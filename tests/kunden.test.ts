import { strict as assert } from "node:assert";
import { test } from "node:test";
import { testUmgebung } from "./hilfe";

testUmgebung();

const { leadView } = await import("@/lib/admin/model");
const { besteStufe, kundenAus, passtZurKundenSuche } = await import("@/lib/admin/kunden");

function lead(id: string, extra: Record<string, string> = {}) {
  return {
    id,
    receivedAt: "2026-09-01T08:00:00.000Z",
    intent: "Verkaufen",
    flaechentyp: "Grünland",
    groesse: "2 ha",
    ort: "Horn",
    flurstueck: "—",
    message: "—",
    name: "Max Beispiel",
    phone: "—",
    email: "max@example.org",
    source: "/flaeche-verkaufen",
    consent: "ja",
    gclid: "—",
    boerse: "—",
    ...extra,
  };
}

const akte = (id: string, extra: Record<string, unknown> = {}) => ({ v: 1, id, rolle: "anbieter", art: "kauf", email: "max@example.org", angelegtAm: "2026-09-02T08:00:00.000Z", angelegtVon: "a", dokumente: [], ereignisse: [], mails: [], ...extra }) as never;

test("Kunden: Anfragen derselben E-Mail-Adresse sind eine Person, neueste zuerst", () => {
  const leads = [
    leadView(lead("LL-AAAAAA01"), undefined),
    leadView(lead("LL-AAAAAA02", { receivedAt: "2026-10-01T08:00:00.000Z", name: "Maximilian Beispiel", phone: "0170 111" }), undefined),
    leadView(lead("LL-AAAAAA03", { email: "anna@example.org", name: "Anna Muster" }), undefined),
  ];
  const k = kundenAus(leads, new Map());
  assert.equal(k.length, 2);
  const max = k.find((x) => x.email === "max@example.org")!;
  assert.deepEqual(max.anfragen.map((l) => l.id), ["LL-AAAAAA02", "LL-AAAAAA01"]);
  assert.equal(max.name, "Maximilian Beispiel");
  assert.deepEqual(max.weitereNamen, ["Max Beispiel"]);
  assert.equal(max.telefon, "0170 111", "Platzhalter „—“ zählt nicht als Telefonnummer");
  assert.equal(k[0].email, "max@example.org", "zuletzt aktive Person zuerst");
});

test("Kunden: Archiv und eigene Flächen gehören nicht dazu; ohne E-Mail zählt der Name", () => {
  const leads = [
    leadView(lead("LL-BBBBBB01"), { status: "archiv" }),
    leadView(lead("LL-BBBBBB02", { source: "verwaltung", message: "eigene Fläche Leopoldstal", email: "dennis@example.org" }), undefined),
    leadView(lead("LL-BBBBBB03", { email: "—", name: "Erika Ohnemail" }), undefined),
    leadView(lead("LL-BBBBBB04", { email: "—", name: "—" }), undefined),
  ];
  const k = kundenAus(leads, new Map());
  assert.deepEqual(k.map((x) => x.name), ["Erika Ohnemail"]);
  assert.equal(k[0].email, "");
});

test("Kunden: Stufe, Weitergabe an TR Immobilien und Suche", () => {
  const meta = { triUebergabe: { am: "2026-10-19T08:00:00.000Z", von: "a", triId: "TRI-XYZ123", einverstaendnis: { am: "2026-10-19T08:00:00.000Z", von: "a" } } };
  const leads = [leadView(lead("LL-CCCCCC01"), meta), leadView(lead("LL-CCCCCC02"), undefined)];
  const akten = new Map([
    ["LL-CCCCCC01", akte("LL-CCCCCC01", { einladung: { nonce: "n", bis: "x", erstelltAm: "x", von: "a" } })],
    ["LL-CCCCCC02", akte("LL-CCCCCC02", { vertrag: { signatur: { am: "2026-10-05T08:00:00.000Z" } } })],
  ]);
  const [k] = kundenAus(leads, akten);
  assert.equal(k.stufe, "unterschrieben");
  assert.deepEqual(k.triIds, ["TRI-XYZ123"]);
  assert.ok(passtZurKundenSuche(k, "beispiel tri-xyz123"));
  assert.ok(passtZurKundenSuche(k, "ll-cccccc02 grünland"));
  assert.ok(!passtZurKundenSuche(k, "beispiel unbekannt"));
});

test("Kunden: Widerruf zählt nur, wenn nichts Gültiges vorliegt", () => {
  const widerruf = akte("LL-DDDDDD01", { vertrag: {}, widerruf: { am: "x" } });
  const eingeladen = akte("LL-DDDDDD02", { einladung: { nonce: "n", bis: "x", erstelltAm: "x", von: "a" } });
  assert.equal(besteStufe([widerruf]), "widerrufen");
  assert.equal(besteStufe([widerruf, eingeladen]), "eingeladen");
  assert.equal(besteStufe([]), "neu");
});
