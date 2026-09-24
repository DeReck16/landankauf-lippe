import { felder, h2, kasten, liste, p, paragraphen, trenner, type Block } from "../dokument";
import { DATENSCHUTZ_URL, FIRMA, FIRMA_ANSCHRIFT, FIRMA_KOPF, KUNDENBEREICH_URL } from "../firma";
import type { NachweisDaten, Vorlage } from "./typen";

// Nachweis- und Vermittlungsvertrag (Maklervertrag, §§ 652 ff. BGB) mit
// Suchenden — nur sie zahlen, und nur im Erfolgsfall. Formfrei (§ 656a BGB gilt
// nur für Wohnungen und Einfamilienhäuser); online geschlossen. Für Verbraucher
// mit Widerrufsbelehrung nach Muster (Art. 246a § 1 Abs. 2 EGBGB, Anlage 1),
// Muster-Widerrufsformular (Anlage 2) und Pflichtinformationen — ohne korrekte
// Belehrung droht der Verlust der Provision (BGH, Urt. v. 07.07.2016, I ZR 30/15).

type ArtText = {
  titel: string;
  suche: string;
  vertrag: string;
  vertraege: string;
  gegenueber: string;
  anderer: string;
};

const TEXT: Record<"pacht" | "kauf", ArtText> = {
  pacht: {
    titel: "Nachweis- und Vermittlungsvertrag – Pachtflächen",
    suche: "landwirtschaftlich oder forstwirtschaftlich nutzbare Flächen zur Pacht",
    vertrag: "Pachtvertrag",
    vertraege: "Pachtverträgen",
    gegenueber: "Verpächter",
    anderer: "Kaufvertrag",
  },
  kauf: {
    titel: "Nachweis- und Vermittlungsvertrag – Flächenkauf",
    suche: "landwirtschaftlich oder forstwirtschaftlich nutzbare Flächen zum Kauf",
    vertrag: "Kaufvertrag",
    vertraege: "Kaufverträgen",
    gegenueber: "Verkäufer",
    anderer: "Pachtvertrag",
  },
};

