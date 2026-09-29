// Gemeinsame Aussagen zu Ökopunkten — eine Quelle für Website (Ökopunkte-Seiten, Blog, Startseite),
// die Standardantwort in lib/portal/antwort.ts und die Beschreibung in lib/site.ts.
//
// Anlass 29.09.2026: Eine Projektmanagerin (LandVest) suchte „Ökopunkte aus Erstaufforstung“ und fand die
// Seite „Ökopunkte verkaufen“ — konnte ihr aber nicht entnehmen, ob wir nur beraten oder ein eigenes Ökokonto
// betreiben und Punkte vermarkten. Die Rolle steht deshalb hier, einmal, ausdrücklich. Wer Punkte oder
// Flächen anders anbietet (z. B. ein eigenes Ökokonto eröffnet), ändert die Aussagen HIER und nur hier.

/** Was Lippe Forst bei Ökopunkten tut — für Eigentümer und Interessenten. */
export const OEKOPUNKTE_TUN: readonly string[] = [
  "Wir prüfen grob, ob eine Fläche in Frage kommt: Lage, Schutzgebietskulisse, heutige Nutzung und Pachtverhältnis. Für Eigentümer ist die Erstprüfung kostenlos.",
  "Wir stimmen uns mit den zuständigen Stellen ab: der Unteren Naturschutzbehörde des Kreises Lippe, der Biologischen Station Lippe und bei Aufforstungen mit der Forstbehörde (Wald und Holz NRW).",
  "Wir nennen regionale Lohnunternehmen für Pflanzung, Pflege und Mahd.",
  "Wir bringen Eigentümer und Interessenten zusammen, die Flächen oder Punkte suchen. Kontaktdaten geben wir nur weiter, wenn beide Seiten zugestimmt haben.",
];

/** Was Lippe Forst bei Ökopunkten nicht tut. */
export const OEKOPUNKTE_NICHT: readonly string[] = [
  "Wir betreiben kein eigenes Ökokonto und haben keine eigenen, bereits anerkannten Ökopunkte.",
  "Wir verkaufen keine Ökopunkte in eigenem Namen und garantieren weder Preise noch Abnehmer.",
  "Über Anerkennung und Punktzahl einer Maßnahme entscheidet nicht Lippe Forst, sondern die zuständige Behörde.",
  "Wir leisten keine Rechts- oder Steuerberatung.",
];

/** Ein Satz für Beschreibungen, Antworten und Zusammenfassungen. */
export const OEKOPUNKTE_ROLLE_KURZ =
  "Lippe Forst betreibt kein eigenes Ökokonto und verkauft keine eigenen Ökopunkte: Wir prüfen Flächen, stimmen uns mit den Behörden ab und bringen Eigentümer und Interessenten zusammen.";
