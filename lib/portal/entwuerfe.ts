import "server-only";
import { formatGroesse, type LeadView, type Zustand } from "@/lib/admin/model";
import { grobeLage } from "@/lib/admin/matching";
import { hinweisAnAnbieter, hinweisAnSuchenden } from "@/lib/admin/texte";
import { GRUSS, einladungsLink, zugangsLink } from "./ablauf";
import * as M from "./model";
import { SPERRE_UNTERSCHRIFT, beideUnterschrieben } from "./schritte";
import * as T from "./texte";
import { PACHTANZEIGE_STELLE, bewertungFaellig, bewertungsText } from "./vorgang";

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
  | "frei";

export const MAIL_ZWECKE: MailZweck[] = ["rueckfrage", "einladung", "erinnerung", "hinweis", "freigabe", "pachtvertrag", "kaufabsicht", "anzeige", "bewertung", "frei"];

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

// ---------------------------------------------------------------------------
// Entwürfe je Anfrage (Kunde)

export function entwuerfeKunde(opts: {
  lead: LeadView;
  kunde: M.KundeRecord | null;
  einstellungen: M.Einstellungen;
  basis: string;
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
      `vielen Dank für Ihre Anfrage. Damit wir ${suchender ? "passende Flächen" : "passende Interessenten"} finden, bräuchten wir noch ein paar Angaben:`,
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
      GRUSS,
    ].join("\n"),
    tipp: "Fragt fehlende Angaben (Größe, Lage/Flurstück, Zeitraum) nach — ändert keinen Status.",
    wirkung: "Die Mail wird im Verlauf der Anfrage gespeichert; eine neue Anfrage wird auf „Beantwortet“ gesetzt.",
    gesendetAm: zuletzt(kunde?.mails, "rueckfrage"),
  });

  // Einladung / Erinnerung
  const unterschrieben = Boolean(kunde?.vertrag);
  const link = kunde ? einladungsLink(kunde, basis) : null;
  const k = M.aktuelleKonditionen(einstellungen);
  const provision = suchender ? M.konditionenText(rr.art, k) : "";
  const bis = kunde?.einladung ? T.datumDe(kunde.einladung.bis) : "";
  // Ein abgelaufener Link darf nicht mehr verschickt werden (der Server lehnt ihn ebenfalls ab).
  const abgelaufen = Boolean(kunde?.einladung && Date.parse(kunde.einladung.bis) < Date.now());
  const linkAbgelaufen = abgelaufen
    ? `Der Einladungslink ist am ${bis} abgelaufen — erst in der Anfrage „Neuen Link erstellen“ oder im Assistenten des Vorgangs „Erinnerung senden“ (erstellt den neuen Link automatisch).`
    : undefined;
  const einladungText = suchender
    ? [
        anrede(nm),
        "",
        `vielen Dank für Ihr Interesse an ${rr.art === "kauf" ? "Flächen zum Kauf" : "Pachtflächen"} über Lippe Forst. Damit wir Ihnen passende Flächen vorstellen und — mit Zustimmung beider Seiten — den Kontakt zum Eigentümer herstellen dürfen, schließen wir mit Ihnen online einen kurzen Nachweisvertrag.`,
        "",
        "Das Wichtigste vorab:",
        `– Sie zahlen nur im Erfolgsfall: ${provision}. Kommt kein Vertrag zustande, entstehen keine Kosten.`,
        "– Flächen stellen wir Ihnen zuerst anonym vor. Kontaktdaten geben wir nur frei, wenn Sie und der Eigentümer zustimmen.",
        "– Sie können jederzeit kündigen. Als Verbraucher haben Sie außerdem ein 14-tägiges Widerrufsrecht.",
        "",
        `Ihr persönlicher Link${bis ? ` (gültig bis ${bis})` : ""}:`,
        link ?? "[Link erscheint nach „Einladung erstellen“]",
        "",
        "Dort ergänzen Sie Ihre Anschrift, lesen den vollständigen Vertrag und unterschreiben mit Ihrem Namen. Den Vertrag erhalten Sie anschließend als PDF per E-Mail.",
        "",
        "Bei Fragen antworten Sie einfach auf diese E-Mail.",
        "",
        GRUSS,
      ]
    : [
        anrede(nm),
        "",
        `vielen Dank, dass Sie Ihre Fläche über Lippe Forst ${rr.art === "kauf" ? "verkaufen" : "verpachten"} möchten. Damit wir sie passenden Interessenten vorstellen dürfen, brauchen wir Ihr Einverständnis in Form einer kurzen, kostenlosen Vereinbarung.`,
        "",
        "Das Wichtigste vorab:",
        "– Sie zahlen nichts — keine Provision, keine Gebühren.",
        "– Ihre Kontaktdaten und die genaue Lage der Fläche geben wir erst weiter, wenn Sie dem konkreten Interessenten zugestimmt haben.",
        "– Sie können jederzeit aussteigen.",
        "",
        `Ihr persönlicher Link${bis ? ` (gültig bis ${bis})` : ""}:`,
        link ?? "[Link erscheint nach „Einladung erstellen“]",
        "",
        "Dort ergänzen Sie Anschrift und Flurstücke, lesen die Vereinbarung und bestätigen sie mit Ihrem Namen. Sie erhalten sie anschließend als PDF per E-Mail.",
        "",
        "Bei Fragen antworten Sie einfach auf diese E-Mail.",
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
    betreff: suchender ? "Ihr persönlicher Zugang bei Lippe Forst — Vertrag online abschließen" : "Ihre Fläche bei Lippe Forst — kurze Vereinbarung online (kostenlos)",
    text: einladungText.join("\n"),
    tipp: "Schickt den persönlichen Einladungslink zum Kundenbereich (Angaben, Vertrag lesen, online unterschreiben).",
    wirkung: "Vermerkt „Einladung gesendet“ in der Kundenakte.",
    gesendetAm: kunde?.einladung?.gesendetAm,
    faellig: Boolean(link && !abgelaufen && !kunde?.einladung?.gesendetAm),
    gesperrt: !link ? "Erst „Einladung erstellen“ klicken — dann steht der persönliche Link im Text." : linkAbgelaufen,
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
        `vor einigen Tagen haben wir Ihnen Ihren persönlichen Zugang geschickt. ${suchender ? "Sobald der Vertrag unterschrieben ist, können wir Ihnen passende Flächen vorstellen." : "Sobald die Vereinbarung bestätigt ist, können wir Ihre Fläche Interessenten vorstellen — für Sie kostenlos."}`,
        "",
        `Ihr Link (gültig bis ${bis}):`,
        link,
        "",
        "Haben Sie Fragen oder möchten Sie doch nicht? Eine kurze Antwort genügt.",
        "",
        GRUSS,
      ].join("\n"),
      tipp: "Freundliche Erinnerung mit demselben Einladungslink.",
      wirkung: "Wird im Verlauf der Anfrage gespeichert.",
      gesendetAm: zuletzt(kunde.mails, "erinnerung"),
      gesperrt: linkAbgelaufen,
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
    return k?.vertrag ? zugangsLink(k, basis) : null;
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
    for (const seite of [
      { k: suchender, l: gesuch, an: anS, rolle: "suchender" as const },
      { k: anbieter, l: angebot, an: anA, rolle: "anbieter" as const },
    ]) {
      if (!seite.k || !seite.an) continue;
      const zugang = zugangsLink(seite.k, basis);
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
          `Bitte nehmen Sie direkt miteinander Kontakt auf. Wenn Sie sich einig werden, können Sie den ${art === "kauf" ? "Kauf über den Notar vorbereiten" : "Pachtvertrag auf Wunsch online über Lippe Forst abschließen"}.${seite.rolle === "suchender" ? " Bitte melden Sie uns einen Vertragsschluss kurz im Kundenbereich („Vertragsschluss melden“)." : ""}`,
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
          zugangsLink(seite.k, basis),
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
        `der Pachtvertrag vom ${T.datumDe(pv.abgeschlossenAm)} ist nach § 2 Landpachtverkehrsgesetz binnen eines Monats nach Abschluss anzuzeigen — zuständig ist ${PACHTANZEIGE_STELLE}. Die Anzeige ist Sache des Verpächters; den Vertrag als PDF finden Sie in Ihrem Kundenbereich.`,
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
          zugangsLink(seite.k, basis),
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
