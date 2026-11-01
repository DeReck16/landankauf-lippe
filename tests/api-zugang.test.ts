import { strict as assert } from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { testUmgebung } from "./hilfe";

const DIR = testUmgebung();

const Z = await import("@/lib/api/zugang");
const store = await import("@/lib/admin/store");
const boardRoute = await import("@/app/api/verwaltung/board/route");
const ichRoute = await import("@/app/api/verwaltung/ich/route");

type Lead = import("@/lib/admin/model").LeadRecord;

async function anfrage(id: string, felder: Partial<Lead>): Promise<void> {
  const lead: Lead = {
    id,
    receivedAt: "2026-10-10T09:00:00.000Z",
    intent: "Verkaufen",
    flaechentyp: "Ackerland",
    groesse: "1,5 ha",
    ort: "Oerlinghausen",
    flurstueck: "—",
    message: "—",
    name: "Erika Musterfrau",
    phone: "0171 1234567",
    email: "erika@example.org",
    source: "/flaeche-verkaufen",
    consent: "on",
    gclid: "—",
    boerse: "—",
    ...felder,
  };
  await store.dateiAnlegen(`leads/${lead.receivedAt.slice(0, 10)}/${id}.json`, JSON.stringify(lead), "application/json");
}

const mitSchluessel = (schluessel: string, init: RequestInit = {}) =>
  new Request("https://lippeforst.de/api/verwaltung/board", { ...init, headers: { authorization: `Bearer ${schluessel}`, ...(init.headers ?? {}) } });

function speicherText(): string {
  let alles = "";
  const gehe = (ordner: string) => {
    for (const n of readdirSync(ordner)) {
      const voll = path.join(ordner, n);
      if (statSync(voll).isDirectory()) gehe(voll);
      else alles += `\n#${path.relative(DIR, voll)}\n${readFileSync(voll, "utf8")}`;
    }
  };
  gehe(DIR);
  return alles;
}

let lesen = "";
let schreiben = "";

