import { strict as assert } from "node:assert";
import { test } from "node:test";
import { STANDARD_AUTOMATIK, automatikVon, erinnerungFaellig, regelWirksam } from "@/lib/portal/automatik-regeln";

test("Standard: alle Regeln aus, Probelauf an, Rechtsschalter aus", () => {
  const a = automatikVon(undefined);
  assert.equal(a.probelauf, true);
  assert.equal(a.notAus, false);
  assert.ok(Object.values(a.regeln).every((x) => x === false));
  assert.equal(a.recht34c, false);
  assert.equal(a.vorlagenGeprueft, false);
  assert.equal(regelWirksam(a, "r1").an, false);
});

test("Not-Aus schlägt jede Regel", () => {
  const a = automatikVon({ notAus: true, regeln: { ...STANDARD_AUTOMATIK.regeln, r1: true } });
  assert.deepEqual(regelWirksam(a, "r1"), { an: false, grund: "Not-Aus ist an" });
});

test("R4/R5 nur mit beiden Rechtsschaltern", () => {
  const regeln = { ...STANDARD_AUTOMATIK.regeln, r4: true, r5: true };
  assert.equal(regelWirksam(automatikVon({ regeln }), "r4").an, false);
  assert.equal(regelWirksam(automatikVon({ regeln, recht34c: true }), "r5").an, false);
  assert.equal(regelWirksam(automatikVon({ regeln, recht34c: true, vorlagenGeprueft: true }), "r4").an, true);
  // R1/R2 brauchen die Schalter nicht
  assert.equal(regelWirksam(automatikVon({ regeln: { ...regeln, r2: true } }), "r2").an, true);
});

test("Erinnerungen: höchstens zwei, nach 3 und weiteren 7 Tagen", () => {
  const t0 = "2026-09-01T08:00:00.000Z";
  const tag = (n: number) => new Date(Date.parse(t0) + n * 86_400_000);
  assert.equal(erinnerungFaellig([], tag(10)), false, "ohne erste Mail keine Erinnerung");
  assert.equal(erinnerungFaellig([t0], tag(2)), false);
  assert.equal(erinnerungFaellig([t0], tag(3)), true);
  const e1 = tag(3).toISOString();
  assert.equal(erinnerungFaellig([t0, e1], tag(9)), false);
  assert.equal(erinnerungFaellig([t0, e1], tag(10)), true);
  const e2 = tag(10).toISOString();
  assert.equal(erinnerungFaellig([t0, e1, e2], tag(40)), false, "nach zwei Erinnerungen ist Schluss");
});