export function nachweisRender(art: "pacht" | "kauf") {
  return (d: NachweisDaten) => {
    const t = TEXT[art];
    const para = paragraphen();
    const verbraucher = d.eigenschaft === "verbraucher";
    const b: Block[] = [];

    b.push(
      felder([
        ["Lippe Forst", FIRMA_KOPF],
        ["Auftraggeber", [d.kunde.name, d.kunde.betrieb, d.kunde.anschrift, d.kunde.email, d.kunde.telefon].filter(Boolean).join(", ")],
        ["Handelt als", verbraucher ? "Verbraucher (§ 13 BGB)" : "Unternehmer (§ 14 BGB)"],
        ["Suchprofil", d.suchprofil],
        ["Vorgang", d.vorgang],
        ["Konditionen", `Stand ${d.konditionenVersion}`],
      ]),
    );

    // § 1 Gegenstand
    b.push(
      para("Gegenstand des Vertrags"),
      p(`(1) Der Auftraggeber sucht ${t.suche}. Lippe Forst weist ihm Gelegenheiten zum Abschluss von ${t.vertraege} über solche Flächen nach und vermittelt auf Wunsch den Vertragsschluss (Maklervertrag, §§ 652 ff. BGB).`),
      p("(2) Vor einer Freigabe erhält der Auftraggeber zu passenden Flächen nur anonyme Eckdaten (Gemeinde, Flächentyp, ungefähre Größe, Pacht oder Kauf). Stimmen der Auftraggeber und der Anbieter dem Kontakt zu, gibt Lippe Forst dem Auftraggeber im Kundenbereich Name und Kontaktdaten des Anbieters sowie die Flächenangaben (Gemarkung, Flur, Flurstück, Größe) bekannt („Freigabe“). Mit der Freigabe ist die Gelegenheit zum Vertragsschluss nachgewiesen."),
      p("(3) Lippe Forst ist zu einer bestimmten Tätigkeit oder einem Erfolg nicht verpflichtet. Der Auftraggeber ist frei, ob er einen Vertrag schließt."),
      p(`(4) Lippe Forst darf auch für den ${t.gegenueber} tätig werden; von ihm verlangt Lippe Forst keine Vergütung. Lippe Forst verhält sich gegenüber beiden Seiten unparteiisch.`),
    );

    // § 2 Provision
    const provision: Block[] = [
      para("Provision"),
      p(`(1) Kommt infolge des Nachweises oder der Vermittlung von Lippe Forst ein ${t.vertrag} zwischen dem Auftraggeber und dem nachgewiesenen ${t.gegenueber} über eine nachgewiesene Fläche zustande, schuldet der Auftraggeber Lippe Forst eine Provision von ${d.provision}.${verbraucher ? ` Der Gesamtbetrag einschließlich Umsatzsteuer beträgt ${d.provisionBrutto}.` : ""}`),
    ];
    if (art === "pacht") {
      provision.push(
        p("(2) Jahrespacht ist der für ein volles Pachtjahr vereinbarte Pachtzins ohne Umsatzsteuer, unabhängig davon, ob er jährlich, halbjährlich oder in anderen Raten gezahlt wird. Ist der Pachtzins gestaffelt oder für einzelne Pachtjahre unterschiedlich hoch vereinbart (auch bei pachtfreien oder ermäßigten Anlaufjahren), ist der Durchschnitt der für die ersten fünf Pachtjahre vereinbarten Jahrespachten maßgeblich, bei einer kürzeren festen Laufzeit der Durchschnitt über die gesamte Laufzeit. Einmalige Zahlungen des Pächters an den Verpächter für die Überlassung (z. B. Einstands- oder Abstandszahlungen) werden gleichmäßig auf diese Pachtjahre verteilt und hinzugerechnet. Wertsicherungs- und Anpassungsklauseln bleiben außer Betracht."),
        p("(3) Ist eine Pachtzeit von weniger als einem Jahr vereinbart, ist die Provision auf den für die gesamte Pachtzeit vereinbarten Pachtzins begrenzt."),
        p("(4) Der Anspruch entsteht mit dem Abschluss des Pachtvertrags (bei Online-Abschluss mit der zweiten Unterschrift) und ist 14 Tage nach Zugang der Rechnung fällig. Eine spätere Kündigung, Aufhebung oder Nichtdurchführung des Pachtvertrags lässt ihn unberührt. Er entfällt, wenn der Pachtvertrag von Anfang an unwirksam ist, wirksam angefochten oder aufgrund einer Beanstandung nach dem Landpachtverkehrsgesetz aufgehoben wird."),
      );
    } else {
      provision.push(
        p("(2) Kaufpreis ist der im notariellen Vertrag vereinbarte Preis für die Fläche einschließlich mitverkaufter Bestandteile und Aufwuchs (z. B. Holzbestand) und mitverkauften Zubehörs."),
        p("(3) Der Anspruch entsteht mit der notariellen Beurkundung des Kaufvertrags. Bedarf der Vertrag einer behördlichen Genehmigung (z. B. nach dem Grundstückverkehrsgesetz) oder steht er unter einer aufschiebenden Bedingung, entsteht der Anspruch erst, wenn der Vertrag wirksam wird (§ 652 Abs. 1 Satz 2 BGB). Die Provision ist 14 Tage nach Zugang der Rechnung fällig."),
        p("(4) Wird ein gesetzliches Vorkaufsrecht ausgeübt oder die Genehmigung endgültig versagt, entfällt der Anspruch. Eine spätere Aufhebung oder Rückabwicklung des wirksamen Kaufvertrags lässt ihn unberührt, es sei denn, der Vertrag ist von Anfang an unwirksam oder wird wirksam angefochten."),
      );
    }
    provision.push(
      p(`(5) Abweichungen vom angebotenen Preis, von der Laufzeit oder den übrigen Bedingungen sowie der Abschluss über einen Teil der nachgewiesenen Flächen lassen den Anspruch unberührt, soweit der geschlossene Vertrag dem nachgewiesenen wirtschaftlich gleichwertig ist.`),
      p(`(6) Der ${t.gegenueber} zahlt keine Provision. Weitere Kosten, Gebühren oder Auslagen berechnet Lippe Forst dem Auftraggeber nicht; bleibt der Erfolg aus, ist nichts zu zahlen.`),
    );
    b.push(...provision);

    // § 3 Abschluss außerhalb der Plattform, gleichwertige Geschäfte (Provisionsschutz)
    b.push(
      para("Abschluss außerhalb der Plattform und gleichwertige Geschäfte"),
      p(`(1) Die Provision entsteht auch, wenn der Auftraggeber infolge des Nachweises von Lippe Forst einen ${t.vertrag} über eine ihm nachgewiesene Fläche außerhalb des Kundenbereichs schließt (schriftlich, beim Notar oder auf andere Weise).`),
      p(`(2) Dem steht gleich der Abschluss durch den Ehegatten oder eingetragenen Lebenspartner des Auftraggebers oder durch eine Gesellschaft, die der Auftraggeber beherrscht oder an der er mehrheitlich beteiligt ist, wenn der Vertrag dem Auftraggeber wirtschaftlich wie ein eigener zugutekommt; ebenso der Abschluss über einen Teil der nachgewiesenen Flächen oder mit einem Miteigentümer oder Rechtsnachfolger des nachgewiesenen ${t.gegenueber}s über die nachgewiesene Fläche.`),
      p(`(3) Beabsichtigte Hauptverträge sind Pacht- und Kaufverträge. Schließt der Auftraggeber über eine nachgewiesene Fläche statt eines ${t.vertrag}s einen ${t.anderer} mit dem nachgewiesenen ${t.gegenueber}, schuldet er die Provision für diese Vertragsart, also ${d.provisionAndere}.`),
      p(`(4) Für weitere Flächen desselben ${t.gegenueber}s schuldet der Auftraggeber eine Provision nur, wenn Lippe Forst ihm auch die Gelegenheit zum Abschluss über diese Flächen nachgewiesen hat und der Vertrag darauf beruht. Nachgewiesen sind alle Flächen, die der ${t.gegenueber} über Lippe Forst angeboten hat und die Lippe Forst dem Auftraggeber mit der Freigabe oder danach in Textform (z. B. im Kundenbereich) mit Flurstück und Abschlussbereitschaft benennt.`),
      p("(5) Die gesetzliche Verteilung der Beweislast bleibt unberührt."),
      p("(6) Der Auftraggeber behandelt Nachweise vertraulich und gibt sie nicht an Dritte weiter; ausgenommen sind Personen, die zur beruflichen Verschwiegenheit verpflichtet sind (z. B. Rechtsanwalt, Steuerberater). Für eine schuldhafte unbefugte Weitergabe haftet er nach den gesetzlichen Vorschriften."),
    );

    // § 4 Mitteilungspflichten
    b.push(
      para("Mitteilungen des Auftraggebers"),
      p(`(1) Schließt der Auftraggeber oder eine ihm nach § 3 Abs. 2 gleichstehende Person innerhalb von ${d.schutzMonate} Monaten nach dem Nachweis einen Pacht- oder Kaufvertrag über eine nachgewiesene Fläche, teilt er dies Lippe Forst binnen 14 Tagen in Textform mit (Datum, Vertragspartner, Fläche, Laufzeit und Pachtzins bzw. Kaufpreis). Auf Verlangen legt er die für die Berechnung der Provision maßgeblichen Teile des Vertrags vor; andere Inhalte darf er schwärzen. Die Mitteilung ist im Kundenbereich (${KUNDENBEREICH_URL}) oder per E-Mail an ${FIRMA.email} möglich.`),
      p("(2) War dem Auftraggeber eine freigegebene Fläche bereits vorher als Vertragsgelegenheit bekannt, soll er dies Lippe Forst unverzüglich nach der Freigabe mitteilen; wer das unterlässt, verliert dadurch keine Rechte. Ein Provisionsanspruch besteht nur, wenn der Nachweis von Lippe Forst für den Vertragsschluss ursächlich war."),
    );

    // § 5 Laufzeit, Kündigung
    b.push(
      para("Laufzeit und Kündigung"),
      p(`(1) Der Vertrag gilt auf unbestimmte Zeit. Beide Seiten können ihn jederzeit ohne Einhaltung einer Frist in Textform kündigen, der Auftraggeber auch über die Schaltfläche „Verträge hier kündigen“ (${KUNDENBEREICH_URL}/kuendigung).`),
      p("(2) Die Kündigung lässt Ansprüche aus Verträgen unberührt, die auf einem vor der Kündigung erfolgten Nachweis beruhen; § 4 Abs. 1 gilt für diese Nachweise fort."),
    );

    // § 6 Datenschutz
    b.push(
      para("Datenschutz und Einwilligung in die Weitergabe"),
      p("(1) Lippe Forst verarbeitet die Daten des Auftraggebers zur Durchführung dieses Vertrags (Art. 6 Abs. 1 lit. b DSGVO)."),
      p(`(2) Der Auftraggeber willigt ein, dass Lippe Forst bei einer Freigabe Name, Anschrift, Telefonnummer, E-Mail-Adresse und gegebenenfalls den Betrieb des Auftraggebers an den jeweiligen Anbieter weitergibt (Art. 6 Abs. 1 lit. a DSGVO). Eine Freigabe erfolgt nur nach Zustimmung zum konkreten Kontakt. Die Einwilligung kann jederzeit mit Wirkung für die Zukunft widerrufen werden; bereits erfolgte Weitergaben bleiben unberührt.`),
      p(`(3) Unterschriebene Verträge und Unterschriftsprotokolle werden nach den handels- und steuerrechtlichen Aufbewahrungsfristen gespeichert. Einzelheiten: ${DATENSCHUTZ_URL}.`),
    );

    // § 7 Haftung
    b.push(
      para("Haftung"),
      p("(1) Angaben der Anbieter (z. B. zu Größe, Nutzung, Bodengüte, Rechten Dritter oder Förderverpflichtungen) gibt Lippe Forst ungeprüft weiter; der Auftraggeber prüft sie vor Vertragsschluss selbst."),
      p("(2) Lippe Forst haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie für Schäden aus der Verletzung von Leben, Körper oder Gesundheit. Bei einfacher Fahrlässigkeit haftet Lippe Forst nur für die Verletzung wesentlicher Vertragspflichten und begrenzt auf den vorhersehbaren, vertragstypischen Schaden."),
    );

    // § 8 Online-Abschluss, Schluss
    b.push(
      para("Vertragsschluss und Schlussbestimmungen"),
      p("(1) Der Vertrag kommt zustande, wenn der Auftraggeber ihn im Kundenbereich durch Eingabe seines Namens und Betätigen der Schaltfläche „Zahlungspflichtig beauftragen“ abschließt. Lippe Forst bestätigt den Vertrag unverzüglich per E-Mail mit dem Vertragstext als PDF samt Unterschriftsprotokoll."),
      p("(2) Änderungen und Ergänzungen bedürfen der Textform. Es gilt deutsches Recht; bei Verbrauchern bleibt der Schutz zwingender Vorschriften ihres Aufenthaltsstaats unberührt."),
      p("(3) Ist der Auftraggeber Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen, ist Gerichtsstand der Sitz der TR Vertriebs GmbH."),
      p("(4) Lippe Forst ist nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen."),
      p("(5) Sollte eine Bestimmung unwirksam sein, bleibt der Vertrag im Übrigen wirksam (§ 306 BGB)."),
    );

    if (verbraucher) {
      b.push(trenner(), ...widerrufsbelehrung(), trenner(), ...widerrufsformular(), trenner(), ...pflichtinformationen(art, d));
    }

    return {
      titel: t.titel,
      untertitel: `zwischen ${FIRMA.name} („${FIRMA.marke}“) und dem Auftraggeber · Provision nur im Erfolgsfall`,
      bloecke: b,
    };
  };
}

