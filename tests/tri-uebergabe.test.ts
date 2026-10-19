import { strict as assert } from "node:assert";
import { test } from "node:test";
import { testUmgebung } from "./hilfe";

testUmgebung();

const { leadView } = await import("@/lib/admin/model");
const { triPayload } = await import("@/lib/portal/tri-payload");

const LEAD = {
  id: "LL-MRCA71FZ",
  receivedAt: "2026-07-10T08:00:00.000Z",
  intent: "Verkaufen",
  flaechentyp: "Grünland",
  groesse: "1,0114 ha",
  ort: "Vlotho",
  flurstueck: "Valdorf Flur 3 Flst. 86",
  message: "Verpachtet für 100 €/Jahr",
  name: "Max Beispiel",
  phone: "—",
  email: "max@example.org",
  source: "/flaeche-verkaufen",
  consent: "ja",
  gclid: "—",
  boerse: "—",
};

test("Übergabe an TR Immobilien: Kontakt, Fläche, Kataster und Einverständnis gehen mit — Platzhalter „—“ nicht", () => {
  const meta = {
    notiz: "INTERN: will nicht unter 30 T€",
    weg: "vermittlung" as const,
    kataster: {
      am: "2026-07-10T09:00:00.000Z",
      schluessel: "x",
      flurstueck: { gemarkung: "Valdorf", gemeinde: "Vlotho", kreis: "Herford", flur: "3", nummer: "86", flaecheM2: 10114, nutzung: "Grünland", lage: "Voßgrund", punkt: [8.9, 52.1] as [number, number] },
      brw: { wert: 2, stichtag: "01.01.2026", art: "landwirtschaft" as const, zone: "Z", gutachterausschuss: "Herford", gemarkungen: "Valdorf" },
    },
  };
  const p = triPayload(leadView(LEAD, meta), meta, "2026-10-19T08:00:00.000Z", "admin@example.org");
  assert.equal(p.quelle, "lippe-forst");
  assert.equal(p.externeId, "LL-MRCA71FZ");
  assert.equal(p.intent, "Verkaufen");
  assert.equal(p.art, "kauf");
  assert.equal(p.flaechentyp, "Grünland");
  assert.equal(p.phone, "", "Platzhalter „—“ wird nicht als Telefonnummer übergeben");
  assert.equal(p.email, "max@example.org");
  assert.equal(p.kataster?.flaecheM2, 10114);
  assert.equal(p.kataster?.brwWert, 2);
  assert.deepEqual(p.einverstaendnis, { am: "2026-10-19T08:00:00.000Z", von: "admin@example.org" });
  assert.equal(p.weg, "vermittlung");
  assert.doesNotMatch(JSON.stringify(p), /INTERN|30 T€/, "interne Notizen gehen nie mit");
});

test("Übergabe an TR Immobilien: ohne Kataster-Daten kein Kataster-Block", () => {
  const p = triPayload(leadView(LEAD, undefined), undefined, "2026-10-19T08:00:00.000Z", "admin@example.org");
  assert.equal(p.kataster, undefined);
  assert.equal(p.weg, undefined);
});
