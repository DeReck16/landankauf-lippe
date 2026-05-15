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
    slug: "photovoltaik-pacht-kreis-lippe",
    title:
      "Photovoltaik-Pacht im Kreis Lippe: Wann sich 3.500 €/ha lohnen — und wann sie zur Falle werden",
    description:
      "Solarpark-Investoren bieten Lipper Eigentümern aktuell 3.500 bis 5.000 €/ha pro Jahr — bei 30 Jahren Laufzeit. Wo sich das wirklich rechnet, welche fünf Fallen wir in Verträgen 2025/2026 gesehen haben und wann klassischer Verkauf oder Pacht besser ist.",
    category: "Markt",
    publishedAt: "2026-05-06",
    readingMinutes: 8,
    keywords: [
      "Photovoltaik Pacht Lippe",
      "PV Freifläche Acker Pacht NRW",
      "Solarpark Pacht Kreis Lippe",
      "Photovoltaik Ackerland verkaufen",
      "Pachtvertrag Solar 30 Jahre",
      "Rückbau Solarpark Pacht",
    ],
    content: `
<p class="lead">Seit 2023 bekommen Lipper Flächeneigentümer regelmäßig Briefe von Solarpark-Investoren: 3.500 bis 5.000 Euro pro Hektar und Jahr, 25 bis 30 Jahre Laufzeit, klingt unwiderstehlich. Doch wer nur die Jahreszahl rechnet, übersieht oft genau die Klauseln, die später teuer werden. Hier eine ehrliche Einordnung — was sich lohnt, was zur Falle wird, und wann Verkauf oder klassische Pacht die bessere Wahl bleibt.</p>

<h2>Wer aktuell anbietet — und wofür</h2>
<p>Aktiv im Kreis Lippe sind seit 2024 mehrere Investorengruppen: regionale Stadtwerke (auch aus Bielefeld und Paderborn), spezialisierte Projektentwickler aus dem OWL-Raum und überregionale Solarpark-Fonds. Die Anfragen kommen meist über drei Wege:</p>
<ul>
<li><strong>Direktanschreiben</strong> nach Grundbuch-Recherche, oft an Eigentümer 1–2 ha großer Schläge in Sennecharakter-Lagen</li>
<li><strong>Vermittler</strong>, die im Auftrag eines Investors mehrere benachbarte Eigentümer zusammenbringen</li>
<li><strong>Flächenpools</strong> mit der Gemeinde, in die Eigentümer freiwillig Flächen einbringen</li>
</ul>
<p>Gesucht werden Flächen mit guter Sonneneinstrahlung, ebener Topographie, Nähe zum Mittelspannungsnetz und idealerweise außerhalb von Schutzgebietskulissen. Die Mindestgröße liegt meist bei 5 ha (zusammenhängend oder im Pool mit Nachbarn).</p>

<h2>Wo Photovoltaik im Kreis Lippe besonders geht</h2>
<p>Aus unserer Praxis und nach Rücksprache mit der Kreisplanung sind vier Lagen im Kreis Lippe besonders im Fokus:</p>
<ul>
<li><strong>Senne-Übergang (Schlangen, Augustdorf)</strong> — sandige Böden mit niedriger Bonität, gute Sonneneinstrahlung, ebene Schläge. Klassisches PV-Land.</li>
<li><strong>Kalletal</strong> — ebene Talflächen mit guter Netzanbindung. Mehrere Projekte in Planung.</li>
<li><strong>Detmold-Pivitsheide / Heidenoldendorf</strong> — Mischlagen mit Hofstellen-Nähe, hier oft Konkurrenz mit klassischer Pacht.</li>
<li><strong>Lippisches Bergland-Übergang (Dörentrup, Barntrup)</strong> — vereinzelt ebene Schläge, geringere Bonität, gute Eignung.</li>
</ul>
<p>Schwierig bis ausgeschlossen sind Flächen im FFH-Gebiet Egge, in den NSGs Silberbachtal und Externstein-Bereich, sowie streng geschützte Bauerwartungs-Lagen.</p>

<h2>Pacht-Konditionen 2026</h2>
<p>Die Spanne ist breit, aber die Eckwerte aus aktuell laufenden Verhandlungen im Kreis Lippe und in den angrenzenden Kreisen Höxter, Paderborn und Gütersloh:</p>
<ul>
<li><strong>Jahrespacht</strong>: 3.500–5.000 €/ha bei Standardflächen. Premium-Lagen mit perfekter Netzanbindung gehen bis 6.000 €/ha. Schwierige Lagen mit hohem Investitionsaufwand: 2.800–3.500 €/ha.</li>
<li><strong>Indexierung</strong>: Üblich ist eine Anpassung an den Verbraucherpreisindex (VPI), oft mit Kappung bei 2–3 % pro Jahr.</li>
<li><strong>Umsatzbeteiligung</strong>: Manche Verträge bieten zusätzlich 0,3–0,5 % Beteiligung am Stromumsatz — kann sich bei steigenden Strompreisen lohnen.</li>
<li><strong>Vorlauf-Pacht</strong>: 50–100 % der vollen Pacht ab Vertragsschluss, auch während der 12–24 Monate Genehmigungsphase.</li>
<li><strong>Laufzeit</strong>: Standard sind 25 Jahre mit Verlängerungsoption um 5–10 Jahre. Manche Investoren wollen 30+5+5.</li>
<li><strong>Rechtliche Sicherung</strong>: Beschränkte persönliche Dienstbarkeit im Grundbuch — sichert dem Investor die Nutzung, auch wenn die Fläche verkauft wird.</li>
</ul>

<h2>Die fünf häufigsten Fallen in PV-Pachtverträgen</h2>
<p>Wir haben 2025 und 2026 mehrere PV-Vertragsentwürfe für Lipper Eigentümer geprüft. Diese fünf Klauseln werden am häufigsten zur Falle:</p>

<h3>1. Schwache Rückbau-Sicherung</h3>
<p>Am Ende der Laufzeit muss der Investor die Anlage entfernen und die Fläche wiederherstellen. Schwache Verträge sehen keine ausreichende Sicherheit dafür vor — wenn die Betreibergesellschaft in 28 Jahren insolvent ist, bleibt der Eigentümer auf 80.000–150.000 € Rückbaukosten pro Hektar sitzen. Gute Verträge fordern eine Bankbürgschaft oder Treuhandsicherung über die volle Laufzeit.</p>

<h3>2. Indexierung ohne Floor</h3>
<p>Eine VPI-Indexierung klingt fair — aber in deflationären Phasen kann die Pacht sinken. Faire Verträge haben einen „Floor": die Pacht steigt mit der Inflation, sinkt aber nie unter den Startbetrag.</p>

<h3>3. Vertragsdauer-Verlängerungsklausel zugunsten des Investors</h3>
<p>Manche Verträge geben dem Investor eine einseitige Verlängerungsoption — der Eigentümer kann nicht entscheiden, ob nach 25 Jahren Schluss ist. Bei einer 25+5+5-Klausel wird aus dem geplanten Schluss am Lebensabend plötzlich eine 35-Jahres-Verpflichtung.</p>

<h3>4. Genehmigungsphase als „Optionsfrist" ohne Pacht</h3>
<p>Viele Investoren wollen 12–24 Monate Optionsfrist während sie Bebauungsplan und Netzanschluss prüfen. Schwache Verträge zahlen in dieser Zeit nichts. Faire Verträge zahlen mindestens 50 % der vollen Pacht ab Vertragsschluss — auch wenn die Anlage noch nicht steht.</p>

<h3>5. Genehmigungsrisiko beim Eigentümer</h3>
<p>Manche Verträge enthalten Klauseln, die dem Eigentümer das Risiko übertragen, falls Bebauungsplan oder Genehmigung scheitern. Das gehört zum Investor. Punkt.</p>

<h2>Wann sich PV-Pacht wirklich lohnt</h2>
<p>Aus unserer Praxis ist PV-Pacht die richtige Wahl, wenn:</p>
<ul>
<li>Die Fläche eine eher schwache Acker-Bonität hat (Sandboden, niedrige Punkte) — der Opportunitätskostenverlust gegenüber klassischer Pacht ist gering</li>
<li>Der Eigentümer ein langfristiges, planbares Einkommen sucht und keine Liquidität braucht</li>
<li>Die Fläche groß genug ist (idealerweise 5+ ha) oder in einem Pool mit Nachbarn liegt</li>
<li>Der Vertrag professionell verhandelt wird (Rückbau-Sicherung, Indexierung, Vorlauf-Pacht, Genehmigungsrisiko)</li>
</ul>

<h2>Wann klassischer Verkauf oder Pacht besser ist</h2>
<p>PV ist nicht universell die beste Lösung. Klassische Pacht oder Direktverkauf gewinnt, wenn:</p>
<ul>
<li>Die Fläche hochwertig ist (Bonität 60+, hofnah) — klassische Pacht ist bei guter Lage steuerlich oft besser, weil Pacht unter EinkommensSt-Regel landet, PV-Pacht teils gewerblich gewertet wird</li>
<li>Die nächste Generation Interesse an der Fläche hat — eine 30-Jahres-PV-Bindung schließt die Übergabe an Kinder oft de facto aus</li>
<li>Die Fläche zeitnah verkauft werden soll — ein laufender PV-Vertrag macht den Verkauf komplizierter, weil der Käufer die Dienstbarkeit übernimmt</li>
<li>Der Eigentümer Liquidität braucht — bei 30 ha PV-Pacht à 4.000 €/ha sind das 120.000 €/Jahr brutto, aber der Verkaufswert würde sofort 1,5 Mio. € freisetzen (allerdings ohne 30 Jahre Folgeerträge)</li>
</ul>

<h2>Was wir konkret tun</h2>
<p>Wenn Sie ein PV-Angebot auf dem Tisch haben, prüfen wir kostenlos: ist die Pachthöhe marktgerecht, sind die fünf häufigen Fallen entschärft, lohnt sich der Vergleich mit klassischer Pacht oder Verkauf? Wir kennen die seriösen regionalen Investoren und können bei Bedarf in eine Mehrfach-Ausschreibung einsteigen — das holt oft 10–20 % mehr Pacht raus.</p>
<p>Falls PV nicht passt: <a href="/flaeche-verpachten">klassische Verpachtung</a>, <a href="/flaeche-bewerten">Wertindikation</a> und <a href="/flaeche-verkaufen">Direktankauf</a> bleiben die Alternativen. Welche am besten passt, ergibt sich aus Ihrer konkreten Fläche und Lebensplanung — nicht aus einer Pauschalantwort.</p>
`,
  },
  {
    slug: "oekopunkte-oekokonto-lippe",
    title:
      "Ökopunkte und Ökokonto im Kreis Lippe: Wenn die Fläche aufgewertet werden darf",
    description:
      "Wie das Ökokonto NRW funktioniert, welche Lipper Flächen sich eignen — und warum Ökopunkte für Eigentümer mit schwer bewirtschaftbaren Hangflächen oft mehr Geld bringen als ein klassischer Verkauf.",
    category: "Förderung",
    publishedAt: "2026-04-15",
    readingMinutes: 8,
    keywords: [
      "Ökopunkte Kreis Lippe",
      "Ökokonto NRW",
      "Ausgleichsflächen Lippe",
      "Wertaufwertung landwirtschaftliche Fläche",
      "Naturschutz Bauträger Kompensation",
    ],
    content: `
<p class="lead">Ökopunkte sind eines der missverständlichsten Förderinstrumente im Kreis Lippe. Wer sie versteht, kann aus einer scheinbar wertlosen Hangwiese eine vier- bis fünfstellige Einmalzahlung machen — bei vollem Eigentum. Hier der Praxis-Leitfaden für Lipper Flächen.</p>

<h2>Was Ökopunkte sind und woher sie kommen</h2>
<p>Wenn ein Bauträger in Lippe ein neues Wohngebiet plant, muss er den Eingriff in die Natur ausgleichen. Das schreibt das Bundesnaturschutzgesetz (§§ 13–17) vor. Die Frage ist nur: wo und wie? Genau hier kommt das <strong>Ökokonto</strong> ins Spiel: ein Eigentümer wertet seine Fläche freiwillig ökologisch auf — pflanzt eine Hecke, wandelt Acker in extensives Grünland, legt einen Tümpel an — und die Aufwertung wird in <strong>Ökopunkten</strong> bemessen. Diese Punkte werden später an Bauträger verkauft, die ihren Ausgleichspflicht damit erfüllen.</p>
<p>Eigentum bleibt vollständig erhalten. Es entsteht eine Grunddienstbarkeit, die im Grundbuch eingetragen wird und die Aufwertung dauerhaft sichert. Die Pflege übernimmt entweder der Eigentümer selbst (oft via Lohnunternehmer) oder ein beauftragter Pflegebetrieb.</p>

<h2>Welche Lipper Flächen sich besonders eignen</h2>
<ul>
<li><strong>Acker an Hanglagen oder mit niedriger Bonität</strong> — Acker zu extensivem Grünland umzuwandeln gibt überdurchschnittlich viele Ökopunkte.</li>
<li><strong>Verbuschende Brachen oder ungenutzte Wiesen</strong> — Aufwertung mit Mahdregime, Hecken, Saumstrukturen.</li>
<li><strong>Talauen entlang Werre, Bega und Emmer</strong> — Renaturierung mit Bachstrukturen ist sehr punkteträchtig.</li>
<li><strong>Flächen mit Streuobst-Potenzial</strong> — Neuanpflanzung von Hochstamm-Streuobst zählt extrem hoch.</li>
<li><strong>Kleinere Restflächen, die niemand pachten will</strong> — gerade die schwer bewirtschaftbaren Flächen, die im Verkauf nur den Bodenrichtwert bringen würden, sind im Ökokonto oft Goldgruben.</li>
</ul>

<h2>Wie die Wertkalkulation funktioniert</h2>
<p>Das Land NRW arbeitet mit dem <strong>Biotopwertverfahren</strong>: jeder Biotoptyp hat einen Wert in „Werteinheiten pro Quadratmeter" (WE/m²). Acker liegt typisch bei 4 WE/m², extensives Grünland bei 8–10 WE/m², artenreiches Mesotrophes Grünland bei 12–14 WE/m². Die Differenz vor / nach Aufwertung × Fläche = generierte Ökopunkte.</p>
<p>Beispielrechnung für einen Hektar Acker, der zu artenreichem Grünland aufgewertet wird:</p>
<ul>
<li>Vorher: 1 ha × (10.000 m² × 4 WE/m²) = 40.000 Werteinheiten</li>
<li>Nachher: 1 ha × (10.000 m² × 12 WE/m²) = 120.000 Werteinheiten</li>
<li>Generiert: <strong>80.000 Werteinheiten</strong></li>
</ul>
<p>Die Vermarktungspreise schwanken regional. Im Kreis Lippe und im OWL-Raum liegen sie aktuell zwischen <strong>0,50 € und 1,20 € pro Werteinheit</strong>. Aus dem Beispiel werden also <strong>40.000 € bis 96.000 € einmalige Einnahme pro Hektar</strong> — bei vollem Eigentum.</p>

<h2>Wer kauft die Punkte?</h2>
<p>Im Kreis Lippe sind drei Käufergruppen aktiv:</p>
<ul>
<li><strong>Kommunen</strong> — wenn sie für eigene Bauprojekte (Gewerbegebiete, Straßenbau, Wohnsiedlungen) Ausgleichsflächen brauchen.</li>
<li><strong>Private Bauträger</strong> — Bauunternehmer und Investoren, die Wohngebiete entwickeln.</li>
<li><strong>Spezialisierte Vermarkter</strong> wie die NRW.URBAN, kommunale Flächenagenturen oder private Ökopunkte-Händler aus dem OWL-Raum.</li>
</ul>
<p>Die UNB Kreis Lippe führt eine Liste anerkannter Ökokonto-Maßnahmen und vermittelt bei Bedarf zwischen Anbietern und Nachfragern. Die Höhe schwankt — wer geduldig ist und nicht beim ersten Angebot zuschlägt, holt 20–30 % mehr raus.</p>

<h2>Der Ablauf in fünf Schritten</h2>
<ol>
<li><strong>Eignungsprüfung</strong> — wir prüfen anhand Lage, Bodenpunkten und Schutzgebietskulisse grob, ob die Fläche überhaupt Ökokonto-fähig ist. Bauland-Flächen scheiden aus.</li>
<li><strong>Maßnahmenkonzept</strong> — gemeinsam mit der UNB Kreis Lippe und ggf. der Bio-Station Lippe wird festgelegt, welche Aufwertung sinnvoll ist und wie viele Punkte sie generiert.</li>
<li><strong>Eintragung</strong> — die UNB Kreis Lippe trägt die Maßnahme im Ökokonto-Register ein, im Grundbuch wird die Grunddienstbarkeit gesichert.</li>
<li><strong>Umsetzung</strong> — die Aufwertung wird ausgeführt (Pflanzung, Mahdregime, Renaturierung). Vermittlung an Lohnunternehmer aus der Region möglich.</li>
<li><strong>Vermarktung</strong> — sobald die Punkte „reif" sind (in der Regel nach erfolgreicher Aufwertung), werden sie verkauft. Auszahlung an den Eigentümer.</li>
</ol>
<p>Realistischer Zeitrahmen: 12 bis 24 Monate von Erstgespräch bis Auszahlung. Wer schneller Liquidität braucht, sollte zum Direktverkauf tendieren — Ökokonto ist eine mittel- bis langfristige Optimierung.</p>

<h2>Wann sich Ökokonto besonders lohnt</h2>
<p>Aus unserer Erfahrung ist das Ökokonto fast immer lukrativer als der Direktverkauf, wenn:</p>
<ul>
<li>Die Fläche schwer zu verpachten ist (Hang, FFH-Lage, kleinteilig)</li>
<li>Die Bonität niedrig und der Bodenrichtwert unterdurchschnittlich ist</li>
<li>Der Eigentümer keinen Liquiditätsdruck hat und 1–2 Jahre Zeit mitbringt</li>
<li>Eine kombinierte Strategie mit VNS oder klassischer Verpachtung möglich ist</li>
</ul>
<p>Umgekehrt: wenn die Fläche hochwertig ist, hofnah, gut erschlossen, mit hoher Ackerzahl — dann bringt ein klassischer Verkauf mehr.</p>

<h2>Was wir konkret tun</h2>
<p>Wir prüfen kostenlos, ob Ihre Fläche für Ökopunkte geeignet ist. Bei Eignung koordinieren wir mit der UNB Kreis Lippe das Maßnahmenkonzept, organisieren über regionale Lohnunternehmer die Umsetzung und vermitteln die Punkte an konkrete Bauträger oder Kommunen — ohne Provision für Sie. Sie bekommen den vollen Erlös.</p>
`,
  },
  {
    slug: "grundstuecksverkehrsgesetz-praxis-nrw",
    title:
      "Grundstücksverkehrsgesetz NRW in der Praxis: Was beim Verkauf ab 1 Hektar wirklich passiert",
    description:
      "Genehmigungspflicht der Landwirtschaftskammer, siedlungsrechtliches Vorkaufsrecht, ungesunde Bodenverteilung — was die Theorie sagt und wie der Ablauf im Kreis Lippe tatsächlich aussieht.",
    category: "Recht",
    publishedAt: "2026-03-20",
    readingMinutes: 7,
    keywords: [
      "Grundstücksverkehrsgesetz NRW",
      "GrdstVG Genehmigung",
      "Landwirtschaftskammer NRW",
      "Siedlungsrechtliches Vorkaufsrecht",
      "Acker Verkauf Genehmigung",
    ],
    content: `
<p class="lead">Wer in NRW eine landwirtschaftliche Fläche ab einem Hektar verkauft, braucht eine Genehmigung der Landwirtschaftskammer. Das klingt bürokratisch, läuft in der Praxis aber meist routiniert. Dieser Artikel zeigt, was wirklich passiert — und wie man typische Stolpersteine vermeidet.</p>

<h2>Worum es geht — kurz</h2>
<p>Das Grundstücksverkehrsgesetz (GrdstVG, 1961) hatte einmal den Zweck, die Zerstückelung von Höfen zu verhindern und die Agrarstruktur zu stützen. Heute regelt es vor allem zwei Dinge:</p>
<ul>
<li><strong>Genehmigungspflicht</strong> für Verkäufe landwirtschaftlicher Flächen ab einer bestimmten Schwelle (in NRW: 1 Hektar)</li>
<li><strong>Siedlungsrechtliches Vorkaufsrecht</strong> der Landgesellschaft NRW (NRW.URBAN), wenn der Käufer kein Landwirt ist und ein örtlicher Landwirt Bedarf anmeldet</li>
</ul>
<p>Die Genehmigungsbehörde in NRW ist die Landwirtschaftskammer, in der Praxis für Lippe die <strong>Kreisstelle Lippe-Höxter</strong> (Felix-Fechenbach-Straße 5, 32756 Detmold).</p>

<h2>Wie der Ablauf in der Praxis aussieht</h2>
<ol>
<li><strong>Notarvertrag wird geschlossen</strong> — Verkäufer und Käufer einigen sich, der Notar setzt den Kaufvertrag auf. Die Eigentumsumschreibung im Grundbuch erfolgt erst später, wenn die Genehmigung vorliegt.</li>
<li><strong>Notar reicht den Vertrag ein</strong> — innerhalb von zwei Wochen nach Beurkundung muss der Notar den Vertrag der Genehmigungsbehörde vorlegen. Diese Frist ist gesetzlich, der Notar achtet darauf.</li>
<li><strong>Behörde prüft</strong> — die Landwirtschaftskammer hat zunächst <em>einen Monat</em> Zeit, kann auf <em>zwei Monate</em> verlängern und in Ausnahmefällen auf <em>drei Monate</em>. Geprüft wird, ob die Veräußerung zu einer „ungesunden Bodenverteilung" führen würde.</li>
<li><strong>Vorkaufsrecht-Prüfung</strong> — parallel wird die Landgesellschaft (NRW.URBAN) gefragt, ob sie ihr siedlungsrechtliches Vorkaufsrecht ausüben will. Das macht sie nur, wenn ein konkreter Landwirt vor Ort die Fläche zu identischen Konditionen kaufen würde.</li>
<li><strong>Genehmigung oder Versagung</strong> — bei Genehmigung läuft die Eigentumsumschreibung weiter wie geplant. Bei Versagung ist der Vertrag nichtig.</li>
</ol>

<h2>Wann die Genehmigung versagt wird</h2>
<p>Versagt wird selten — und nur unter klaren Voraussetzungen:</p>
<ul>
<li><strong>Käufer ist nicht-landwirtschaftlich</strong> und ein konkreter ortsansässiger Landwirt hat dokumentierten Bedarf an genau dieser Fläche</li>
<li><strong>Kaufpreis liegt deutlich (≥ 50 %) über dem Verkehrswert</strong> — was als spekulativer Aufkauf gewertet wird</li>
<li><strong>Verkauf führt zu einer Zersplitterung</strong>, die die Bewirtschaftung in der Region erschwert</li>
</ul>
<p>In der Praxis kommt das im Kreis Lippe pro Jahr im einstelligen Bereich vor. Die meisten Genehmigungen laufen nach 4–6 Wochen durch.</p>

<h2>Das siedlungsrechtliche Vorkaufsrecht im Detail</h2>
<p>Wenn die NRW.URBAN ihr Vorkaufsrecht ausübt, „schlüpft" sie in den Vertrag — sie wird zum Käufer, zu denselben Konditionen, die Sie und der ursprüngliche Käufer vereinbart haben. Sie übernimmt die Fläche dann, um sie an einen ortsansässigen Landwirt weiterzugeben.</p>
<p>Für den Verkäufer ändert sich nichts: Der Kaufpreis bleibt gleich, das Geld kommt — nur eben von einer anderen Stelle. Für den ursprünglichen Käufer ist es ärgerlich; für regional aktive Direktankäufer wie uns ist das Risiko gut zu managen.</p>

<h2>Häufige Stolpersteine — und wie man sie umgeht</h2>
<ul>
<li><strong>Kaufpreis-Diskussion mit der Behörde</strong>: Die Landwirtschaftskammer bewertet den Preis vorab. Wer 80.000 €/ha für eine 25.000 €/ha-Fläche aufruft, bekommt Versagung wegen ungesunder Bodenverteilung. Lösung: Bewertung nach Bodenrichtwert + Vergleichsverkäufen, nicht nach Wunschpreis.</li>
<li><strong>Pachtvertrag wird ignoriert</strong>: Pächter haben gesetzliche Vorkaufsrechte (§ 587 ff. BGB für Landpacht). Diese sind <em>vor</em> dem siedlungsrechtlichen zu berücksichtigen. Sauberer Notar-Vertrag adressiert beides.</li>
<li><strong>Mehrere Miteigentümer</strong>: Bei Erbengemeinschaft zählt jede Person — alle müssen mitziehen, sonst ist der Vertrag nicht wirksam. Das verlängert die Genehmigung manchmal.</li>
<li><strong>Käufer-Status ist unklar</strong>: Manchmal kauft eine GmbH oder Stiftung. Die Behörde prüft genau, wer dahinter steht und ob die Käuferseite landwirtschaftlich strukturiert ist.</li>
</ul>

<h2>Was wir konkret tun</h2>
<p>Bei jedem Direktankauf koordinieren wir mit dem Notar Ihrer Wahl die Genehmigungsphase. Wir kennen die Lipper Behörden, wissen welche Argumente überzeugen und welche Pakete der Verkauf brauchen darf. Bisher ist uns kein Vertrag versagt worden — weil wir realistische Preise zahlen, eigene landwirtschaftliche Strukturen vorweisen können und Pacht-Vorkaufsrechte sauber adressieren.</p>
<p>Das Wichtigste: Sie als Verkäuferin oder Verkäufer haben mit der Behörde nichts direkt zu tun. Ihr einziger Anker bleibt der Notar. Wir kümmern uns um den Rest.</p>
`,
  },
  {
    slug: "pachtspiegel-lippe-2026",
    title:
      "Pachtspiegel Kreis Lippe 2026: Was Verpächter aktuell für Acker und Grünland erzielen",
    description:
      "Aktuelle Pachtpreise im Kreis Lippe für Ackerland, Grünland und Sondernutzungen. Mit Bandbreiten je Bonität, Vergleich zu Vorjahren und Hinweisen, wann sich Pachterneuerung oder Direktverkauf rechnet.",
    category: "Markt",
    publishedAt: "2026-02-12",
    readingMinutes: 7,
    keywords: [
      "Pachtspiegel Lippe 2026",
      "Pachtpreis Ackerland Lippe",
      "Grünland Pacht Kreis Lippe",
      "Pacht Photovoltaik Acker NRW",
      "Pachtwert Hangwiese",
    ],
    content: `
<p class="lead">Pachtpreise im Kreis Lippe sind 2025 erneut leicht gestiegen — vor allem bei guten Ackerlagen mit Bonitäten über 60 Punkten. Wer einen alten Pachtvertrag von 2018 oder 2019 noch laufen hat, lässt oft 20–35 % Pacht auf der Strecke. Eine Übersicht.</p>

<h2>Aktuelle Bandbreiten 2026</h2>
<p>Die folgenden Werte basieren auf realen Pachtabschlüssen 2024/2025 im Kreis Lippe und in den angrenzenden Kreisen Höxter, Paderborn und Gütersloh, mit denen wir aktiv arbeiten:</p>
<ul>
<li><strong>Ackerland, gute Lage (Bonität 55+, hofnah, gut erschlossen)</strong>: 550–750 €/ha/Jahr</li>
<li><strong>Ackerland, mittlere Lage</strong>: 380–550 €/ha/Jahr</li>
<li><strong>Ackerland, schwere Lage (Hang, schlechter Zuschnitt, geringe Bonität)</strong>: 250–380 €/ha/Jahr</li>
<li><strong>Grünland, intensiv nutzbar</strong>: 250–380 €/ha/Jahr</li>
<li><strong>Grünland, extensiv (Hang, FFH-Umfeld)</strong>: 120–250 €/ha/Jahr — oft nur Pflegeentgelt</li>
<li><strong>Grünland mit VNS-Modul</strong>: Pachtzins + Förderanteil oft 800–1.400 €/ha/Jahr</li>
<li><strong>Streuobstwiesen</strong>: meist Pflegevereinbarung, kein klassischer Pachtzins</li>
<li><strong>Photovoltaik-Pacht (Freiflächen)</strong>: 3.500–5.000 €/ha/Jahr — sehr lange Laufzeiten (25–30 Jahre)</li>
</ul>
<p>Die Spannen sind real und keine Modellrechnung. Lokale Bonitätsunterschiede zwischen Bad Salzuflen, Detmold-Werretal, Lemgo und den höheren Lagen rund um Schieder-Schwalenberg machen schnell 100–200 €/ha aus.</p>

<h2>Warum die Pacht 2024 und 2025 erneut gestiegen ist</h2>
<p>Drei Gründe:</p>
<ul>
<li><strong>Steigende Erzeugerpreise im Getreidesegment</strong> haben 2022/2023 die Zahlungsbereitschaft der Vollerwerbsbetriebe deutlich gehoben — und das hat sich in den 2024er Pachterneuerungen niedergeschlagen.</li>
<li><strong>Konkurrenz durch Photovoltaik-Investoren</strong> in Schwerlagen (Sennegebiet, Kalletal): wo Photovoltaik möglich ist, zieht das die klassische Pacht mit nach oben.</li>
<li><strong>Knappheit in Top-Lagen</strong>: Im westlichen Kreis Lippe (Lage, Leopoldshöhe, Bad Salzuflen) ist der Bodenmarkt eng. Wer Pacht braucht, bietet hoch.</li>
</ul>

<h2>Wann sich eine Pachterneuerung lohnt</h2>
<p>Die typische Lipper Pachtperiode liegt bei 5–12 Jahren. Wer einen Vertrag aus 2018 oder 2019 noch laufen hat, ist meistens 20–35 % unter Marktniveau. Eine sauber strukturierte Pachterneuerung kann den Jahresertrag spürbar erhöhen — ohne Verkaufsdruck.</p>
<p>Konkrete Frage, die wir mit Eigentümern durchgehen:</p>
<ul>
<li>Wann läuft der aktuelle Pachtvertrag aus?</li>
<li>Ist eine vorzeitige Neuverhandlung sinnvoll (z. B. wenn der Pächter selbst ein Interesse an längerer Bindung hat)?</li>
<li>Gibt es Förderpotenzial (VNS, Ökokonto), das in den neuen Vertrag eingebaut werden sollte?</li>
<li>Soll der Vertrag staffeln (z. B. 3 Jahre fest, dann marktorientiert)?</li>
</ul>

<h2>Pacht oder Verkauf — die ehrliche Rechnung</h2>
<p>Pacht und Verkauf konkurrieren oft im Kopf der Eigentümer. Eine grobe Faustregel:</p>
<ul>
<li>Bei <strong>Ackerland mit ~600 €/ha/Jahr Pacht</strong> entspricht das einer Verzinsung von ca. <strong>1,2 % auf einen Verkehrswert von 50.000 €/ha</strong>. Wer das Geld in den Sparbüchern belässt, verliert über 10–15 Jahre real.</li>
<li>Bei <strong>guter Acker-Pacht von 700+ €/ha</strong> auf <strong>40.000–45.000 €/ha Verkehrswert</strong> liegt die Verzinsung bei 1,5–1,7 % — passable Anlage, aber unter Inflation.</li>
<li>Wer also <strong>liquide werden will</strong> oder das Kapital anders investieren möchte: Verkauf ist meistens die rationalere Wahl.</li>
<li>Wer <strong>Substanz halten will</strong> und kein Liquiditätsbedürfnis hat: Pacht (mit regelmäßiger Anpassung) bleibt sinnvoll.</li>
</ul>

<h2>Sonderfall Photovoltaik-Pacht</h2>
<p>Für Eigentümer ebener, sonnenexponierter Flächen ab 2 ha im Kreis Lippe ist Photovoltaik-Pacht 2024/2025 ein heißes Thema. Investoren bieten 3.500 €/ha aufwärts, gestaffelt über 25–30 Jahre. Vorteile: hoher Pachtzins, langer Vertrag. Nachteile: lange Bindung, Genehmigungsphase 12–18 Monate, Wiederherstellung der Fläche nach Vertragsende oft komplex.</p>
<p>Im Kreis Lippe sind besonders Lagen rund um Schlangen, Augustdorf und Teile des Kalletals interessant. Wir vermitteln solche Anfragen an seriöse Investoren — und prüfen vorab, ob die Fläche geeignet und das Angebot fair ist.</p>

<h2>Was wir konkret tun</h2>
<p>Wir bewerten Ihren bestehenden Pachtvertrag kostenlos: Ist der Pachtzins marktgerecht? Gibt es Spielraum nach oben? Lohnt eine Verbindung mit VNS oder Ökopunkten? Bei Pachterneuerung verhandeln wir mit dem Pächter (auf Wunsch auch ohne dass er Ihren Namen erfährt) — oder wir vermitteln einen neuen, verlässlichen Lipper Betrieb.</p>
`,
  },
  {
    slug: "privatwald-lippe-halten-foerdern-verkaufen",
    title:
      "Privatwald in Lippe: Halten, fördern oder verkaufen — die drei Wege",
    description:
      "Was Privatwald in Lippe heute wert ist, welche Förderprogramme NRW Eigentümern zur Verfügung stehen — und wann es wirtschaftlich sinnvoller ist, zu halten als zu verkaufen.",
    category: "Wald",
    publishedAt: "2026-01-09",
    readingMinutes: 8,
    keywords: [
      "Privatwald Lippe verkaufen",
      "Wald Förderung NRW",
      "Biotopbaum-Förderung NRW",
      "Forstbetriebsgemeinschaft Lippe",
      "Wald Wertermittlung Privat",
    ],
    content: `
<p class="lead">Wer einen Privatwald geerbt hat oder seit Generationen besitzt, steht oft vor derselben Frage: lohnt sich das Halten überhaupt noch, oder ist Verkaufen die bessere Option? Die Antwort hängt von Bestand, Bewirtschaftungswillen und Förderlage ab. Drei Wege im Detail.</p>

<h2>Weg 1: Halten und passiv bewirtschaften</h2>
<p>Für viele Lipper Privatwaldeigentümer ist „Halten" die unausgesprochene Default-Option. Der Wald gehört zur Familie, der Förster ruft zweimal im Jahr an, gelegentlich wird Holz gemacht. Was dabei oft übersehen wird:</p>
<ul>
<li><strong>Steuerliche Belastung</strong>: Wald gilt als landwirtschaftliches Vermögen, ist aber nicht von der Grundsteuer befreit. Für ungenutzten Privatwald fallen jährlich kleine, aber konstante Kosten an.</li>
<li><strong>Verkehrssicherungspflicht</strong>: Bei Wegen, Straßen oder Wanderpfaden in der Nähe haftet der Eigentümer für umstürzende Bäume. Eine Versicherung ist Pflicht — oder zumindest dringend zu empfehlen.</li>
<li><strong>Käferholz und Sturmschäden</strong>: Wer 2018–2022 Fichtenbestände hatte, weiß, wovon hier die Rede ist. Wiederaufforstung ist gesetzlich vorgeschrieben und teuer.</li>
</ul>
<p>Trotz dieser Punkte: Wer einen alten Laubholzbestand hat (Buche, Eiche), kann durch passive Bewirtschaftung über Jahrzehnte Vermögen aufbauen. Hochwertiges Eichenholz erzielt aktuell 350–600 €/Festmeter, Furnierqualität deutlich mehr.</p>

<h2>Weg 2: Aktive Förderung über NRW-Programme</h2>
<p>Wer den Wald hält, sollte die NRW-Förderprogramme kennen. Sie sind unterausgenutzt, weil viele Eigentümer sie nicht kennen.</p>

<h3>Biotopbaum-Förderung Privatwald NRW</h3>
<p>Über die <em>Förderrichtlinie Privat- und Körperschaftswald NRW</em> (FöRL) werden alte, dicke Bäume als Biotopbäume dauerhaft gesichert. Der Eigentümer verzichtet auf Holzeinschlag — und bekommt dafür eine <strong>einmalige Festbetrags-Förderung</strong>:</p>
<ul>
<li><strong>Eiche, BHD 40 cm</strong>: 270 €</li>
<li><strong>Eiche, BHD 60 cm</strong>: 690 €</li>
<li><strong>Eiche, BHD 80 cm</strong>: 1.400 €</li>
<li><strong>Buche / Edellaubholz, BHD 40–80 cm</strong>: 100–430 €</li>
</ul>
<p>Voraussetzung: BHD ≥ 40 cm, Alter ≥ 120 Jahre oder Horst-/Höhlenbaum. Maximal 30 Bäume pro Hektar. Beantragt wird über das Online-Portal <em>wald.web.nrw.de</em>, der zuständige Förster macht die Bestandsaufnahme.</p>
<p>Im Kreis Lippe besonders relevant: alte Eichenbestände rund um den Teutoburger Wald, am Püngelsberg, im Eggegebirge und in den waldreicheren Gemeinden Schieder-Schwalenberg, Lügde und Extertal.</p>

<h3>Klimaschutz-Wald NRW</h3>
<p>Bei Aufforstung von Käfer- oder Sturmwurfflächen mit klimastabilen Mischbeständen gibt es Investitions- und Pflegezuschüsse. Insbesondere bei Umbau ehemaliger Fichten-Reinbestände in Mischwald.</p>

<h3>Forstbetriebsgemeinschaft (FBG)</h3>
<p>Im Kreis Lippe ist die <strong>FBG Passadetal</strong> aktiv. Mitgliedschaft bringt Zugang zu gemeinsamer Holzvermarktung, Versicherungspaketen und Pflegepools. Lohnt sich für Privatwaldeigentümer ab ca. 2 ha aufwärts.</p>

<h2>Weg 3: Verkauf — wann er Sinn ergibt</h2>
<p>Verkauf ist die richtige Wahl, wenn:</p>
<ul>
<li>Der Eigentümer keinen Bezug mehr zum Wald hat oder im fernen Ausland lebt</li>
<li>Der Bestand wenig wertvoll ist (Käferflächen, Wiederaufforstungspflicht ohne Eigenmittel)</li>
<li>Liquiditätsbedarf besteht (Erbschaftssteuer, anderer Investitionsbedarf)</li>
<li>Erbengemeinschaft sich auf einheitliches Vorgehen nicht einigen kann</li>
</ul>
<p>Privatwald-Werte im Kreis Lippe (2024er Marktdaten):</p>
<ul>
<li><strong>Bodenwert ohne Aufwuchs</strong>: 0,30–1,50 €/m² (3.000–15.000 €/ha)</li>
<li><strong>Mit Aufwuchs (junger Mischbestand)</strong>: 5.000–10.000 €/ha</li>
<li><strong>Mit hiebsreifem Eichen-/Buchenbestand</strong>: 12.000–25.000 €/ha, in Premium-Lagen mehr</li>
<li><strong>Käfer-/Aufforstungsfläche</strong>: 2.000–4.000 €/ha (mit Wiederaufforstungspflicht beim Käufer)</li>
</ul>

<h2>Die kombinierte Strategie</h2>
<p>In der Praxis ist die Lösung oft <em>kein</em> Entweder-Oder. Typische kombinierte Strategie für ein gemischtes Privatwald-Erbe von 5 ha:</p>
<ul>
<li>2 ha Eichenbestand → Biotopbaum-Förderung beantragen (15.000–20.000 € einmalig), behalten</li>
<li>1,5 ha Käfer-Restfläche → verkaufen, Wiederaufforstungspflicht beim Käufer</li>
<li>1,5 ha Mischwald → in FBG einbringen, gemeinsam bewirtschaften</li>
</ul>
<p>So bleibt die Substanz erhalten, der Eigentümer bekommt Liquidität und die Bewirtschaftung wird professionalisiert.</p>

<h2>Was wir konkret tun</h2>
<p>Wir kennen die Lipper Forstlandschaft aus eigener Praxis — am Püngelsberg, in den Wäldern rund um Leopoldstal, am Triftenberge. Wir koordinieren mit dem zuständigen Forstamt von Wald und Holz NRW (Förster Thomas Schulte und Kollegen), beantragen Biotopbaum-Förderung mit Ihnen, vermitteln in die FBG Passadetal und kaufen — wenn der Verkauf der bessere Weg ist — Privatwald direkt.</p>
`,
  },
  {
    slug: "hangwiese-ffh-niemand-pachtet",
    title:
      "Hangwiese, Streuobst, FFH-Lage: Wenn die Fläche niemand mehr pachten will",
    description:
      "Was tun, wenn der alte Pächter aufgehört hat und niemand die Hangwiese mehr will? Drei Wege, wie aus einer Problemfläche ein verlässlicher Ertrag wird — ohne Eigenaufwand.",
    category: "Praxis",
    publishedAt: "2025-11-18",
    readingMinutes: 6,
    keywords: [
      "Hangwiese verpachten",
      "Streuobstwiese verkaufen",
      "FFH-Fläche schwer pachtbar",
      "Problemfläche Lipper Land",
      "Extensive Wiese Bewirtschaftung",
    ],
    content: `
<p class="lead">Im Kreis Lippe gibt es eine wachsende Zahl von Flächen, die niemand mehr klassisch bewirtschaften will: Hangwiesen, alte Streuobstwiesen, Talauen im FFH-Schutz. Eigentümer stehen oft ratlos da — der alte Pächter hört auf, neue gibt es nicht. Hier drei Wege, die in der Praxis funktionieren.</p>

<h2>Warum diese Flächen nicht mehr „funktionieren"</h2>
<p>Die Bewirtschaftung von Problemflächen ist für Vollerwerbsbetriebe wirtschaftlich uninteressant geworden:</p>
<ul>
<li><strong>Hangneigung über 12–15 %</strong> macht moderne Mähtechnik schwer einsetzbar — Maschinen kippen, Aufwand pro Hektar verdreifacht sich</li>
<li><strong>FFH-Auflagen</strong> begrenzen Düngung und Mahdtermine — der Ertrag pro Schnitt sinkt</li>
<li><strong>Streuobstwiesen</strong> brauchen Spezialwerkzeug und Baumpflege — kein normaler Landwirt hat Zeit dafür</li>
<li><strong>Kleinflächen unter 0,5 ha</strong> rechnen sich für die Anfahrt nicht mehr</li>
</ul>
<p>Das Ergebnis: Eigentümerin oder Eigentümer bekommt Anrufe, dass der Pachtvertrag ausläuft und niemand fortsetzen will. Dabei ist die Fläche nicht wertlos — sie braucht nur einen anderen Bewirtschaftungs- oder Vermarktungsweg.</p>

<h2>Weg 1: Vertragsnaturschutz NRW</h2>
<p>Genau für diese Flächen wurde der Vertragsnaturschutz erfunden. Der Eigentümer (oder ein neuer Pächter) verpflichtet sich für 3–5 Jahre zu extensiver Bewirtschaftung — späte Mahd, kein Dünger, keine Pflanzenschutzmittel — und bekommt dafür einen festen Förderbetrag pro Hektar.</p>
<ul>
<li>Extensives Grünland: bis 950 €/ha/Jahr</li>
<li>Mahd-Kennarten-Wiesen (artenreiche Mähwiesen): bis 2.040 €/ha/Jahr</li>
<li>Streuobstpflege: 25 €/Baum/Jahr, max. 1.900 €/ha</li>
</ul>
<p>Bei einer 1,2-Hektar-Hangwiese im Umfeld der Egge können das 2.500–4.000 €/Jahr werden — deutlich mehr als der ursprüngliche Pachtzins. Plus: Eigentum bleibt unangetastet, die Bewirtschaftung läuft über einen Lohnunternehmer, kein eigener Aufwand. Im Detail haben wir den Antragsweg im <a href="/blog/vertragsnaturschutz-nrw-frist-juni-2026">VNS-Artikel</a> beschrieben.</p>

<h2>Weg 2: Ökopunkte / Ökokonto</h2>
<p>Wenn die Fläche aktiv aufgewertet werden kann — z. B. Acker zu Wiese, Hecke pflanzen, Tümpel anlegen — generiert das Ökopunkte. Diese werden an Bauträger oder Kommunen verkauft, die ihre Eingriffsausgleichspflicht erfüllen müssen.</p>
<p>Für eine 1,2-Hektar-Fläche, die von Acker zu artenreichem Grünland aufgewertet wird, sind realistische Einmalerlöse von 25.000–50.000 € möglich. Das Eigentum bleibt erhalten, eine Grunddienstbarkeit wird im Grundbuch eingetragen.</p>
<p>Lohnt sich besonders bei mittlerer Bonität, FFH-Lage und Eigentümerinnen oder Eigentümern, die längerfristig planen können (12–24 Monate von Erstgespräch bis Auszahlung).</p>

<h2>Weg 3: Verkauf an spezialisierte Käufer</h2>
<p>Es gibt Käufer, die genau solche Flächen suchen — Naturschutzorganisationen, Stiftungen, ökologisch orientierte Investoren, Direktankäufer wie wir. Der Marktpreis ist niedriger als bei klassischem Acker (oft nur 5.000–12.000 €/ha statt 50.000), aber die Fläche wird los, ohne dass der Eigentümer noch Aufwand hat.</p>
<p>Wichtig dabei: der Verkauf an einen seriösen Käufer mit Naturschutz-Affinität schützt die Fläche meist besser als ein Verkauf an einen anonymen Höchstbietenden. Die Stiftung „NRW-Stiftung Naturschutz, Heimat- und Kulturpflege" ist ein typisches Beispiel.</p>

<h2>Die ehrliche Reihenfolge</h2>
<p>In unserer Beratungspraxis spielen wir die drei Wege meist in dieser Reihenfolge durch:</p>
<ol>
<li><strong>VNS prüfen</strong> — wenn Fläche in Schutzgebietskulisse: oft die ertragreichste Lösung mit minimalem Eigenaufwand. Pflegeentgelt nach unten korrigiert, Förderung deckt es überreich.</li>
<li><strong>Ökopunkte prüfen</strong> — wenn Aufwertungspotenzial besteht und Eigentümer 1–2 Jahre Geduld hat.</li>
<li><strong>Verkauf erwägen</strong> — wenn die ersten beiden nicht passen oder Eigentümer kurzfristig liquide werden möchte.</li>
</ol>

<h2>Was wir konkret tun</h2>
<p>Wir prüfen Ihre Fläche kostenlos auf alle drei Wege gleichzeitig. Das Ergebnis ist eine ehrliche Empfehlung mit konkreten Zahlen — nicht „Verkaufen Sie an uns", sondern „für Ihre Lage ist Weg X wirtschaftlich am besten". Bei VNS koordinieren wir mit der Bio-Station Lippe, bei Ökopunkten mit der UNB Kreis Lippe, bei Verkauf greifen wir zum eigenen Direktankauf oder vermitteln im Netzwerk. Lohnunternehmer für die Mahd organisieren wir auf Wunsch dazu.</p>
`,
  },
  {
    slug: "erbengemeinschaft-landwirtschaftliche-flaeche-lippe",
    title:
      "Erbengemeinschaft mit landwirtschaftlicher Fläche: Sechs Stolpersteine — und wie wir sie umgehen",
    description:
      "Was passiert, wenn drei Geschwister 4 Hektar Acker erben und einer im Ausland lebt? Sechs Stolpersteine in Lipper Erbengemeinschaften — und wie der Verkauf trotzdem in unter sechs Monaten durchläuft.",
    category: "Recht",
    publishedAt: "2025-10-22",
    readingMinutes: 7,
    keywords: [
      "Erbengemeinschaft Ackerland verkaufen",
      "Erbschaft landwirtschaftliche Fläche",
      "Notar Erbengemeinschaft",
      "Grundbuch Erbengemeinschaft Lippe",
      "Auseinandersetzung Erbengemeinschaft",
    ],
    content: `
<p class="lead">Erbengemeinschaft ist die häufigste Konstellation, wenn wir im Kreis Lippe einen Verkauf abwickeln. Drei Geschwister, ein Stiefonkel, eine Tante in Hannover und ein Cousin in Spanien — und alle sollen sich einig werden, was mit den 4 Hektar Acker an der Werre passiert. Hier sechs Stolpersteine — und wie wir sie umgehen.</p>

<h2>Stolperstein 1: Niemand ist im Grundbuch eingetragen</h2>
<p>Nach einem Erbfall wird die Erbengemeinschaft nicht automatisch im Grundbuch eingetragen. Das passiert erst, wenn jemand das aktiv betreibt — und kostet Zeit (oft 3–6 Monate beim Grundbuchamt) und Geld.</p>
<p>Wenn der Verkauf vor der Grundbuchbereinigung beurkundet wird, muss der Notar die Erbnachweise zusätzlich beibringen. Das verzögert die Eigentumsumschreibung weiter. Unsere Vorgehensweise: wir lassen die Grundbuchbereinigung parallel zum Verkauf laufen — meistens beim selben Notar.</p>

<h2>Stolperstein 2: Mehrere Generationen, unklare Quoten</h2>
<p>Wenn die ursprüngliche Erbengemeinschaft Großeltern → Eltern → Kinder läuft, sind die Quoten oft kompliziert. Manche Erbteile sind weiter aufgeteilt, manche fehlen, manche sind nicht eindeutig dokumentiert.</p>
<p>Lösung: vor dem Verkaufsgespräch erstellt der Notar einen Erbenermittlungs-Auszug. Das kostet 200–400 €, ist aber Pflicht, sonst ist der Vertrag nicht rechtssicher.</p>

<h2>Stolperstein 3: Ein Miteigentümer blockiert</h2>
<p>Das klassische Problem: zwei wollen verkaufen, einer will halten. Was tun? Drei reale Wege, die wir oft sehen:</p>
<ul>
<li><strong>Auszahlung</strong> — der „Halter" kauft die anderen aus. Erfordert Liquidität, ist aber oft die schnellste Lösung.</li>
<li><strong>Teilungsversteigerung</strong> — formaljuristischer Weg, dauert 12–18 Monate, kostet Gebühren, das Ergebnis ist meist nicht optimal.</li>
<li><strong>Vermittlungsgespräch mit allen Beteiligten</strong> — wir setzen uns mit allen Miteigentümern zusammen (auch per Videokonferenz mit dem Cousin in Spanien) und arbeiten eine einvernehmliche Lösung aus.</li>
</ul>
<p>Aus unserer Erfahrung: Weg 3 löst 80 % der Fälle. Oft ist „Halten" beim widerständigen Miteigentümer kein echter Wille, sondern Verlustangst oder Misstrauen gegenüber den anderen Miteigentümern. Mit einem neutralen Außenstehenden lässt sich das auflösen.</p>

<h2>Stolperstein 4: Ein Miteigentümer lebt im Ausland</h2>
<p>Spanien, Schweiz, USA — wir hatten alles. Die Beurkundung läuft dann meist über die deutsche Botschaft im Ausland (mit deutlich höheren Beurkundungsgebühren) oder über eine Generalvollmacht, die der ausländische Erbe einem Vertreter in Deutschland gibt.</p>
<p>Generalvollmacht ist meist die schnellere Variante. Wir erstellen die Vorlage zusammen mit dem Notar, schicken sie ans Konsulat, der ausländische Erbe lässt sie dort beglaubigen, das Original wird per Kurier zurück nach Deutschland geschickt. Zeitaufwand: 4–6 Wochen.</p>

<h2>Stolperstein 5: Pachtvertrag mit langer Restlaufzeit</h2>
<p>Ein laufender 12-Jahres-Pachtvertrag aus 2018 macht den Verkauf oft nicht einfacher — aber auch nicht unmöglich. Der Käufer übernimmt den Pachtvertrag (§ 593b BGB, Pachtvertrag geht auf den Erwerber über). Der Pächter hat in den meisten Fällen kein Vorkaufsrecht — anders als beim Erbpachtvertrag.</p>
<p>Wir kommunizieren mit dem Pächter — auf Wunsch erst nach Abschluss des Notarvertrags, sodass keine Ungewissheit entsteht. Der laufende Pachtzins wird zeitanteilig zwischen Verkäufer und Käufer aufgeteilt.</p>

<h2>Stolperstein 6: Konflikte zwischen Miteigentümern</h2>
<p>Manchmal sind die familiären Verhältnisse einfach zerrüttet. Der Bruder, mit dem man seit 20 Jahren nicht spricht; die Schwester, die schon im Vorfeld ihre Anwältin eingeschaltet hat. Wenn das die Lage ist, übernehmen wir die Kommunikation.</p>
<p>Wir sprechen mit jedem Miteigentümer einzeln, formulieren einen Vorschlag, der für alle akzeptabel ist, und legen das Ergebnis dem Notar vor. Die Beurkundung kann dann entweder gemeinsam (mit Distanz) oder seriell stattfinden — keiner muss dem anderen begegnen, wenn das nicht gewünscht ist.</p>

<h2>Was unsere typische Erbschafts-Abwicklung kostet</h2>
<p>Übersicht der typischen Kosten für eine 4-ha-Erbengemeinschaft mit drei Erben:</p>
<ul>
<li>Erbenermittlung Notar: 200–400 €</li>
<li>Grundbuchbereinigung (Berichtigung): 0,5–1 % des Verkehrswertes (Wertgebühr)</li>
<li>Notarvertrag: ca. 1 % des Kaufpreises</li>
<li>Grunderwerbsteuer (zahlt Käufer): 6,5 % in NRW</li>
<li>Genehmigung Landwirtschaftskammer: ca. 100–300 € (zahlt meist Käufer)</li>
</ul>
<p>Wir tragen alle diese Kosten als Käufer — Sie als Verkäufer haben außer den notariellen Anteilen für Verkäufer-spezifische Posten nichts zu zahlen.</p>

<h2>Was wir konkret tun</h2>
<p>Erbengemeinschaft ist unser Schwerpunkt. Wir koordinieren mit allen Miteigentümern, dem Notar Ihrer Wahl, dem Grundbuchamt und der Landwirtschaftskammer. Auf Wunsch übernehmen wir die Kommunikation mit „schwierigen" Miteigentümern. In den meisten Fällen schaffen wir den Verkauf in 4–8 Wochen vom Erstgespräch bis Notar — auch wenn jemand im Ausland lebt.</p>
`,
  },
  {
    slug: "bodenrichtwert-vs-marktpreis-lippe",
    title:
      "Bodenrichtwert vs. Marktpreis: Warum diese zwei Zahlen für Ihre Lipper Fläche selten gleich sind",
    description:
      "Der Bodenrichtwert sagt 1,80 €/m² — der Käufer bietet 4,20 €/m². Warum stimmen die zwei Zahlen nicht überein? Eine Einordnung mit echten Marktdaten aus dem Kreis Lippe.",
    category: "Markt",
    publishedAt: "2025-09-15",
    readingMinutes: 6,
    keywords: [
      "Bodenrichtwert Marktpreis Lippe",
      "Verkehrswert landwirtschaftliche Fläche",
      "BORIS NRW",
      "Acker Verkaufspreis Lippe",
      "Richtwertgrundstück Bodenpunkte",
    ],
    content: `
<p class="lead">Eigentümer schauen oft im Geoportal nach dem Bodenrichtwert ihrer Fläche, vergleichen mit dem Käufer-Angebot und sind verwirrt: 1,80 €/m² laut BORIS, 4,20 €/m² vom Käufer. Stimmt da was nicht? Doch — beide Zahlen können richtig sein. Hier die Einordnung.</p>

<h2>Was der Bodenrichtwert eigentlich ist</h2>
<p>Der Bodenrichtwert ist ein <strong>durchschnittlicher Lagewert pro Quadratmeter</strong>, ermittelt aus tatsächlichen Verkaufsfällen in einer Bodenrichtwertzone. Der Gutachterausschuss für Grundstückswerte im Kreis Lippe und in der Stadt Detmold legt sie jährlich fest und veröffentlicht sie auf <a href="https://www.boris.nrw.de" target="_blank" rel="noopener">BORIS NRW</a> sowie im Geoportal des Kreises.</p>
<p>Wichtig: der Bodenrichtwert bezieht sich auf ein <strong>Richtwertgrundstück</strong> mit definierten Eigenschaften:</p>
<ul>
<li><strong>Ackerland</strong>: ca. 2,0 ha Größe, Ackerzahl 55</li>
<li><strong>Grünland</strong>: ca. 1,0 ha Größe</li>
<li><strong>Wald</strong>: Bodenwert ohne Aufwuchs</li>
</ul>
<p>Wenn Ihre Fläche andere Eigenschaften hat — höhere Bonität, besserer Zuschnitt, hofnähe — kann der Verkehrswert deutlich abweichen.</p>

<h2>Der Marktpreis: was tatsächlich gezahlt wird</h2>
<p>Der Marktpreis ergibt sich aus Angebot und Nachfrage. Im Kreis Lippe haben sich 2024 reale Kaufpreise eingestellt, die bei Ackerland im Durchschnitt deutlich über dem Bodenrichtwert lagen:</p>
<ul>
<li><strong>Ackerland Mittelwert 2024 in Lippe</strong>: 5,26 €/m² (etwa 52.600 €/ha)</li>
<li><strong>Bodenrichtwert Ackerland Lippe</strong> (typische Zone): 1,40–4,50 €/m²</li>
</ul>
<p>Der Markt zahlt also rund <strong>20–30 % über dem Bodenrichtwert</strong>. Diese Differenz ist nicht ungewöhnlich — sie spiegelt die starke Nachfrage durch Vollerwerbsbetriebe, Investoren und Stiftungen wider, die in den vergangenen Jahren um Lipper Flächen konkurrieren.</p>

<h2>Was den Marktpreis nach oben oder unten zieht</h2>
<p>Faktoren, die einen konkreten Verkaufspreis vom Bodenrichtwert abweichen lassen:</p>
<ul>
<li><strong>Bonität (Ackerzahl)</strong>: jedes Bonitätspunkt über 55 bringt im Schnitt 1,5–2 % Aufschlag</li>
<li><strong>Zuschnitt und Größe</strong>: zusammenhängende 5-ha-Schläge erzielen mehr als drei Splitter à 1,7 ha</li>
<li><strong>Hofnähe</strong>: bei Vollerwerbsbetrieben ist die Distanz zum Hof ein harter Faktor — 5 km zu viel kostet 10 % Pacht/Verkaufspreis</li>
<li><strong>Erschließung</strong>: ohne befestigten Wirtschaftsweg sinkt der Wert deutlich</li>
<li><strong>Pachtstatus</strong>: laufender langer Pachtvertrag kann je nach Konditionen Bonus oder Malus sein</li>
<li><strong>Lasten im Grundbuch</strong>: Wegerechte, Leitungsrechte, Vorkaufsrechte schmälern den Preis</li>
<li><strong>Schutzgebietskulisse</strong>: FFH-, NSG-, Wasserschutz-Gebiete schränken die Bewirtschaftung ein und drücken den Preis bei klassischer Pacht — können aber durch VNS / Ökopunkte überkompensiert werden</li>
</ul>

<h2>Beispielrechnung: 3 ha am Werretal-Hang</h2>
<p>Ein typisches Lipper Beispiel: 3 ha Ackerland am Übergang zum Werretal, Bonität 65 (über dem Schnitt), zusammenhängend, befestigter Weg, 4 km zum nächsten Hof.</p>
<ul>
<li>Bodenrichtwert in der Zone: 2,80 €/m² → 84.000 € rein bodenrichtwert-basiert</li>
<li>Bonitätsaufschlag (10 Punkte über Standard): +15 % → 96.600 €</li>
<li>Zuschnitt-Aufschlag (gut): +5 % → 101.400 €</li>
<li>Hofnähe-Malus (4 km): −5 % → 96.300 €</li>
<li><strong>Realistischer Verkehrswert</strong>: 95.000–105.000 € (entspricht 3,17–3,50 €/m²)</li>
</ul>
<p>Der Bodenrichtwert von 2,80 €/m² ist also <em>nicht falsch</em> — er ist ein Mittelwert. Der echte Marktpreis liegt darüber, weil die Fläche besser als das Richtwertgrundstück ist.</p>

<h2>Wann der Marktpreis unter dem Bodenrichtwert liegt</h2>
<p>Selten, aber es kommt vor:</p>
<ul>
<li>Sehr kleine Splitter unter 0,3 ha — keine Bewirtschaftungs-Skala mehr möglich</li>
<li>Hangwiesen über 15 % Neigung in FFH-Schutz — schwer bewirtschaftbar</li>
<li>Käfer-/Sturmwurfflächen mit Aufforstungspflicht — Investitionsbedarf beim Käufer</li>
<li>Flächen mit eingetragenen Lasten (Rückbauverpflichtung, Bodenkontamination)</li>
</ul>
<p>In solchen Fällen ist die Lösung oft nicht „Verkauf zum niedrigen Preis", sondern Werthebung über VNS, Ökopunkte oder Aufforstungs-Förderung.</p>

<h2>Was wir konkret tun</h2>
<p>Eine seriöse Wertindikation kombiniert immer drei Quellen: Bodenrichtwert (BORIS), reale Vergleichsverkäufe der letzten 12–24 Monate (haben wir aus eigener Praxis und durch den Grundstücksmarktbericht des Kreises) und die spezifischen Eigenschaften Ihrer Fläche. Wir machen das kostenlos für Sie — mit nachvollziehbarer Begründung jeder Zahl, nicht mit Pi-mal-Daumen-Schätzungen.</p>
`,
  },
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
