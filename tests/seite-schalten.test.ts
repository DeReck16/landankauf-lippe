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
  assert.equal(r.formular?.einwilligungNoetig, true);
  assert.equal(r.formular?.typ, "Ackerland"); // Vorschlag aus der Anfrage
  assert.equal(r.formular?.groesseHa, 6);
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

const { veroeffentlichungBestaetigen, BESTAETIGUNG_LIMIT_PRO_TAG, seiteSchaltenViele, boerseEinwilligungKunde } = await import("@/lib/boerse");

test("Bestätigungslink: ohne Häkchen im Formular wird nichts erfasst oder veröffentlicht", async () => {
  await anfrage("LL-BES0", { name: "Nina Neinsager", email: "nina@example.com" });
  await lageSetzen("LL-BES0", "boerse", "Raum Kalletal", { code: "LF-4999" });
  const r = await veroeffentlichungBestaetigen("LL-BES0");
  assert.equal(r.ok, false);
  const { zustand } = await store.readZustand();
  assert.equal(zustand.anfragen["LL-BES0"].boerse?.einwilligung, null);
  assert.ok(!oeffentlich().angebote.some((a) => a.code === "LF-4999"));
});

test("Bestätigungslink: erfasst die Einwilligung „per Bestätigungslink“ und veröffentlicht sofort", async () => {
  await anfrage("LL-BES1", { name: "Gerd Gutsbesitzer", email: "gerd@example.com", ort: "Kalletal", veroeffentlichen: true });
  await lageSetzen("LL-BES1", "boerse", "Raum Kalletal", { code: "LF-5001" });
  const r = await veroeffentlichungBestaetigen("LL-BES1");
  assert.equal(r.ok, true, r.meldung);
  const { zustand } = await store.readZustand();
  const e = zustand.anfragen["LL-BES1"].boerse?.einwilligung;
  assert.equal(e?.quelle, "per Bestätigungslink");
  assert.equal(e?.von, "Kunde");
  assert.ok(oeffentlich().angebote.some((a) => a.code === "LF-5001"));
  assert.ok(zustand.protokoll.some((p) => p.ref === "LL-BES1" && /automatisch nach Bestätigung per E-Mail-Link/.test(p.was)));
  assert.ok(!readFileSync(path.join(DIR, BOERSE_PFAD), "utf8").includes("Gutsbesitzer"), "kein Name in der öffentlichen Datei");
});

test("Bestätigungslink: ohne Größe bleibt es vorbereitet, die Einwilligung ist trotzdem erfasst", async () => {
  await anfrage("LL-BES2", { groesse: "—", ort: "Lage", veroeffentlichen: true });
  await lageSetzen("LL-BES2", "boerse", "Raum Lage", { code: "LF-5002", groesseHa: null });
  const r = await veroeffentlichungBestaetigen("LL-BES2");
  assert.equal(r.ok, false);
  assert.match(r.meldung, /ungefähre Größe fehlt/);
  const { zustand } = await store.readZustand();
  assert.equal(zustand.anfragen["LL-BES2"].boerse?.einwilligung?.quelle, "per Bestätigungslink");
  assert.equal(zustand.anfragen["LL-BES2"].boerse?.online, false);
});

test("Bestätigungslink: auch ein Suchauftrag geht nach der Bestätigung online und lässt sich per Link widerrufen", async () => {
  await anfrage("LL-BES4", { intent: "Fläche gesucht (Pacht)", name: "Hans Sucher", email: "hans2@example.com", ort: "Lemgo", groesse: "10 ha", veroeffentlichen: true });
  await lageSetzen("LL-BES4", "suche", "Raum Lemgo", { code: "LS-5004", groesseHa: 10 });
  const r = await veroeffentlichungBestaetigen("LL-BES4");
  assert.equal(r.ok, true, r.meldung);
  assert.ok(oeffentlich().gesuche.some((g) => g.code === "LS-5004"));

  // Widerruf mit einem Klick (Link der Bestätigungsmail): sofort weg, Einwilligung zurückgenommen.
  assert.equal(await boerseEinwilligungKunde("LL-BES4", false, null), "widerrufen");
  assert.ok(!oeffentlich().gesuche.some((g) => g.code === "LS-5004"));
  const { zustand } = await store.readZustand();
  assert.equal(zustand.anfragen["LL-BES4"].suche?.einwilligung, null);
  assert.equal(zustand.anfragen["LL-BES4"].suche?.online, false);
  assert.ok(zustand.anfragen["LL-BES4"].suche?.widerrufenAm, "Widerruf ist vermerkt");

  // Derselbe Bestätigungslink schaltet die Anzeige nach dem Widerruf nicht wieder ein.
  const nochmal = await veroeffentlichungBestaetigen("LL-BES4");
  assert.deepEqual([nochmal.ok, nochmal.code], [false, "widerrufen"]);
  assert.ok(!oeffentlich().gesuche.some((g) => g.code === "LS-5004"));
  assert.equal((await store.readZustand()).zustand.anfragen["LL-BES4"].suche?.einwilligung, null);

  // Nur die Verwaltung kann nach einem neuen Einverständnis wieder veröffentlichen — das hebt den Widerruf auf.
  const neu = await seiteSchalten("LL-BES4", "oeffentlich", "admin@example.com", { quelle: "telefonisch" });
  assert.equal(neu.ok, true, neu.meldung);
  assert.equal((await store.readZustand()).zustand.anfragen["LL-BES4"].suche?.widerrufenAm, undefined);
  await seiteSchalten("LL-BES4", "nicht", "admin@example.com");
});