// ---------------------------------------------------------------------------
// Widerrufsbelehrung (Muster nach Anlage 1 zu Art. 246a § 1 Abs. 2 Satz 2 EGBGB,
// Gestaltungshinweise für Dienstleistungen) und Muster-Widerrufsformular (Anlage 2)

export const WIDERRUF_URL = `${KUNDENBEREICH_URL}/widerruf`;

export function widerrufsbelehrung(): Block[] {
  // Wortlaut nach Anlage 1 zu Art. 246a § 1 Abs. 2 Satz 2 EGBGB in der Fassung ab
  // 19.06.2026 (Gestaltungshinweise ① „des Vertragsabschlusses“, ② Kontaktdaten,
  // ③ neu: Widerrufsfunktion nach § 356a BGB, ⑥ Wertersatz bei Dienstleistungen).
  return [
    h2("Widerrufsbelehrung"),
    kasten("Widerrufsrecht", [
      "Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.",
      "Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.",
      `Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (${FIRMA_ANSCHRIFT}, Telefon ${FIRMA.telefon}, E-Mail ${FIRMA.email}) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.`,
      `Sie können Ihr Widerrufsrecht auch online unter ${WIDERRUF_URL} (Schaltfläche „Vertrag widerrufen“, auch in Ihrem Kundenbereich) ausüben. Wenn Sie diese Online-Funktion nutzen, übermitteln wir Ihnen auf einem dauerhaften Datenträger (z. B. durch eine E-Mail) unverzüglich eine Eingangsbestätigung mit Informationen zum Inhalt der Widerrufserklärung sowie dem Datum und der Uhrzeit ihres Eingangs.`,
      "Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.",
    ]),
    kasten("Folgen des Widerrufs", [
      "Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.",
      "Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen soll, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.",
    ]),
    p("Ende der Widerrufsbelehrung"),
  ];
}

