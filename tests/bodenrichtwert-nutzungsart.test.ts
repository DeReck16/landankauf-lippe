import { strict as assert } from "node:assert";
import { test } from "node:test";
import { testUmgebung } from "./hilfe";
import type { KatasterDaten, LeadMeta, LeadRecord, LeadView } from "@/lib/admin/model";

testUmgebung();

const K = await import("@/lib/portal/kataster");
const W = await import("@/lib/portal/wert");
const S = await import("@/lib/admin/store");
const { leadView } = await import("@/lib/admin/model");
const { antwortEntwurf } = await import("@/lib/portal/antwort");

// Befund 01.10.2026: BORIS NRW liefert in der Landwirtschaftsschicht je Punkt überlappende Zonen für Acker („A“) und
// Grünland („GR“) — in jedem Gebiet in anderer Reihenfolge. Bis dahin nahm bodenrichtwert() immer die erste:
// in Gemarkung Horn Grünland (2,3 €/m²) statt Acker (4 €/m²), also ~42 % zu wenig im Antwortentwurf.

const GA_LIPPE = "Der Gutachterausschuss für Grundstückswerte im Kreis Lippe und in der Stadt Detmold";

/** Eine Zone, wie sie die GetFeatureInfo-Antwort liefert (gekürzt auf die Felder, die der Code liest). */
const zone = (nuta: string, brw: string, nr: string, extra: Record<string, string> = {}) => ({
  type: "Feature",
  geometry: null,
  properties: { NUTA: nuta, BRW: brw, BRWZNR: nr, STAG: "2026-01-01", ENTW: "LF", GABE: GA_LIPPE, GEMA: "Horn", GENA: "Horn-Bad Meinberg", ...extra },
  layerName: "brw_landwirtschaft",
});
const sammlung = (...features: unknown[]) => ({ type: "FeatureCollection", features });

// Echte Antwort vom 01.10.2026 für lon 8.96238, lat 51.86143 (Horn-Bad Meinberg, Acker-Feldblock): Grünland zuerst, dann Acker.
const HORN = sammlung(zone("GR", "2,3", "8302", { GRZA: "50" }), zone("A", "4", "8301", { ACZA: "55" }));
// Gemarkung Belle/Veldrom: Acker zuerst.
const BELLE = sammlung(zone("A", "2,5", "7801", { GEMA: "Belle" }), zone("GR", "1,7", "7802", { GEMA: "Belle" }));

test("Horn (Reihenfolge Grünland, Acker): Acker liefert 4,0 €/m², Grünland 2,3 €/m²", () => {
  const acker = K.brwAusAntwort(HORN, "landwirtschaft", "A");
  assert.equal(acker?.wert, 4);
  assert.equal(acker?.nuta, "A");
  assert.equal(acker?.gewuenscht, "A");
  assert.equal(acker?.zone, "8301");
  assert.equal(acker?.stichtag, "2026-01-01");
  assert.equal(acker?.gutachterausschuss, GA_LIPPE);
  assert.equal(acker?.gemarkungen, "Horn");

  const gruen = K.brwAusAntwort(HORN, "landwirtschaft", "GR");
  assert.equal(gruen?.wert, 2.3);
  assert.equal(gruen?.nuta, "GR");
  assert.equal(gruen?.gewuenscht, "GR");
  assert.equal(gruen?.zone, "8302");
});

test("Die Reihenfolge der Zonen spielt keine Rolle (Belle: Acker zuerst, Grünland bekommt Grünland)", () => {
  assert.equal(K.brwAusAntwort(BELLE, "landwirtschaft", "A")?.wert, 2.5);
  assert.equal(K.brwAusAntwort(BELLE, "landwirtschaft", "GR")?.wert, 1.7);
  const umgekehrt = sammlung(...(HORN.features as unknown[]).slice().reverse());
  assert.equal(K.brwAusAntwort(umgekehrt, "landwirtschaft", "A")?.wert, 4);
  assert.equal(K.brwAusAntwort(umgekehrt, "landwirtschaft", "GR")?.wert, 2.3);
});

