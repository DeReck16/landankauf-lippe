import { strict as assert } from "node:assert";
import { test } from "node:test";
import { testUmgebung } from "./hilfe";

testUmgebung();

const { kontoStand, seitenStand } = await import("@/lib/admin/online-stand");
const { leadView } = await import("@/lib/admin/model");
const M = await import("@/lib/portal/model");

const lead = {
  id: "LL-TEST1",
  receivedAt: "2026-09-20T10:00:00.000Z",
  intent: "Verpachten",
  flaechentyp: "Ackerland",
  groesse: "5 ha",
  ort: "Horn-Bad Meinberg",
  flurstueck: "—",
  message: "",
  name: "Erika Muster",
  phone: "—",
  email: "erika@example.com",
  source: "Startseite",
  consent: "on",
  gclid: "—",
  boerse: "—",
};

const boerse = {
  code: "LF-1234",
  typ: "Ackerland",
  groesseHa: 5,
  lage: "Raum Horn-Bad Meinberg",
  text: "Arrondierte Ackerfläche mit guter Zuwegung.",
  einwilligung: { am: "2026-09-25", quelle: "im Kundenbereich", von: "kunde" },
  online: false,
};

test("Konto: Stufen vom Nicht-Eingeladenen bis zum Onboarded", () => {
  assert.equal(kontoStand(null).label, "Nicht eingeladen");

  const k = M.neuerKunde("LL-TEST1", "anbieter", "pacht", "erika@example.com", "test");
  assert.equal(kontoStand(k).label, "Nicht eingeladen");

  k.einladung = { nonce: "n", bis: "2026-12-01T00:00:00.000Z", erstelltAm: "2026-09-21T00:00:00.000Z", von: "test" };
  assert.equal(kontoStand(k).label, "Eingeladen");

  k.einladung.angenommenAm = "2026-09-22T00:00:00.000Z";
  assert.deepEqual([kontoStand(k).label, kontoStand(k).detail], ["Angemeldet", "noch keine Angaben"]);

  k.stammdaten = { name: "Erika Muster", betrieb: "", strasse: "", plz: "", ort: "", telefon: "", eigenschaft: "verbraucher", geaendertAm: "2026-09-22T00:00:00.000Z" };
  assert.deepEqual([kontoStand(k).label, kontoStand(k).detail], ["Angemeldet", "Unterschrift fehlt"]);

  k.vertrag = { signatur: { am: "2026-09-23T10:00:00.000Z" } } as never;
  const onboarded = kontoStand(k);
  assert.equal(onboarded.label, "Onboarded");
  assert.equal(onboarded.ton, "ok");
  assert.match(onboarded.detail ?? "", /23\.09\.2026/);

  k.widerruf = { am: "2026-09-24T00:00:00.000Z", eingang: "online", erfasstVon: "kunde" };
  assert.deepEqual([kontoStand(k).label, kontoStand(k).ton], ["Widerrufen", "rot"]);
});

test("Konto: weitere Fläche eines Anbieters folgt der Quell-Anfrage", () => {
  const quelle = M.neuerKunde("LL-QUELLE", "anbieter", "pacht", "erika@example.com", "test");
  quelle.einladung = { nonce: "n", bis: "2026-12-01T00:00:00.000Z", erstelltAm: "2026-09-21T00:00:00.000Z", von: "test", angenommenAm: "2026-09-22T00:00:00.000Z" };
  const kopie = M.neuerKunde("LL-TEST2", "anbieter", "pacht", "erika@example.com", "test");
  kopie.einladung = { nonce: "m", bis: "2026-12-01T00:00:00.000Z", erstelltAm: "2026-09-21T00:00:00.000Z", von: "test", ueber: "LL-QUELLE", kopie: true };
  const anzeige = kontoStand(kopie, new Map([[quelle.id, quelle]]));
  assert.equal(anzeige.label, "Angemeldet");
  assert.match(anzeige.detail ?? "", /LL-QUELLE/);
  assert.equal(kontoStand(kopie).label, "Eingeladen");
});