test("Bestätigungslink: wiederholte Klicks ändern nichts und verbrauchen weder Kontingent noch Postfach", async () => {
  // LL-BES1 ist bereits bestätigt und online (siehe oben).
  const vorher = (await store.readZustand()).zustand.protokoll.length;
  for (let i = 0; i < 6; i++) {
    const r = await veroeffentlichungBestaetigen("LL-BES1");
    assert.deepEqual([r.ok, r.code], [true, "bereits"]);
  }
  assert.equal((await store.readZustand()).zustand.protokoll.length, vorher, "kein neuer Verlaufseintrag");
  assert.ok(oeffentlich().angebote.some((a) => a.code === "LF-5001"));
});

test("Bestätigungslink: eine von der Verwaltung offline genommene Anzeige bleibt offline", async () => {
  await anfrage("LL-BES5", { name: "Olga Offline", email: "olga@example.com", ort: "Lage", veroeffentlichen: true });
  await lageSetzen("LL-BES5", "boerse", "Raum Lage", { code: "LF-5005", einwilligung: { am: "2026-10-12", quelle: "telefonisch", von: "admin@example.com" }, online: true });
  await boerseNeuSchreiben();
  assert.ok(oeffentlich().angebote.some((a) => a.code === "LF-5005"));
  await boerseOfflineNehmen(["LL-BES5"], "Verwaltung: Eigentümer wünscht Pause", "admin@example.com");

  const r = await veroeffentlichungBestaetigen("LL-BES5");
  assert.deepEqual([r.ok, r.code], [false, "offline"]);
  assert.ok(!oeffentlich().angebote.some((a) => a.code === "LF-5005"));
});

test("Bestätigungslink: nach 30 Tagen nicht mehr zum Bestätigen — der Widerruf bleibt möglich", async () => {
  await anfrage("LL-BES6", { receivedAt: "2026-08-01T09:00:00.000Z", veroeffentlichen: true, ort: "Detmold" });
  await lageSetzen("LL-BES6", "boerse", "Raum Detmold", { code: "LF-5006" });
  const r = await veroeffentlichungBestaetigen("LL-BES6");
  assert.deepEqual([r.ok, r.code], [false, "abgelaufen"]);
  const { zustand } = await store.readZustand();
  assert.equal(zustand.anfragen["LL-BES6"].boerse?.einwilligung, null);
});

test("Bestätigungslink: ab dem Tageslimit wird nur noch vorbereitet, nicht veröffentlicht", async () => {
  // Schon verbraucht: LL-BES1, LL-BES2, LL-BES4 (je ein Zähler-Schritt). Den Rest bis zum Limit auffüllen.
  for (let i = 3; i < BESTAETIGUNG_LIMIT_PRO_TAG; i++) await store.drosseln("boerse-bestaetigung", "alle", [{ sekunden: 86_400, max: BESTAETIGUNG_LIMIT_PRO_TAG }]);
  await anfrage("LL-BES3", { ort: "Detmold", veroeffentlichen: true });
  await lageSetzen("LL-BES3", "boerse", "Raum Detmold", { code: "LF-5003" });
  const r = await veroeffentlichungBestaetigen("LL-BES3");
  assert.equal(r.ok, false);
  assert.match(r.meldung, /wartet auf den Klick/);
  const { zustand } = await store.readZustand();
  assert.equal(zustand.anfragen["LL-BES3"].boerse?.einwilligung?.quelle, "per Bestätigungslink");
  assert.equal(zustand.anfragen["LL-BES3"].boerse?.online, false);
  assert.ok(!oeffentlich().angebote.some((a) => a.code === "LF-5003"));

  // Der Klick der Verwaltung geht weiterhin (Einwilligung liegt ja vor).
  const klick = await seiteSchalten("LL-BES3", "oeffentlich", "admin@example.com");
  assert.equal(klick.ok, true, klick.meldung);
  assert.ok(oeffentlich().angebote.some((a) => a.code === "LF-5003"));
});

