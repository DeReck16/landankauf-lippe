import { GRUSS } from "@/lib/portal/gruss";
import { grobeGroesse } from "@/lib/portal/texte";
import { formatGroesse, type LeadView } from "./model";

// Anonyme Hinweistexte für beide Seiten eines Paares — ohne Namen, Kontakt-
// daten oder Flurstück. Nur Gemeinde, Flächentyp, gerundete Größe und Art (die
// genaue Größe würde zusammen mit dem Ort das Flurstück verraten). Die Texte
// sind Grundlage der E-Mail-Entwürfe (lib/portal/entwuerfe.ts); verschickt wird
// auf Klick der Verwaltung bzw. über eine eingeschaltete Automatik-Regel.

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

/** Absatz mit dem Link zum Zustimmen (direkt in den Kundenbereich) — ohne Link: Antwort per E-Mail. */
function zustimmungsAbsatz(link: string | null | undefined, frage: string): string {
  if (!link) return `${frage} Dann antworten Sie bitte kurz auf diese E-Mail.`;
  return `${frage} Dann stimmen Sie bitte über diesen Link zu — er führt direkt in Ihren Kundenbereich (14 Tage gültig; danach melden Sie sich einfach mit Ihrer E-Mail-Adresse an):
${link}

Kein Interesse? Das können Sie dort ebenfalls mit einem Klick mitteilen — oder Sie antworten einfach auf diese E-Mail.`;
}

export function hinweisAnSuchenden(
  angebot: LeadView,
  gesuch: LeadView,
  gemeindeAngebot: string,
  link?: string | null,
  opt: { eigeneFlaeche?: boolean } = {},
): string {
  const groesse = grobeGroesse(angebot.groesseWert);
  const art = angebot.art === "kauf" ? "zum Verkauf" : "zur Verpachtung";
  const ort = gemeindeAngebot || "Ihrer Suchregion";
  const eigen = opt.eigeneFlaeche
    ? `\n\nZur Offenheit: Diese Fläche gehört dem Geschäftsführer von Lippe Forst bzw. seiner Familie. Für sie fällt keine Provision an — auch nicht nach Ihrem Nachweisvertrag.`
    : "";
  return `${anrede(gesuch)}

zu Ihrem Gesuch haben wir ein passendes Angebot: ${typText(angebot.typ)}${groesse ? `, ${groesse}` : ""}, im Raum ${ort}, ${art}.${eigen}

Den Eigentümer fragen wir gleichzeitig, ob er mit einem Kontakt einverstanden ist. Ihre Kontaktdaten geben wir erst weiter, wenn Sie beide zugestimmt haben.

${zustimmungsAbsatz(link, "Haben Sie Interesse?")}

${GRUSS}`;
}

export function hinweisAnAnbieter(angebot: LeadView, gesuch: LeadView, gemeindeGesuch: string, link?: string | null): string {
  const groesse = formatGroesse(gesuch.groesseWert);
  const wunsch = gesuch.art === "kauf" ? "kaufen" : "pachten";
  const ort = gemeindeGesuch || "Ihrer Nähe";
  return `${anrede(angebot)}

für Ihre Fläche haben wir eine passende Anfrage: Ein Interessent möchte im Raum ${ort} ${typText(gesuch.typ)}${groesse !== "Größe offen" ? ` (${groesse})` : ""} ${wunsch}.

Den Interessenten fragen wir gleichzeitig, ob er mit einem Kontakt einverstanden ist. Ohne Ihre Zustimmung nennen wir weder Ihren Namen noch die genaue Lage der Fläche.

${zustimmungsAbsatz(link, "Dürfen wir Sie miteinander in Kontakt bringen?")}

${GRUSS}`;
}