test("Seite: Angebot ohne Börsen-Angaben ist nicht online", () => {
  const a = seitenStand(leadView(lead, undefined), null);
  assert.deepEqual([a.label, a.detail], ["Nicht online", "noch keine Börsen-Angaben"]);
});

test("Seite: ohne Einwilligung bleibt es unveröffentlicht", () => {
  const a = seitenStand(leadView(lead, { boerse: { ...boerse, einwilligung: null } }), null);
  assert.deepEqual([a.label, a.detail], ["Nicht online", "Einwilligung fehlt"]);
});

test("Seite: Einwilligung und vollständige Angaben = bereit; veröffentlicht = online mit Link", () => {
  const bereit = seitenStand(leadView(lead, { boerse }), null);
  assert.equal(bereit.label, "Bereit");
  assert.equal(bereit.ton, "warn");

  const online = seitenStand(leadView(lead, { boerse: { ...boerse, online: true, seit: "2026-09-26T08:00:00.000Z" } }), null);
  assert.equal(online.label, "Online");
  assert.equal(online.ton, "ok");
  assert.equal(online.href, "/flaechenboerse/LF-1234");
  assert.equal(online.oeffentlich, true);
  assert.match(online.detail ?? "", /LF-1234 · seit 26\.09\.2026/);
});

test("Seite: online geführt, aber wegen einer Lücke nicht sichtbar", () => {
  // Flurstücksangabe im Text würde die Fläche verraten — die Börse lässt sie nicht durch.
  const a = seitenStand(leadView(lead, { boerse: { ...boerse, online: true, text: "Flur 3, Flurstück 86/2" } }), null);
  assert.equal(a.label, "Nicht sichtbar");
  assert.equal(a.ton, "rot");
  assert.match(a.detail ?? "", /Flur/);
});

test("Seite: vergeben, ausgestiegen, offline genommen, Direktankauf, erledigt", () => {
  const meta = { boerse: { ...boerse, online: true } };
  const vergeben = seitenStand(leadView(lead, meta), "vergeben (Vertrag geschlossen)");
  assert.deepEqual([vergeben.label, vergeben.detail], ["Offline", "vergeben (Vertrag geschlossen)"]);

  const manuell = seitenStand(leadView(lead, { boerse: { ...boerse, offline: { am: "2026-10-01T00:00:00.000Z", grund: "Eigentümer wünscht Pause" } } }), null);
  assert.deepEqual([manuell.label, manuell.detail], ["Offline", "Eigentümer wünscht Pause"]);

  const ankauf = seitenStand(leadView(lead, { weg: "ankauf", boerse: { ...boerse, online: true } }), null);
  assert.equal(ankauf.label, "Direktankauf");

  const erledigt = seitenStand(leadView(lead, { status: "erledigt", boerse }), null);
  assert.deepEqual([erledigt.label, erledigt.detail], ["Nicht online", "Anfrage erledigt"]);
});

test("Seite: Gesuche sind nie öffentlich, Sonstiges hat keinen Stand", () => {
  const gesuch = seitenStand(leadView({ ...lead, intent: "Fläche gesucht (Pacht)" }, undefined), null);
  assert.deepEqual([gesuch.label, gesuch.detail], ["Nicht öffentlich", "im Abgleich"]);

  const beendet = seitenStand(leadView({ ...lead, intent: "Fläche gesucht (Pacht)" }, { status: "archiv" }), null);
  assert.equal(beendet.detail, "nicht im Abgleich");

  const sonst = seitenStand(leadView({ ...lead, intent: "Bewertung" }, undefined), null);
  assert.equal(sonst.label, "—");
});

const { ueberblick, passtZumAnliegen, passtZumStand, anliegenSchluessel } = await import("@/lib/admin/ueberblick");

function mitMeta(id: string, intent: string, meta?: object) {
  return leadView({ ...lead, id, intent }, meta as never);
}

