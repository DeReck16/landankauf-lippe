import { strict as assert } from "node:assert";
import { test } from "node:test";
import { testUmgebung } from "./hilfe";

testUmgebung();

const S = await import("@/lib/portal/speicher");
const M = await import("@/lib/portal/model");
const { jsonAendern } = await import("@/lib/admin/store");

test("E-Mail-Index: neue Akten, Altbestand ohne Index, Adresswechsel", async () => {
  // Altbestand: Akte ohne Index (direkt geschrieben, wie vor Einführung des Index)
  await jsonAendern("portal/kunden/LL-ALT1.json", () => M.neuerKunde("LL-ALT1", "anbieter", "pacht", "eva@example.com", "test"), () => undefined);
  // Neue Akten über aendereKunde
  await S.aendereKunde("LL-NEU1", () => undefined, () => M.neuerKunde("LL-NEU1", "suchender", "pacht", "eva@example.com", "test"));
  await S.aendereKunde("LL-NEU2", () => undefined, () => M.neuerKunde("LL-NEU2", "suchender", "kauf", "tom@example.com", "test"));

  const eva = await S.kundenFuerEmail("Eva@Example.com");
  assert.deepEqual(eva.map((k) => k.id).sort(), ["LL-ALT1", "LL-NEU1"], "Altbestand wird beim ersten Mal gefunden");
  assert.deepEqual((await S.kundenFuerEmail("eva@example.com")).map((k) => k.id).sort(), ["LL-ALT1", "LL-NEU1"], "danach aus dem Index");

  await S.aendereKunde("LL-NEU2", (k) => {
    k.email = "eva@example.com";
  });
  assert.deepEqual((await S.kundenFuerEmail("eva@example.com")).map((k) => k.id).sort(), ["LL-ALT1", "LL-NEU1", "LL-NEU2"], "Adresswechsel landet im Index");
  assert.deepEqual((await S.kundenFuerEmail("tom@example.com")).map((k) => k.id), [], "alte Adresse findet die Akte nicht mehr");
  assert.deepEqual(await S.kundenFuerEmail("niemand@example.com"), []);
});
