import "server-only";
import { formatGroesse, istEigeneFlaeche, parseGroesse, type LeadView, type Zustand } from "@/lib/admin/model";
import { grobeLage } from "@/lib/admin/matching";
import { hinweisAnAnbieter, hinweisAnSuchenden } from "@/lib/admin/texte";
import { GRUSS, einladungsLink, zugangsLink } from "./ablauf";
import { vereinbarungFuer } from "./anbieter-gruppe";
import { pachtFuerLead, wertFuerLead } from "./wert";
import type { NachfassTyp } from "./anfrage-typen";
import * as M from "./model";
import { SPERRE_UNTERSCHRIFT, beideUnterschrieben } from "./schritte";
import * as T from "./texte";
import { antwortToken } from "./token";
import { bewertungFaellig, bewertungsText, kreisDerFlaeche, pachtanzeigeStelle } from "./vorgang";

// Fertige E-Mail-Entwürfe für jeden sinnvollen Schritt. Die Verwaltung kann
// Betreff und Text vor dem Senden ändern und hat drei Wege: „Senden“ (über
// Resend, erst nach Sicherheitsabfrage), „Im Mailprogramm öffnen“ (mailto:) und
// „Kopieren“. Nichts wird automatisch verschickt.

export type MailZweck =
  | "rueckfrage"
  | "einladung"
  | "erinnerung"
  | "hinweis"
  | "freigabe"
  | "pachtvertrag"
  | "kaufabsicht"
  | "anzeige"
  | "bewertung"
  | "nachfassen"
  | "antwort"
  | "ergaenzen"
  | "ankauf"
  | "boerse"
  | "frei";

export const MAIL_ZWECKE: MailZweck[] = ["rueckfrage", "einladung", "erinnerung", "hinweis", "freigabe", "pachtvertrag", "kaufabsicht", "anzeige", "bewertung", "nachfassen", "antwort", "ergaenzen", "ankauf", "boerse", "frei"];

export type Entwurf = {
  id: string;
  zweck: MailZweck;
  rolle?: M.Rolle;
  kundeId: string;
  paarKey?: string;
  titel: string;
  an: string;
  betreff: string;
  text: string;
  /** Tooltip: wofür der Entwurf gedacht ist. */
  tipp: string;
  /** Was beim Senden zusätzlich passiert (Status rückt vor …). */
  wirkung: string;
  /** Zuletzt mit diesem Zweck gesendet. */
  gesendetAm?: string;
  /** Pulsieren: der Schritt ist jetzt dran. */
  faellig?: boolean;
  /** Entwurf ist (noch) nicht sinnvoll — wird ausgegraut mit Begründung. */
  gesperrt?: string;
};

function anrede(name: string): string {
  const n = T.wert(name);
  return n ? `Guten Tag ${n},` : "Guten Tag,";
}

/** Zuletzt erfolgreich gesendet — mit `seit` nur Mails der aktuellen Runde (z. B. seit der Freigabe). */
function zuletzt(mails: M.GesendeteMail[] | undefined, zweck: string, an?: string, seit?: string): string | undefined {
  return mails?.find((m) => m.zweck === zweck && m.ok && (!an || m.an === an) && (!seit || m.am >= seit))?.am;
}

function name(k: M.KundeRecord | null, l: LeadView): string {
  return k?.stammdaten?.name || T.wert(l.name);
}

