import { strict as assert } from "node:assert";
import { test } from "node:test";
import { testUmgebung } from "./hilfe";

testUmgebung();

const { VORLAGEN, VORLAGEN_REIHENFOLGE, vorlageHash } = await import("@/lib/vertraege/vorlagen");

function textVon(dok: { titel: string; untertitel?: string; bloecke: unknown[] }): string {
  return JSON.stringify(dok);
}

test("alle Vorlagen rendern jede Variante ohne undefined/null", () => {
  for (const id of VORLAGEN_REIHENFOLGE) {
    const v = VORLAGEN[id];
    assert.ok(v.varianten.length > 0, id);
    for (const x of v.varianten) {
      const t = textVon(v.render(x.daten));
      assert.doesNotMatch(t, /undefined|\bnull\b|\[object Object\]/, `${id} / ${x.name}`);
    }
    assert.match(vorlageHash(id), /^[0-9a-f]{64}$/);
  }
});

test("Nachweisvertrag: ein Begriff, Direktankauf offengelegt, eigene Flächen ohne Provision", () => {
  for (const id of ["nachweis-pacht", "nachweis-kauf"] as const) {
    const t = textVon(VORLAGEN[id].render(VORLAGEN[id].varianten[0].daten));
    assert.match(t, /Nachweisvertrag – /);
    assert.match(t, /Direktankauf/);
    assert.match(t, /„eigene Fläche“ gekennzeichnete Fläche \(§ 1 Abs\. 6\) schuldet der Auftraggeber keine Provision/);
  }
});

test("Anbieter-Vereinbarung: Knopfname passt zur Seite, 24 Monate im Kurztext", () => {
  const v = VORLAGEN.anbieter;
  const t = textVon(v.render(v.varianten[0].daten));
  assert.match(t, /„Vereinbarung kostenlos bestätigen“/);
  assert.match(t, /innerhalb von 24 Monaten nach einer Freigabe/);
  assert.match(t, /kauft geeignete Flächen auch selbst/);
});

test("Pachtvertrag und Kaufabsicht haben eine Variante „eigene Fläche“ ohne Provision", () => {
  const pv = VORLAGEN.pachtvertrag.varianten.find((x) => x.name.startsWith("eigene Fläche"));
  assert.ok(pv);
  assert.match(textVon(VORLAGEN.pachtvertrag.render(pv.daten)), /schuldet keine Partei Lippe Forst eine Provision/);
  const ka = VORLAGEN.kaufabsicht.varianten.find((x) => x.name.startsWith("eigene Fläche"));
  assert.ok(ka);
  assert.match(textVon(VORLAGEN.kaufabsicht.render(ka.daten)), /schuldet keine Partei Lippe Forst eine Provision/);
  // Entstehung der Kaufprovision wie im Nachweisvertrag: mit Beurkundung, bei Genehmigung erst mit Wirksamkeit.
  const std = textVon(VORLAGEN.kaufabsicht.render(VORLAGEN.kaufabsicht.varianten[0].daten));
  assert.match(std, /entsteht mit der notariellen Beurkundung/);
  assert.match(std, /erst mit seiner Wirksamkeit/);
});

test("Pachtvertrag nummeriert die Pachtzins-Absätze fortlaufend (mit Staffel und Einmalzahlung)", () => {
  const v = VORLAGEN.pachtvertrag.varianten.find((x) => x.daten.staffel && x.daten.einmalzahlung);
  assert.ok(v);
  const t = textVon(VORLAGEN.pachtvertrag.render(v.daten));
  for (const n of [1, 2, 3, 4, 5, 6]) assert.match(t, new RegExp(`\\(${n}\\) `));
  assert.match(t, /einmalig «Einmalzahlung»/);
});
