import { strict as assert } from "node:assert";
import { test } from "node:test";
import { eingangPruefen, eingangsbestaetigung, FELD_MAX } from "@/lib/portal/eingang";

const gueltig = { intent: "Verkaufen", flaechentyp: "Ackerland", name: "Erika Muster", email: "Erika@Example.com", consent: "on" };

test("gültige Anfrage wird angenommen und bereinigt", () => {
  const r = eingangPruefen({ ...gueltig, message: "x".repeat(10_000), phone: "0172 / 605 53 18" });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.eingabe.email, "erika@example.com");
  assert.equal(r.eingabe.message.length, FELD_MAX.message);
  assert.equal(r.eingabe.phone, "0172 / 605 53 18");
  assert.equal(r.spam, false);
});

test("unbekanntes Anliegen wird Allgemein, unbekannter Flächentyp offen", () => {
  const r = eingangPruefen({ ...gueltig, intent: "<script>", flaechentyp: "Mond" });
  assert.ok(r.ok && r.eingabe.intent === "Allgemein" && r.eingabe.flaechentyp === "—");
});

test("ungültige E-Mail, fehlender Name oder fehlende Einwilligung werden abgelehnt", () => {
  assert.equal(eingangPruefen({ ...gueltig, email: "keine-mail" }).ok, false);
  assert.equal(eingangPruefen({ ...gueltig, email: "a@b.de, c@d.de" }).ok, false);
  assert.equal(eingangPruefen({ ...gueltig, name: "" }).ok, false);
  assert.equal(eingangPruefen({ ...gueltig, consent: "" }).ok, false);
});

test("Links im Namen gelten als Spam", () => {
  const r = eingangPruefen({ ...gueltig, name: "Gewinn www.beispiel.test" });
  assert.ok(r.ok && r.spam);
});

test("Eingangsbestätigung nennt Vorgangsnummer und Werktag, aber keine Freitexte und kein Telefon", () => {
  const r = eingangPruefen({ ...gueltig, name: "BUY NOW Erika", message: "Kaufen Sie jetzt" });
  assert.ok(r.ok);
  if (!r.ok) return;
  const b = eingangsbestaetigung(r.eingabe, "LL-TEST123", "2026-09-27T12:30:00.000Z");
  assert.match(b.betreff, /LL-TEST123/);
  assert.match(b.text, /in der Regel innerhalb eines Werktags per E-Mail/);
  assert.match(b.text, /Verkaufen · Ackerland/);
  assert.doesNotMatch(b.text, /BUY NOW|Kaufen Sie jetzt/);
  assert.doesNotMatch(b.text, /Telefon|\+49|0176|05234/);
});

test("Häkchen „anonym veröffentlichen“ zählt nur bei Verkaufen, Verpachten und Gesuchen", () => {
  const mit = (intent: string, wert: unknown = "on") => {
    const r = eingangPruefen({ ...gueltig, intent, veroeffentlichen: wert });
    assert.ok(r.ok);
    return r.ok ? r.eingabe.veroeffentlichen : "";
  };
  assert.equal(mit("Verkaufen"), "on");
  assert.equal(mit("Verpachten"), "on");
  assert.equal(mit("Fläche gesucht (Pacht)"), "on");
  assert.equal(mit("Fläche gesucht (Kauf)", "1"), "on");
  assert.equal(mit("Bewertung"), "—");
  assert.equal(mit("Ökopunkte gesucht"), "—");
  assert.equal(mit("Verkaufen", "off"), "—");
  assert.equal(mit("Verkaufen", true), "—");
  const ohne = eingangPruefen(gueltig);
  assert.ok(ohne.ok && ohne.eingabe.veroeffentlichen === "—");
});

test("Eingangsbestätigung erwähnt die Veröffentlichung samt Widerruf nur mit Häkchen", () => {
  const text = (intent: string, veroeffentlichen: "on" | "—") => eingangsbestaetigung({ intent, flaechentyp: "Ackerland", boerse: "—", veroeffentlichen }, "LL-TEST1", "2026-10-19T08:00:00.000Z").text;

  const angebot = text("Verkaufen", "on");
  assert.match(angebot, /Ihre Fläche anonym auf lippeforst\.de zeigen/);
  assert.match(angebot, /nie mit Ihrem Namen, Ihren Kontaktdaten oder dem Flurstück/);
  assert.match(angebot, /Antworten Sie einfach auf diese E-Mail/);

  const gesuch = text("Fläche gesucht (Pacht)", "on");
  assert.match(gesuch, /Ihren Suchauftrag anonym auf lippeforst\.de zeigen/);
  assert.doesNotMatch(gesuch, /Flurstück/);

  assert.doesNotMatch(text("Verkaufen", "—"), /anonym auf lippeforst\.de/);
});
