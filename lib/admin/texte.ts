import { formatGroesse, type LeadView } from "./model";

// Anonyme Hinweistexte für beide Seiten eines Paares — ohne Namen, Kontakt-
// daten oder Flurstück. Nur Gemeinde, Flächentyp, Größe und Art. Die Texte
// sind Grundlage der E-Mail-Entwürfe im Matching (lib/portal/entwuerfe.ts);
// verschickt wird nur auf ausdrücklichen Klick der Verwaltung.

function typText(typ: string): string {
  if (typ === "Wiese / Grünland") return "Grünland";
  if (typ === "Wald / Forst") return "Wald";
  if (typ === "Sonstiges") return "Fläche";
  return typ;
}

function anrede(lead: LeadView): string {
  const name = lead.name !== "—" ? lead.name : "";
  return name ? `Guten Tag ${name},` : "Guten Tag,";
}

const ABSCHLUSS = `Mit freundlichen Grüßen
Dennis Reckling
--
Lippe Forst · lippeforst.de
Bahnhofstraße 70b · 32805 Horn-Bad Meinberg
TR Vertriebs GmbH · Amtsgericht Lemgo HRB 11734
Geschäftsführer: Dennis Reckling, Martin Thomann`;

export function hinweisAnSuchenden(angebot: LeadView, gesuch: LeadView, gemeindeAngebot: string): string {
  const groesse = formatGroesse(angebot.groesseWert);
  const art = angebot.art === "kauf" ? "zum Verkauf" : "zur Verpachtung";
  const ort = gemeindeAngebot || "Ihrer Suchregion";
  return `${anrede(gesuch)}

zu Ihrem Gesuch haben wir ein passendes Angebot: ${typText(angebot.typ)}${groesse !== "Größe offen" ? `, ca. ${groesse}` : ""}, im Raum ${ort}, ${art}.

Wenn Sie Interesse haben, geben Sie uns bitte kurz Bescheid. Wir fragen dann den Eigentümer, ob wir Sie miteinander in Kontakt bringen dürfen. Ihre Kontaktdaten geben wir erst weiter, wenn Sie beide zugestimmt haben.

${ABSCHLUSS}`;
}

export function hinweisAnAnbieter(angebot: LeadView, gesuch: LeadView, gemeindeGesuch: string): string {
  const groesse = formatGroesse(gesuch.groesseWert);
  const wunsch = gesuch.art === "kauf" ? "kaufen" : "pachten";
  const ort = gemeindeGesuch || "Ihrer Nähe";
  return `${anrede(angebot)}

für Ihre Fläche haben wir eine passende Anfrage: Ein Interessent möchte im Raum ${ort} ${typText(gesuch.typ)}${groesse !== "Größe offen" ? ` (${groesse})` : ""} ${wunsch}.

Dürfen wir Ihre Kontaktdaten an den Interessenten weitergeben? Ohne Ihre Zustimmung nennen wir weder Ihren Namen noch die genaue Lage der Fläche.

${ABSCHLUSS}`;
}
