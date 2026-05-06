// Blog-Artikel als typisierte Daten. HTML-Content inline für minimale
// Build-Komplexität. Sortiert nach publishedAt absteigend.

export type Article = {
  slug: string;
  title: string;
  description: string;
  category: "VNS" | "Markt" | "Recht" | "Praxis" | "Wald" | "Förderung";
  publishedAt: string; // ISO date
  updatedAt?: string;
  readingMinutes: number;
  keywords: string[];
  /** HTML body (between hero and CTA). Use semantic markup, no <h1>. */
  content: string;
};

export const ARTICLES: Article[] = [
  {
    slug: "vertragsnaturschutz-nrw-frist-juni-2026",
    title:
      "Vertragsnaturschutz NRW 2026: Die 30.06.-Frist und was Lipper Eigentümer jetzt tun sollten",
    description:
      "Bis zum 30. Juni 2026 müssen VNS-Anträge für Verpflichtungen ab 01.01.2027 bei der UNB Kreis Lippe eingegangen sein. Welche Pakete passen, welche Lipper Flächen besonders profitieren — und wie der Antragsweg über die Biologische Station Lippe abläuft.",
    category: "VNS",
    publishedAt: "2026-05-06",
    readingMinutes: 9,
    keywords: [
      "Vertragsnaturschutz NRW 2026",
      "VNS Frist 30.06.2026",
      "VNS Antrag Kreis Lippe",
      "Biologische Station Lippe",
      "UNB Kreis Lippe",
      "Förderung extensives Grünland NRW",
      "Streuobstwiesen Förderung NRW",
      "ELAN Antrag VNS",
      "FFH Gebiet Egge Vertragsnaturschutz",
    ],
    content: `
<p class="lead">In knapp acht Wochen läuft die zentrale Antragsfrist 2026 für den Vertragsnaturschutz NRW (VNS) ab. Wer bis zum <strong>30. Juni 2026</strong> seinen Grundantrag nicht bei der UNB Kreis Lippe einreicht, verliert ein ganzes Förderjahr — und damit oft vier- bis fünfstellige Beträge pro Hektar über die Verpflichtungslaufzeit. Hier der praktische Leitfaden für Eigentümer im Kreis Lippe.</p>

<h2>Worum es beim Vertragsnaturschutz NRW eigentlich geht</h2>
<p>Der Vertragsnaturschutz ist seit den 1980er Jahren das wichtigste freiwillige Förderinstrument für extensive landwirtschaftliche Nutzung in Nordrhein-Westfalen. Eigentümer oder Bewirtschafter verpflichten sich für 3 oder 5 Jahre, eine Fläche schonend zu bewirtschaften — späte Mahd, reduzierte Düngung, kein Pflanzenschutz, Erhalt von Strukturen wie Hecken oder Streuobstreihen. Dafür gibt es eine jährliche Ausgleichszahlung.</p>
<p>In NRW läuft das Programm über ein Verbundsystem: Die <strong>Biologische Station Lippe</strong> berät vor Ort und schlägt das passende Paket vor, die <strong>Untere Naturschutzbehörde (UNB) Kreis Lippe</strong> bewilligt und schließt den Vertrag, die <strong>Landwirtschaftskammer NRW</strong> wickelt die jährliche Auszahlung über das ELAN-Portal ab.</p>

<h2>Die Frist: Warum der 30. Juni 2026 so wichtig ist</h2>
<p>Damit eine Verpflichtung am 01.01.2027 starten kann, muss der Grundantrag im laufenden Jahr — also bis spätestens 30.06.2026 — elektronisch über ELAN bei der UNB Kreis Lippe eingehen. Wer die Frist verpasst, kann frühestens 2028 starten. Bei einem typischen 5-jährigen VNS-Vertrag mit beispielsweise 1.200 €/ha/Jahr und 3 ha Grünland sind das <strong>18.000 € verlorene Förderung</strong> wegen ein paar Wochen zu spät.</p>
<p>Die Bio-Station Lippe und die UNB nehmen die meisten Erstgespräche im April und Mai an — wer im Juni anruft, läuft in den Engpass und riskiert, dass die Bestandserfassung nicht mehr rechtzeitig läuft.</p>

<h2>Welche Flächen im Kreis Lippe besonders profitieren</h2>
<p>Nicht jede Fläche eignet sich gleich gut. Aus unserer Praxis und in Abstimmung mit der Bio-Station Lippe haben wir vier Lipper Hotspots identifiziert, in denen VNS überproportional lohnt:</p>
<ul>
<li><strong>FFH-Gebiet Egge (DE-4319-301)</strong> — die Hochlagen rund um Veldrom, Leopoldstal, Holzhausen-Externsteine und das Silberbachtal. Hier sind extensive Mähwiesen (LRT 6510) und Bergmähwiesen (LRT 6520) als Schutzgut anerkannt. Höchste Förderpakete plus Zusatzmodule für späte Mahd und Verzicht auf Mineraldüngung.</li>
<li><strong>NSG Silberbachtal mit Ziegenberg (LIP-028)</strong> — Hangflächen entlang der L 954 mit hohem ökologischem Potenzial.</li>
<li><strong>Bach- und Aueflächen entlang der Werre, Bega und Emmer</strong> — gut für Pakete „Extensive Grünland-Bewirtschaftung in Auen" und Renaturierungs-Bonus.</li>
<li><strong>Streuobstwiesen rund um Bad Salzuflen, Lemgo und Schieder-Schwalenberg</strong> — eigenes Paket mit fester Förderhöhe pro Baum (25 €/Baum, max. 1.900 €/ha).</li>
</ul>
<p>Wenn Ihre Fläche in einer dieser Kulissen liegt, lohnt sich der VNS-Antrag fast immer.</p>

<h2>VNS-Pakete und Förderhöhen 2026 im Überblick</h2>
<p>Die Pakete und Sätze sind in der aktuellen <em>Förderrichtlinie Vertragsnaturschutz NRW</em> (zuletzt aktualisiert 2025) festgeschrieben. Die wichtigsten Eckwerte für den Kreis Lippe:</p>
<ul>
<li><strong>Extensives Grünland</strong>: 345 €/ha/Jahr Grundförderung, mit Zusatzmodulen (späte Mahd, Düngerverzicht, Mahdwerkzeug) bis ca. 950 €/ha/Jahr.</li>
<li><strong>Mahd-Kennarten-Wiesen (artenreiche Mähwiesen)</strong>: bis 2.040 €/ha/Jahr — höchste Förderstufe, an Nachweis von Indikatorarten (z. B. Wiesen-Glockenblume, Margerite, Herbstzeitlose) gebunden.</li>
<li><strong>Acker-zu-Grünland-Umwandlung</strong>: 440–2.040 €/ha/Jahr je nach Bonität und Lage. Sehr interessant für mäßige Acker-Bonitäten an Hängen oder im Auenbereich.</li>
<li><strong>Streuobstpflege</strong>: 25 €/Baum/Jahr, gedeckelt auf 1.900 €/ha.</li>
<li><strong>Heckenpflege</strong>: 0,75–1,13 €/m² je nach Pflegeart.</li>
<li><strong>Ackerextensivierung</strong> (Stoppelbrache, Lerchenfenster, Blühstreifen): 350–1.800 €/ha/Jahr.</li>
</ul>
<p>Die echte Höhe für eine konkrete Fläche ergibt sich aus Bonität, Lage in der Schutzgebietskulisse und Kombination der Module. Die Bio-Station rechnet das im Beratungstermin durch.</p>

<h2>Der Antragsweg: Schritt für Schritt</h2>
<ol>
<li><strong>Erstgespräch mit der Biologischen Station Lippe e. V.</strong> — Domäne 2, 32816 Schieder-Schwalenberg, Telefon 05282 462. Mitbringen: Liegenschaftsauszug, Grundbuchauszug, ggf. Pachtvertrag. Die Bio-Station prüft, ob die Fläche in einer förderfähigen Kulisse liegt und schlägt geeignete Pakete vor.</li>
<li><strong>Bestandserfassung vor Ort</strong> — die Bio-Station kommt zu einem festen Termin auf die Fläche, dokumentiert Kennarten und Strukturen. Daraus entsteht der Maßnahmenplan.</li>
<li><strong>Antragstellung über ELAN</strong> — der Bewirtschafter (oft der Pächter, nicht der Eigentümer) reicht den Antrag elektronisch über die Landwirtschaftskammer NRW ein. Wenn keine eigene Betriebsnummer (BNR-ZD) vorliegt, wird sie vorher über die LWK Kreisstelle Lippe-Höxter (Felix-Fechenbach-Str. 5, Detmold) beantragt.</li>
<li><strong>Bewilligung durch UNB Kreis Lippe</strong> — Tobias Kleingödinghaus (Telefon 05231 62 6390) prüft den Antrag, schließt den 5-Jahres-Vertrag und meldet zur Auszahlung an die LWK.</li>
<li><strong>Jährliche Auszahlung über ELAN</strong> — die Bewirtschaftung wird stichprobenartig kontrolliert.</li>
</ol>
<p>Realistischer Zeitbedarf vom Erstgespräch bis Antragseingang: 4 bis 8 Wochen. Wer also die Frist 30.06.2026 sicher halten will, sollte spätestens <strong>Mitte Mai 2026</strong> das Erstgespräch geführt haben.</p>

<h2>Eigentümer vs. Pächter — wer beantragt?</h2>
<p>Diese Frage ist die häufigste Hürde. VNS wird in der Regel vom <strong>Bewirtschafter</strong> beantragt (also dem aktuellen Pächter, falls die Fläche verpachtet ist). Der Pächter braucht eine eigene Betriebsnummer und führt die Bewirtschaftungsauflagen aus. Der Eigentümer profitiert indirekt: Bei VNS-geförderten Flächen wird üblicherweise eine Aufteilung der Mehrerträge zwischen Pächter und Eigentümer vereinbart — typisch 50–70 % der Förderung an den Eigentümer als erhöhter Pachtzins.</p>
<p>Wenn der aktuelle Pächter nicht mitmachen will oder kein VNS-erfahrener Betrieb ist, gibt es zwei Wege: Pachtvertrag zum nächsten Termin auslaufen lassen und neu vergeben (mit VNS-Klausel), oder den Vertrag in Abstimmung umstellen.</p>

<h2>Häufige Fehler beim VNS-Antrag</h2>
<ul>
<li><strong>Zu spät anrufen.</strong> Wer im Juni anruft, ist meist zu spät — die Bio-Station ist im Frühjahr ausgelastet, Bestandserfassungen brauchen Vorlauf.</li>
<li><strong>Falsche Pakete wählen.</strong> Hohe Pakete bringen hohe Förderung, aber auch hohe Auflagen. Wenn der Pächter die nicht einhalten will, fliegt der Vertrag bei der Kontrolle und Sie zahlen die Förderung zurück.</li>
<li><strong>Pachtvertrag nicht angepasst.</strong> Der laufende Pachtvertrag muss VNS-konform sein — sonst Konflikt zwischen Pflicht und Vertrag.</li>
<li><strong>Doppelförderung übersehen.</strong> VNS und ELER-Greening können sich teilweise ausschließen. Die Bio-Station weiß im Detail, was kombinierbar ist.</li>
<li><strong>Mehrjahres-Effekt ignorieren.</strong> Wer eine 5-Jahres-Verpflichtung eingeht, kann vor Ablauf nur unter Strafe rauskommen. Bei geplantem Verkauf 2027 oder 2028 unbedingt Pakete mit kürzerer Laufzeit oder Übertragbarkeit wählen.</li>
</ul>

<h2>Wenn die VNS-Frist nicht passt: Alternativen</h2>
<p>Nicht jede Fläche und jeder Eigentümer passt zum VNS-Verfahren. Die Alternativen, die wir mit unseren Kunden gerade durchspielen:</p>
<ul>
<li><strong>Ökopunkte / Ökokonto</strong> — einmalige Aufwertungserlöse, kein langer Vertrag, Eigentum bleibt voll erhalten. Sinnvoll bei Acker-zu-Wiese-Umwandlung, Heckenpflanzung oder Tümpelanlage.</li>
<li><strong>Privatwald-Förderprogramme NRW</strong> — Biotopbaum-Förderung als Einmalzahlung pro Baum (bis 1.400 € pro Eiche bei 80 cm BHD), kombinierbar mit klassischer Pacht der angrenzenden Flächen.</li>
<li><strong>Direktverkauf an einen Käufer mit Naturschutz-Affinität</strong> — wir haben spezialisierte Investoren im Netzwerk, die Flächen mit ökologischem Aufwertungspotenzial gezielt suchen.</li>
</ul>

<h2>Was wir konkret tun</h2>
<p>Lippe Forst ist Eigentümer eigener Forst- und Wiesenflächen rund um Leopoldstal, den Püngelsberg und das Triftenberge-Gebiet. Wir kennen die Bio-Station Lippe persönlich, haben mit der UNB Kreis Lippe in eigener Sache zusammengearbeitet und wissen, welche Pakete für welche Lipper Lage tatsächlich Sinn ergeben.</p>
<p>Wenn Sie unsicher sind, ob VNS für Ihre Fläche passt — und ob die Frist 30.06.2026 noch zu schaffen ist — schauen wir kostenlos drauf. Sprechen Sie uns an, idealerweise <strong>noch im Mai 2026</strong>, damit das Erstgespräch mit der Bio-Station rechtzeitig stattfindet.</p>
`,
  },
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function articlesSorted(): Article[] {
  return [...ARTICLES].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt)
  );
}

export const CATEGORY_LABEL: Record<Article["category"], string> = {
  VNS: "Vertragsnaturschutz",
  Markt: "Markt & Preise",
  Recht: "Recht & Steuern",
  Praxis: "Praxis & Tipps",
  Wald: "Wald & Forst",
  Förderung: "Förderung",
};
