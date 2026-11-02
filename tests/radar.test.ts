import { strict as assert } from "node:assert";
import { test } from "node:test";
import { testUmgebung } from "./hilfe";

testUmgebung();

const M = await import("@/lib/portal/model");
const R = await import("@/lib/portal/radar");

const FREIGABE = "2026-11-02T15:30:00.000Z";
const tage = (n: number, von = FREIGABE) => new Date(Date.parse(von) + n * 86_400_000);

function vorgang(teil: Partial<import("@/lib/portal/model").VorgangRecord> = {}) {
  return { ...M.neuerVorgang("LL-AAAA0001~LL-BBBB0002", "kauf"), freigabe: { am: FREIGABE, von: "test" }, ...teil };
}

function standMail(an: string, am: string, ok = true) {
  return { id: M.kurzId("M"), am, von: "test", an, betreff: "Kurze Nachfrage", text: "…", zweck: "stand", test: false, ok };
}

test("Stand-Nachfrage: erste nach 7 Tagen, zweite 14 Tage später, danach alle 60 Tage", () => {
  const an = "kunde@example.org";
  const v = vorgang();
  assert.equal(R.standPlan(v, an, tage(6)).faellig, false, "vor Tag 7 noch nicht");
  const erste = R.standPlan(v, an, tage(7));
  assert.equal(erste.faellig, true, "ab Tag 7 fällig");
  assert.equal(erste.runde, 0);

  v.mails.unshift(standMail(an, tage(7).toISOString()));
  assert.equal(R.standPlan(v, an, tage(7 + 13)).faellig, false);
  const zweite = R.standPlan(v, an, tage(7 + 14));
  assert.equal(zweite.faellig, true, "14 Tage nach der ersten");
  assert.equal(zweite.runde, 1);

  v.mails.unshift(standMail(an, tage(21).toISOString()));
  assert.equal(R.standPlan(v, an, tage(21 + 59)).faellig, false);
  assert.equal(R.standPlan(v, an, tage(21 + 60)).faellig, true, "danach alle 60 Tage");
  assert.equal(R.standPlan(v, an, tage(21 + 60)).runde, 2);
});

test("Stand-Nachfrage: gescheiterte Mails, andere Adressen, andere Zwecke und Mails vor der Freigabe zählen nicht", () => {
  const an = "kunde@example.org";
  const v = vorgang();
  v.mails.unshift(standMail(an, tage(7).toISOString(), false));
  v.mails.unshift(standMail("anderer@example.org", tage(7).toISOString()));
  v.mails.unshift({ ...standMail(an, tage(7).toISOString()), zweck: "freigabe" });
  v.mails.unshift(standMail(an, "2026-10-01T10:00:00.000Z"));
  const p = R.standPlan(v, an, tage(7));
  assert.equal(p.runde, 0);
  assert.equal(p.faellig, true);
  assert.equal(R.standPlan(v, "KUNDE@example.org", tage(7)).faellig, true, "Adresse ohne Groß-/Kleinschreibung");
});

test("Stand-Nachfrage: keine Freigabe (oder zurückgezogen) und abgelaufene Schutzfrist = nichts fällig", () => {
  const an = "kunde@example.org";
  assert.equal(R.standPlan(M.neuerVorgang("LL-AAAA0001~LL-BBBB0002", "kauf"), an, tage(100)).faellig, false);
  const zurueck = vorgang({ freigabe: { am: FREIGABE, von: "t", zurueckgezogen: { am: FREIGABE, von: "t", grund: "x" } } });
  assert.equal(R.standPlan(zurueck, an, tage(100)).faellig, false);
  const vorbei = R.standPlan(vorgang(), an, tage(366 * 2 + 5));
  assert.equal(vorbei.vorbei, true);
  assert.equal(vorbei.faellig, false);
  assert.equal(vorbei.faelligAb, null);
});

