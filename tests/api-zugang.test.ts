import { strict as assert } from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { testUmgebung } from "./hilfe";

const DIR = testUmgebung();

const Z = await import("@/lib/api/zugang");
const B = await import("@/lib/api/board");
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
let abschluss = "";
let schreiben2 = "";

test("Zugang anlegen: Schlüssel nur einmal, im Speicher nur der Hash", async () => {
  const r = await Z.zugangAnlegen("admin@example.com", { name: "Tagesbearbeitung", rechte: ["board:lesen", "board:details", "board:notiz", "board:status", "board:paare", "board:boerse"], tage: 30 });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.match(r.schluessel, /^lfk_[a-f0-9]{10}_[A-Za-z0-9_-]{43}$/);
  schreiben = r.schluessel;
  const geheimnis = r.schluessel.split("_").slice(2).join("_");
  assert.ok(!speicherText().includes(geheimnis), "Geheimnis darf nirgends im Speicher stehen");
  assert.ok(!JSON.stringify(await Z.zugaengeListe()).includes("hash"), "Liste ohne Hash");

  const zweiter = await Z.zugangAnlegen("admin@example.com", { name: "Tagesbearbeitung 2", rechte: ["board:lesen", "board:details", "board:notiz", "board:status", "board:paare", "board:boerse"], tage: 30 });
  assert.equal(zweiter.ok, true);
  if (zweiter.ok) schreiben2 = zweiter.schluessel;

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
  // Auch ein gesperrter Name bleibt vergeben: Der Name steht im Verlauf, ein neuer Zugang soll nicht als dessen Urheber gelten
  const alt1 = await Z.zugangAnlegen("a", { name: "Wechsel", rechte: ["board:lesen"], tage: 30 });
  assert.equal(alt1.ok, true);
  if (alt1.ok) assert.equal(await Z.zugangSperren("a", alt1.id), true);
  assert.equal((await Z.zugangAnlegen("a", { name: "wechsel", rechte: ["board:lesen"], tage: 30 })).ok, false, "gesperrter Name ist nicht frei");
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
  abschluss = z.schluessel;
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
  assert.ok(!text.includes(lesen.split("_").slice(2).join("_")));
  assert.equal((await ichRoute.GET(new Request("https://lippeforst.de/api/verwaltung/ich"))).status, 401);
});

test("Eingabe: Nicht-Texte und Fantasie-Status werden abgewiesen, bevor Rechte oder Zustand berührt werden", async () => {
  schreiben = schreiben2; // der erste Schlüssel hat seine 190 Aufrufe je Stunde fast verbraucht
  const vorher = JSON.stringify((await store.readZustand()).zustand);
  const faelle: unknown[] = [
    { aktion: "status", anfrage: "LL-TEST0001", status: ["erledigt"] },
    { aktion: "status", anfrage: "LL-TEST0001", status: "constructor" },
    { aktion: "status", anfrage: "LL-TEST0001", status: "__proto__" },
    { aktion: "status", anfrage: ["LL-TEST0001"], status: "in_arbeit" },
    { aktion: "notiz", paar: ["LL-TEST0001~LL-TEST0002"], text: "x" },
    { aktion: "notiz", anfrage: ["LL-TEST0001"], text: "x" },
    { aktion: "notiz", anfrage: "LL-TEST0001", text: ["x"] },
    { aktion: "notiz", anfrage: "LL-TEST0001", paar: "LL-TEST0001~LL-TEST0002", text: "beides" },
    { aktion: "notiz", text: "weder noch" },
    { aktion: "paar", angebot: ["LL-TEST0001"], gesuch: "LL-TEST0002", status: "vorgemerkt" },
    { aktion: "paar", angebot: "LL-TEST0001", gesuch: "LL-TEST0002", status: ["vorgemerkt"] },
    { aktion: ["status"], anfrage: "LL-TEST0001", status: "neu" },
    ["status"],
    "status",
    null,
  ];
  for (const f of faelle) {
    // Auch mit allen Rechten: kein Weg an der Prüfung vorbei.
    const res = await boardRoute.POST(mitSchluessel(schreiben, { method: "POST", body: JSON.stringify(f) }));
    assert.equal(res.status, 400, `abgewiesen: ${JSON.stringify(f)}`);
  }
  assert.equal(JSON.stringify((await store.readZustand()).zustand), vorher, "der Zustand bleibt unverändert");
});

