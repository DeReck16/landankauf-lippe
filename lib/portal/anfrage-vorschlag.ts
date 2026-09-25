import "server-only";
import { createHash } from "node:crypto";
import type { LeadView } from "@/lib/admin/model";
import { VORLAGEN, istFreigegeben, kundenVorlage } from "@/lib/vertraege/vorlagen";
import { einladungsLink } from "./ablauf";
import type { AnfrageAktion, AnfrageMail, AnfrageVorschlag } from "./anfrage-typen";
import { entwuerfeKunde } from "./entwuerfe";
import * as M from "./model";
import { nachfassFrist } from "./nachfassen";
import * as T from "./texte";
import { einladungBis } from "./token";

// Vorgeschlagene Aktion je „Neue Anfrage ohne Paar“ (Dashboard): genau EIN
// Hauptknopf, abhängig vom Anliegen — Anbieter einladen (Vereinbarung und auf
// Wunsch Flächenbörse), Suchende einladen (Suchauftrag = Nachweisvertrag), reine
// Auskünfte als beantwortet markieren (Antwort im eigenen Mailprogramm). Wie beim
// Klick-Assistenten zeigt die Rückfrage, was passiert und welche Mail an wen mit
// welchem Betreff rausgeht. Ausgeführt wird in app/admin/assistent-actions.ts
// (anfrageVorschlagAktion) — nur, wenn der Vorschlag noch dem bestätigten Stand
// entspricht (Signatur). Nichts geht ohne Klick raus.

export type AnfrageUmgebung = { einstellungen: M.Einstellungen; basis: string; jetzt?: Date };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NEUER_LINK = "[persönlicher Link — wird beim Klick neu erstellt]";
export const ANTWORT_BETREFF = "Ihre Anfrage bei Lippe Forst";

const VORLAGEN_LINK = { href: "/admin/vorlagen", text: "Zu den Vorlagen", tipp: "Öffnet die Vertragsvorlagen — dort „Alle freigeben“" };

/** Halbsatz für reine Auskünfte — je Anliegen aus dem Formular. */
const AUSKUNFT_WARUM: Record<string, string> = {
  Bewertung: "Bewertungsanfrage",
  "Energiepacht (Solar/Wind)": "Frage zur Energiepacht (Solar/Wind)",
  "VNS / Ökopunkte": "Frage zu VNS / Ökopunkten",
  Lohnunternehmer: "Sucht einen Lohnunternehmer",
  "Bauland-Beratung": "Wunsch nach Bauland-Beratung",
  Allgemein: "Allgemeine Frage",
};

function signatur(teile: unknown): string {
  return createHash("sha256").update(JSON.stringify(teile)).digest("hex").slice(0, 24);
}

/**
 * Einladungs-Mail für die Anzeige. Entsteht der Link erst beim Klick, wird der Text
 * mit einem Probe-Link erzeugt und dieser durch einen Platzhalter ersetzt — gesendet
 * wird später der echte Entwurf (wie im Klick-Assistenten).
 */
function einladungVorschau(l: LeadView, k: M.KundeRecord | null, rr: { rolle: M.Rolle; art: M.Art }, an: string, u: AnfrageUmgebung, neuerLink: boolean): AnfrageMail | null {
  let kunde = k;
  let probeLink: string | null = null;
  if (neuerLink) {
    const basis = k ?? M.neuerKunde(l.id, rr.rolle, rr.art, an, "vorschau");
    kunde = {
      ...basis,
      rolle: rr.rolle,
      art: rr.art,
      einladung: { nonce: "vorschau-nur-zur-anzeige", bis: einladungBis().toISOString(), erstelltAm: (u.jetzt ?? new Date()).toISOString(), von: "vorschau", gesendetAm: k?.einladung?.gesendetAm },
    };
    probeLink = einladungsLink(kunde, u.basis);
  }
  const e = entwuerfeKunde({ lead: l, kunde, einstellungen: u.einstellungen, basis: u.basis }).find((x) => x.zweck === "einladung");
  if (!e) return null;
  const name = k?.stammdaten?.name || T.wert(l.name) || l.id;
  const zuletzt = k?.einladung?.gesendetAm ?? k?.mails.find((m) => m.zweck === "einladung" && m.ok)?.am;
  return {
    wer: `${M.ROLLE_NAME[rr.rolle]} (${name})`,
    an: e.an,
    betreff: e.betreff,
    text: probeLink ? e.text.split(probeLink).join(NEUER_LINK) : e.text,
    hinweis: neuerLink
      ? `Der persönliche Link (30 Tage gültig) wird beim Klick neu erstellt und in den Text eingesetzt${k?.einladung ? "; der bisherige Link wird damit ungültig" : ""}.`
      : `Es wird der bestehende persönliche Link gesendet (gültig bis ${T.datumDe(k?.einladung?.bis)}).`,
    zuletzt,
  };
}

