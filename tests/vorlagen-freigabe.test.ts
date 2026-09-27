import { strict as assert } from "node:assert";
import { test } from "node:test";
import { testUmgebung } from "./hilfe";

testUmgebung();

const { VORLAGEN_REIHENFOLGE, vorlageHash } = await import("@/lib/vertraege/vorlagen");

// Stand der Vorlagen, die Dennis ab dem 27.09.2026 freigibt (Version 2026-09-27). Jede Textänderung
// ändert die Prüfsumme und hebt die Freigabe auf — dieser Test schlägt dann an. Nur bewusst anpassen,
// wenn eine geänderte Vorlage neu freigegeben werden soll (nach anwaltlicher Prüfung).
const FREIGABE_STAND: Record<string, string> = {
  "nachweis-pacht": "36ae3817ea4b71bbf52ab29fa5fc970ae9e989f2360992e5277ce06408259ed2",
  "nachweis-kauf": "aa1be4bfa3923b7c2d826236c19f3424ad5f6173ce597638d8aa9137b96682ca",
  anbieter: "628c0a548dae3ac54b080ea05f3a3ad35cf861e8e46cd0c9c68753ae8e5fa9e3",
  pachtvertrag: "f8dfcfee58fed818c4fb6787f96e8a68bc1a159e83fe22fb03a5059d214cd150",
  kaufabsicht: "fda846ac8029ad912d86db6b0904a5e7000ad9c33fc372d01a0d752827359ef4",
};

test("Vorlagentexte unverändert seit der Freigabe-Runde vom 27.09.2026", () => {
  assert.deepEqual([...VORLAGEN_REIHENFOLGE].sort(), Object.keys(FREIGABE_STAND).sort());
  for (const id of VORLAGEN_REIHENFOLGE) {
    assert.equal(vorlageHash(id), FREIGABE_STAND[id], `Vorlage „${id}“ geändert — die Freigabe erlischt. Nur bewusst ändern und hier eintragen.`);
  }
});
