import { strict as assert } from "node:assert";
import { test } from "node:test";
import { testUmgebung } from "./hilfe";

testUmgebung();

const { neuerTeil, postfachVorschlag } = await import("@/lib/portal/postfach-text");

const ANBIETER = { gruppe: "anbieter", art: "kauf", intent: "Verkaufen", flaechentyp: "Ackerland" } as const;
const BERATUNG = { gruppe: "beratung", art: null, intent: "Bewertung", flaechentyp: "Ackerland" } as const;

// Unsere Nachfass-Mail, wie Web-Mail sie zitiert: Kopf mit „Gesendet:“ VOR „Von:“ (Anlass Henkenius 27.09.2026).
const ZITAT = `Gesendet: Freitag, 25. September 2026 um 10:28
Von: "Lippe Forst" <kontakt@lippeforst.de>
An: max.mustermann@example.com
Betreff: Ihre Fläche bei Lippe Forst

Guten Tag Max Mustermann,
Sie hatten sich am 05.08.2026 wegen des Verkaufs Ihrer Fläche in Gehrden an uns gewandt. Haben Sie noch Interesse am Verkauf?
Wenn nicht, antworten Sie einfach mit „kein Interesse“ — dann melden wir uns nicht wieder.`;

test("Zitatkopf mit „Gesendet:“ vor „Von:“ wird abgeschnitten", () => {
  const neu = neuerTeil(`Hallo,\n\nIch habe kein Interresse mehr da die Flächen verkauft sind.\nMFG\n${ZITAT}`);
  assert.match(neu, /kein Interresse mehr/);
  assert.doesNotMatch(neu, /Haben Sie noch Interesse/);
  assert.doesNotMatch(neu, /Von: "Lippe Forst"/);
});

test("Absage mit Tippfehler („Interresse“) und „Flächen verkauft sind“ = kein Interesse", () => {
  const neu = neuerTeil(`Hallo,\n\nIch habe kein Interresse mehr da die Flächen verkauft sind.\nMFG\n${ZITAT}`);
  assert.equal(postfachVorschlag(neu, ANBIETER).art, "kein-interesse");
  assert.equal(postfachVorschlag("Die Flächen sind leider schon verkauft.", ANBIETER).art, "kein-interesse");
  assert.equal(postfachVorschlag("Das Grundstück wurde inzwischen verpachtet.", ANBIETER).art, "kein-interesse");
});

test("Ausdrücklicher Wunsch zu verkaufen bleibt ein Verkaufswunsch", () => {
  assert.equal(postfachVorschlag("Ja, ich möchte die Fläche gern verkaufen.", ANBIETER).art, "verkaufen");
  // Nachbar hat verkauft, ich will ebenfalls verkaufen: die Absicht zählt.
  assert.equal(postfachVorschlag("Mein Nachbar hat schon verkauft, ich möchte auch verkaufen.", ANBIETER).art, "verkaufen");
});

test("„Melde mich selbst, wenn es wieder aktuell ist“ = pausiert, nicht Beratung", () => {
  const v = postfachVorschlag(
    `Guten Tag,\n\nGrundsätzlich habe ich noch Interesse an einer Bewertung der Flächen, aktuell aber einige andere private "Baustellen".\n\nIch melde mich eigenständig bei Ihnen, wenn das Thema wieder aktuell ist!\n\nMit freundlichen Grüßen`,
    BERATUNG,
  );
  assert.equal(v.art, "kein-interesse");
  assert.match(v.grund, /pausiert/);
  assert.match(v.hinweis ?? "", /Keine Absage/);
});

test("Kurzes „Ja bitte“ zur Bewertung bleibt Beratung", () => {
  assert.equal(postfachVorschlag("Ja bitte", BERATUNG).art, "beratung");
});

test("Eine echte Absage wird nicht zu „pausiert“", () => {
  const v = postfachVorschlag("Kein Interesse. Ich melde mich selbst, falls sich etwas ändert.", ANBIETER);
  assert.equal(v.art, "kein-interesse");
  assert.doesNotMatch(v.grund, /pausiert/);
});
