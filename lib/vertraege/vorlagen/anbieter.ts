import { felder, kasten, liste, p, paragraphen, type Block } from "../dokument";
import { DATENSCHUTZ_URL, FIRMA, FIRMA_KOPF, KUNDENBEREICH_URL } from "../firma";
import type { AnbieterDaten, Vorlage } from "./typen";

// Vereinbarung mit Anbietern (Eigentümer, die verpachten oder verkaufen).
// Unentgeltlich — Anbieter zahlen nie eine Provision. Kern: Einwilligung in die
// Weitergabe der Kontaktdaten erst nach Freigabe und Mitteilungspflicht über
// Abschlüsse mit nachgewiesenen Interessenten (Grundlage des Provisions-
// anspruchs gegenüber dem Suchenden). Weil der Anbieter nichts zahlt, besteht
// kein Widerrufsrecht nach §§ 312 ff. BGB; die Vereinbarung ist jederzeit
// fristlos kündbar, die Einwilligung jederzeit widerruflich.

function render(d: AnbieterDaten) {
  const para = paragraphen();
  const b: Block[] = [];
  const vorhaben = d.art === "kauf" ? "zum Verkauf" : "zur Verpachtung";
  const vertrag = d.art === "kauf" ? "Kaufvertrag" : "Pachtvertrag";

  b.push(
    felder([
      ["Lippe Forst", FIRMA_KOPF],
      ["Anbieter", [d.kunde.name, d.kunde.betrieb, d.kunde.anschrift, d.kunde.email, d.kunde.telefon].filter(Boolean).join(", ")],
      ["Handelt als", d.eigenschaft === "unternehmer" ? "Unternehmer (§ 14 BGB)" : "Verbraucher (§ 13 BGB)"],
      ["Vorgang", d.vorgang],
    ]),
  );

  b.push(
    para("Gegenstand"),
    p(`(1) Der Anbieter bietet folgende Fläche(n) ${vorhaben} an (weitere Flächen kann er jederzeit ergänzen): ${d.angebot}`),
    ...(d.flaechen.length ? [liste(d.flaechen)] : []),
    p("(2) Lippe Forst sucht passende Interessenten, stellt ihnen die Fläche zunächst nur mit anonymen Eckdaten vor (Gemeinde, Flächentyp, ungefähre Größe, Pacht oder Kauf) und stellt den Kontakt erst her, wenn beide Seiten zugestimmt haben („Freigabe“). Danach verhandeln Anbieter und Interessent direkt miteinander."),
    p(`(3) Auf Wunsch stellt Lippe Forst eine Vorlage für den ${vertrag} bereit und ermöglicht den Abschluss online. Lippe Forst ist nicht Vertragspartei und erbringt keine rechtliche oder steuerliche Beratung im Einzelfall.`),
    p("(4) Eine Pflicht zum Abschluss besteht für den Anbieter zu keiner Zeit. Lippe Forst ist zu einer bestimmten Tätigkeit oder einem Erfolg nicht verpflichtet."),
  );

  b.push(
    para("Keine Provision für den Anbieter"),
    p("Der Anbieter zahlt Lippe Forst keine Provision, keine Gebühr und keinen Aufwendungsersatz. Lippe Forst wird von dem Interessenten vergütet, dem es die Fläche nachweist, und zwar aufgrund eines gesonderten Vertrags nur im Erfolgsfall. Lippe Forst ist damit für beide Seiten tätig und verhält sich dabei unparteiisch."),
  );

  b.push(
    para("Angaben des Anbieters"),
    p("(1) Der Anbieter versichert, Eigentümer der angebotenen Fläche(n) oder zur Verpachtung bzw. zum Verkauf berechtigt zu sein; bei mehreren Eigentümern handelt er mit deren Einverständnis."),
    p("(2) Seine Angaben zur Fläche macht er nach bestem Wissen. Bestehende Pacht- oder Nutzungsverhältnisse, Belastungen und laufende Förderverpflichtungen (z. B. Vertragsnaturschutz) teilt er Interessenten spätestens vor Vertragsschluss mit."),
  );

  b.push(
    para("Einwilligung in die Weitergabe der Kontaktdaten"),
    p("(1) Der Anbieter willigt ein, dass Lippe Forst bei einer Freigabe folgende Angaben an den jeweils nachgewiesenen Interessenten weitergibt: Name, Anschrift, Telefonnummer, E-Mail-Adresse sowie die Flächenangaben (Gemarkung, Flur, Flurstück, Größe, Nutzung). Vor jeder Freigabe fragt Lippe Forst die Zustimmung des Anbieters zu dem konkreten Interessenten ein; die Zustimmung kann per E-Mail, telefonisch oder im Kundenbereich erklärt werden."),
    p(`(2) Die Einwilligung kann jederzeit ohne Angabe von Gründen mit Wirkung für die Zukunft widerrufen werden, z. B. per E-Mail an ${FIRMA.email} oder im Kundenbereich. Bereits erfolgte Weitergaben bleiben davon unberührt. Einzelheiten: ${DATENSCHUTZ_URL}.`),
  );

  b.push(
    para("Mitteilung über Abschlüsse"),
    p(`(1) Schließt der Anbieter innerhalb von 24 Monaten nach einer Freigabe mit dem Interessenten, den Lippe Forst ihm nachgewiesen hat, oder mit dessen Ehegatten, eingetragenem Lebenspartner oder einer von ihm beherrschten Gesellschaft einen Pacht- oder Kaufvertrag über eine über Lippe Forst angebotene Fläche, teilt er Lippe Forst dies binnen 14 Tagen in Textform mit (Datum, Vertragspartner, Fläche, Laufzeit und Pachtzins bzw. Kaufpreis). Die Mitteilung ist im Kundenbereich oder per E-Mail an ${FIRMA.email} möglich.`),
    p("(2) Die Mitteilung dient allein der Abrechnung mit dem Interessenten; dem Anbieter entstehen dadurch keine Kosten."),
  );

  b.push(
    para("Laufzeit und Kündigung"),
    p(`Die Vereinbarung gilt auf unbestimmte Zeit. Beide Seiten können sie jederzeit ohne Einhaltung einer Frist in Textform kündigen, der Anbieter auch über die Schaltfläche „Verträge hier kündigen“ (${KUNDENBEREICH_URL}/kuendigung). Die Mitteilungspflicht nach dem vorstehenden Paragrafen gilt für Interessenten, die vor der Kündigung freigegeben wurden, fort.`),
  );

  b.push(
    para("Datenschutz"),
    p(`Lippe Forst verarbeitet die Daten des Anbieters zur Durchführung dieser Vereinbarung (Art. 6 Abs. 1 lit. b DSGVO) und gibt sie nur mit seiner Einwilligung weiter (Art. 6 Abs. 1 lit. a DSGVO). Unterschriebene Verträge und Unterschriftsprotokolle werden nach den handels- und steuerrechtlichen Aufbewahrungsfristen gespeichert. Einzelheiten: ${DATENSCHUTZ_URL}.`),
  );

  b.push(
    para("Haftung"),
    p("Lippe Forst haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie für Schäden aus der Verletzung von Leben, Körper oder Gesundheit. Im Übrigen haftet Lippe Forst nur für die Verletzung wesentlicher Vertragspflichten und begrenzt auf den vorhersehbaren, typischen Schaden. Angaben der Interessenten gibt Lippe Forst ungeprüft weiter."),
  );

  b.push(
    para("Online-Abschluss und Schlussbestimmungen"),
    p("(1) Die Vereinbarung kommt zustande, wenn der Anbieter sie im Kundenbereich durch Eingabe seines Namens und Betätigen der Schaltfläche „Verbindlich unterzeichnen“ abschließt. Er erhält sie anschließend als PDF mit Unterschriftsprotokoll per E-Mail."),
    p("(2) Änderungen bedürfen der Textform. Es gilt deutsches Recht. Ist der Anbieter Kaufmann, ist Gerichtsstand der Sitz der TR Vertriebs GmbH."),
    p("(3) Sollte eine Bestimmung unwirksam sein, bleibt die Vereinbarung im Übrigen wirksam (§ 306 BGB)."),
  );

  b.push(
    kasten("Kurz gesagt", [
      "Sie zahlen nichts. Ihre Kontaktdaten gibt Lippe Forst erst weiter, wenn Sie dem konkreten Interessenten zugestimmt haben. Sie können jederzeit aussteigen.",
    ]),
  );

  return {
    titel: d.art === "kauf" ? "Vereinbarung für Anbieter – Flächenverkauf" : "Vereinbarung für Anbieter – Flächenverpachtung",
    untertitel: `zwischen ${FIRMA.name} („${FIRMA.marke}“) und dem Anbieter · unentgeltlich`,
    bloecke: b,
  };
}