test("Keine passende Zone: die erste wird genommen, aber kenntlich gemacht (nuta ≠ gewuenscht, Warnung)", () => {
  const nurAcker = sammlung(zone("A", "8", "20009"));
  const gruen = K.brwAusAntwort(nurAcker, "landwirtschaft", "GR");
  assert.equal(gruen?.wert, 8);
  assert.equal(gruen?.nuta, "A");
  assert.equal(gruen?.gewuenscht, "GR");
  assert.match(W.brwWarnung(gruen!) ?? "", /Keine Grünland-Zone am Flurstück gefunden — der Wert gilt für Acker/);

  const nurGruen = sammlung(zone("GR", "1,9", "1"), zone("X", "7", "2"));
  const acker = K.brwAusAntwort(nurGruen, "landwirtschaft", "A");
  assert.equal(acker?.nuta, "GR", "erste Zone");
  assert.match(W.brwWarnung(acker!) ?? "", /Keine Acker-Zone am Flurstück gefunden — der Wert gilt für Grünland/);
});

test("Flächenart unklar (kein Wunsch): Acker bevorzugt, ohne Acker die erste Zone — mit Warnung", () => {
  const ohneWunsch = K.brwAusAntwort(HORN, "landwirtschaft", null);
  assert.equal(ohneWunsch?.wert, 4, "unabhängig von der Reihenfolge der Antwort");
  assert.equal(ohneWunsch?.nuta, "A");
  assert.equal(ohneWunsch?.gewuenscht, undefined);
  assert.match(W.brwWarnung(ohneWunsch!) ?? "", /Flächenart nicht eindeutig — Zone für Acker genommen/);
  assert.equal(K.brwAusAntwort(sammlung(zone("GR", "2,3", "8302")), "landwirtschaft", null)?.nuta, "GR");
});

test("Sammelzone „L“ (Landwirtschaft ohne Unterscheidung, z. B. Kreis Heinsberg) passt zu Acker und Grünland — ohne Warnung", () => {
  const heinsberg = sammlung(zone("L", "8,7", "12056", { ACZA: "71", GEMA: "Würm" }));
  for (const wunsch of ["A", "GR"] as const) {
    const b = K.brwAusAntwort(heinsberg, "landwirtschaft", wunsch);
    assert.equal(b?.wert, 8.7);
    assert.equal(b?.nuta, "L");
    assert.equal(W.brwWarnung(b!), null);
    assert.match(W.wertAusBrw(kataster(b!))?.satz ?? "", /Bodenrichtwert für landwirtschaftliche Flächen in Ihrer Lage liegt bei 8,70 €/);
  }
});

test("Zonen ohne gültigen Wert werden übersprungen; ohne Treffer gibt es keinen Bodenrichtwert", () => {
  const leer = zone("A", " ", "1");
  assert.equal(K.brwAusAntwort(sammlung(leer, zone("GR", "2,3", "8302")), "landwirtschaft", "A")?.nuta, "GR");
  assert.equal(K.brwAusAntwort(sammlung(), "landwirtschaft", "A"), null);
  assert.equal(K.brwAusAntwort(sammlung(leer), "landwirtschaft", "A"), null);
  assert.equal(K.brwAusAntwort({ features: "kaputt" }, "landwirtschaft", "A"), null);
  assert.equal(K.brwAusAntwort(null, "landwirtschaft", "A"), null);
});

test("Forst und Wohnbau: erste Zone wie bisher, ohne Nutzungsart-Wunsch", () => {
  const forst = sammlung(zone("F", "0,52", "9001", { ENTW: "F" }));
  const b = K.brwAusAntwort(forst, "forstwirtschaft", null);
  assert.equal(b?.wert, 0.52);
  assert.equal(b?.art, "forstwirtschaft");
  assert.equal(b?.gewuenscht, undefined);
  assert.equal(W.brwWarnung(b!), null);
});