test("Notizen und Verlauf: nur mit board:details, Adressen und Nummern geschwärzt", async () => {
  await store.mutateZustand("test", (z) => {
    z.anfragen["LL-TEST0001"] = { ...(z.anfragen["LL-TEST0001"] ?? {}), notiz: "Frau Muster, 0171 1234567, erika@example.org" };
    z.paare["LL-TEST0001~LL-TEST0002"] = { status: "vorgemerkt", notiz: "Rückruf +49 171 7654321" };
  });
  assert.equal((await post(schreiben, { aktion: "notiz", anfrage: "LL-TEST0001", text: "Rückruf unter 0171 7654321 oder karl@example.org" })).status, 200);

  const detail = (s: string) => boardRoute.GET(new Request("https://lippeforst.de/api/verwaltung/board?anfrage=LL-TEST0001", { headers: { authorization: `Bearer ${s}` } }));

  const kurz = await (await detail(lesen)).text();
  assert.ok(!kurz.includes("Muster, "), "ohne board:details keine Notiz");
  assert.ok(!kurz.includes("1234567") && !kurz.includes("7654321") && !kurz.includes("@example.org"));
  assert.ok(!kurz.includes("Rückruf"), "auch keine Notiz am Paar und kein Verlauf");

  const voll = await (await detail(schreiben)).text();
  assert.ok(voll.includes("[E-Mail]") && voll.includes("[Telefon]"));
  assert.ok(!voll.includes("1234567") && !voll.includes("7654321") && !voll.includes("@example.org"));
  assert.ok(voll.includes("2026-"), "Datumsangaben bleiben lesbar");

  const liste = await (await boardRoute.GET(mitSchluessel(schreiben))).text();
  assert.ok(!liste.includes("Rückruf"), "in der Liste stehen nie Paar-Notizen");
});

test("Eigene Notizen eines Zugangs werden nicht anfragespezifisch geschwärzt, fremde gar nicht gezeigt (kein Rate-Orakel über „[entfernt]“)", async () => {
  await anfrage("LL-TEST0009", { name: "Karl Orakel", email: "orakel@example.org", phone: "0171 5550000" });
  assert.equal((await post(schreiben, { aktion: "notiz", anfrage: "LL-TEST0009", text: "Karl Orakel meldet sich, mail orakel@example.org" })).status, 200);
  assert.equal((await post(schreiben, { aktion: "notiz", anfrage: "LL-TEST0009", text: "Berta Beispiel meldet sich, mail beispiel@example.org" })).status, 200);
  await store.mutateZustand("admin@example.com", () => ({ was: "Notiz: Karl Orakel rief an", ref: "LL-TEST0009" }));
  const detail = async (s: string) => (await boardRoute.GET(new Request("https://lippeforst.de/api/verwaltung/board?anfrage=LL-TEST0009", { headers: { authorization: `Bearer ${s}` } }))).text();

  const eigen = await detail(schreiben);
  assert.ok(eigen.includes("Karl Orakel meldet sich") && eigen.includes("Berta Beispiel meldet sich"), "geratener Name und echter Name sehen für den Schreiber gleich aus");
  assert.ok(!eigen.includes("@example.org"), "Adressen bleiben allgemein geschwärzt");
  assert.ok(!eigen.includes("Karl Orakel rief an") && eigen.includes("[entfernt] rief an"), "Text der Verwaltung bleibt anfragespezifisch geschwärzt");

  // Ein anderer Zugang sieht den Text des ersten voll geschwärzt: kein Namen-Weiterreichen
  const anderer = await Z.zugangAnlegen("admin@example.com", { name: "Fremd lesen", rechte: ["board:lesen", "board:details"], tage: 30 });
  assert.equal(anderer.ok, true);
  if (!anderer.ok) return;
  const fremd = await detail(anderer.schluessel);
  assert.ok(!fremd.includes("Karl Orakel meldet sich") && !fremd.includes("Berta Beispiel") && !fremd.includes("[entfernt] meldet sich"), "Notizen anderer Zugänge erscheinen weder offen noch geschwärzt");
  assert.ok(fremd.includes("Notiz eines anderen API-Zugangs"));
  assert.ok(fremd.includes("[entfernt] rief an"), "Text der Verwaltung bleibt voll geschwärzt");
});

