import { felder, kasten, p, paragraphen, type Block } from "../dokument";
import { FIRMA } from "../firma";
import type { PachtvertragDaten, Vorlage } from "./typen";

// Landpachtvertrag (§§ 585 ff. BGB). Seit 01.01.2025 genügt nach § 585a BGB die
// Textform (§ 126b BGB) auch für Laufzeiten über zwei Jahre — die Online-
// Unterschrift beider Parteien mit PDF auf dauerhaftem Datenträger reicht.
// Inhaltlich bewusst nah am Gesetz, damit die Vorlage für beide Seiten fair ist.

function render(d: PachtvertragDaten) {
  const para = paragraphen();
  const b: Block[] = [];

  b.push(
    felder([
      ["Verpächter", `${d.verpaechter.name}, ${d.verpaechter.anschrift}`],
      ["Pächter", `${d.paechter.name}${d.paechter.betrieb ? ` (${d.paechter.betrieb})` : ""}, ${d.paechter.anschrift}`],
    ]),
    p("Die Parteien schließen folgenden Landpachtvertrag:"),
  );

  b.push(
    para("Pachtgegenstand"),
    p("(1) Verpachtet werden die folgenden landwirtschaftlich genutzten Grundstücke:"),
    felder(d.flaechen.map((f) => [f.bezeichnung, `${f.groesse}${f.nutzung ? ` · ${f.nutzung}` : ""}`] as [string, string])),
    p(`(2) Gesamtfläche: ${d.gesamtFlaeche}. Nutzungsart: ${d.nutzungsart}. Maßgeblich sind die Angaben des Liegenschaftskatasters.`),
    p("(3) Mitverpachtet sind nur die Grundstücke selbst. Gebäude, bauliche Anlagen und Inventar sind nur mitverpachtet, wenn sie unter „Besondere Vereinbarungen“ ausdrücklich genannt sind."),
    p("(4) Die Pachtsache wird in dem Zustand verpachtet, in dem sie sich bei Pachtbeginn befindet. Die Parteien sollen bei Übergabe eine Beschreibung der Pachtsache nach § 585b BGB anfertigen; jede Partei kann dies verlangen."),
  );

  b.push(
    para("Pachtzeit"),
    p(`(1) Das Pachtverhältnis beginnt am ${d.pachtBeginn}. Pachtjahr ist ${d.pachtjahr}.`),
    ...(d.befristet
      ? [
          p(`(2) Das Pachtverhältnis wird für ${d.laufzeit} geschlossen und endet am ${d.pachtEnde}, ohne dass es einer Kündigung bedarf. Eine ordentliche Kündigung ist während dieser Zeit ausgeschlossen.`),
          p("(3) Die Vorschriften über die Anfrage auf Fortsetzung (§ 594 BGB) sowie über die außerordentliche Kündigung bleiben unberührt."),
        ]
      : [
          p("(2) Das Pachtverhältnis wird auf unbestimmte Zeit geschlossen."),
          p("(3) Es kann von jeder Partei spätestens am dritten Werktag eines Pachtjahres für den Schluss des nächsten Pachtjahres gekündigt werden (§ 594a Abs. 1 BGB). Die Kündigung bedarf der schriftlichen Form (§ 594f BGB)."),
        ]),
  );

  b.push(
    para("Pachtzins"),
    p(`(1) Der Pachtzins beträgt ${d.pachtzins}. Die volle Jahrespacht beträgt damit ${d.jahrespacht}.`),
    ...(d.staffel ? [p(`(2) Abweichend davon gilt folgende Staffel: ${d.staffel}`)] : []),
    p(`(${d.staffel ? 3 : 2}) Der Pachtzins ist ${d.zahlweise} zu zahlen${d.konto ? ` auf das Konto ${d.konto}` : ""}. Für die Rechtzeitigkeit kommt es auf den Zahlungseingang an.`),
    p(
      d.umsatzsteuer === "zuzueglich"
        ? `(${d.staffel ? 4 : 3}) Der Verpächter hat für die Verpachtung zur Umsatzsteuer optiert. Zum Pachtzins kommt die gesetzliche Umsatzsteuer hinzu; der Verpächter erteilt hierüber eine Rechnung.`
        : `(${d.staffel ? 4 : 3}) Die Parteien gehen davon aus, dass die Verpachtung nicht der Umsatzsteuer unterliegt; der Pachtzins enthält keine Umsatzsteuer.`,
    ),
    p(`(${d.staffel ? 5 : 4}) Eine Anpassung des Pachtzinses richtet sich nach § 593 BGB.`),
  );

  b.push(
    para("Lasten und Abgaben"),
    p("(1) Die auf der Pachtsache ruhenden öffentlichen Lasten, insbesondere die Grundsteuer, trägt der Verpächter (§ 586a BGB)."),
    p(
      d.wasserverband === "paechter"
        ? "(2) Die Beiträge zum Wasser- und Bodenverband trägt der Pächter; der Verpächter kann sie in Rechnung stellen, soweit sie auf die verpachteten Flächen entfallen."
        : "(2) Die Beiträge zum Wasser- und Bodenverband trägt der Verpächter.",
    ),
    p("(3) Die mit der Bewirtschaftung verbundenen Beiträge, insbesondere zur landwirtschaftlichen Berufsgenossenschaft, trägt der Pächter."),
    p("(4) Das Jagdrecht bleibt unberührt. Ansprüche auf Ersatz von Wildschäden an den Erzeugnissen stehen während der Pachtzeit dem Pächter zu."),
  );

  b.push(
    para("Bewirtschaftung"),
    p("(1) Der Pächter bewirtschaftet die Pachtsache ordnungsgemäß nach guter fachlicher Praxis und erhält ihre Ertragsfähigkeit (§ 586 Abs. 1 BGB). Er hält Grenzzeichen, Gräben, Drainagen, Hecken und sonstige Landschaftselemente auf der Pachtsache in ordnungsgemäßem Zustand, soweit dies zur gewöhnlichen Unterhaltung gehört."),
    p("(2) Eine Änderung der landwirtschaftlichen Bestimmung oder der bisherigen Nutzung — insbesondere der Umbruch von Grünland, eine Aufforstung, die Errichtung von Gebäuden, Anlagen oder Photovoltaik — bedarf der vorherigen Erlaubnis des Verpächters in Textform (§ 590 BGB)."),
    p("(3) Das Aufbringen von Klärschlamm und Bioabfällen bedarf der vorherigen Zustimmung des Verpächters in Textform."),
    p("(4) Der Verpächter oder eine von ihm beauftragte Person darf die Pachtsache nach vorheriger Ankündigung zu angemessener Zeit besichtigen."),
  );

  b.push(
    para("Überlassung an Dritte"),
    p("Der Pächter darf die Pachtsache nur mit vorheriger Erlaubnis des Verpächters in Textform unterverpachten oder Dritten zur Nutzung überlassen (§ 589 BGB). Die Erlaubnis zu einem üblichen Bewirtschaftungstausch darf nur aus wichtigem Grund verweigert werden; der Pächter bleibt dem Verpächter gegenüber verantwortlich."),
  );

  b.push(
    para("Förderrecht und bestehende Verpflichtungen"),
    p("(1) Der Pächter beantragt Zahlungen der Gemeinsamen Agrarpolitik (GAP) als Bewirtschafter im eigenen Namen und erfüllt die damit verbundenen Pflichten (insbesondere Konditionalität). Zahlungsansprüche gibt es seit dem Antragsjahr 2023 nicht mehr; sie sind nicht Gegenstand dieses Vertrags."),
    p(`(2) Bestehende Verpflichtungen auf der Pachtsache (z. B. Agrarumwelt- und Klimamaßnahmen, Vertragsnaturschutz, Ökoregelungen, geschützte Landschaftselemente): ${d.verpflichtungen || "keine bekannt."}`),
    p("(3) Übernimmt der Pächter bestehende Verpflichtungen, geben die Parteien die dafür vorgesehene Übernahmeerklärung gegenüber der Bewilligungsbehörde ab (Agrarumweltmaßnahmen: Landwirtschaftskammer Nordrhein-Westfalen; Vertragsnaturschutz: Kreis). Mit der Übernahme tritt der Pächter in die Rechte und Pflichten aus dem Zuwendungsbescheid ein, auch in etwaige Rückforderungen und Sanktionen. Im Verhältnis der Parteien zueinander trägt Rückforderungen oder Sanktionen die Partei, deren Verhalten sie verursacht hat; für Verstöße vor der Übernahme ist das der Verpächter."),
  );

  b.push(
    para("Verwendungen"),
    p("Für Verwendungen auf die Pachtsache gelten die §§ 590b und 591 BGB. Wertverbessernde Verwendungen sind nur zu ersetzen, wenn der Verpächter ihnen vorher zugestimmt hat."),
  );

  b.push(
    para("Beendigung und Rückgabe"),
    p("(1) Das Recht zur außerordentlichen Kündigung richtet sich nach den gesetzlichen Vorschriften (§§ 594c, 594d, 594e BGB)."),
    p("(2) Bei Pachtende gibt der Pächter die Pachtsache in dem Zustand zurück, der einer bis zur Rückgabe fortgesetzten ordnungsmäßigen Bewirtschaftung entspricht (§ 596 Abs. 1 BGB). Im Übrigen gelten die §§ 596 bis 596b BGB."),
  );

  b.push(
    para("Anzeige nach dem Landpachtverkehrsgesetz"),
    p(`(1) Der Verpächter zeigt den Abschluss dieses Vertrags binnen eines Monats der zuständigen Behörde an (§ 2 LPachtVG); der Pächter ist zur Anzeige ebenfalls berechtigt. Zuständig ist ${d.anzeigeStelle}. Jede Partei stellt der anderen die hierfür nötigen Angaben zur Verfügung.`),
    p("(2) In Nordrhein-Westfalen sind Landpachtverträge über Grundstücke bis zu einer Größe von 1 ha von der Anzeigepflicht ausgenommen. Änderungen des Vertrags über Pachtsache, Pachtdauer oder Pachtzins sind ebenfalls anzuzeigen."),
  );

  b.push(
    para("Nachweis durch Lippe Forst"),
    p(`(1) Dieser Vertrag kam durch den Nachweis von ${FIRMA.name} („${FIRMA.marke}“) zustande. ${FIRMA.marke} ist nicht Vertragspartei; die Rechte und Pflichten aus diesem Vertrag bestehen allein zwischen Verpächter und Pächter. Die Vertragsvorlage wurde als Formular bereitgestellt und mit den Angaben der Parteien ausgefüllt; eine rechtliche oder steuerliche Beratung im Einzelfall hat ${FIRMA.marke} nicht erbracht.`),
    p(`(2) Eine Provision schuldet ausschließlich der Pächter aufgrund seines gesonderten Vertrags mit ${FIRMA.marke}; der Verpächter schuldet keine Provision.`),
    p("(3) Handelt der Verpächter nicht als Unternehmer, finden die besonderen Vorschriften über Verbraucherverträge (etwa ein Widerrufsrecht) auf diesen Pachtvertrag keine Anwendung."),
  );

  b.push(para("Besondere Vereinbarungen"), p(d.besonderes || "Keine."));

  b.push(
    para("Form und Schlussbestimmungen"),
    p("(1) Dieser Vertrag wird in Textform (§§ 126b, 585a BGB) geschlossen: Jede Partei unterzeichnet ihn online im Kundenbereich von lippeforst.de durch Eingabe ihres Namens; das Unterschriftsprotokoll am Ende dieser Urkunde ist ihr Bestandteil und schließt die Erklärung jeder Partei ab. Der Vertrag kommt mit der Unterschrift der zweiten Partei zustande. Beide Parteien erhalten ihn als PDF."),
    p("(2) Änderungen und Ergänzungen bedürfen der Textform. Kündigungen bedürfen der schriftlichen Form mit eigenhändiger Unterschrift (§ 594f BGB) — eine Kündigung per E-Mail oder im Kundenbereich genügt nicht."),
    p("(3) Sollte eine Bestimmung unwirksam sein, bleibt der Vertrag im Übrigen wirksam; an die Stelle der unwirksamen Bestimmung tritt die gesetzliche Regelung."),
  );

  b.push(
    kasten("Hinweise", [
      "Diese Vorlage ersetzt keine Rechtsberatung. Vor der Unterschrift kann jede Partei den Text in Ruhe prüfen oder prüfen lassen und Änderungen über Lippe Forst anfragen.",
      "Die Anzeige nach dem Landpachtverkehrsgesetz ist Pflicht des Verpächters; Lippe Forst erinnert daran, übernimmt sie aber nicht.",
    ]),
  );

  return {
    titel: "Landpachtvertrag",
    untertitel: `über landwirtschaftlich genutzte Flächen · geschlossen online über ${FIRMA.marke} · Vorgang ${d.vorgang}`,
    bloecke: b,
  };
}