test("Welche Nutzungsart gesucht ist: Flächentyp der Anfrage, sonst ausdrücklich genannte amtliche Nutzung", () => {
  assert.equal(K.brwNutzungFuer("Ackerland", "Landwirtschaft"), "A");
  assert.equal(K.brwNutzungFuer("Wiese / Grünland", "Landwirtschaft"), "GR");
  assert.equal(K.brwNutzungFuer("Wiese / Grünland", "Wald"), "GR", "der Flächentyp der Anfrage geht vor");
  assert.equal(K.brwNutzungFuer("Sonstiges", "Landwirtschaft"), null, "ALKIS sagt nur „Landwirtschaft“ — nicht eindeutig");
  assert.equal(K.brwNutzungFuer("Sonstiges", "Ackerland"), "A");
  assert.equal(K.brwNutzungFuer("Sonstiges", "Grünland"), "GR");
  assert.equal(K.brwNutzungFuer("Wald / Forst", "Wald"), null);
  assert.equal(K.brwNutzungFuer("Bauland", "Wohnbaufläche"), null);
  assert.equal(K.brwNutzungFuer("Sonstiges", "Wald"), null, "Waldschicht, kein Acker/Grünland");
});

// ---------------------------------------------------------------------------
// Abfrage (BORIS mit Attrappe)

type FetchEingabe = Parameters<typeof fetch>[0];

/** Führt f mit einem ersetzten fetch aus und liefert die abgefragten Adressen mit. */
async function mitFetch<T>(antwort: (url: URL) => Response | Promise<Response>, f: () => Promise<T>): Promise<{ ergebnis: T; urls: URL[] }> {
  const original = globalThis.fetch;
  const urls: URL[] = [];
  globalThis.fetch = (async (eingabe: FetchEingabe) => {
    const url = new URL(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe.url);
    urls.push(url);
    return antwort(url);
  }) as typeof fetch;
  try {
    return { ergebnis: await f(), urls };
  } finally {
    globalThis.fetch = original;
  }
}

test("bodenrichtwert(): fragt bis zu 10 Zonen ab und wählt die zur Nutzungsart passende", async () => {
  const { ergebnis, urls } = await mitFetch(
    () => Response.json(HORN),
    async () => ({
      acker: await K.bodenrichtwert([8.96238, 51.86143], "landwirtschaft", "A"),
      gruen: await K.bodenrichtwert([8.96238, 51.86143], "landwirtschaft", "GR"),
    }),
  );
  assert.ok(ergebnis.acker && ergebnis.acker !== "fehler");
  assert.ok(ergebnis.gruen && ergebnis.gruen !== "fehler");
  assert.equal(ergebnis.acker.wert, 4);
  assert.equal(ergebnis.gruen.wert, 2.3);
  assert.equal(urls.length, 2);
  for (const u of urls) {
    assert.equal(u.hostname, "www.wms.nrw.de");
    assert.equal(u.searchParams.get("LAYERS"), "8", "Schicht brw_landwirtschaft");
    assert.ok(Number(u.searchParams.get("FEATURE_COUNT")) >= 10, "FEATURE_COUNT mindestens 10");
  }
});

test("bodenrichtwert(): Dienststörung → „fehler“, keine Zone → null", async () => {
  const stumm = console.error;
  console.error = () => undefined;
  try {
    const { ergebnis } = await mitFetch(
      (u) => (u.searchParams.get("CRS") ? new Response("Bad Gateway", { status: 502 }) : Response.json({})),
      async () => K.bodenrichtwert([8.9, 51.8], "landwirtschaft", "A"),
    );
    assert.equal(ergebnis, "fehler");
    const geworfen = await mitFetch(
      () => Promise.reject(new Error("offline")),
      async () => K.bodenrichtwert([8.9, 51.8], "landwirtschaft", "A"),
    );
    assert.equal(geworfen.ergebnis, "fehler");
    const keine = await mitFetch(
      () => Response.json(sammlung()),
      async () => K.bodenrichtwert([8.9, 51.8], "landwirtschaft", "A"),
    );
    assert.equal(keine.ergebnis, null);
  } finally {
    console.error = stumm;
  }
});

// ---------------------------------------------------------------------------
// Anzeige: Nutzungsart nennen

const FLURSTUECK: NonNullable<KatasterDaten["flurstueck"]> = {
  gemarkung: "Leopoldstal",
  gemeinde: "Horn-Bad Meinberg",
  kreis: "Lippe",
  flur: "4",
  nummer: "15",
  flaecheM2: 9538,
  nutzung: "Landwirtschaft",
  lage: "Mühlenweg",
  punkt: [8.96238, 51.86143],
};