test("Börsen-Angebote: offline nehmen und öffentliche Angaben anpassen — mit Leck-Prüfung und eigenen Rechten", async () => {
  await anfrage("LL-TEST0006", { intent: "Verpachten", name: "Maxine Börsenfrau", ort: "Lage", email: "boerse@example.org" });
  await store.mutateZustand("test", (z) => {
    z.anfragen["LL-TEST0006"] = {
      boerse: { code: "LF-7777", typ: "Ackerland", groesseHa: 2, lage: "Lage", text: "Ruhige Fläche am Ortsrand", einwilligung: { am: "2026-10-01", quelle: "telefonisch", von: "test" }, online: true },
    };
  });
  const aendern = (key: string, feld: Record<string, unknown>) => post(key, { aktion: "boerse", anfrage: "LL-TEST0006", was: "aendern", ...feld });
  const boerseMeta = async () => (await store.readZustand()).zustand.anfragen["LL-TEST0006"].boerse!;

  // Rechte: lesen allein genügt nicht; Abschließen genügt nur fürs Offline-Nehmen
  assert.equal((await aendern(lesen, { text: "x" })).status, 403);
  assert.equal((await post(lesen, { aktion: "boerse", anfrage: "LL-TEST0006", was: "offline" })).status, 403);
  assert.equal((await aendern(abschluss, { text: "x" })).status, 403);

  // Eingabeprüfung vor allem anderen
  assert.equal((await aendern(schreiben, {})).status, 400, "nichts angegeben");
  assert.equal((await aendern(schreiben, { text: ["x"] })).status, 400);
  assert.equal((await aendern(schreiben, { typ: "Mondlandschaft" })).status, 400);
  assert.equal((await aendern(schreiben, { groesseHa: -3 })).status, 400);
  assert.equal((await aendern(schreiben, { text: "siehe https://beispiel.example" })).status, 400);
  assert.equal((await aendern(schreiben, { details: { gibtsnicht: "x" } })).status, 400);
  assert.equal((await post(lesen, { aktion: "boerse", anfrage: "LL-TEST0006", was: "veroeffentlichen" })).status, 403, "Veröffentlichen braucht board:boerse");
  assert.equal((await post(schreiben, { aktion: "boerse", anfrage: "LL-TEST0006", was: "gibtsnicht" })).status, 400);

  // Online ändern: gültig, dann verräterisch (422, Angebot bleibt unverändert). Die Gründe nennen Name, Flur und Nummer nie einzeln.
  assert.equal((await aendern(schreiben, { text: "Ruhige Wiese am Ortsrand", groesseHa: 2.5, details: { frei: "ab sofort" } })).status, 200);
  const b = await boerseMeta();
  assert.deepEqual([b.text, b.groesseHa, b.details?.frei, b.online], ["Ruhige Wiese am Ortsrand", 2.5, "ab sofort", true]);
  const mitName = await aendern(schreiben, { text: "Fläche von Börsenfrau" });
  const mitFlur = await aendern(schreiben, { lage: "Lage, Flur 5 Flurstück 12" });
  assert.equal(mitName.status, 422);
  assert.equal(mitFlur.status, 422);
  const nameText = await mitName.text();
  assert.equal(nameText, await mitFlur.text(), "gleiche Antwort für Name und Flur");
  assert.ok(nameText.includes("erkennen lassen") && !nameText.includes("Namen des Eigentümers"));
  assert.equal((await boerseMeta()).text, "Ruhige Wiese am Ortsrand");

  // Offline nehmen: mit Börsen-Recht und mit Abschließen-Recht; bleibt offline (wie in der Verwaltung); zweiter Aufruf ist wirkungslos
  assert.equal((await post(abschluss, { aktion: "boerse", anfrage: "LL-TEST0006", was: "offline" })).status, 200);
  assert.equal((await boerseMeta()).online, false);
  assert.match((await boerseMeta()).offline?.grund ?? "", /per API offline genommen/);
  assert.equal((await post(schreiben, { aktion: "boerse", anfrage: "LL-TEST0006", was: "offline" })).status, 200);
  assert.equal((await aendern(schreiben, { text: "Offline geändert" })).status, 200, "offline darf man Angaben anpassen");
  assert.equal((await boerseMeta()).online, false, "Ändern veröffentlicht nie");
  const wieder = await post(schreiben, { aktion: "boerse", anfrage: "LL-TEST0006", was: "veroeffentlichen" });
  assert.equal(wieder.status, 409, "was die API offline nahm, öffnet nur die Verwaltung wieder");
  assert.match(await wieder.text(), /offline genommen/);
  assert.equal((await boerseMeta()).online, false);
  assert.equal((await post(schreiben, { aktion: "boerse", anfrage: "LL-GIBTSNICHT", was: "offline" })).status, 404);
  assert.equal((await post(schreiben, { aktion: "boerse", anfrage: "LL-TEST0001", was: "offline" })).status, 409, "ohne Börsen-Angebot");

  // Anonym online stellen: nur mit Einwilligung des Eigentümers und ohne Verräterisches
  const einwilligung = { am: "2026-10-01", quelle: "per E-Mail", von: "test" };
  await anfrage("LL-TEST0010", { intent: "Verpachten", name: "Hanna Wiesel", ort: "Lage", email: "wiesel@example.org" });
  await anfrage("LL-TEST0011", { intent: "Verpachten", name: "Ingo Weide", ort: "Lage", email: "weide@example.org" });
  await anfrage("LL-TEST0012", { intent: "Verpachten", name: "Jutta Koppel", ort: "Lage", email: "koppel@example.org" });
  await store.mutateZustand("test", (z) => {
    z.anfragen["LL-TEST0010"] = { boerse: { code: "LF-8001", typ: "Ackerland", groesseHa: 2, lage: "Lage", text: "Ruhige Fläche am Ortsrand", einwilligung, online: false } };
    z.anfragen["LL-TEST0011"] = { boerse: { code: "LF-8002", typ: "Ackerland", groesseHa: 2, lage: "Lage", text: "Ruhige Fläche am Ortsrand", online: false } };
    z.anfragen["LL-TEST0012"] = { boerse: { code: "LF-8003", typ: "Ackerland", groesseHa: 2, lage: "Lage", text: "Fläche von Koppel", einwilligung, online: false } };
  });
  const online = (id: string) => post(schreiben, { aktion: "boerse", anfrage: id, was: "veroeffentlichen" });
  const meta = async (id: string) => (await store.readZustand()).zustand.anfragen[id].boerse!;

  assert.equal((await online("LL-TEST0011")).status, 409, "ohne Einwilligung des Eigentümers");
  assert.equal((await meta("LL-TEST0011")).online, false);
  const verraeterisch = await online("LL-TEST0012");
  assert.equal(verraeterisch.status, 422, "Name im Text");
  assert.ok(!(await verraeterisch.text()).includes("Namen des Eigentümers"));
  assert.equal((await meta("LL-TEST0012")).online, false);
  assert.equal((await online("LL-GIBTSNICHT")).status, 404);

  assert.equal((await online("LL-TEST0010")).status, 200);
  assert.equal((await meta("LL-TEST0010")).online, true);
  const verlauf10 = await store.verlaufLesen("LL-TEST0010", (await store.readZustand()).zustand.protokoll);
  assert.ok(verlauf10.some((e) => e.von.startsWith("API: ") && e.was.includes("per API nach Einwilligung")));
  assert.equal((await online("LL-TEST0010")).status, 200, "zweiter Aufruf: schon online");

  const tag = new Date().toISOString().slice(0, 10);
  const prot = (await store.jsonLesen<{ eintraege: { aktion: string; ref: string }[] }>(`admin/api-protokoll/${tag}.json`))?.daten.eintraege ?? [];
  assert.ok(prot.filter((e) => e.aktion === "boerse" && e.ref === "LL-TEST0006").length >= 3);
});