/** Wie anfrageVorschlag — ein kaputter Datensatz legt das Dashboard nicht lahm (dann gesperrter Knopf mit Hinweis). */
export function anfrageVorschlagSicher(l: LeadView, k: M.KundeRecord | null, u: AnfrageUmgebung): AnfrageVorschlag {
  try {
    return anfrageVorschlag(l, k, u);
  } catch (err) {
    console.error("[dashboard] Vorschlag für Anfrage nicht berechenbar", l.id, err);
    const grund = "Für diese Anfrage lässt sich gerade kein Vorschlag berechnen — bitte die Anfrage öffnen und dort bearbeiten.";
    return { art: "auskunft", warum: grund, aktion: { id: "beantwortet", knopf: "Als beantwortet markieren", tipp: grund, frage: "", passiert: [], mails: [], gesperrt: grund, signatur: "-" }, antworten: null };
  }
}

/** Der eine vorgeschlagene Schritt für eine neue Anfrage ohne Paar. */
export function anfrageVorschlag(l: LeadView, k: M.KundeRecord | null, u: AnfrageUmgebung): AnfrageVorschlag {
  const jetzt = u.jetzt ?? new Date();
  const rr = T.rolleVonLead(l);
  const an = (k?.email || T.wert(l.email)).toLowerCase();
  const emailOk = EMAIL.test(an);
  const name = k?.stammdaten?.name || T.wert(l.name) || l.id;
  const basis = { id: l.id, status: l.status, rolle: rr?.rolle ?? "", art: rr?.art ?? "", an };

  // Als beantwortet markieren: reine Auskunft — und Anbieter/Suchende, die schon unterschrieben haben oder keine E-Mail-Adresse angegeben haben.
  const beantwortet = (warum: string, art: AnfrageVorschlag["art"]): AnfrageVorschlag => {
    const roh: Omit<AnfrageAktion, "signatur"> = {
      id: "beantwortet",
      knopf: "Als beantwortet markieren",
      tipp: "Setzt den Status auf „Beantwortet“ — zum Beispiel, nachdem Sie selbst geantwortet oder angerufen haben. Es geht keine E-Mail raus.",
      frage: `Anfrage von ${name} als beantwortet markieren?`,
      passiert: [
        "Der Status wird „Beantwortet“ — die Anfrage verschwindet aus dieser Liste (unter „Anfragen“ weiter sichtbar, der Schritt steht im Verlauf).",
        ...(emailOk ? [`Ohne weiteren Kontakt erscheint sie ${nachfassFrist()} im Abschnitt „Nachfassen“ (eine kurze Mail, ob noch Interesse besteht — nur auf Klick).`] : []),
      ],
      mails: [],
    };
    return {
      art,
      warum,
      aktion: { ...roh, signatur: signatur({ ...basis, a: roh.id }) },
      antworten: art === "auskunft" && emailOk ? { href: `mailto:${an}?subject=${encodeURIComponent(ANTWORT_BETREFF)}`, an } : null,
    };
  };

  if (!rr) {
    const intent = T.wert(l.intent);
    const was = AUSKUNFT_WARUM[intent] ?? (l.rolle === "keine" || !intent ? "Anfrage ohne Flächenangebot oder Gesuch" : `Anfrage „${intent}“ ohne Einordnung als Angebot oder Gesuch mit Kauf/Pacht`);
    return beantwortet(`${was} — ${emailOk ? "persönlich antworten, dann als beantwortet markieren" : "keine gültige E-Mail-Adresse: anrufen, dann als beantwortet markieren"}`, "auskunft");
  }

  const angebot = rr.rolle === "anbieter";
  const art: AnfrageVorschlag["art"] = angebot ? "angebot" : "gesuch";
  const vertragName = angebot ? "die kostenlose Vereinbarung für Anbieter" : "den Nachweisvertrag (Suchauftrag)";
  if (k?.vertrag) {
    const stand = k.widerruf ? `hat den Vertrag am ${T.datumDe(k.widerruf.am)} widerrufen` : k.kuendigung ? `hat den Vertrag am ${T.datumDe(k.kuendigung.am)} gekündigt` : `hat ${vertragName} schon am ${T.datumDe(k.vertrag.signatur.am)} unterschrieben`;
    return beantwortet(`${M.ROLLE_NAME[rr.rolle]} ${stand} — keine Einladung mehr nötig, nur noch als beantwortet markieren`, art);
  }
  const was = angebot ? (rr.art === "kauf" ? "Verkaufsangebot" : "Pachtangebot") : rr.art === "kauf" ? "Kaufgesuch" : "Pachtgesuch";
  // Ohne E-Mail-Adresse ist keine Online-Einladung möglich (die Anfrage selbst ist unveränderlich) — also anrufen.
  if (!emailOk) {
    return beantwortet(`${was} ohne gültige E-Mail-Adresse — anrufen, dann als beantwortet markieren (eine Online-Einladung braucht eine E-Mail-Adresse)`, art);
  }

  const warum = angebot
    ? `${was} ohne ${rr.art === "kauf" ? "passenden Käufer" : "passenden Pächter"} — einladen, damit wir die Fläche anbieten dürfen`
    : `${was} ohne passende Fläche — einladen, damit wir Flächen vorstellen dürfen`;
  const knopf = angebot ? "Einladen — Vereinbarung & Flächenbörse" : "Einladen — Suchauftrag";
  const tipp = angebot
    ? "Erstellt bei Bedarf den persönlichen Einladungslink und sendet die Einladung zur kostenlosen Vereinbarung — mit dem Hinweis, dass die Fläche auf Wunsch anonym in die Flächenbörse kann (vorher wird nachgefragt)"
    : "Erstellt bei Bedarf den persönlichen Einladungslink und sendet die Einladung zum Nachweisvertrag, damit wir passende Flächen vorstellen dürfen (vorher wird nachgefragt)";

  const gesperrt = (grund: string, link?: AnfrageAktion["link"]): AnfrageVorschlag => {
    const roh: Omit<AnfrageAktion, "signatur"> = { id: "einladen", knopf, tipp, frage: "", passiert: [], mails: [], gesperrt: grund, link };
    return { art, warum, aktion: { ...roh, signatur: signatur({ ...basis, a: roh.id, g: grund }) }, antworten: null };
  };
  if (k?.gesperrt) return gesperrt(`Der Zugang zum Kundenbereich ist seit ${T.datumDe(k.gesperrt.am)} gesperrt — erst in der Anfrage entsperren.`);
  const vorlage = kundenVorlage(rr.rolle, rr.art);
  if (!istFreigegeben(u.einstellungen, vorlage)) {
    return gesperrt(`Die Vorlage „${VORLAGEN[vorlage].titel}“ ist noch nicht freigegeben (Verwaltung → Vorlagen) — ohne Freigabe kann niemand unterschreiben.`, VORLAGEN_LINK);
  }

  const abgelaufen = Boolean(k?.einladung && Date.parse(k.einladung.bis) < jetzt.getTime());
  const neuerLink = !k?.einladung || abgelaufen;
  const mail = einladungVorschau(l, k, rr, an, u, neuerLink);
  if (!mail) return gesperrt("Für diese Anfrage ist keine Einladung möglich.");

  const passiert = [
    neuerLink
      ? `Persönlichen Einladungslink für ${name} erstellen (30 Tage gültig)${!k ? " und die Kundenakte anlegen" : abgelaufen ? ` — der bisherige ist am ${T.datumDe(k?.einladung?.bis)} abgelaufen` : ""}.`
      : `Den bestehenden Einladungslink verwenden (gültig bis ${T.datumDe(k?.einladung?.bis)}).`,
    angebot
      ? `Einladungs-Mail an ${name} senden: persönlicher Link in den Kundenbereich — Anschrift und Flurstücke angeben, die kostenlose Vereinbarung lesen und online bestätigen. Die Mail erwähnt auch: Auf Wunsch zeigen wir die Fläche anonym in der Flächenbörse — dafür genügt ein Häkchen bei den Angaben.`
      : `Einladungs-Mail an ${name} senden: persönlicher Link in den Kundenbereich — Angaben machen, den Nachweisvertrag lesen und online unterschreiben. Erst dann dürfen wir passende Flächen vorstellen; eine Provision fällt nur im Erfolgsfall an.`,
    "Der Status wird „Beantwortet“ — die Anfrage verschwindet aus dieser Liste.",
    "Öffnet der Kunde den Link bzw. unterschreibt er, bekommt die Verwaltung eine Meldung per E-Mail.",
  ];
  const roh: Omit<AnfrageAktion, "signatur"> = {
    id: "einladen",
    knopf,
    tipp,
    frage: angebot ? `${name} zur Vereinbarung einladen?` : `${name} zum Suchauftrag einladen?`,
    passiert,
    mails: [mail],
  };
  return {
    art,
    warum,
    aktion: { ...roh, signatur: signatur({ ...basis, a: roh.id, n: neuerLink, e: k?.einladung?.erstelltAm ?? "", z: mail.zuletzt ?? "", b: mail.betreff }) },
    antworten: null,
  };
}