export function widerrufsformular(): Block[] {
  return [
    h2("Muster-Widerrufsformular"),
    p("(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)"),
    liste([
      `An ${FIRMA_ANSCHRIFT}, E-Mail ${FIRMA.email}:`,
      "Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*)",
      "Bestellt am (*)/erhalten am (*)",
      "Name des/der Verbraucher(s)",
      "Anschrift des/der Verbraucher(s)",
      "Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)",
      "Datum",
    ]),
    p("(*) Unzutreffendes streichen."),
  ];
}

function pflichtinformationen(art: "pacht" | "kauf", d: NachweisDaten): Block[] {
  const t = TEXT[art];
  return [
    h2("Informationen für Verbraucher"),
    p("(Art. 246a § 1 EGBGB und Art. 246c EGBGB)"),
    felder([
      ["Unternehmer", FIRMA_KOPF],
      ["Wesentliche Eigenschaften", `Nachweis von Gelegenheiten zum Abschluss von ${t.vertraege} über land- oder forstwirtschaftliche Flächen und auf Wunsch Vermittlung; Abschluss des ${t.vertrag}s auf Wunsch online über den Kundenbereich.`],
      ["Gesamtpreis", `Provision nur im Erfolgsfall: ${d.provisionBrutto}. Keine weiteren Kosten.`],
      ["Zahlung", "Per Überweisung nach Rechnung; fällig 14 Tage nach Zugang der Rechnung."],
      ["Leistungszeit", "Nachweise erfolgen, sobald eine passende Fläche angeboten wird und beide Seiten dem Kontakt zugestimmt haben. Ein bestimmter Zeitpunkt oder Erfolg ist nicht geschuldet."],
      ["Laufzeit", "Unbestimmte Zeit; jederzeit ohne Frist kündbar. Keine Mindestlaufzeit."],
      ["Widerrufsrecht", "Es besteht ein Widerrufsrecht (siehe Widerrufsbelehrung). Haben Sie verlangt, dass wir vor Ablauf der Widerrufsfrist beginnen, schulden Sie im Fall des Widerrufs Wertersatz für bis dahin erbrachte Leistungen. Das Widerrufsrecht erlischt, wenn wir die Dienstleistung vollständig erbracht haben und Sie vorher ausdrücklich den Beginn vor Fristablauf verlangt und Ihre Kenntnis vom Erlöschen bestätigt haben (§ 356 Abs. 4 BGB)."],
      ["Widerrufsfunktion", `Während der Widerrufsfrist steht die Schaltfläche „Vertrag widerrufen“ oben auf der Übersichtsseite Ihres Kundenbereichs (${KUNDENBEREICH_URL}) sowie ohne Anmeldung unter ${WIDERRUF_URL} bereit. Nach dem Absenden erhalten Sie eine Eingangsbestätigung per E-Mail.`],
      ["Kündigung", `Jederzeit ohne Frist, auch über die Schaltfläche „Verträge hier kündigen“ (${KUNDENBEREICH_URL}/kuendigung).`],
      ["Vertragsschluss", "Angaben im Kundenbereich erfassen, Vertragstext lesen, Erklärungen anhaken, Namen eingeben, Schaltfläche „Zahlungspflichtig beauftragen“ betätigen. Bis dahin können Eingaben jederzeit geändert werden; der Vorgang kann ohne Folgen abgebrochen werden."],
      ["Vertragstext", "Der Vertragstext wird bei Lippe Forst gespeichert und Ihnen als PDF per E-Mail zugesandt; im Kundenbereich ist er jederzeit abrufbar."],
      ["Vertragssprache", "Deutsch"],
      ["Verhaltenskodizes", "Keine"],
      ["Streitbeilegung", "Lippe Forst ist nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen."],
    ]),
  ];
}