const P = (s: string) => `«${s}»`;

function platzhalter(befristet: boolean, umsatzsteuer: "ohne" | "zuzueglich", wasserverband: "verpaechter" | "paechter", staffel: boolean): PachtvertragDaten {
  return {
    vorgang: P("Vorgang"),
    verpaechter: { name: P("Name Verpächter"), anschrift: P("Anschrift Verpächter") },
    paechter: { name: P("Name Pächter"), anschrift: P("Anschrift Pächter"), betrieb: P("Betrieb") },
    flaechen: [{ bezeichnung: P("Gemarkung, Flur, Flurstück"), groesse: P("Größe"), nutzung: P("Nutzung") }],
    gesamtFlaeche: P("Gesamtfläche"),
    nutzungsart: P("Nutzungsart"),
    pachtBeginn: P("Pachtbeginn"),
    befristet,
    laufzeit: P("Laufzeit"),
    pachtEnde: P("Pachtende"),
    pachtjahr: P("Pachtjahr"),
    pachtzins: P("Pachtzins je ha und gesamt"),
    jahrespacht: P("Jahrespacht"),
    staffel: staffel ? P("Staffel") : "",
    zahlweise: P("Zahlweise und Fälligkeit"),
    umsatzsteuer,
    konto: P("Konto"),
    wasserverband,
    verpflichtungen: P("bestehende Verpflichtungen"),
    besonderes: P("Besondere Vereinbarungen"),
    anzeigeStelle: P("zuständige Behörde"),
  };
}

export const PACHTVERTRAG: Vorlage<PachtvertragDaten> = {
  id: "pachtvertrag",
  version: "2026-09-24",
  titel: "Landpachtvertrag",
  beschreibung: "Vollständiger Landpachtvertrag zwischen Anbieter (Verpächter) und Suchendem (Pächter), online in Textform unterschrieben.",
  render,
  varianten: [
    { name: "befristet, ohne USt, Wasserverband Verpächter", daten: platzhalter(true, "ohne", "verpaechter", false) },
    { name: "befristet, mit Staffel, USt-Option, Wasserverband Pächter", daten: platzhalter(true, "zuzueglich", "paechter", true) },
    { name: "unbefristet, ohne USt, Wasserverband Verpächter", daten: platzhalter(false, "ohne", "verpaechter", false) },
    { name: "unbefristet, mit Staffel, USt-Option, Wasserverband Pächter", daten: platzhalter(false, "zuzueglich", "paechter", true) },
  ],
};