function kataster(brw: KatasterDaten["brw"], extra: Partial<KatasterDaten> = {}): KatasterDaten {
  return { am: new Date().toISOString(), schluessel: "Horn-Bad Meinberg|Flur 4, Flurstück 15", flurstueck: FLURSTUECK, brw, ...extra };
}

const acker = K.brwAusAntwort(HORN, "landwirtschaft", "A")!;
const gruen = K.brwAusAntwort(HORN, "landwirtschaft", "GR")!;
/** So stand der Wert bis 01.10.2026 im Zustand: erste Zone (Grünland), ohne Nutzungsart. */
const ALT: NonNullable<KatasterDaten["brw"]> = { wert: 2.3, stichtag: "2026-01-01", art: "landwirtschaft", zone: "8302", gutachterausschuss: GA_LIPPE, gemarkungen: "Horn" };

test("Verwaltung sieht die Nutzungsart der Zone („Acker“ / „Grünland“ statt „Landwirtschaft“)", () => {
  assert.equal(W.brwZeile(acker), "Bodenrichtwert 4,00 €/m² (Acker, Stichtag 01.01.2026, Zone 8301)");
  assert.equal(W.brwZeile(gruen), "Bodenrichtwert 2,30 €/m² (Grünland, Stichtag 01.01.2026, Zone 8302)");
  assert.equal(W.brwNutzungKurz(ALT), "Landwirtschaft");
  assert.equal(W.brwWarnung(acker), null);
  assert.equal(W.brwWarnung(gruen), null);
  assert.match(W.brwWarnung(ALT) ?? "", /Ältere Abfrage — Acker und Grünland waren nicht unterschieden/);
});

