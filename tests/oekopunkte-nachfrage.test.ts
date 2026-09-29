import { strict as assert } from "node:assert";
import { test } from "node:test";
import { testUmgebung } from "./hilfe";

testUmgebung();

const { INTENTS, isGesuchIntent, isOekopunkteNachfrage } = await import("@/lib/lead-options");
const { eingangPruefen } = await import("@/lib/portal/eingang");
const { leadView } = await import("@/lib/admin/model");
const { antwortEntwurf } = await import("@/lib/portal/antwort");
const { artDerAnfrage } = await import("@/lib/admin/loeschen-regeln");

// Anlass Kraskes (LandVest), 29.09.2026: Wer Ökopunkte SUCHT, ist kein Eigentümer — die Website hatte nur „Ökopunkte verkaufen“.

const nachfrage = {
  id: "LL-TESTOEKO",
  receivedAt: "2026-09-29T12:19:00.000Z",
  intent: "Ökopunkte gesucht",
  flaechentyp: "Wald / Forst",
  groesse: "250.000 Punkte",
  ort: "Kreis Lippe",
  flurstueck: "—",
  message: "Erstaufforstung, bis Sommer 2027, Anerkennung durch die UNB",
  name: "Juliane Kraskes",
  phone: "—",
  email: "juliane@example.com",
  source: "oekopunkte-gesucht",
  consent: "on",
  gclid: "—",
  boerse: "—",
};
const BASIS = "https://lippeforst.de";

test("Anliegen „Ökopunkte gesucht“ ist bekannt, aber kein Flächen-Gesuch", () => {
  assert.ok((INTENTS as readonly string[]).includes("Ökopunkte gesucht"));
  assert.equal(isOekopunkteNachfrage("Ökopunkte gesucht"), true);
  assert.equal(isOekopunkteNachfrage("VNS / Ökopunkte"), false);
  assert.equal(isGesuchIntent("Ökopunkte gesucht"), false);
});

test("Formularprüfung lässt „Ökopunkte gesucht“ durch (wird nicht zu „Allgemein“)", () => {
  const r = eingangPruefen({ intent: "Ökopunkte gesucht", flaechentyp: "Wald / Forst", name: "Juliane Kraskes", email: "juliane@example.com", consent: "on" });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.eingabe.intent, "Ökopunkte gesucht");
});

test("Antwortentwurf: eigene Antwort ohne Eigentümer-Link, mit ehrlicher Einordnung und den offenen Fragen", () => {
  const a = antwortEntwurf({ lead: leadView(nachfrage, {}), kunde: null, basis: BASIS });
  assert.ok(a);
  if (!a) return;
  assert.equal(a.thema, "oekopunkte");
  assert.match(a.betreff, /Ökopunkten/);
  assert.match(a.text, /Wir betreiben kein eigenes Ökokonto und haben keine bereits anerkannten Ökopunkte zum Verkauf/);
  assert.match(a.text, /Preisvorstellung je Ökopunkt/);
  assert.match(a.text, /Weserbergland \(Naturraum D36[\s\S]*Westfälischen Bucht \(D34\)/);
  assert.match(a.text, /Eine kurze Antwort auf diese E-Mail genügt/);
  // kein Verkaufs-/Verpachtungs-Link, keine Bewertung, keine Telefonnummer
  assert.doesNotMatch(a.text, /persönlichen Link|Ja, ich möchte|kunde\/antwort/);
  assert.doesNotMatch(a.text, /Bodenrichtwert|Wertindikation|Tel\.|\+49/);
  // Bezug auf die Anfrage mit den Bedeutungen der Nachfrage-Felder
  assert.match(a.text, /Gesuchte Maßnahme: Wald \/ Forst/);
  assert.match(a.text, /Umfang: 250\.000 Punkte/);
  assert.match(a.text, /Suchraum: Kreis Lippe/);
  assert.doesNotMatch(a.text, /– Fläche:|– Lage:/);
  // Umfang „250.000 Punkte“ ist keine Fläche → kein Hinweis „Größe unsicher“
  assert.ok(!a.hinweise.some((h) => /Größe unsicher/.test(h)));
});

test("Antwortentwurf: bereits angegebene Felder werden nicht noch einmal erfragt", () => {
  const a = antwortEntwurf({ lead: leadView(nachfrage, {}), kunde: null, basis: BASIS });
  assert.ok(a);
  if (!a) return;
  assert.doesNotMatch(a.text, /bräuchten wir noch:.*Suchraum/);
  assert.doesNotMatch(a.text, /bräuchten wir noch:.*gesuchten Umfang/);
  const leer = antwortEntwurf({ lead: leadView({ ...nachfrage, groesse: "—", ort: "—" }, {}), kunde: null, basis: BASIS });
  assert.ok(leer);
  if (leer) assert.match(leer.text, /bräuchten wir noch:[\s\S]*Suchraum[\s\S]*gesuchten Umfang/);
});

test("„Allgemein“ mit Ökopunkte-Suche in der Nachricht wird ebenfalls als Nachfrage erkannt", () => {
  const a = antwortEntwurf({
    lead: leadView({ ...nachfrage, intent: "Allgemein", flaechentyp: "—", groesse: "—", ort: "—", message: "Wir suchen Ökopunkte aus Erstaufforstung im Naturraum D34." }, {}),
    kunde: null,
    basis: BASIS,
  });
  assert.ok(a);
  if (a) assert.equal(a.thema, "oekopunkte");
});

test("Eigentümer-Anfrage „VNS / Ökopunkte“ bleibt bei der bisherigen Antwort (Thema vns)", () => {
  const a = antwortEntwurf({ lead: leadView({ ...nachfrage, intent: "VNS / Ökopunkte", flaechentyp: "Wiese / Grünland", groesse: "2 ha", message: "" }, {}), kunde: null, basis: BASIS });
  assert.ok(a);
  if (a) assert.equal(a.thema, "vns");
});

test("Grabstein-Bezeichnung nennt die Art der Anfrage aus festen Begriffen", () => {
  assert.equal(artDerAnfrage({ intent: "Ökopunkte gesucht" }, undefined), "Auskunft (Ökopunkte gesucht)");
});