const P = (s: string) => `«${s}»`;

function platzhalter(art: AnbieterDaten["art"], eigenschaft: AnbieterDaten["eigenschaft"]): AnbieterDaten {
  return {
    eigenschaft,
    art,
    kunde: { name: P("Name"), betrieb: P("Betrieb"), anschrift: P("Anschrift"), email: P("E-Mail"), telefon: P("Telefon") },
    vorgang: P("Vorgang"),
    angebot: P("Flächentyp, Größe, Lage"),
    flaechen: [P("Gemarkung, Flur, Flurstück, Größe, Nutzung")],
  };
}

export const ANBIETER: Vorlage<AnbieterDaten> = {
  id: "anbieter",
  version: "2026-09-24",
  titel: "Vereinbarung für Anbieter (ohne Provision)",
  beschreibung: "Unentgeltliche Vereinbarung mit Eigentümern: Einwilligung in die Weitergabe der Kontaktdaten nach Freigabe, Mitteilungspflicht über Abschlüsse, jederzeit kündbar.",
  render,
  varianten: [
    { name: "Verpachtung, Verbraucher", daten: platzhalter("pacht", "verbraucher") },
    { name: "Verpachtung, Unternehmer", daten: platzhalter("pacht", "unternehmer") },
    { name: "Verkauf, Verbraucher", daten: platzhalter("kauf", "verbraucher") },
    { name: "Verkauf, Unternehmer", daten: platzhalter("kauf", "unternehmer") },
  ],
};