test("Wieder öffnen: abgeschlossene Anfragen öffnet nur die Verwaltung (sonst käme ein Angebot unbemerkt zurück in die Börse)", async () => {
  // LL-TEST0002 ist durch den Abschluss-Test archiviert
  const res = await post(schreiben, { aktion: "status", anfrage: "LL-TEST0002", status: "neu" });
  assert.equal(res.status, 409);
  assert.equal((await store.readZustand()).zustand.anfragen["LL-TEST0002"].status, "archiv");
});

test("Schwärzen: Punkt als Trenner wird erkannt, Datum bleibt, Ort und Flurstück werden mitgeschwärzt", async () => {
  assert.equal(B.schwaerzen("Tel 0171.1234567 am 01.11.2026, Mail a@b.de"), "Tel [Telefon] am 01.11.2026, Mail [E-Mail]");
  await anfrage("LL-TEST0004", { ort: "Lügde, erika@example.org", flurstueck: "Flur 5, Tel 0171 1234567" });
  const text = await (await boardRoute.GET(mitSchluessel(lesen))).text();
  assert.ok(text.includes("LL-TEST0004"));
  assert.ok(!text.includes("erika@example.org") && !text.includes("1234567"));
});

test("Detailansicht: Name, Adresse und Nummer dieser Anfrage fehlen auch im Freitext", async () => {
  await anfrage("LL-TEST0005", { name: "Max Mustermann", email: "max@example.org", phone: "0170 5550000", message: "Ich bin Max Mustermann, erreichbar unter 0170 5550000. Herr Mustermann ruft zurück." });
  await store.mutateZustand("test", (z) => {
    z.anfragen["LL-TEST0005"] = { notiz: "Mustermann will Preis 20.000 € wissen" };
  });
  const detail = await (await boardRoute.GET(new Request("https://lippeforst.de/api/verwaltung/board?anfrage=LL-TEST0005", { headers: { authorization: `Bearer ${schreiben}` } }))).text();
  for (const verboten of ["Mustermann", "Max", "0170", "max@example.org"]) assert.ok(!detail.includes(verboten), `${verboten} darf nicht in der Detailansicht stehen`);
  assert.ok(detail.includes("20.000"), "Beträge bleiben lesbar");
});