function kuerzen(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Bezug auf die ursprüngliche Anfrage — steht in jeder Mail an Interessenten (Dennis,
 * 25.09.2026: Kunden wussten nach Wochen nicht mehr, worum es ging). Nur die eigenen
 * Formularangaben des Kunden, nie Übersteuerungen der Verwaltung oder Daten Dritter.
 */
export function anfrageBezug(lead: LeadView, einleitung = "Ihre Anfrage"): string[] {
  const roh = T.wert(lead.groesse);
  const g = parseGroesse(roh);
  // Tippfehler oder fehlende Einheit („15.606 qmm“): gelesene Größe dazuschreiben.
  const groesse = roh && g.unsicher && (g.minHa != null || g.maxHa != null) ? `${roh} (≈ ${formatGroesse(g)})` : roh;
  const typ = T.wert(lead.flaechentyp);
  const flaeche = [typ && typ !== "Sonstiges" ? typ : "", groesse].filter(Boolean).join(", ");
  const lage = [T.wert(lead.ort), T.wert(lead.flurstueck)].filter(Boolean).join(", ");
  const nachricht = T.wert(lead.message);
  return [
    `${einleitung} vom ${T.datumDe(lead.receivedAt)}:`,
    `– Anliegen: ${T.wert(lead.intent) || "—"}`,
    ...(flaeche ? [`– Fläche: ${flaeche}`] : []),
    ...(lage ? [`– Lage: ${lage}`] : []),
    ...(nachricht ? [`– Ihre Nachricht: „${kuerzen(nachricht, 400)}“`] : []),
  ];
}

// ---------------------------------------------------------------------------
// Entwürfe je Anfrage (Kunde)

/** Die beiden Wege für Eigentümer (Dennis 27.09.2026) — wahrheitsgemäß getrennt benannt. */
export function wegeSatz(art: M.Art | null): string {
  return art === "pacht"
    ? "Zu Ihren Möglichkeiten: Wir vermitteln Ihre Fläche an einen passenden Pächter — für Sie als Eigentümer kostenlos; nur der Pächter zahlt im Erfolgsfall eine Provision. Möchten Sie lieber verkaufen, kauft die TR Vertriebs GmbH (Betreiberin von Lippe Forst) geeignete Flächen auch selbst — dann ohne Makler und ohne Provision."
    : "Sie haben zwei Wege: Die TR Vertriebs GmbH (Betreiberin von Lippe Forst) kauft geeignete Flächen auch selbst — dann ohne Makler und ohne Provision. Oder wir vermitteln Ihre Fläche an einen passenden Käufer — für Sie als Eigentümer ebenfalls kostenlos; nur der Käufer zahlt im Erfolgsfall eine Provision.";
}

/** Provision für Suchende mit Rechenbeispiel (brutto), wie im Nachweisvertrag. */
export function provisionMitBeispiel(art: M.Art, k: M.Konditionen): string {
  const text = M.konditionenText(art, k);
  if (art === "pacht") {
    const b = M.provisionBerechnen("pacht", 2000, k);
    return `${text} — ein Beispiel: 5 ha × 400 € = 2.000 € Jahrespacht, Provision ${M.euro(b.netto)} zzgl. USt = ${M.euro(b.brutto)} einmalig`;
  }
  const b = M.provisionBerechnen("kauf", 100_000, k);
  return `${text} (zusammen ${M.bruttoText("kauf", k).replace(/ \(Gesamtbetrag.*$/, "")} inkl. USt) — ein Beispiel: bei 100.000 € Kaufpreis ${M.euro(b.brutto)} einmalig`;
}

/** Anonyme Eckdaten der Flächen, die zu einem Gesuch schon vorgemerkt sind (für die Einladung des Suchenden). */
export function vorgemerkteFlaechen(gesuchId: string, zustand: Zustand, leads: LeadView[]): string[] {
  const byId = new Map(leads.map((l) => [l.id, l]));
  const out: string[] = [];
  for (const [key, m] of Object.entries(zustand.paare)) {
    const [aId, gId] = key.split("~");
    if (gId !== gesuchId || (m.status !== "vorgemerkt" && m.status !== "angefragt")) continue;
    const a = byId.get(aId);
    if (!a) continue;
    const e = T.anonymeEckdaten(a, grobeLage(a, zustand.orte));
    out.push(`${e.typ}, ${e.groesse}, Raum ${e.lage}, ${e.art}${istEigeneFlaeche(a, a.meta) ? " — eigene Fläche des Geschäftsführers, ohne Provision" : ""}`);
  }
  return out;
}

export function entwuerfeKunde(opts: {
  lead: LeadView;
  kunde: M.KundeRecord | null;
  einstellungen: M.Einstellungen;
  basis: string;
  /** Alle Kundenakten — für Anbieter mit mehreren Flächen („Fläche bestätigen“ statt Einladung). */
  kunden?: Iterable<M.KundeRecord>;
  /** Für die Einladung Suchender: schon vorgemerkte Flächen (anonyme Eckdaten). */
  vorschlaege?: string[];
}): Entwurf[] {
  const { lead, kunde, einstellungen, basis } = opts;
  const rr = T.rolleVonLead(lead);
  const an = kunde?.email || T.wert(lead.email);
  if (!rr || !an) return [];
  const liste: Entwurf[] = [];
  const nm = name(kunde, lead);
  const suchender = rr.rolle === "suchender";

  // Rückfrage (Größe, Lage, Flurstück)
  liste.push({
    id: `rueckfrage:${lead.id}`,
    zweck: "rueckfrage",
    rolle: rr.rolle,
    kundeId: lead.id,
    titel: "Rückfrage zu Größe und Lage",
    an,
    betreff: "Rückfrage zu Ihrer Anfrage bei Lippe Forst",
    text: [
      anrede(nm),
      "",
      `vielen Dank für Ihre Anfrage. Damit wir ${suchender ? "passende Flächen" : "Ihre Fläche richtig einschätzen"} ${suchender ? "finden" : "können"}, bräuchten wir noch ein paar Angaben:`,
      "",
      ...(suchender
        ? [
            "– Welche Größe suchen Sie (von … bis … Hektar)?",
            "– In welchen Orten bzw. in welchem Umkreis darf die Fläche liegen?",
            `– Ab wann und für wie lange möchten Sie ${rr.art === "kauf" ? "kaufen" : "pachten"}? Was möchten Sie auf der Fläche bewirtschaften?`,
          ]
        : [
            "– Wie groß ist die Fläche genau (in Hektar)?",
            "– Wo liegt sie (Gemarkung, Flur, Flurstück — steht z. B. im Grundsteuerbescheid)?",
            "– Ist sie derzeit verpachtet oder frei? Gibt es laufende Förderverpflichtungen (z. B. Vertragsnaturschutz)?",
          ]),
      "",
      "Eine kurze Antwort auf diese E-Mail genügt.",
      "",
      ...anfrageBezug(lead),
      "",
      GRUSS,
    ].join("\n"),
    tipp: "Fragt fehlende Angaben (Größe, Lage/Flurstück, Zeitraum) nach — ändert keinen Status.",
    wirkung: "Die Mail wird im Verlauf der Anfrage gespeichert; eine neue Anfrage wird auf „Beantwortet“ gesetzt.",
    gesendetAm: zuletzt(kunde?.mails, "rueckfrage"),
  });

  // Direktankauf gewählt (Weiche „Selbst kaufen“): statt Einladung ein Kaufangebot bzw. dessen Ankündigung.
  if (!suchender && lead.meta.weg === "ankauf") {
    const w = wertFuerLead(lead);
    const preis = lead.meta.ankauf?.preis ?? null;
    liste.push({
      id: `ankauf:${lead.id}`,
      zweck: "ankauf",
      rolle: rr.rolle,
      kundeId: lead.id,
      titel: "Direktankauf: Kaufangebot bzw. nächste Schritte",
      an,
      betreff: preis ? "Unser Kaufangebot für Ihre Fläche — Lippe Forst" : "Ihre Fläche: Wir kaufen selbst — Lippe Forst",
      text: [
        anrede(nm),
        "",
        "vielen Dank für Ihre Anfrage. Für Ihre Fläche kommt ein Direktankauf in Frage: Die TR Vertriebs GmbH (Betreiberin von Lippe Forst) kauft sie selbst — ohne Makler und ohne Provision.",
        "",
        ...(w ? [`Zur Einordnung: ${w.satz}`, ""] : []),
        preis
          ? `Wir bieten Ihnen für die Fläche ${M.euro(preis)} (Kaufpreis, Notar- und Grundbuchkosten übernehmen wir). Das Angebot ist unverbindlich, bis der Kaufvertrag beim Notar beurkundet ist.`
          : "Damit wir Ihnen ein konkretes Kaufangebot machen können, sehen wir uns die Fläche genauer an. Hilfreich sind die Flurstücksangaben (Gemarkung, Flur, Flurstück) und ob die Fläche derzeit verpachtet ist.",
        "",
        "Möchten Sie die Fläche lieber an einen anderen Käufer oder Pächter vermitteln lassen? Auch das geht — für Sie als Eigentümer kostenlos; dann zahlt nur der Käufer bzw. Pächter im Erfolgsfall eine Provision.",
        "",
        "Eine kurze Antwort auf diese E-Mail genügt.",
        "",
        ...anfrageBezug(lead),
        "",
        GRUSS,
      ].join("\n"),
      tipp: "Direktankauf durch die TR Vertriebs GmbH: Kaufangebot (mit Preis, falls eingetragen) oder die nächsten Schritte — ohne Makler, ohne Provision.",
      wirkung: "Die Mail wird im Verlauf gespeichert; eine neue Anfrage wird auf „Beantwortet“ gesetzt.",
      gesendetAm: zuletzt(kunde?.mails, "ankauf"),
      faellig: !zuletzt(kunde?.mails, "ankauf"),
    });
    return liste;
  }

  // Anbieter mit schon unterschriebener Vereinbarung über eine andere Fläche: nur bestätigen lassen.
  const vereinbarung = !suchender && opts.kunden ? vereinbarungFuer(lead, kunde, opts.kunden) : null;
  const unterschrieben = Boolean(kunde?.vertrag);
  if (vereinbarung && !unterschrieben) {
    const gesendet = zuletzt(kunde?.mails, "ergaenzen");
    liste.push({
      id: `ergaenzen:${lead.id}`,
      zweck: "ergaenzen",
      rolle: rr.rolle,
      kundeId: lead.id,
      titel: "Weitere Fläche zur Vereinbarung bestätigen lassen",
      an,
      betreff: `${gesendet ? "Erinnerung: " : ""}Ihre weitere Fläche bei Lippe Forst — bitte kurz bestätigen`,
      text: [
        anrede(nm),
        "",
        `vielen Dank für Ihre Anfrage zu einer weiteren Fläche (${T.angebotText(lead) || "siehe unten"}). Ihre kostenlose Vereinbarung mit Lippe Forst haben Sie bereits für Ihre Fläche aus Vorgang ${vereinbarung.id} bestätigt. Soll sie auch für diese Fläche gelten, genügt ein Klick in Ihrem Kundenbereich — eine neue Unterschrift ist nicht nötig:`,
        zugangsLink({ id: lead.id } as M.KundeRecord, basis),
        "(Der Link ist 14 Tage gültig und funktioniert einmal; danach melden Sie sich einfach mit Ihrer E-Mail-Adresse an.)",
        "",
        "Möchten Sie das nicht, genügt eine kurze Antwort.",
        "",
        ...anfrageBezug(lead),
        "",
        GRUSS,
      ].join("\n"),
      tipp: "Der Anbieter hat die Vereinbarung schon über eine andere Fläche bestätigt — er erstreckt sie mit einem Klick auf diese (nie automatisch).",
      wirkung: "Vermerkt die Mail in der Kundenakte (legt sie bei Bedarf an).",
      gesendetAm: gesendet,
      faellig: !gesendet,
    });
    return liste;
  }

  // Einladung / Erinnerung
  const link = kunde ? einladungsLink(kunde, basis) : null;
  const k = M.aktuelleKonditionen(einstellungen);
  const bis = kunde?.einladung ? T.datumDe(kunde.einladung.bis) : "";
  // Ein abgelaufener Link darf nicht mehr verschickt werden (der Server lehnt ihn ebenfalls ab).
  const abgelaufen = Boolean(kunde?.einladung && Date.parse(kunde.einladung.bis) < Date.now());
  const linkAbgelaufen = abgelaufen
    ? `Der Einladungslink ist am ${bis} abgelaufen — erst in der Anfrage „Neuen Link erstellen“ oder im Assistenten des Vorgangs „Erinnerung senden“ (erstellt den neuen Link automatisch).`
    : undefined;
  const vorschlaege = opts.vorschlaege ?? [];
  const wert = !suchender ? (rr.art === "pacht" ? pachtFuerLead(lead) : wertFuerLead(lead)) : null;
  const einladungText = suchender
    ? [
        anrede(nm),
        "",
        `vielen Dank für Ihr Interesse an ${rr.art === "kauf" ? "Flächen zum Kauf" : "Pachtflächen"} über Lippe Forst. Damit wir Ihnen passende Flächen vorstellen und — mit Zustimmung beider Seiten — den Kontakt zum Eigentümer herstellen dürfen, schließen wir mit Ihnen online einen kurzen Nachweisvertrag.`,
        "",
        ...(vorschlaege.length
          ? [
              vorschlaege.length === 1 ? "Eine passende Fläche haben wir schon für Sie vorgemerkt:" : "Passende Flächen haben wir schon für Sie vorgemerkt:",
              ...vorschlaege.map((v) => `– ${v}`),
              "Namen, Flurstück und genaue Lage nennen wir nach Ihrem Nachweisvertrag und der Zustimmung beider Seiten.",
              "",
            ]
          : []),
        "Das Wichtigste vorab:",
        `– Provision nur im Erfolgsfall: ${provisionMitBeispiel(rr.art, k)}. Fällig 14 Tage nach Rechnung; kommt kein Vertrag zustande, zahlen Sie nichts. Für Flächen, die dem Geschäftsführer von Lippe Forst bzw. seiner Familie gehören, fällt keine Provision an.`,
        "– Flächen stellen wir Ihnen zuerst anonym vor. Kontaktdaten geben wir nur frei, wenn Sie und der Eigentümer zustimmen.",
        "– Sie können jederzeit kündigen. Als Verbraucher haben Sie außerdem ein 14-tägiges Widerrufsrecht; ohne ausdrücklichen Beginnwunsch geben wir Kontakte erst nach Ablauf der Widerrufsfrist frei.",
        "",
        `Ihr persönlicher Link${bis ? ` (gültig bis ${bis})` : ""}:`,
        link ?? "[Link erscheint nach „Einladung erstellen“]",
        "",
        "Dort ergänzen Sie Ihre Anschrift, lesen den vollständigen Nachweisvertrag und unterschreiben mit Ihrem Namen. Den Vertrag erhalten Sie anschließend als PDF per E-Mail.",
        "",
        "Bei Fragen antworten Sie einfach auf diese E-Mail.",
        "",
        ...anfrageBezug(lead),
        "",
        GRUSS,
      ]
    : [
        anrede(nm),
        "",
        `vielen Dank für Ihre Anfrage ${rr.art === "kauf" ? "zum Verkauf" : "zur Verpachtung"} Ihrer Fläche.`,
        "",
        ...(wert ? [`Unsere erste Einschätzung: ${wert.satz}`, ""] : []),
        wegeSatz(rr.art),
        "",
        `Für die Vermittlung brauchen wir Ihr Einverständnis in Form einer kurzen, kostenlosen Vereinbarung:`,
        "– Sie zahlen nichts — keine Provision, keine Gebühren.",
        "– Ihre Kontaktdaten und die genaue Lage der Fläche geben wir erst weiter, wenn Sie dem konkreten Interessenten zugestimmt haben.",
        "– Sie können jederzeit aussteigen. Kommt innerhalb von 24 Monaten nach einer Freigabe ein Vertrag mit einem von uns nachgewiesenen Interessenten zustande, teilen Sie uns das bitte kurz mit — auch nach einem Ausstieg; Kosten entstehen Ihnen dadurch nicht.",
        "",
        `Ihr persönlicher Link${bis ? ` (gültig bis ${bis})` : ""}:`,
        link ?? "[Link erscheint nach „Einladung erstellen“]",
        "",
        "Dort ergänzen Sie Anschrift und Flurstücke (gern auch Ihre Preis- bzw. Pachtvorstellung, ab wann die Fläche frei ist und die Ackerzahl), lesen die Vereinbarung und bestätigen sie kostenlos mit Ihrem Namen. Sie erhalten sie anschließend als PDF per E-Mail.",
        "",
        // Die Flächenbörse gibt es für Verkauf und Verpachtung — der Satz gilt für jeden Anbieter.
        "Auf Wunsch zeigen wir Ihre Fläche außerdem anonym in der Flächenbörse auf lippeforst.de — nur mit Flächentyp, gerundeter Größe und Gemeinde, nie mit Namen oder Flurstück. Dafür genügt ein Häkchen bei den Angaben im Kundenbereich.",
        "",
        "Bei Fragen antworten Sie einfach auf diese E-Mail.",
        "",
        ...anfrageBezug(lead),
        "",
        GRUSS,
      ];
  // Nach der Unterschrift ist die Einladung erledigt — dann kein Entwurf mehr (Versand steht im Verlauf).
  if (!unterschrieben) liste.push({
    id: `einladung:${lead.id}`,
    zweck: "einladung",
    rolle: rr.rolle,
    kundeId: lead.id,
    titel: suchender ? "Einladung: Nachweisvertrag online abschließen" : "Einladung: Vereinbarung für Anbieter (kostenlos)",
    an,
    betreff: suchender ? "Ihr persönlicher Zugang bei Lippe Forst — Nachweisvertrag online abschließen" : "Ihre Fläche bei Lippe Forst — erste Einschätzung und kostenlose Vereinbarung",
    text: einladungText.join("\n"),
    tipp: "Schickt den persönlichen Einladungslink zum Kundenbereich (Angaben, Vertrag lesen, online unterschreiben).",
    wirkung: "Vermerkt „Einladung gesendet“ in der Kundenakte.",
    gesendetAm: kunde?.einladung?.gesendetAm,
    faellig: Boolean(link && !abgelaufen && !kunde?.einladung?.gesendetAm),
    gesperrt: kunde?.einladung?.ueber
      ? `Die Einladung läuft über Anfrage ${kunde.einladung.ueber} (gleicher Anbieter) — eine Vereinbarung gilt für alle seine Flächen, keine zweite Mail.`
      : !link
        ? "Erst „Einladung erstellen“ klicken — dann steht der persönliche Link im Text."
        : linkAbgelaufen,
  });
  if (kunde?.einladung && !unterschrieben && link) {
    liste.push({
      id: `erinnerung:${lead.id}`,
      zweck: "erinnerung",
      rolle: rr.rolle,
      kundeId: lead.id,
      titel: "Erinnerung an die Unterschrift",
      an,
      betreff: "Erinnerung: Ihr Zugang bei Lippe Forst",
      text: [
        anrede(nm),
        "",
        `vor einigen Tagen haben wir Ihnen Ihren persönlichen Zugang geschickt. ${suchender ? "Sobald der Nachweisvertrag unterschrieben ist, können wir Ihnen passende Flächen vorstellen." : "Sobald die Vereinbarung bestätigt ist, können wir Ihre Fläche Interessenten vorstellen — für Sie kostenlos."}`,
        "",
        `Ihr Link (gültig bis ${bis}):`,
        link,
        "",
        "Haben Sie Fragen oder möchten Sie doch nicht? Eine kurze Antwort genügt.",
        "",
        ...anfrageBezug(lead),
        "",
        GRUSS,
      ].join("\n"),
      tipp: "Freundliche Erinnerung mit demselben Einladungslink.",
      wirkung: "Wird im Verlauf der Anfrage gespeichert.",
      gesendetAm: zuletzt(kunde.mails, "erinnerung"),
      gesperrt: kunde.einladung.ueber ? `Die Einladung läuft über Anfrage ${kunde.einladung.ueber} (gleicher Anbieter) — dort erinnern, keine zweite Mail.` : linkAbgelaufen,
    });
  }
  return liste;
}

// ---------------------------------------------------------------------------
// Entwürfe je Paar (Vorgang)

export function entwuerfePaar(opts: {
  key: string;
  angebot: LeadView;
  gesuch: LeadView;
  anbieter: M.KundeRecord | null;
  suchender: M.KundeRecord | null;
  vorgang: M.VorgangRecord | null;
  meta: { status: string } | null;
  zustand: Zustand;
  einstellungen: M.Einstellungen;
  basis: string;
  bewertungsUrl: string | null;
}): Entwurf[] {
  const { key, angebot, gesuch, anbieter, suchender, vorgang, zustand, basis } = opts;
  const status = opts.meta?.status ?? "vorschlag";
  const art: M.Art = angebot.art === "kauf" ? "kauf" : "pacht";
  const liste: Entwurf[] = [];
  const anS = suchender?.email || T.wert(gesuch.email);
  const anA = anbieter?.email || T.wert(angebot.email);
  const lageA = grobeLage(angebot, zustand.orte);
  const lageG = grobeLage(gesuch, zustand.orte);

  /** Link zum Zustimmen im anonymen Hinweis: Direktzugang zum Kundenbereich (14 Tage, einmal). Hinweise gehen erst nach beiden Unterschriften raus. */
  function zustimmungsLink(k: M.KundeRecord | null): string | null {
    return k?.vertrag ? zugangsLink(k, basis, key) : null;
  }

  // Anonyme Hinweise erst nach Schritt 3: beide haben unterschrieben (Suchender: Provisionsvereinbarung).
  const hinweisSperre = beideUnterschrieben(anbieter, suchender) ? undefined : SPERRE_UNTERSCHRIFT;
  // Schon einmal gesendet? Dann geht derselbe Text als Erinnerung raus.
  const nochmal = (gesendet: string | undefined) => (gesendet ? "Erinnerung: " : "");
  if (status === "vorschlag" || status === "vorgemerkt" || status === "angefragt") {
    if (anS) {
      liste.push({
        id: `hinweis-s:${key}`,
        zweck: "hinweis",
        rolle: "suchender",
        kundeId: gesuch.id,
        paarKey: key,
        titel: `Anonymer Hinweis an ${T.wert(gesuch.name) || "Suchenden"}`,
        an: anS,
        betreff: `${nochmal(vorgang?.hinweise?.suchender)}Passende Fläche zu Ihrem Gesuch — Lippe Forst`,
        text: hinweisAnSuchenden(angebot, gesuch, lageA, zustimmungsLink(suchender)),
        tipp: "Anonymer Hinweis an den Suchenden: nur Gemeinde, Typ, Größe, Art — kein Name, kein Flurstück.",
        wirkung: "Vermerkt den Hinweis im Vorgang; sind beide Hinweise gesendet, wechselt das Paar auf „Angefragt“.",
        gesendetAm: vorgang?.hinweise?.suchender,
        faellig: !hinweisSperre && status !== "vorschlag" && !vorgang?.hinweise?.suchender,
        gesperrt: hinweisSperre,
      });
    }
    if (anA) {
      liste.push({
        id: `hinweis-a:${key}`,
        zweck: "hinweis",
        rolle: "anbieter",
        kundeId: angebot.id,
        paarKey: key,
        titel: `Anonymer Hinweis an ${T.wert(angebot.name) || "Anbieter"}`,
        an: anA,
        betreff: `${nochmal(vorgang?.hinweise?.anbieter)}Interessent für Ihre Fläche — Lippe Forst`,
        text: hinweisAnAnbieter(angebot, gesuch, lageG, zustimmungsLink(anbieter)),
        tipp: "Anonymer Hinweis an den Anbieter: nur Gemeinde, Typ, Größe, Art des Gesuchs — kein Name.",
        wirkung: "Vermerkt den Hinweis im Vorgang; sind beide Hinweise gesendet, wechselt das Paar auf „Angefragt“.",
        gesendetAm: vorgang?.hinweise?.anbieter,
        faellig: !hinweisSperre && status !== "vorschlag" && !vorgang?.hinweise?.anbieter,
        gesperrt: hinweisSperre,
      });
    }
  }

  const frei = M.aktiveFreigabe(vorgang);
  if (frei) {
    const eckdaten = `${formatGroesse(angebot.groesseWert)} ${angebot.typ === "Wiese / Grünland" ? "Grünland" : angebot.typ} im Raum ${lageA || "Lippe"}`;
    const eigen = istEigeneFlaeche(angebot, angebot.meta);
    // Wald: Die Online-Vorlage ist ein Landpachtvertrag für landwirtschaftliche Flächen (§ 585 BGB).
    const wald = /wald|forst/i.test(angebot.typ);
    const k = suchender?.vertrag?.konditionen ?? null;
    const provisionSatz = eigen
      ? "Für diese Fläche fällt keine Provision an: Sie gehört dem Geschäftsführer von Lippe Forst bzw. seiner Familie."
      : k
        ? `Zur Provision laut Ihrem Nachweisvertrag: Kommt ein ${art === "kauf" ? "Kaufvertrag" : "Pachtvertrag"} zustande, beträgt sie ${M.konditionenText(art, k)} — zusammen ${M.bruttoText(art, k)}. Wir stellen sie nach dem ${art === "kauf" ? "Wirksamwerden des Kaufvertrags" : "Vertragsschluss"} in Rechnung; zahlbar ${M.ZAHLUNGSZIEL_TAGE} Tage nach Zugang der Rechnung. Kommt kein Vertrag zustande, zahlen Sie nichts.`
        : "";
    const abschlussSatz =
      art === "kauf"
        ? "Wenn Sie sich einig werden, bereiten Sie den Kauf über den Notar vor — auf Wunsch fassen wir die Eckdaten vorher für den Notar zusammen."
        : wald
          ? "Wenn Sie sich einig werden, schließen Sie den Pachtvertrag bitte direkt miteinander (unsere Online-Vorlage ist ein Landpachtvertrag für landwirtschaftliche Flächen und passt für Wald in der Regel nicht)."
          : "Wenn Sie sich einig werden, können Sie den Pachtvertrag auf Wunsch online über Lippe Forst abschließen.";
    for (const seite of [
      { k: suchender, l: gesuch, an: anS, rolle: "suchender" as const },
      { k: anbieter, l: angebot, an: anA, rolle: "anbieter" as const },
    ]) {
      if (!seite.k || !seite.an) continue;
      const zugang = zugangsLink(seite.k, basis, key);
      liste.push({
        id: `freigabe-${seite.rolle}:${key}`,
        zweck: "freigabe",
        rolle: seite.rolle,
        kundeId: seite.l.id,
        paarKey: key,
        titel: `Freigabe-Mitteilung an ${name(seite.k, seite.l)}`,
        an: seite.an,
        betreff: seite.rolle === "suchender" ? `Kontakt freigegeben: ${eckdaten}` : "Kontakt freigegeben: Ihr Interessent",
        text: [
          anrede(name(seite.k, seite.l)),
          "",
          seite.rolle === "suchender"
            ? `gute Nachrichten: Der Eigentümer der Fläche (${eckdaten}) ist mit einem Kontakt einverstanden. Name, Telefonnummer, E-Mail-Adresse und die Flurstücke finden Sie ab sofort in Ihrem Kundenbereich.`
            : "gute Nachrichten: Der Interessent ist mit einem Kontakt einverstanden. Seinen Namen und seine Kontaktdaten finden Sie ab sofort in Ihrem Kundenbereich; er hat Ihre Kontaktdaten und die Flurstücke ebenfalls erhalten.",
          "",
          `Direkt zum Kundenbereich (der Link ist 14 Tage gültig und funktioniert einmal; danach melden Sie sich einfach mit Ihrer E-Mail-Adresse an):`,
          zugang,
          "",
          `Bitte nehmen Sie direkt miteinander Kontakt auf. ${abschlussSatz}${seite.rolle === "suchender" ? " Bitte melden Sie uns einen Vertragsschluss kurz im Kundenbereich („Vertragsschluss melden“)." : " Kommt ein Vertrag zustande, teilen Sie uns das bitte kurz mit — Kosten entstehen Ihnen dadurch nicht."}`,
          ...(seite.rolle === "suchender" && provisionSatz ? ["", provisionSatz] : []),
          "",
          GRUSS,
        ].join("\n"),
        tipp: "Teilt mit, dass die Kontaktdaten im Kundenbereich freigegeben sind (die Daten selbst stehen nicht in der Mail).",
        wirkung: "Wird im Verlauf des Vorgangs gespeichert.",
        // Nur Mitteilungen seit der aktuellen Freigabe zählen (nach „Freigabe zurückziehen“ beginnt eine neue Runde).
        gesendetAm: zuletzt(vorgang?.mails, "freigabe", seite.an, vorgang?.freigabe?.am),
        faellig: !zuletzt(vorgang?.mails, "freigabe", seite.an, vorgang?.freigabe?.am),
      });
    }
  }

  const pv = vorgang?.pachtvertrag;
  if (pv?.status === "zur_unterschrift") {
    for (const seite of [
      { k: anbieter, l: angebot, an: anA, rolle: "anbieter" as const, feld: "verpaechter" as const, wer: "Verpächter" },
      { k: suchender, l: gesuch, an: anS, rolle: "suchender" as const, feld: "paechter" as const, wer: "Pächter" },
    ]) {
      if (!seite.k || !seite.an || pv.unterschriften[seite.feld]) continue;
      // Runde = seit „Zur Unterschrift freigeben“ (geaendertAm); frühere Runden zählen nicht.
      const gesendet = zuletzt(vorgang?.mails, "pachtvertrag", seite.an, pv.geaendertAm);
      liste.push({
        id: `pacht-${seite.rolle}:${key}`,
        zweck: "pachtvertrag",
        rolle: seite.rolle,
        kundeId: seite.l.id,
        paarKey: key,
        titel: `Pachtvertrag zur Unterschrift an ${name(seite.k, seite.l)} (${seite.wer})`,
        an: seite.an,
        betreff: `${nochmal(gesendet)}Ihr Landpachtvertrag liegt zur Unterschrift bereit`,
        text: [
          anrede(name(seite.k, seite.l)),
          "",
          `${gesendet ? "eine kurze Erinnerung: Der Landpachtvertrag liegt" : "der Landpachtvertrag ist vorbereitet und liegt"} in Ihrem Kundenbereich zur Prüfung und Unterschrift bereit. Bitte lesen Sie ihn in Ruhe. Änderungswünsche können Sie uns dort über „Rückfrage“ schicken.`,
          "",
          "Direkt zum Kundenbereich (der Link ist 14 Tage gültig und funktioniert einmal):",
          zugangsLink(seite.k, basis, key),
          "",
          "Der Vertrag wird in Textform geschlossen (§ 585a BGB) und kommt zustande, sobald beide Seiten unterschrieben haben. Beide erhalten ihn dann als PDF.",
          "",
          GRUSS,
        ].join("\n"),
        tipp: `Bittet den ${seite.wer} um die Online-Unterschrift des Pachtvertrags.`,
        wirkung: "Wird im Verlauf des Vorgangs gespeichert.",
        gesendetAm: gesendet,
        faellig: !gesendet,
      });
    }
  }
  if (pv?.status === "abgeschlossen" && !pv.anzeigeErledigtAm && anbieter && anA) {
    liste.push({
      id: `anzeige:${key}`,
      zweck: "anzeige",
      rolle: "anbieter",
      kundeId: angebot.id,
      paarKey: key,
      titel: "Erinnerung an die Pachtanzeige (§ 2 LPachtVG)",
      an: anA,
      betreff: "Erinnerung: Anzeige Ihres Pachtvertrags",
      text: [
        anrede(name(anbieter, angebot)),
        "",
        `der Pachtvertrag vom ${T.datumDe(pv.abgeschlossenAm)} ist nach § 2 Landpachtverkehrsgesetz binnen eines Monats nach Abschluss anzuzeigen — zuständig ist ${pachtanzeigeStelle(pv.daten.anzeigeKreis ?? kreisDerFlaeche(angebot))}. Die Anzeige ist Sache des Verpächters; den Vertrag als PDF finden Sie in Ihrem Kundenbereich. Verträge über Flächen bis 1 ha sind in Nordrhein-Westfalen von der Anzeigepflicht ausgenommen.`,
        "",
        "Ist die Anzeige schon erledigt, betrachten Sie diese E-Mail bitte als gegenstandslos.",
        "",
        GRUSS,
      ].join("\n"),
      tipp: "Erinnert den Verpächter an die Anzeigepflicht nach dem Landpachtverkehrsgesetz.",
      wirkung: "Wird im Verlauf des Vorgangs gespeichert.",
      gesendetAm: zuletzt(vorgang?.mails, "anzeige"),
    });
  }

  const kauf = vorgang?.kauf;
  if (kauf?.status === "zur_bestaetigung") {
    for (const seite of [
      { k: anbieter, l: angebot, an: anA, rolle: "anbieter" as const, feld: "verkaeufer" as const, wer: "Verkäufer" },
      { k: suchender, l: gesuch, an: anS, rolle: "suchender" as const, feld: "kaeufer" as const, wer: "Käufer" },
    ]) {
      if (!seite.k || !seite.an || kauf.bestaetigungen[seite.feld]) continue;
      const gesendet = zuletzt(vorgang?.mails, "kaufabsicht", seite.an, kauf.geaendertAm);
      liste.push({
        id: `kauf-${seite.rolle}:${key}`,
        zweck: "kaufabsicht",
        rolle: seite.rolle,
        kundeId: seite.l.id,
        paarKey: key,
        titel: `Kaufabsicht bestätigen: ${name(seite.k, seite.l)} (${seite.wer})`,
        an: seite.an,
        betreff: `${nochmal(gesendet)}Eckdaten für den Notar — bitte kurz bestätigen`,
        text: [
          anrede(name(seite.k, seite.l)),
          "",
          gesendet
            ? "eine kurze Erinnerung: Die Eckdaten für den Kaufvertrag liegen in Ihrem Kundenbereich zur Bestätigung bereit — die Bestätigung ist unverbindlich; der Kaufvertrag entsteht erst beim Notar."
            : "wir haben die besprochenen Eckdaten für den Kaufvertrag zusammengefasst. Bitte prüfen und bestätigen Sie sie in Ihrem Kundenbereich — die Bestätigung ist unverbindlich; der Kaufvertrag entsteht erst beim Notar.",
          "",
          "Direkt zum Kundenbereich (der Link ist 14 Tage gültig und funktioniert einmal):",
          zugangsLink(seite.k, basis, key),
          "",
          GRUSS,
        ].join("\n"),
        tipp: `Bittet den ${seite.wer}, die unverbindlichen Eckdaten für den Notar zu bestätigen.`,
        wirkung: "Wird im Verlauf des Vorgangs gespeichert.",
        gesendetAm: gesendet,
        faellig: !gesendet,
      });
    }
  }

  // Bitte um Google-Bewertung — ohne Anreiz, ohne Gutschein, an beide Seiten.
  if (vorgang?.abschluss && opts.bewertungsUrl) {
    const faellig = bewertungFaellig(vorgang, opts.einstellungen);
    for (const seite of [
      { k: anbieter, l: angebot, an: anA, rolle: "anbieter" as const },
      { k: suchender, l: gesuch, an: anS, rolle: "suchender" as const },
    ]) {
      if (!seite.k || !seite.an || seite.k.widerruf) continue;
      const { betreff, text } = bewertungsText(name(seite.k, seite.l), art, opts.bewertungsUrl);
      const gesendet = vorgang.bewertung?.[seite.rolle];
      const erlaubt = M.bewertungsmailErlaubt(seite.k);
      liste.push({
        id: `bewertung-${seite.rolle}:${key}`,
        zweck: "bewertung",
        rolle: seite.rolle,
        kundeId: seite.l.id,
        paarKey: key,
        titel: `Bitte um Google-Bewertung an ${name(seite.k, seite.l)}`,
        an: seite.an,
        betreff,
        text,
        tipp: "Freundliche Bitte um eine ehrliche Google-Bewertung — ohne Gegenleistung, ohne Vorgaben zu Sternen oder Inhalt.",
        wirkung: "Vermerkt die Bitte im Vorgang (wird nicht erneut vorgeschlagen).",
        gesendetAm: gesendet,
        faellig: erlaubt && faellig.includes(seite.rolle),
        gesperrt: !erlaubt
          ? "Keine Einwilligung in Bewertungs-E-Mails (oder Widerspruch) — eine solche Mail wäre Werbung ohne Einwilligung (§ 7 UWG). Die Bitte erscheint nur im Kundenbereich."
          : !gesendet && !faellig.includes(seite.rolle)
            ? `Frühestens ${opts.einstellungen.bewertung?.nachTagen ?? 3} Tage nach dem Abschluss.`
            : undefined,
      });
    }
  }
  // Hat eine Seite ihren Vertrag widerrufen (und ist noch nichts geschlossen), gehen keine
  // Freigabe-, Vertrags- oder Eckdaten-Mitteilungen mehr heraus.
  if ((anbieter?.widerruf || suchender?.widerruf) && !vorgang?.abschluss) {
    for (const e of liste) {
      if (e.zweck === "freigabe" || e.zweck === "pachtvertrag" || e.zweck === "kaufabsicht") {
        e.gesperrt = "Eine Seite hat ihren Vertrag mit Lippe Forst widerrufen — diese Mitteilung nicht mehr senden.";
        e.faellig = false;
      }
    }
  }
  return liste;
}

// ---------------------------------------------------------------------------
// Nachfass-Mail (Dashboard „Nachfassen“): fragt nur, ob zur eigenen Anfrage noch
// Interesse besteht — keine allgemeine Werbung, keine Telefonnummer. Im Text
// stehen nur die Formularangaben des Kunden, nie Übersteuerungen der Verwaltung.
// Der persönliche Antwort-Link führt zu /kunde/antwort; jede Antwort wird im
// Dashboard zum Ticket (lib/portal/rueckmeldung.ts).

const FLAECHENTYP_KURZ: Record<string, string> = { Ackerland: "Ackerland", "Wiese / Grünland": "Grünland", "Wald / Forst": "Wald", Bauland: "Bauland" };

const BERATUNG_GRUND: Record<string, string> = {
  "Energiepacht (Solar/Wind)": "wegen einer Energiepacht (Solar/Wind)",
  "VNS / Ökopunkte": "wegen Vertragsnaturschutz bzw. Ökopunkten",
  Lohnunternehmer: "wegen der Vermittlung eines Lohnunternehmers",
  "Bauland-Beratung": "wegen einer Bauland-Beratung",
};

/**
 * Art der Nachfass-Mail — aus der Einordnung der Anfrage (Angebot/Gesuch mit Kauf oder Pacht). Bei einer
 * allgemeinen Anfrage zählt die Nachricht („Würde gern verkaufen“ → Verkauf), sonst Beratung.
 */
export function nachfassTyp(lead: LeadView): NachfassTyp {
  const rr = T.rolleVonLead(lead);
  if (rr?.rolle === "anbieter") return rr.art === "kauf" ? "verkauf" : "verpachtung";
  if (rr?.rolle === "suchender") return rr.art === "kauf" ? "suche-kauf" : "suche-pacht";
  const nachricht = T.wert(lead.message);
  if (T.wert(lead.intent) === "Allgemein" || !T.wert(lead.intent)) {
    if (/verkauf|veräußer/i.test(nachricht)) return "verkauf";
    if (/\bverpachten\b|zu verpachten|zur pacht (geben|anbieten)/i.test(nachricht)) return "verpachtung";
  }
  return "beratung";
}

/** Persönlicher Antwort-Link der Nachfass-Mail — die Antwort wird im Dashboard zum Ticket („Rückmeldungen“). */
export function antwortLink(anfrageId: string, basis: string): string {
  return `${basis}/kunde/antwort?t=${encodeURIComponent(antwortToken(anfrageId))}`;
}

/** Was die Antwortseite zur Auswahl anbietet — für den Satz vor dem Link. */
const ANTWORT_AUSWAHL: Record<NachfassTyp, string> = {
  verkauf: "Verkauf, Verpachtung, eine Beratung oder „kein Interesse“",
  verpachtung: "Verpachtung, Verkauf, eine Beratung oder „kein Interesse“",
  "suche-pacht": "„Ich suche weiter“, eine Beratung oder „kein Interesse“",
  "suche-kauf": "„Ich suche weiter“, eine Beratung oder „kein Interesse“",
  beratung: "eine Beratung mit Thema, Verkauf, Verpachtung oder „kein Interesse“",
};

export function nachfassEntwurf(lead: LeadView, kunde: M.KundeRecord | null, basis: string): { typ: NachfassTyp; an: string; betreff: string; text: string } {
  const typ = nachfassTyp(lead);
  const ort = T.wert(lead.ort);
  const roh = T.wert(lead.groesse);
  const gl = parseGroesse(roh);
  // Unsicher gelesene Größe („15.606 qmm“) im Satz als gelesene Hektarzahl — der Originaltext steht im Anfrage-Bezug.
  const groesse = roh && gl.unsicher && (gl.minHa != null || gl.maxHa != null) ? formatGroesse(gl) : roh;
  const klammer = [FLAECHENTYP_KURZ[T.wert(lead.flaechentyp)] ?? "", groesse.length <= 30 ? groesse : ""].filter(Boolean).join(", ");
  const zusatz = (vor: string) => `${ort && ort.length <= 60 ? ` ${vor} ${ort}` : ""}${klammer ? ` (${klammer})` : ""}`;
  const intent = T.wert(lead.intent);
  const grund: Record<NachfassTyp, string> = {
    verkauf: `wegen des Verkaufs Ihrer Fläche${zusatz("in")}`,
    verpachtung: `wegen der Verpachtung Ihrer Fläche${zusatz("in")}`,
    "suche-pacht": `wegen einer Fläche zur Pacht${zusatz("im Raum")}`,
    "suche-kauf": `wegen einer Fläche zum Kauf${zusatz("im Raum")}`,
    beratung: intent === "Bewertung" ? `wegen einer Bewertung Ihrer Fläche${zusatz("in")}` : (BERATUNG_GRUND[intent] ?? "mit einer Anfrage"),
  };
  const frage: Record<NachfassTyp, string> = {
    verkauf: "Haben Sie noch Interesse am Verkauf?",
    verpachtung: "Haben Sie noch Interesse an der Verpachtung?",
    "suche-pacht": "Haben Sie noch Interesse an einer Fläche zur Pacht?",
    "suche-kauf": "Haben Sie noch Interesse an einer Fläche zum Kauf?",
    beratung: intent === "Bewertung" ? "Haben Sie noch Interesse an einer Bewertung?" : "Haben Sie noch Interesse an einer Beratung?",
  };
  // Allgemeine Fragen ohne Bezug zu einer Fläche (kein Flächentyp, kein Ort) nicht mit „Ihre Fläche“ anschreiben.
  const ohneFlaeche = typ === "beratung" && !FLAECHENTYP_KURZ[T.wert(lead.flaechentyp)] && !ort && !["Bewertung", "Energiepacht (Solar/Wind)", "VNS / Ökopunkte", "Bauland-Beratung"].includes(intent);
  return {
    typ,
    an: (kunde?.email || T.wert(lead.email)).toLowerCase(),
    betreff: typ === "suche-pacht" || typ === "suche-kauf" ? "Ihre Flächensuche bei Lippe Forst" : ohneFlaeche ? "Ihre Anfrage bei Lippe Forst" : "Ihre Fläche bei Lippe Forst",
    text: [
      anrede(name(kunde, lead)),
      "",
      `Sie hatten sich am ${T.datumDe(lead.receivedAt)} ${grund[typ]} an uns gewandt. ${frage[typ]}`,
      "",
      ...anfrageBezug(lead, "Zur Erinnerung — Ihre Anfrage"),
      "",
      `Antworten Sie einfach über Ihren persönlichen Link — dort wählen Sie ${ANTWORT_AUSWAHL[typ]}:`,
      antwortLink(lead.id, basis),
      "",
      "Sie können auch direkt auf diese E-Mail antworten. Haben Sie kein Interesse mehr, wählen Sie „Kein Interesse mehr“ oder antworten Sie kurz — dann melden wir uns nicht wieder.",
      "",
      GRUSS,
    ].join("\n"),
  };
}