test("Zugang anlegen: Schlüssel nur einmal, im Speicher nur der Hash", async () => {
  const r = await Z.zugangAnlegen("admin@example.com", { name: "Tagesbearbeitung", rechte: ["board:lesen", "board:details", "board:notiz", "board:status", "board:paare"], tage: 30 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.match(r.schluessel, /^lfk_[a-f0-9]{10}_[A-Za-z0-9_-]{43}$/);
  schreiben = r.schluessel;
  const geheimnis = r.schluessel.split("_")[2];
  assert.ok(!speicherText().includes(geheimnis), "Geheimnis darf nirgends im Speicher stehen");
  assert.ok(!JSON.stringify(await Z.zugaengeListe()).includes("hash"), "Liste ohne Hash");

  const nur = await Z.zugangAnlegen("admin@example.com", { name: "Nur lesen", rechte: ["board:lesen"], tage: 30 });
  assert.equal(nur.ok, true);
  if (nur.ok) lesen = nur.schluessel;
});

test("Zugang anlegen: ungültige Eingaben und Doppelnamen werden abgelehnt", async () => {
  assert.equal((await Z.zugangAnlegen("a", { name: "ab", rechte: ["board:lesen"], tage: 30 })).ok, false);
  assert.equal((await Z.zugangAnlegen("a", { name: "Ohne Recht", rechte: ["gibt-es-nicht"], tage: 30 })).ok, false);
  assert.equal((await Z.zugangAnlegen("a", { name: "Zu lang", rechte: ["board:lesen"], tage: 5000 })).ok, false);
  const doppelt = await Z.zugangAnlegen("a", { name: "tagesbearbeitung", rechte: ["board:lesen"], tage: 30 });
  assert.equal(doppelt.ok, false);
});

test("Prüfung: gültig, falsch, fehlend, Recht fehlt", async () => {
  const gut = await Z.zugangPruefen(mitSchluessel(lesen), "board:lesen");
  assert.equal(gut.ok, true);
  if (gut.ok) assert.equal(gut.von, "API: Nur lesen");

  const falsch = await Z.zugangPruefen(mitSchluessel(lesen.slice(0, -2) + "xx"), "board:lesen");
  assert.deepEqual([falsch.ok, falsch.ok ? 0 : falsch.status], [false, 401]);
  const ohne = await Z.zugangPruefen(new Request("https://lippeforst.de/x"), "board:lesen");
  assert.deepEqual([ohne.ok, ohne.ok ? 0 : ohne.status], [false, 401]);
  const kein = await Z.zugangPruefen(mitSchluessel(lesen), "board:status");
  assert.deepEqual([kein.ok, kein.ok ? 0 : kein.status], [false, 403]);
});

test("Fehlversuche werden gezählt: nach 20 gibt es 429", async () => {
  const kopf = { "x-forwarded-for": "203.0.113.9" };
  let letzter = 0;
  for (let i = 0; i < 25; i++) {
    const p = await Z.zugangPruefen(new Request("https://lippeforst.de/x", { headers: { authorization: "Bearer lfk_0000000000_" + "A".repeat(43), ...kopf } }));
    letzter = p.ok ? 200 : p.status;
  }
  assert.equal(letzter, 429);
});

test("Board lesen: ohne Namen, Adressen und Telefonnummern", async () => {
  await anfrage("LL-TEST0001", {});
  await anfrage("LL-TEST0002", { intent: "Fläche gesucht (Kauf)", name: "Karl Käufer", email: "karl@example.org", phone: "0170 7654321", ort: "Leopoldshöhe", boerse: "LF-1234" });
  const res = await boardRoute.GET(mitSchluessel(lesen));
  assert.equal(res.status, 200);
  const text = await res.text();
  const daten = JSON.parse(text);
  assert.equal(daten.ok, true);
  assert.equal(daten.anfragen.length, 2);
  for (const verboten of ["Musterfrau", "Käufer", "erika@example.org", "karl@example.org", "0171 1234567", "0170 7654321"]) {
    assert.ok(!text.includes(verboten), `${verboten} darf nicht in der Antwort stehen`);
  }
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("Board lesen: ohne Schlüssel 401, Detail braucht board:details", async () => {
  const ohne = await boardRoute.GET(new Request("https://lippeforst.de/api/verwaltung/board"));
  assert.equal(ohne.status, 401);

  const q = (s: string) => new Request("https://lippeforst.de/api/verwaltung/board?anfrage=LL-TEST0001", { headers: { authorization: `Bearer ${s}` } });
  const kurz = JSON.parse(await (await boardRoute.GET(q(lesen))).text());
  assert.equal(kurz.ok, true);
  assert.ok(!("nachricht" in kurz.anfrage));
  const voll = JSON.parse(await (await boardRoute.GET(q(schreiben))).text());
  assert.ok("nachricht" in voll.anfrage);
  const nichtDa = new Request("https://lippeforst.de/api/verwaltung/board?anfrage=LL-NICHTDA", { headers: { authorization: `Bearer ${schreiben}` } });
  assert.equal((await boardRoute.GET(nichtDa)).status, 404);
});

const post = (schluessel: string, body: unknown) => boardRoute.POST(mitSchluessel(schluessel, { method: "POST", body: JSON.stringify(body) }));

test("Eintragen: Notiz und Status stehen mit „API: Name“ im Verlauf", async () => {
  const n = await post(schreiben, { aktion: "notiz", anfrage: "LL-TEST0001", text: "Entwurf angelegt, wartet auf Dennis" });
  assert.equal(n.status, 200);
  const s = await post(schreiben, { aktion: "status", anfrage: "LL-TEST0001", status: "beantwortet" });
  assert.equal(s.status, 200);
  const { zustand } = await store.readZustand();
  assert.equal(zustand.anfragen["LL-TEST0001"].status, "beantwortet");
  assert.equal(zustand.anfragen["LL-TEST0001"].geaendert?.von, "API: Tagesbearbeitung");
  const verlauf = await store.verlaufLesen("LL-TEST0001", zustand.protokoll);
  assert.ok(verlauf.some((e) => e.von === "API: Tagesbearbeitung" && e.was.startsWith("Notiz: Entwurf angelegt")));
  assert.ok(verlauf.some((e) => e.von === "API: Tagesbearbeitung" && e.was === "Status → Beantwortet"));
});

test("Eintragen: fehlende Rechte, unbekannte Anfrage, unerlaubte Aktion", async () => {
  assert.equal((await post(lesen, { aktion: "notiz", anfrage: "LL-TEST0001", text: "x" })).status, 403);
  assert.equal((await post(schreiben, { aktion: "status", anfrage: "LL-TEST0001", status: "erledigt" })).status, 403, "Abschließen ist ein eigenes Recht");
  assert.equal((await post(schreiben, { aktion: "notiz", anfrage: "LL-GIBTSNICHT", text: "x" })).status, 404);
  assert.equal((await post(schreiben, { aktion: "status", anfrage: "LL-TEST0001", status: "gibt-es-nicht" })).status, 400);
  for (const aktion of ["senden", "einladen", "freigeben", "loeschen", "boerse"]) {
    assert.equal((await post(schreiben, { aktion, anfrage: "LL-TEST0001" })).status, 400, `${aktion} gibt es per API nicht`);
  }
  assert.equal((await boardRoute.POST(mitSchluessel(schreiben, { method: "POST", body: "kein json" }))).status, 400);
});

test("Paare: vormerken nur bei passendem Angebot/Gesuch gleicher Art, Freigegebenes bleibt unberührt", async () => {
  await anfrage("LL-TEST0003", { intent: "Verpachten", ort: "Lage" });
  const passt = await post(schreiben, { aktion: "paar", angebot: "LL-TEST0001", gesuch: "LL-TEST0002", status: "vorgemerkt" });
  assert.equal(passt.status, 200);
  const { zustand } = await store.readZustand();
  assert.equal(zustand.paare["LL-TEST0001~LL-TEST0002"].status, "vorgemerkt");

  const andereArt = await post(schreiben, { aktion: "paar", angebot: "LL-TEST0003", gesuch: "LL-TEST0002", status: "vorgemerkt" });
  assert.equal(andereArt.status, 422, "Pacht-Angebot passt nicht zu Kauf-Gesuch");
  const vertauscht = await post(schreiben, { aktion: "paar", angebot: "LL-TEST0002", gesuch: "LL-TEST0001", status: "vorgemerkt" });
  assert.equal(vertauscht.status, 422);

  await store.mutateZustand("test", (z) => {
    z.paare["LL-TEST0001~LL-TEST0002"] = { status: "kontakt" };
  });
  const frei = await post(schreiben, { aktion: "paar", angebot: "LL-TEST0001", gesuch: "LL-TEST0002", status: "verworfen" });
  assert.equal(frei.status, 409, "freigegebener Kontakt ist per API nicht änderbar");
});

test("Abschließen: mit Recht möglich, aber nicht bei Angebot online in der Börse", async () => {
  const z = await Z.zugangAnlegen("admin@example.com", { name: "Abschluss", rechte: ["board:abschliessen", "board:lesen"], tage: 30 });
  assert.equal(z.ok, true);
  if (!z.ok) return;
  await store.mutateZustand("test", (zu) => {
    zu.anfragen["LL-TEST0003"] = { boerse: { code: "LF-0001", typ: "Ackerland", groesseHa: 1, lage: "Lage", text: "", online: true } };
  });
  const online = await post(z.schluessel, { aktion: "status", anfrage: "LL-TEST0003", status: "erledigt" });
  assert.equal(online.status, 409);
  const ok = await post(z.schluessel, { aktion: "status", anfrage: "LL-TEST0002", status: "archiv" });
  assert.equal(ok.status, 200);
});

test("Sperren und Ablauf wirken sofort", async () => {
  const z = await Z.zugangAnlegen("admin@example.com", { name: "Wegwerf", rechte: ["board:lesen"], tage: 1 });
  assert.equal(z.ok, true);
  if (!z.ok) return;
  assert.equal((await Z.zugangPruefen(mitSchluessel(z.schluessel), "board:lesen")).ok, true);
  assert.equal(await Z.zugangSperren("admin@example.com", z.id), true);
  assert.equal(await Z.zugangSperren("admin@example.com", z.id), false, "zweites Sperren ändert nichts");
  assert.equal((await Z.zugangPruefen(mitSchluessel(z.schluessel), "board:lesen")).ok, false);

  const alt = await Z.zugangAnlegen("admin@example.com", { name: "Abgelaufen", rechte: ["board:lesen"], tage: 1 });
  assert.equal(alt.ok, true);
  if (!alt.ok) return;
  await store.jsonAendern<{ zugaenge: Record<string, { laeuftAb: string }> }>("admin/api-zugaenge.json", () => ({ zugaenge: {} }), (d) => {
    d.zugaenge[alt.id].laeuftAb = "2020-01-01T00:00:00.000Z";
  });
  assert.equal((await Z.zugangPruefen(mitSchluessel(alt.schluessel), "board:lesen")).ok, false);
});

test("Anmeldeprobe /ich nennt Name und Rechte, nie den Schlüssel", async () => {
  const res = await ichRoute.GET(new Request("https://lippeforst.de/api/verwaltung/ich", { headers: { authorization: `Bearer ${lesen}` } }));
  const text = await res.text();
  const d = JSON.parse(text);
  assert.equal(d.ok, true);
  assert.equal(d.zugang.name, "Nur lesen");
  assert.deepEqual(d.zugang.rechte, ["board:lesen"]);
  assert.ok(!text.includes(lesen.split("_")[2]));
  assert.equal((await ichRoute.GET(new Request("https://lippeforst.de/api/verwaltung/ich"))).status, 401);
});

test("Höchstens 20 aktive Zugänge", async () => {
  let abgelehnt = false;
  for (let i = 0; i < 25 && !abgelehnt; i++) {
    const r = await Z.zugangAnlegen("admin@example.com", { name: `Masse ${i}`, rechte: ["board:lesen"], tage: 5 });
    if (!r.ok) abgelehnt = /Höchstens/.test(r.fehler);
  }
  assert.equal(abgelehnt, true);
});