// ---------------------------------------------------------------------------

const P = (s: string) => `«${s}»`;

function platzhalter(eigenschaft: NachweisDaten["eigenschaft"]): NachweisDaten {
  return {
    eigenschaft,
    kunde: { name: P("Name"), betrieb: P("Betrieb"), anschrift: P("Anschrift"), email: P("E-Mail"), telefon: P("Telefon") },
    vorgang: P("Vorgang"),
    suchprofil: P("Suchprofil"),
    provision: P("Provision (Konditionen)"),
    provisionBrutto: P("Gesamtbetrag inkl. USt"),
    provisionAndere: P("Provision andere Vertragsart"),
    konditionenVersion: P("Konditionen-Version"),
    schutzMonate: P("Monate"),
  };
}

export const NACHWEIS_PACHT: Vorlage<NachweisDaten> = {
  id: "nachweis-pacht",
  version: "2026-09-24",
  titel: "Nachweis-/Vermittlungsvertrag Pacht (Suchende)",
  beschreibung: "Maklervertrag mit Pacht-Suchenden: Provision nur im Erfolgsfall (Standard: eine volle Jahrespacht zzgl. USt), Provisionsschutz, Mitteilungspflicht; für Verbraucher mit Widerrufsbelehrung und Pflichtinformationen.",
  render: nachweisRender("pacht"),
  varianten: [
    { name: "Verbraucher", daten: platzhalter("verbraucher") },
    { name: "Unternehmer", daten: platzhalter("unternehmer") },
  ],
};

export const NACHWEIS_KAUF: Vorlage<NachweisDaten> = {
  id: "nachweis-kauf",
  version: "2026-09-24",
  titel: "Nachweis-/Vermittlungsvertrag Kauf (Suchende)",
  beschreibung: "Maklervertrag mit Kauf-Suchenden: Provision nur im Erfolgsfall (Standard: 3,59 % des Kaufpreises zzgl. USt), entsteht mit Beurkundung bzw. Wirksamkeit; für Verbraucher mit Widerrufsbelehrung und Pflichtinformationen.",
  render: nachweisRender("kauf"),
  varianten: [
    { name: "Verbraucher", daten: platzhalter("verbraucher") },
    { name: "Unternehmer", daten: platzhalter("unternehmer") },
  ],
};
