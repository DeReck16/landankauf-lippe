import { strict as assert } from "node:assert";
import { test } from "node:test";
import { testUmgebung } from "./hilfe";

testUmgebung();

const { filterOptionen, filtereGruppen, gruppieren } = await import("@/lib/boerse-regeln");
type Eintrag = import("@/lib/boerse-regeln").BoerseEintrag;

function eintrag(code: string, art: "kauf" | "pacht", typ: string, paket?: string): Eintrag {
  return { code, art, typ, groesseHa: 2, lage: "Kreis Lippe", text: "", seit: "2026-10-01", paket };
}

const gruppen = gruppieren([
  eintrag("LF-1001", "kauf", "Acker"),
  eintrag("LF-1002", "kauf", "Wald"),
  eintrag("LF-1003", "pacht", "Acker"),
  eintrag("LF-1004", "pacht", "Acker", "P1"),
  eintrag("LF-1005", "pacht", "Acker", "P1"),
  eintrag("LF-1006", "pacht", " "),
]);

const codes = (g: Eintrag[][]) => g.map((x) => x[0].code);

test("ohne Auswahl bleiben alle Karten, Pakete zählen als eine Karte", () => {
  assert.equal(gruppen.length, 5);
  assert.deepEqual(codes(filtereGruppen(gruppen, { art: "", typ: "" })), ["LF-1001", "LF-1002", "LF-1003", "LF-1004", "LF-1006"]);
});

test("Art und Typ filtern einzeln und zusammen", () => {
  assert.deepEqual(codes(filtereGruppen(gruppen, { art: "kauf", typ: "" })), ["LF-1001", "LF-1002"]);
  assert.deepEqual(codes(filtereGruppen(gruppen, { art: "", typ: "Acker" })), ["LF-1001", "LF-1003", "LF-1004"]);
  assert.deepEqual(codes(filtereGruppen(gruppen, { art: "pacht", typ: "Acker" })), ["LF-1003", "LF-1004"]);
  assert.deepEqual(filtereGruppen(gruppen, { art: "kauf", typ: "Fläche" }), []);
});

test("fehlender Typ heißt „Fläche“ wie auf der Karte", () => {
  assert.deepEqual(codes(filtereGruppen(gruppen, { art: "", typ: "Fläche" })), ["LF-1006"]);
});

test("Zahlen der Optionen gelten für die Auswahl der jeweils anderen Gruppe", () => {
  const alle = filterOptionen(gruppen, { art: "", typ: "" });
  assert.deepEqual(alle.arten, [{ wert: "kauf", anzahl: 2 }, { wert: "pacht", anzahl: 3 }]);
  assert.deepEqual(alle.typen, [{ wert: "Acker", anzahl: 3 }, { wert: "Fläche", anzahl: 1 }, { wert: "Wald", anzahl: 1 }]);

  const pacht = filterOptionen(gruppen, { art: "pacht", typ: "" });
  assert.deepEqual(pacht.typen, [{ wert: "Acker", anzahl: 2 }, { wert: "Fläche", anzahl: 1 }, { wert: "Wald", anzahl: 0 }]);

  const wald = filterOptionen(gruppen, { art: "", typ: "Wald" });
  assert.deepEqual(wald.arten, [{ wert: "kauf", anzahl: 1 }, { wert: "pacht", anzahl: 0 }]);
});