test("wertAusBrw: Text an den Kunden nennt Ackerland bzw. Grünland und den richtigen Wert", () => {
  const a = W.wertAusBrw(kataster(acker));
  assert.match(a?.satz ?? "", /Der amtliche Bodenrichtwert für Ackerland in Ihrer Lage liegt bei 4,00 € je m² \(Stichtag 01\.01\.2026, Gutachterausschuss/);
  assert.match(a?.satz ?? "", /rund 38\.000 €/, "4,00 € × 9.538 m²");
  assert.doesNotMatch(a?.satz ?? "", /landwirtschaftliche Flächen/);
  assert.ok(a?.kurz.startsWith("Bodenrichtwert 4,00 €/m² (Acker, 01.01.2026)"), a?.kurz);

  const g = W.wertAusBrw(kataster(gruen));
  assert.match(g?.satz ?? "", /Bodenrichtwert für Grünland in Ihrer Lage liegt bei 2,30 € je m²/);
  assert.match(g?.satz ?? "", /rund 22\.000 €/, "2,30 € × 9.538 m²");
  assert.ok(g?.kurz.startsWith("Bodenrichtwert 2,30 €/m² (Grünland, 01.01.2026)"), g?.kurz);

  // Eintrag ohne Nutzungsart: wie bisher „landwirtschaftliche Flächen“ (wird neu abgefragt)
  assert.match(W.wertAusBrw(kataster(ALT))?.satz ?? "", /Bodenrichtwert für landwirtschaftliche Flächen in Ihrer Lage liegt bei 2,30 €/);
});

// ---------------------------------------------------------------------------
// Antwortentwurf

const BASIS = "https://lippeforst.de";
const record = (o: Partial<LeadRecord> = {}): LeadRecord => ({
  id: "LL-TESTBRW1",
  receivedAt: "2026-09-26T08:00:00.000Z",
  intent: "Bewertung",
  flaechentyp: "Ackerland",
  groesse: "0,95 ha",
  ort: "Horn-Bad Meinberg",
  flurstueck: "Flur 4, Flurstück 15",
  message: "Was ist mein Acker wert?",
  name: "Erika Muster",
  phone: "—",
  email: "erika@example.com",
  source: "bewertung",
  consent: "on",
  gclid: "—",
  boerse: "—",
  ...o,
});
const ansicht = (o: Partial<LeadRecord>, meta: LeadMeta = {}): LeadView => leadView(record(o), meta);

test("Antwortentwurf: Acker in Gemarkung Horn bekommt 4,00 €/m² (Ackerland), nicht 2,30 € aus der Grünland-Zone", () => {
  const a = antwortEntwurf({ lead: ansicht({}, { kataster: kataster(acker) }), kunde: null, basis: BASIS });
  assert.ok(a);
  assert.match(a.text, /Der amtliche Bodenrichtwert für Ackerland in Ihrer Lage liegt bei 4,00 € je m²/);
  assert.doesNotMatch(a.text, /2,30/);
  assert.ok(a.wert?.startsWith("Bodenrichtwert 4,00 €/m² (Acker, 01.01.2026)"), a.wert ?? "");
  assert.ok(!a.hinweise.some((h) => /Bodenrichtwert/.test(h)), "Zone passt — kein Hinweis nötig");
});

test("Antwortentwurf: Grünland bekommt die Grünland-Zone", () => {
  const a = antwortEntwurf({ lead: ansicht({ flaechentyp: "Wiese / Grünland", message: "Wiese verkaufen" }, { kataster: kataster(gruen) }), kunde: null, basis: BASIS });
  assert.ok(a);
  assert.match(a.text, /Bodenrichtwert für Grünland in Ihrer Lage liegt bei 2,30 € je m²/);
  assert.ok(!a.hinweise.some((h) => /Bodenrichtwert/.test(h)));
});

test("Antwortentwurf: fehlt die passende Zone, steht die Nutzungsart der gewählten im Text und die Verwaltung bekommt einen Hinweis", () => {
  const nurGruen = K.brwAusAntwort(sammlung(zone("GR", "2,3", "8302")), "landwirtschaft", "A")!;
  const a = antwortEntwurf({ lead: ansicht({}, { kataster: kataster(nurGruen) }), kunde: null, basis: BASIS });
  assert.ok(a);
  assert.match(a.text, /Bodenrichtwert für Grünland in Ihrer Lage/);
  assert.ok(a.hinweise.some((h) => /Bodenrichtwert: Keine Acker-Zone am Flurstück gefunden — der Wert gilt für Grünland/.test(h)), a.hinweise.join(" | "));
});

test("Antwortentwurf: Altbestand ohne Nutzungsart wird als solcher gemeldet", () => {
  const a = antwortEntwurf({ lead: ansicht({}, { kataster: kataster(ALT) }), kunde: null, basis: BASIS });
  assert.ok(a);
  assert.match(a.text, /Bodenrichtwert für landwirtschaftliche Flächen/);
  assert.ok(a.hinweise.some((h) => /Bodenrichtwert: Ältere Abfrage/.test(h)));
});

test("Antwortentwurf: kein Bodenrichtwert-Hinweis, wenn der Entwurf den Wert gar nicht nennt (Thema Solar)", () => {
  const a = antwortEntwurf({ lead: ansicht({ intent: "Energiepacht (Solar/Wind)", message: "Solarpark?" }, { kataster: kataster(ALT) }), kunde: null, basis: BASIS });
  assert.ok(a);
  assert.ok(!a.hinweise.some((h) => /Bodenrichtwert/.test(h)));
});

// ---------------------------------------------------------------------------
// Fälligkeit: Altbestand wird neu abgefragt

const JETZT = Date.parse("2026-10-01T08:00:00.000Z");
/** Wie der Zustand: Eintrag mit Schlüssel der Anfrage und frischem Datum — nur die Nutzungsart-Regel kann ihn fällig machen. */
function mitEintrag(o: Partial<LeadRecord>, brw: KatasterDaten["brw"], extra: Partial<KatasterDaten> = {}): LeadView {
  const ohne = ansicht(o);
  return ansicht(o, { kataster: kataster(brw, { am: "2026-09-30T08:00:00.000Z", schluessel: K.katasterSchluessel(ohne), ...extra }) });
}

test("katasterFaellig: Bodenrichtwert der Landwirtschaftsschicht ohne Nutzungsart (Altbestand) wird neu abgefragt", () => {
  assert.equal(K.katasterFaellig(mitEintrag({}, ALT), JETZT), true);
  assert.equal(K.brwNeuAbfragen(mitEintrag({}, ALT)), true);
});

test("katasterFaellig: nach der Neuabfrage nicht mehr fällig (auch ohne NUTA im Dienst — keine Schleife)", () => {
  assert.equal(K.katasterFaellig(mitEintrag({}, acker), JETZT), false);
  assert.equal(K.katasterFaellig(mitEintrag({ flaechentyp: "Wiese / Grünland" }, gruen), JETZT), false);
  const ohneNuta = K.brwAusAntwort(sammlung(zone("", "4", "1")), "landwirtschaft", "A")!;
  assert.equal(ohneNuta.nuta, "");
  assert.equal(K.katasterFaellig(mitEintrag({}, ohneNuta), JETZT), false);
  const unklar = K.brwAusAntwort(HORN, "landwirtschaft", null)!;
  assert.equal(K.katasterFaellig(mitEintrag({ flaechentyp: "Sonstiges" }, unklar), JETZT), false);
});

test("katasterFaellig: ändert sich die gesuchte Nutzungsart (Flächentyp korrigiert), wird neu abgefragt", () => {
  assert.equal(K.katasterFaellig(mitEintrag({ flaechentyp: "Wiese / Grünland" }, acker), JETZT), true);
  assert.equal(K.katasterFaellig(mitEintrag({ flaechentyp: "Ackerland" }, gruen), JETZT), true);
  assert.equal(K.katasterFaellig(ansicht({ flaechentyp: "Wiese / Grünland" }, { flaechentyp: "Ackerland", kataster: kataster(acker, { am: "2026-09-30T08:00:00.000Z", schluessel: K.katasterSchluessel(ansicht({})) }) }), JETZT), false, "Übersteuerung der Verwaltung zählt");
});

test("katasterFaellig: Altbestand anderer Schichten, ohne Wert und ohne Flurstück bleibt unberührt", () => {
  const forst = { ...ALT, art: "forstwirtschaft" as const };
  assert.equal(K.katasterFaellig(mitEintrag({ flaechentyp: "Wald / Forst" }, forst), JETZT), false);
  assert.equal(K.katasterFaellig(mitEintrag({}, null, { hinweis: "Kein Bodenrichtwert für diese Lage gefunden." }), JETZT), false);
  assert.equal(K.katasterFaellig(ansicht({ flurstueck: "—" }, { kataster: kataster(ALT) }), JETZT), false);
});

test("katasterFaellig: Schlüssel- und Jahresregel gelten weiter", () => {
  assert.equal(K.katasterFaellig(ansicht({}), JETZT), true, "noch nie abgefragt");
  assert.equal(K.katasterFaellig(mitEintrag({}, acker, { schluessel: "anderer Ort|Flur 4, Flurstück 15" }), JETZT), true, "Ort oder Flurstück geändert");
  assert.equal(K.katasterFaellig(mitEintrag({}, acker, { am: "2025-09-01T08:00:00.000Z" }), JETZT), true, "älter als ein Jahr");
});

test("katasterKandidaten: erst die Entwürfe, dann offener Altbestand — Erledigtes und Archiv bleiben unberührt", () => {
  const mit = (id: string, o: Partial<LeadRecord>, meta: LeadMeta = {}, brw: KatasterDaten["brw"] | undefined = undefined): LeadView => {
    const ohne = ansicht({ id, ...o }, meta);
    return brw === undefined ? ohne : ansicht({ id, ...o }, { ...meta, kataster: kataster(brw, { am: "2026-09-30T08:00:00.000Z", schluessel: K.katasterSchluessel(ohne) }) });
  };
  const anbieterAlt = mit("LL-ANBIETER1", { intent: "Verkaufen" }, { status: "in_arbeit" }, ALT);
  const beantwortetAlt = mit("LL-BEANTW1", {}, { status: "beantwortet" }, ALT);
  const anbieterNeu = mit("LL-ANBIETER2", { intent: "Verpachten" }, { status: "neu" }, acker);
  const erledigtAlt = mit("LL-ERLEDIGT", { intent: "Verkaufen" }, { status: "erledigt" }, ALT);
  const archivAlt = mit("LL-ARCHIV", {}, { status: "archiv" }, ALT);
  const auskunft = mit("LL-AUSKUNFT", {}, { status: "neu" });
  const ids = K.katasterKandidaten([anbieterAlt, beantwortetAlt, anbieterNeu, erledigtAlt, archivAlt, auskunft]).map((l) => l.id);
  assert.deepEqual(ids, ["LL-AUSKUNFT", "LL-ANBIETER1", "LL-BEANTW1"]);
});

// ---------------------------------------------------------------------------
// Neuabfrage des Altbestands — ohne Mails

const ALKIS = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "1",
      properties: { flurstid: "DENW-TEST-15", gemarkung: "Leopoldstal", gemeinde: "Horn-Bad Meinberg", kreis: "Lippe", flur: "004", flstnrzae: "15", flaeche: 9538, tntxt: "Landwirtschaft;9538", lagebeztxt: "Mühlenweg" },
      geometry: { type: "Polygon", coordinates: [[[8.9622, 51.8613], [8.9626, 51.8613], [8.9626, 51.8615], [8.9622, 51.8615], [8.9622, 51.8613]]] },
    },
  ],
};
const NRW_HOSTS = ["ogc-api.nrw.de", "www.wms.nrw.de"];