test("Überblick: zählt Anliegen, Konto, Seite und Matching; Erledigte und Archiv zählen nicht", () => {
  const leads = [
    mitMeta("LL-A1", "Verpachten", { boerse: { ...boerse, online: true, seit: "2026-10-01T00:00:00.000Z" } }),
    mitMeta("LL-A2", "Verkaufen", { boerse }),
    mitMeta("LL-A3", "Verkaufen", { weg: "ankauf" }),
    mitMeta("LL-G1", "Fläche gesucht (Kauf)"),
    mitMeta("LL-S1", "Bewertung"),
    mitMeta("LL-X1", "Verkaufen", { status: "erledigt" }),
    mitMeta("LL-X2", "Verkaufen", { status: "archiv" }),
  ];
  const k = M.neuerKunde("LL-A1", "anbieter", "pacht", "erika@example.com", "test");
  k.einladung = { nonce: "n", bis: "2026-12-01T00:00:00.000Z", erstelltAm: "2026-10-01T00:00:00.000Z", von: "test", angenommenAm: "2026-10-02T00:00:00.000Z" };
  k.stammdaten = { name: "Erika Muster", betrieb: "", strasse: "", plz: "", ort: "", telefon: "", eigenschaft: "verbraucher", geaendertAm: "2026-10-02T00:00:00.000Z" };
  k.vertrag = { signatur: { am: "2026-10-03T10:00:00.000Z" } } as never;

  const u = ueberblick(
    leads,
    new Map([[k.id, k]]),
    () => null,
    [{ meta: null }, { meta: { status: "vorgemerkt" } }, { meta: { status: "verworfen" } }, { meta: { status: "abschluss" } }],
    (l) => l.id === "LL-A2",
  );
  const n = (liste: { schluessel: string; n: number }[], s: string) => liste.find((z) => z.schluessel === s)?.n;

  assert.equal(n(u.wollen, "angebot:kauf"), 2); // LL-A2, LL-A3 — nicht die erledigte und archivierte
  assert.equal(n(u.wollen, "angebot:pacht"), 1);
  assert.equal(n(u.wollen, "gesuch:kauf"), 1);
  assert.equal(n(u.wollen, "keine"), 1);
  assert.equal(u.wollen.find((z) => z.schluessel === "angebot:kauf")?.puls, true);
  assert.equal(u.wollen.find((z) => z.schluessel === "angebot:pacht")?.puls, false);

  assert.equal(n(u.konto, "onboarded"), 1);
  assert.equal(n(u.konto, "nicht"), 3); // LL-A2, LL-A3, LL-G1 — die Auskunft hat kein Konto
  assert.equal(n(u.konto, "eingeladen"), 0);

  assert.equal(n(u.seite, "online"), 1);
  assert.equal(n(u.seite, "bereit"), 1);
  assert.equal(n(u.seite, "direkt"), 1);
  assert.equal(u.seite.find((z) => z.schluessel === "unsichtbar"), undefined); // leere Randfälle bleiben ausgeblendet
  assert.equal(u.gesucheImAbgleich, 1);

  assert.equal(n(u.matching, "vorschlag"), 1);
  assert.equal(n(u.matching, "vorgemerkt"), 1);
  assert.equal(n(u.matching, "abschluss"), 1);
  assert.equal(n(u.matching, "angefragt"), 0); // verworfene Paare zählen nirgends
});

test("Filter: Anliegen, Konto und Seite", () => {
  const verkauf = mitMeta("LL-F1", "Verkaufen");
  const gesuch = mitMeta("LL-F2", "Fläche gesucht (Pacht)");
  assert.equal(anliegenSchluessel(verkauf), "angebot:kauf");
  assert.equal(anliegenSchluessel(gesuch), "gesuch:pacht");
  assert.equal(anliegenSchluessel(mitMeta("LL-F3", "Bewertung")), "keine");

  assert.ok(passtZumAnliegen(verkauf, "alle"));
  assert.ok(passtZumAnliegen(verkauf, "angebot"));
  assert.ok(passtZumAnliegen(verkauf, "angebot:kauf"));
  assert.ok(!passtZumAnliegen(verkauf, "angebot:pacht"));
  assert.ok(!passtZumAnliegen(verkauf, "gesuch"));
  assert.ok(passtZumAnliegen(gesuch, "gesuch:pacht"));

  const a = kontoStand(null);
  assert.ok(passtZumStand(a, "alle"));
  assert.ok(passtZumStand(a, "nicht"));
  assert.ok(!passtZumStand(a, "onboarded"));
});