test("Radar: Vertragsschluss gemeldet steht ganz oben, danach Hinweis vom Angebot, dann ruhig, dann frisch", () => {
  const e = (n: number, extra: Partial<import("@/lib/portal/radar").RadarEingabe> = {}) => ({ jetzt: tage(n), adressen: ["a@example.org", "b@example.org"], ...extra });

  const frisch = R.radarFuer(vorgang(), e(3));
  assert.equal(frisch?.stufe, "frisch");
  assert.equal(frisch?.faellig, false);

  const ruhig = R.radarFuer(vorgang(), e(9));
  assert.equal(ruhig?.stufe, "ruhig");
  assert.equal(ruhig?.faellig, true, "ab Tag 7 ist die Nachfrage fällig");
  assert.match(ruhig!.text, /Seit 9 Tagen keine Rückmeldung/);

  const hinweis = R.radarFuer(vorgang(), e(5, { angebotSignal: { am: tage(4).toISOString(), text: "Fläche aus der Börse genommen (vergeben)" } }));
  assert.equal(hinweis?.stufe, "hinweis");

  const altesSignal = R.radarFuer(vorgang(), e(5, { angebotSignal: { am: "2026-10-01T00:00:00.000Z", text: "vor der Freigabe" } }));
  assert.equal(altesSignal?.stufe, "frisch", "Signale vor der Freigabe zählen nicht");

  const gemeldet = vorgang({ meldungen: [{ id: "m1", am: tage(4).toISOString(), rolle: "suchender", art: "abschluss", text: "Vertrag unterschrieben" }] });
  const g = R.radarFuer(gemeldet, e(5, { angebotSignal: { am: tage(4).toISOString(), text: "x" } }));
  assert.equal(g?.stufe, "gemeldet", "eine gemeldete Unterschrift schlägt jedes andere Signal");
  assert.ok(R.RADAR_RANG.gemeldet < R.RADAR_RANG.hinweis && R.RADAR_RANG.hinweis < R.RADAR_RANG.ruhig && R.RADAR_RANG.ruhig < R.RADAR_RANG.frisch);

  const erledigt = vorgang({ meldungen: [{ id: "m1", am: tage(4).toISOString(), rolle: "suchender", art: "abschluss", text: "…", erledigt: { am: tage(4).toISOString(), von: "t" } }] });
  assert.equal(R.radarFuer(erledigt, e(5))?.stufe, "frisch", "eine abgehakte Meldung zählt nicht mehr");
  const rueckfrage = vorgang({ meldungen: [{ id: "m2", am: tage(4).toISOString(), rolle: "anbieter", art: "rueckfrage", text: "Frage" }] });
  assert.equal(R.radarFuer(rueckfrage, e(5))?.stufe, "frisch", "eine Rückfrage ist kein Deal-Hinweis");
});

test("Radar: Abschluss, beendeter Vorgang, Absage und fehlende Freigabe gehören nicht auf den Radar", () => {
  const e = { jetzt: tage(10), adressen: ["a@example.org"] };
  assert.equal(R.radarFuer(vorgang({ abschluss: { am: tage(8).toISOString(), grundlage: "extern" } }), e), null);
  assert.equal(R.radarFuer(vorgang({ beendet: { am: tage(8).toISOString(), von: "t", grund: "keine Einigung" } }), e), null);
  assert.equal(R.radarFuer(vorgang(), { ...e, abgelehnt: true }), null);
  assert.equal(R.radarFuer(M.neuerVorgang("LL-AAAA0001~LL-BBBB0002", "kauf"), e), null);
  assert.equal(R.radarFuer(null, e), null);
});

test("Radar: gesendete Nachfragen und nächster Termin werden gezählt", () => {
  const v = vorgang();
  v.mails.unshift(standMail("a@example.org", tage(7).toISOString()));
  v.mails.unshift(standMail("b@example.org", tage(7).toISOString()));
  const r = R.radarFuer(v, { jetzt: tage(10), adressen: ["a@example.org", "b@example.org"] });
  assert.equal(r?.stufe, "ruhig");
  assert.equal(r?.nachfragen, 1);
  assert.equal(r?.faellig, false);
  assert.equal(r?.naechste, tage(21).toISOString(), "zweite Nachfrage 14 Tage nach der ersten");
});