test("Altbestand wird beim nächsten Lauf neu abgefragt: richtige Zone gespeichert, nichts sonst geändert, keine Mail, ALKIS nicht nötig", async () => {
  const id = "LL-TESTBRW9";
  // Zustand wie vor der Korrektur: Acker-Anfrage mit dem Grünland-Wert (2,3) ohne Nutzungsart, frisch abgefragt.
  const vorher = ansicht({ id });
  await S.mutateZustand("test", (z) => {
    z.anfragen[id] = { status: "neu", kataster: kataster(ALT, { schluessel: K.katasterSchluessel(vorher) }) };
  });
  const { zustand: z0 } = await S.readZustand();
  const lead = ansicht({ id }, z0.anfragen[id]);
  assert.equal(K.katasterFaellig(lead), true, "Altbestand ist fällig");
  assert.deepEqual(K.katasterKandidaten([lead]).map((l) => l.id), [id]);

  const protokollVorher = z0.protokoll.length;
  const meldungen: string[] = [];
  const log = console.log;
  console.log = (...a: unknown[]) => void meldungen.push(a.join(" "));
  let urls: URL[];
  try {
    ({ urls } = await mitFetch(
      (u) => Response.json(u.hostname === "ogc-api.nrw.de" ? ALKIS : HORN),
      async () => {
        const ergebnisse = await K.katasterNachholen([lead], 10_000);
        assert.deepEqual(Object.keys(ergebnisse), [id]);
      },
    ));
  } finally {
    console.log = log;
  }

  const { zustand: z1 } = await S.readZustand();
  const meta = z1.anfragen[id];
  assert.equal(meta.kataster?.brw?.wert, 4, "Acker-Zone statt Grünland");
  assert.equal(meta.kataster?.brw?.nuta, "A");
  assert.equal(meta.kataster?.brw?.gewuenscht, "A");
  assert.equal(meta.kataster?.brw?.zone, "8301");
  assert.deepEqual(meta.kataster?.flurstueck, FLURSTUECK, "das gespeicherte Flurstück bleibt");
  assert.equal(meta.kataster?.am, lead.meta.kataster?.am, "Datum der Flurstück-Abfrage bleibt");
  assert.equal(K.katasterFaellig(ansicht({ id }, meta)), false, "danach nicht mehr fällig");

  // Nur das Kataster ändert sich: Status, Notizen & Co. bleiben, kein Eintrag im Verlauf, keine Mail.
  assert.deepEqual(Object.keys(meta).sort(), ["kataster", "status"]);
  assert.equal(meta.status, "neu");
  assert.equal(z1.protokoll.length, protokollVorher, "kein Protokolleintrag");
  assert.deepEqual(meldungen.filter((m) => /\[mail/.test(m)), [], "keine Mail (auch nicht im Testmodus-Log)");
  assert.deepEqual(urls.map((u) => u.hostname), ["www.wms.nrw.de"], "nur der Bodenrichtwert wird neu gefragt (BORIS), das Flurstück steht schon da");
});

test("Ein Aussetzer von ALKIS ersetzt beim Auffrischen keinen guten Eintrag durch „nicht gefunden“", async () => {
  const id = "LL-TESTBRW7";
  const vorher = ansicht({ id });
  await S.mutateZustand("test", (z) => {
    z.anfragen[id] = { status: "neu", kataster: kataster(ALT, { schluessel: K.katasterSchluessel(vorher) }) };
  });
  const { zustand: z0 } = await S.readZustand();
  const lead = ansicht({ id }, z0.anfragen[id]);
  // ALKIS antwortet mit HTTP 503 (das zählt dort als „kein Treffer“) — BORIS läuft.
  const { urls } = await mitFetch(
    (u) => (u.hostname === "ogc-api.nrw.de" ? new Response("down", { status: 503 }) : Response.json(HORN)),
    () => K.katasterNachholen([lead], 10_000),
  );
  const { zustand: z1 } = await S.readZustand();
  const k = z1.anfragen[id].kataster;
  assert.equal(k?.brw?.wert, 4);
  assert.deepEqual(k?.flurstueck, FLURSTUECK, "Flurstück nicht verloren");
  assert.ok(!urls.some((u) => u.hostname === "ogc-api.nrw.de"), "ALKIS wurde gar nicht gefragt");
});

test("Volle Abfrage (ALKIS + BORIS), wenn sich Ort oder Flurstück geändert haben oder der Eintrag über ein Jahr alt ist", async () => {
  const faelle: [string, Partial<KatasterDaten>][] = [
    ["LL-TESTBRW5", { schluessel: "anderer Ort|Flur 4, Flurstück 15" }],
    ["LL-TESTBRW6", { am: "2025-06-01T08:00:00.000Z" }],
  ];
  for (const [id, abweichung] of faelle) {
    const vorher = ansicht({ id });
    await S.mutateZustand("test", (z) => {
      z.anfragen[id] = { status: "neu", kataster: kataster(ALT, { schluessel: K.katasterSchluessel(vorher), ...abweichung }) };
    });
    const { zustand: z0 } = await S.readZustand();
    const { urls } = await mitFetch(
      (u) => Response.json(u.hostname === "ogc-api.nrw.de" ? ALKIS : HORN),
      () => K.katasterNachholen([ansicht({ id }, z0.anfragen[id])], 10_000),
    );
    assert.ok(urls.every((u) => NRW_HOSTS.includes(u.hostname)));
    assert.ok(urls.some((u) => u.hostname === "ogc-api.nrw.de"), `${id}: ALKIS wird gefragt`);
    const { zustand: z1 } = await S.readZustand();
    const k = z1.anfragen[id].kataster;
    assert.equal(k?.brw?.wert, 4, id);
    assert.equal(k?.schluessel, K.katasterSchluessel(vorher), id);
    assert.ok(Date.now() - Date.parse(k!.am) < 60_000, `${id}: Datum erneuert`);
  }
});

test("Dienststörung bei der Neuabfrage lässt den Altbestand unverändert — er bleibt fällig und wird später erneut versucht", async () => {
  const id = "LL-TESTBRW8";
  const vorher = ansicht({ id });
  await S.mutateZustand("test", (z) => {
    z.anfragen[id] = { status: "neu", kataster: kataster(ALT, { schluessel: K.katasterSchluessel(vorher) }) };
  });
  const { zustand: z0 } = await S.readZustand();
  const lead = ansicht({ id }, z0.anfragen[id]);
  const stumm = console.error;
  console.error = () => undefined;
  try {
    await mitFetch(
      (u) => (u.hostname === "ogc-api.nrw.de" ? Response.json(ALKIS) : new Response("down", { status: 503 })),
      () => K.katasterNachholen([lead], 10_000),
    );
  } finally {
    console.error = stumm;
  }
  const { zustand: z1 } = await S.readZustand();
  assert.deepEqual(z1.anfragen[id].kataster?.brw, ALT, "alter Eintrag unverändert");
  assert.equal(K.katasterFaellig(ansicht({ id }, z1.anfragen[id])), true);
});
