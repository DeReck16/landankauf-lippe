import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { testUmgebung } from "./hilfe";

const DIR = testUmgebung();

const store = await import("@/lib/admin/store");
const { seiteSchalten, boerseNeuSchreiben, boerseOfflineNehmen, BOERSE_PFAD } = await import("@/lib/boerse");

type Lead = import("@/lib/admin/model").LeadRecord;

async function anfrage(id: string, felder: Partial<Lead>): Promise<void> {
  const lead: Lead = {
    id,
    receivedAt: "2026-10-10T09:00:00.000Z",
    intent: "Verpachten",
    flaechentyp: "Ackerland",
    groesse: "6 ha",
    ort: "Kalletal",
    flurstueck: "—",
    message: "—",
    name: "Erika Musterfrau",
    phone: "—",
    email: "erika@example.com",
    source: "test",
    consent: "on",
    gclid: "—",
    boerse: "—",
    ...felder,
  };
  await store.dateiAnlegen(`leads/${lead.receivedAt.slice(0, 10)}/${id}.json`, JSON.stringify(lead), "application/json");
}

/** Grobe Lage vorgeben — ohne Netz kennt der Test keine Ortskoordinaten. */
async function lageSetzen(id: string, feld: "boerse" | "suche", lage: string, extra: object = {}): Promise<void> {
  await store.mutateZustand("test", (z) => {
    const alt = z.anfragen[id] ?? {};
    z.anfragen[id] = { ...alt, [feld]: { code: feld === "suche" ? "LS-4711" : "LF-4711", typ: "Ackerland", groesseHa: 6, lage, text: "", einwilligung: null, online: false, ...extra } };
    return { was: "Test: Angaben vorbereitet", ref: id };
  });
}

function oeffentlich(): { angebote: { code: string }[]; gesuche: { code: string; art: string; lage: string }[] } {
  const d = JSON.parse(readFileSync(path.join(DIR, BOERSE_PFAD), "utf8"));
  return { angebote: d.angebote ?? [], gesuche: d.gesuche ?? [] };
}

test("Schalter: ohne Einwilligung fragt er nach, schreibt aber nichts", async () => {
  await anfrage("LL-SCH1", {});
  const r = await seiteSchalten("LL-SCH1", "oeffentlich", "admin@example.com");
  assert.equal(r.ok, false);
  assert.equal(r.einwilligungNoetig, true);
  const { zustand } = await store.readZustand();
  assert.equal(zustand.anfragen["LL-SCH1"], undefined);
});

test("Schalter: mit Einwilligung und Lage wird die Fläche öffentlich, danach wieder nicht", async () => {
  await anfrage("LL-SCH2", { name: "Bernd Beispiel", email: "bernd@example.com" });
  await lageSetzen("LL-SCH2", "boerse", "Raum Kalletal");
  const r = await seiteSchalten("LL-SCH2", "oeffentlich", "admin@example.com", { quelle: "telefonisch" });
  assert.equal(r.ok, true, r.meldung);
  assert.deepEqual(oeffentlich().angebote.map((a) => a.code), ["LF-4711"]);
  const { zustand } = await store.readZustand();
  assert.equal(zustand.anfragen["LL-SCH2"].boerse?.einwilligung?.quelle, "telefonisch");
  assert.equal(zustand.anfragen["LL-SCH2"].boerse?.einwilligung?.von, "admin@example.com");
  assert.equal(zustand.anfragen["LL-SCH2"].boerse?.online, true);

  const aus = await seiteSchalten("LL-SCH2", "nicht", "admin@example.com");
  assert.equal(aus.ok, true);
  assert.deepEqual(oeffentlich().angebote, []);
});

test("Schalter: fehlt die Lage, bleibt die Einwilligung erfasst, veröffentlicht wird nichts", async () => {
  await anfrage("LL-SCH3", {});
  const r = await seiteSchalten("LL-SCH3", "oeffentlich", "admin@example.com", { quelle: "per E-Mail" });
  assert.equal(r.ok, false);
  assert.match(r.meldung, /grobe Lage fehlt/);
  const { zustand } = await store.readZustand();
  assert.equal(zustand.anfragen["LL-SCH3"].boerse?.einwilligung?.quelle, "per E-Mail");
  assert.equal(zustand.anfragen["LL-SCH3"].boerse?.online, false);
});

test("Schalter: Suchauftrag kommt als „Gesucht“ ohne Namen in die Datei", async () => {
  await anfrage("LL-SCH4", { intent: "Fläche gesucht (Pacht)", name: "Hans Sucher", email: "hans@example.com", ort: "Lemgo", groesse: "10 ha" });
  await lageSetzen("LL-SCH4", "suche", "Raum Lemgo", { groesseHa: 10 });
  const r = await seiteSchalten("LL-SCH4", "oeffentlich", "admin@example.com", { quelle: "schriftlich" });
  assert.equal(r.ok, true, r.meldung);
  const d = oeffentlich();
  assert.deepEqual(d.gesuche.map((g) => [g.code, g.art, g.lage]), [["LS-4711", "pacht", "Raum Lemgo"]]);
  assert.ok(!readFileSync(path.join(DIR, BOERSE_PFAD), "utf8").includes("Sucher"), "kein Name in der öffentlichen Datei");
});

test("Schalter: verräterische Angaben (Name im Text) halten einen Suchauftrag von der Seite fern", async () => {
  await anfrage("LL-SCH5", { intent: "Fläche gesucht (Kauf)", name: "Karla Käufer", email: "karla@example.com", ort: "Detmold" });
  await lageSetzen("LL-SCH5", "suche", "Raum Detmold", { text: "Karla Käufer sucht Wald", einwilligung: { am: "2026-10-12", quelle: "telefonisch", von: "admin@example.com" } });
  const r = await seiteSchalten("LL-SCH5", "oeffentlich", "admin@example.com");
  assert.equal(r.ok, false);
  assert.match(r.meldung, /Namen/);
  assert.ok(!oeffentlich().gesuche.some((g) => g.code === "LS-4711" && g.lage === "Raum Detmold"));
});

test("Schalter: offline nehmen und erledigte Anfragen entfernen Angebot wie Suchauftrag", async () => {
  // LL-SCH4 (Suchauftrag, online) wird mit Grund offline genommen
  assert.equal(oeffentlich().gesuche.length, 1);
  const n = await boerseOfflineNehmen(["LL-SCH4"], "Test: Suchender ausgestiegen", "system");
  assert.equal(n, 1);
  assert.deepEqual(oeffentlich().gesuche, []);

  // erledigt → auch ohne eigenen Schritt weg, sobald die Datei neu geschrieben wird
  await seiteSchalten("LL-SCH4", "oeffentlich", "admin@example.com");
  assert.equal(oeffentlich().gesuche.length, 1, "wieder öffentlich (Einwilligung bleibt erfasst)");
  await store.mutateZustand("test", (z) => {
    z.anfragen["LL-SCH4"] = { ...z.anfragen["LL-SCH4"], status: "erledigt" };
    return { was: "Test: erledigt", ref: "LL-SCH4" };
  });
  await boerseNeuSchreiben();
  assert.deepEqual(oeffentlich().gesuche, []);
});
