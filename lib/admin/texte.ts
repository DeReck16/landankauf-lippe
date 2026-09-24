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

/** Absatz mit dem Link zum Zustimmen (direkt in den Kundenbereich) — ohne Link: Antwort per E-Mail. */
function zustimmungsAbsatz(link: string | null | undefined, frage: string): string {
  if (!link) return `${frage} Dann antworten Sie bitte kurz auf diese E-Mail.`;
  return `${frage} Dann stimmen Sie bitte über diesen Link zu — er führt direkt in Ihren Kundenbereich (14 Tage gültig; danach melden Sie sich einfach mit Ihrer E-Mail-Adresse an):
${link}

Kein Interesse? Das können Sie dort ebenfalls mit einem Klick mitteilen — oder Sie antworten einfach auf diese E-Mail.`;
}

export function hinweisAnSuchenden(angebot: LeadView, gesuch: LeadView, gemeindeAngebot: string, link?: string | null): string {
  const groesse = formatGroesse(angebot.groesseWert);
  const art = angebot.art === "kauf" ? "zum Verkauf" : "zur Verpachtung";
  const ort = gemeindeAngebot || "Ihrer Suchregion";
  return `${anrede(gesuch)}

zu Ihrem Gesuch haben wir ein passendes Angebot: ${typText(angebot.typ)}${groesse !== "Größe offen" ? `, ca. ${groesse}` : ""}, im Raum ${ort}, ${art}.

Den Eigentümer fragen wir gleichzeitig, ob er mit einem Kontakt einverstanden ist. Ihre Kontaktdaten geben wir erst weiter, wenn Sie beide zugestimmt haben.

${zustimmungsAbsatz(link, "Haben Sie Interesse?")}

${ABSCHLUSS}`;
}

export function hinweisAnAnbieter(angebot: LeadView, gesuch: LeadView, gemeindeGesuch: string, link?: string | null): string {
  const groesse = formatGroesse(gesuch.groesseWert);
  const wunsch = gesuch.art === "kauf" ? "kaufen" : "pachten";
  const ort = gemeindeGesuch || "Ihrer Nähe";
  return `${anrede(angebot)}

für Ihre Fläche haben wir eine passende Anfrage: Ein Interessent möchte im Raum ${ort} ${typText(gesuch.typ)}${groesse !== "Größe offen" ? ` (${groesse})` : ""} ${wunsch}.

Den Interessenten fragen wir gleichzeitig, ob er mit einem Kontakt einverstanden ist. Ohne Ihre Zustimmung nennen wir weder Ihren Namen noch die genaue Lage der Fläche.

${zustimmungsAbsatz(link, "Dürfen wir Sie miteinander in Kontakt bringen?")}

${ABSCHLUSS}`;
}