test("Schalter: fehlen Eckdaten, liefert er das Formular mit Vorschlag — ergänzt, geht es sofort online", async () => {
  await anfrage("LL-ANG1", { intent: "Fläche gesucht (Kauf)", name: "Rita Suchend", email: "rita@example.com", ort: "—", groesse: "—" });
  // Einwilligung liegt vor, aber kein Suchraum: Der Schalter fragt nach, schreibt nichts.
  await store.mutateZustand("test", (z) => {
    z.anfragen["LL-ANG1"] = { suche: { code: "LS-6001", typ: "Ackerland", groesseHa: null, lage: "", text: "", einwilligung: { am: "2026-10-12", quelle: "telefonisch", von: "admin@example.com" }, online: false } };
    return { was: "Test", ref: "LL-ANG1" };
  });
  const probe = await seiteSchalten("LL-ANG1", "oeffentlich", "admin@example.com");
  assert.equal(probe.ok, false);
  assert.equal(probe.formular?.einwilligungNoetig, false);
  assert.match((probe.formular?.luecken ?? []).join(" "), /Suchraum/);
  assert.ok(!oeffentlich().gesuche.some((g) => g.code === "LS-6001"));

  // Eine verräterische Lage wird abgelehnt — auch direkt im Formular.
  const falsch = await seiteSchalten("LL-ANG1", "oeffentlich", "admin@example.com", { angaben: { lage: "Musterstraße 5, Lemgo" } });
  assert.equal(falsch.ok, false);
  assert.ok(falsch.formular?.luecken.length);
  assert.ok(!oeffentlich().gesuche.some((g) => g.code === "LS-6001"));

  // Mit Eckdaten ergänzt: sofort öffentlich, Größe gerundet, kein Name.
  const gut = await seiteSchalten("LL-ANG1", "oeffentlich", "admin@example.com", { angaben: { typ: "Wiese / Grünland", groesseHa: 7.3, lage: "Raum Lemgo" } });
  assert.equal(gut.ok, true, gut.meldung);
  const e = oeffentlich().gesuche.find((g) => g.code === "LS-6001");
  assert.ok(e);
  assert.deepEqual([e.lage, (e as unknown as { typ: string }).typ, (e as unknown as { groesseHa: number }).groesseHa], ["Raum Lemgo", "Wiese / Grünland", 7]);
  assert.ok(!readFileSync(path.join(DIR, BOERSE_PFAD), "utf8").includes("Suchend"));
});

test("Sammel-Schalter: veröffentlicht die Bereiten, überspringt Unvollständige und ohne Einwilligung, mit Quelle auch ohne Einwilligung", async () => {
  const einw = { am: "2026-10-12", quelle: "telefonisch", von: "admin@example.com" };
  await anfrage("LL-SAM1", { name: "Sam Eins", email: "sam1@example.com" });
  await anfrage("LL-SAM2", { name: "Sam Zwei", email: "sam2@example.com" });
  await anfrage("LL-SAM3", { name: "Sam Drei", email: "sam3@example.com" });
  await lageSetzen("LL-SAM1", "boerse", "Raum Blomberg", { code: "LF-7001", einwilligung: einw });
  await lageSetzen("LL-SAM2", "boerse", "Raum Schieder", { code: "LF-7002" }); // keine Einwilligung
  await lageSetzen("LL-SAM3", "boerse", "", { code: "LF-7003", einwilligung: einw }); // keine Lage

  const ohneQuelle = await seiteSchaltenViele(["LL-SAM1", "LL-SAM2", "LL-SAM3"], "admin@example.com");
  assert.deepEqual(ohneQuelle.map((r) => [r.id, r.ok]), [["LL-SAM1", true], ["LL-SAM2", false], ["LL-SAM3", false]]);
  let codes = oeffentlich().angebote.map((a) => a.code);
  assert.ok(codes.includes("LF-7001") && !codes.includes("LF-7002") && !codes.includes("LF-7003"));
  const { zustand } = await store.readZustand();
  assert.equal(zustand.anfragen["LL-SAM2"].boerse?.einwilligung, null, "ohne Angabe wird keine Einwilligung erfunden");

  // Mit Quelle: SAM2 bekommt die Einwilligung erfasst und geht online; SAM3 bleibt wegen der fehlenden Lage draußen.
  const mitQuelle = await seiteSchaltenViele(["LL-SAM2", "LL-SAM3"], "admin@example.com", { quelle: "per E-Mail" });
  assert.deepEqual(mitQuelle.map((r) => [r.id, r.ok]), [["LL-SAM2", true], ["LL-SAM3", false]]);
  codes = oeffentlich().angebote.map((a) => a.code);
  assert.ok(codes.includes("LF-7002") && !codes.includes("LF-7003"));
  assert.equal((await store.readZustand()).zustand.anfragen["LL-SAM2"].boerse?.einwilligung?.quelle, "per E-Mail");
});
