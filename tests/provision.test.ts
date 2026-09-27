import { strict as assert } from "node:assert";
import { test } from "node:test";
import { testUmgebung } from "./hilfe";

testUmgebung();

const M = await import("@/lib/portal/model");

const K = { ...M.STANDARD_KONDITIONEN };

function pacht(teil: Partial<import("@/lib/portal/model").PachtDaten>): import("@/lib/portal/model").PachtDaten {
  return {
    verpaechter: { name: "V", anschrift: "A" },
    paechter: { name: "P", anschrift: "A", betrieb: "" },
    flaechen: [{ gemarkung: "Horn", flur: "1", flurstueck: "2", groesseHa: 5, nutzung: "Ackerland" }],
    nutzungsart: "Ackerland",
    pachtBeginn: "2026-10-01",
    laufzeitJahre: 10,
    pachtjahr: "wirtschaftsjahr",
    pachtzinsJeHa: 400,
    pachtzinsJahr: null,
    staffel: [],
    zahlweise: "jaehrlich",
    faelligkeit: "",
    umsatzsteuer: "ohne",
    kontoinhaber: "",
    iban: "",
    wasserverband: "verpaechter",
    verpflichtungen: "",
    besonderes: "",
    ...teil,
  };
}

test("Pacht: eine Jahrespacht zzgl. 19 % — Beispiel 5 ha × 400 € = 2.000 € → 2.380 €", () => {
  const b = M.provisionBerechnen("pacht", M.massgeblicheJahrespacht(pacht({})), K);
  assert.equal(b.netto, 2000);
  assert.equal(b.brutto, 2380);
});

test("Kauf: 3,59 % zzgl. USt, Umsatzsteuer auf den gerundeten Nettobetrag", () => {
  // 3,59 % von 12.345,67 = 443,209553 → netto 443,21 → brutto 527,42 (nicht 527,41 aus dem ungerundeten Wert)
  const b = M.provisionBerechnen("kauf", 12_345.67, K);
  assert.equal(b.netto, 443.21);
  assert.equal(b.brutto, 527.42);
});

test("Staffel und Einmalzahlung: Durchschnitt der ersten fünf Pachtjahre", () => {
  const d = pacht({ pachtzinsJeHa: null, pachtzinsJahr: 2000, staffel: [{ pachtjahr: 1, betrag: 0 }], einmalzahlung: 1500 });
  // (0 + 4 × 2.000 + 1.500) / 5 = 1.900
  assert.equal(M.massgeblicheJahrespacht(d), 1900);
});

test("Einmalzahlung bei kurzer fester Laufzeit wird auf die Laufzeit verteilt", () => {
  const d = pacht({ pachtzinsJeHa: null, pachtzinsJahr: 1000, laufzeitJahre: 2, einmalzahlung: 400 });
  assert.equal(M.massgeblicheJahrespacht(d), 1200);
});

test("Konditionen-Texte: Kauf brutto exakt auf vier Stellen", () => {
  assert.match(M.bruttoText("kauf", K), /4,2721 %/);
  assert.match(M.konditionenText("pacht", K), /eine volle Jahrespacht \(netto\) zzgl\. 19 % Umsatzsteuer/);
});