test("Notizen: höchstens 10 je Anfrage am Tag, und jede API-Änderung steht im eigenen, ungekürzten Protokoll", async () => {
  let letzter = 0;
  for (let i = 0; i < 12; i++) letzter = (await post(schreiben, { aktion: "notiz", anfrage: "LL-TEST0003", text: `Notiz ${i}` })).status;
  assert.equal(letzter, 429);
  const tag = new Date().toISOString().slice(0, 10);
  const prot = (await store.jsonLesen<{ eintraege: { aktion: string; ref: string; von: string }[] }>(`admin/api-protokoll/${tag}.json`))?.daten.eintraege ?? [];
  assert.equal(prot.filter((e) => e.aktion === "notiz" && e.ref === "LL-TEST0003").length, 10);
  assert.ok(prot.some((e) => e.aktion === "status" && e.von === "API: Tagesbearbeitung"));
  assert.ok(prot.some((e) => e.aktion === "paar"));
});

test("Zu große POST-Bodies werden abgewiesen, auch ohne Content-Length", async () => {
  const gross = JSON.stringify({ aktion: "notiz", anfrage: "LL-TEST0001", text: "x".repeat(30_000) });
  const res = await boardRoute.POST(new Request("https://lippeforst.de/api/verwaltung/board", { method: "POST", headers: { authorization: `Bearer ${schreiben}` }, body: new Blob([gross]).stream(), duplex: "half" } as RequestInit));
  assert.equal(res.status, 413);
});

test("Sitzung frisch prüfen: nach „Alle Sitzungen beenden“ nicht mehr gültig", async () => {
  const { createSessionToken } = await import("@/lib/admin/token");
  const { sitzungNochGueltigFrisch } = await import("@/lib/admin/session");
  const { alleSitzungenBeenden } = await import("@/lib/admin/sitzungen");
  const { SESSION_COOKIE } = await import("@/lib/admin/config");
  const g = globalThis as unknown as { __testAnfrage: { cookies: Map<string, string>; headers: Map<string, string> } };
  g.__testAnfrage = { cookies: new Map([[SESSION_COOKIE, createSessionToken("admin@example.com").token]]), headers: new Map() };
  assert.equal(await sitzungNochGueltigFrisch(), true);
  await new Promise((r) => setTimeout(r, 1100));
  await alleSitzungenBeenden("admin@example.com");
  assert.equal(await sitzungNochGueltigFrisch(), false);
  g.__testAnfrage.cookies.clear();
  assert.equal(await sitzungNochGueltigFrisch(), false, "ohne Cookie sowieso nicht");
});

test("Notschalter: „Alle Sitzungen beenden“ sperrt auch alle API-Zugänge", async () => {
  assert.equal((await Z.zugangPruefen(mitSchluessel(lesen), "board:lesen")).ok, true, "vorher gültig");
  const n = await Z.alleZugaengeSperren("admin@example.com");
  assert.ok(n >= 2, "alle noch gültigen Zugänge");
  for (const s of [lesen, schreiben]) assert.equal((await Z.zugangPruefen(mitSchluessel(s), "board:lesen")).ok, false);
  assert.equal(await Z.alleZugaengeSperren("admin@example.com"), 0, "zweiter Aufruf: nichts mehr zu sperren");
  assert.ok((await Z.zugaengeListe()).every((x) => !x.aktiv));
  const neu = await Z.zugangAnlegen("admin@example.com", { name: "Nach dem Notschalter", rechte: ["board:lesen"], tage: 5 });
  assert.equal(neu.ok, true, "ein neuer Zugang ist danach wieder möglich");
});

test("Höchstens 20 aktive Zugänge", async () => {
  let abgelehnt = false;
  for (let i = 0; i < 25 && !abgelehnt; i++) {
    const r = await Z.zugangAnlegen("admin@example.com", { name: `Masse ${i}`, rechte: ["board:lesen"], tage: 5 });
    if (!r.ok) abgelehnt = /Höchstens/.test(r.fehler);
  }
  assert.equal(abgelehnt, true);
});
