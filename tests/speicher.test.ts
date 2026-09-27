import { strict as assert } from "node:assert";
import { test } from "node:test";
import { testUmgebung } from "./hilfe";

testUmgebung();
const S = await import("@/lib/admin/store");

test("jsonAendern legt an, ändert und erkennt parallele Änderungen", async () => {
  const a = await S.jsonAendern<{ n: number }>("t/zaehler.json", () => ({ n: 0 }), (d) => {
    d.n++;
  });
  assert.equal(a.n, 1);
  // Zwei parallele Änderungen: beide landen (ETag-Wiederholung), keine geht verloren.
  await Promise.all([
    S.jsonAendern<{ n: number }>("t/zaehler.json", () => ({ n: 0 }), (d) => void d.n++),
    S.jsonAendern<{ n: number }>("t/zaehler.json", () => ({ n: 0 }), (d) => void d.n++),
  ]);
  assert.equal((await S.jsonLesen<{ n: number }>("t/zaehler.json"))?.daten.n, 3);
});

test("einmalMarker gilt genau einmal", async () => {
  assert.equal(await S.einmalMarker("t/marker/a.json"), true);
  assert.equal(await S.einmalMarker("t/marker/a.json"), false);
});

test("dateiAnlegen überschreibt nie", async () => {
  await S.dateiAnlegen("t/datei.txt", "eins", "text/plain");
  await assert.rejects(S.dateiAnlegen("t/datei.txt", "zwei", "text/plain"));
  const d = await S.dateiLesen("t/datei.txt");
  assert.equal(Buffer.from(d!.bytes).toString(), "eins");
});

test("drosseln begrenzt je Fenster", async () => {
  const k = S.kurzwert("203.0.113.9", "test");
  const ergebnisse: boolean[] = [];
  for (let i = 0; i < 4; i++) ergebnisse.push(await S.drosseln("test", k, [{ sekunden: 600, max: 3 }]));
  assert.deepEqual(ergebnisse, [true, true, true, false]);
  // Anderer Schlüssel ist unabhängig.
  assert.equal(await S.drosseln("test", S.kurzwert("198.51.100.1", "test"), [{ sekunden: 600, max: 3 }]), true);
});

test("Verlauf je Anfrage bleibt, auch wenn das Protokoll gekürzt wird", async () => {
  await S.mutateZustand("admin@example.com", () => ({ was: "Status → Neu", ref: "LL-TEST1" }));
  await S.mutateZustand("admin@example.com", () => ({ was: "Paar vorgemerkt", ref: "LL-TEST1~LL-TEST2" }));
  const v1 = await S.verlaufLesen("LL-TEST1");
  const v2 = await S.verlaufLesen("LL-TEST2");
  assert.equal(v1.length, 2);
  assert.equal(v2.length, 1);
  assert.equal(v2[0].was, "Paar vorgemerkt");
});
