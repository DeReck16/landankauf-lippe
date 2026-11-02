import { strict as assert } from "node:assert";
import { test } from "node:test";
import { testUmgebung } from "./hilfe";

testUmgebung();

const M = await import("@/lib/portal/model");
const E = await import("@/lib/portal/entwuerfe");

const FREIGABE = "2026-11-02T15:30:00.000Z";
const tage = (n: number) => new Date(Date.parse(FREIGABE) + n * 86_400_000);

function lead(id: string, art: "kauf" | "pacht", extra: Record<string, unknown> = {}) {
  return {
    id,
    name: id === "LL-AAAA0001" ? "Anna Anbieter" : "Sven Suchender",
    email: id === "LL-AAAA0001" ? "anna@example.org" : "sven@example.org",
    phone: "",
    typ: "Ackerland",
    art,
    groesseWert: 5700,
    boerse: "—",
    meta: {},
    ort: "Helpup",
    ortText: "Helpup",
    ...extra,
  };
}

function entwuerfe(vorgang: import("@/lib/portal/model").VorgangRecord, jetzt: Date, art: "kauf" | "pacht" = "kauf") {
  const angebot = lead("LL-AAAA0001", art);
  const gesuch = lead("LL-BBBB0002", art);
  return E.entwuerfePaar({
    key: "LL-AAAA0001~LL-BBBB0002",
    angebot: angebot as never,
    gesuch: gesuch as never,
    anbieter: { ...M.neuerKunde("LL-AAAA0001", "anbieter", art, "anna@example.org", "t"), stammdaten: { name: "Anna Anbieter" } } as never,
    suchender: { ...M.neuerKunde("LL-BBBB0002", "suchender", art, "sven@example.org", "t"), stammdaten: { name: "Sven Suchender" } } as never,
    vorgang,
    meta: { status: "kontakt" },
    zustand: { orte: {}, anfragen: {}, paare: {} } as never,
    einstellungen: M.leereEinstellungen(),
    basis: "https://lippeforst.de",
    bewertungsUrl: null,
    jetzt,
  });
}

function vorgang(teil: Partial<import("@/lib/portal/model").VorgangRecord> = {}, art: "kauf" | "pacht" = "kauf") {
  return { ...M.neuerVorgang("LL-AAAA0001~LL-BBBB0002", art), freigabe: { am: FREIGABE, von: "test" }, ...teil };
}

test("Stand-Nachfrage: je Seite eine Mail mit Bezug zur Fläche, Direktlink und Rückmeldewegen — erst nach 7 Tagen fällig", () => {
  const frueh = entwuerfe(vorgang(), tage(3)).filter((e) => e.zweck === "stand");
  assert.equal(frueh.length, 2, "für Anbieter und Suchenden");
  assert.ok(frueh.every((e) => !e.faellig && !e.gesperrt), "vor Tag 7 nicht fällig, aber auch nicht gesperrt (von Hand jederzeit möglich)");

  const spaet = entwuerfe(vorgang(), tage(8)).filter((e) => e.zweck === "stand");
  assert.ok(spaet.every((e) => e.faellig));
  const such = spaet.find((e) => e.rolle === "suchender")!;
  assert.equal(such.an, "sven@example.org");
  assert.match(such.betreff, /^Kurze Nachfrage zur Fläche \(.*Ackerland.*\) — Lippe Forst$/);
  assert.match(such.text, /^Guten Tag Sven Suchender,/);
  assert.match(such.text, /am 02\.11\.2026 haben wir Ihnen die Kontaktdaten/);
  assert.match(such.text, /Kaufvertrag/);
  assert.match(such.text, /Vertragsschluss melden/);
  assert.match(such.text, /https:\/\/lippeforst\.de\/kunde\/anmelden\/bestaetigen\?z=/);
  assert.doesNotMatch(such.text, /Zur Erinnerung/, "die erste Nachfrage erinnert noch nicht an die Mitteilungspflicht");
  assert.doesNotMatch(such.text, /34c|Telefon|\+49|0\d{3,}/, "keine § 34c-Aussage, keine Telefonnummer");
  assert.match(such.text, /Lippe Forst · lippeforst\.de/);
});

test("Stand-Nachfrage: ab der zweiten Runde mit Hinweis auf die Mitteilungspflicht (14 Tage); Pacht sagt Pachtvertrag", () => {
  const v = vorgang({}, "pacht");
  v.mails.unshift({ id: "M1", am: tage(7).toISOString(), von: "t", an: "sven@example.org", betreff: "x", text: "x", zweck: "stand", test: false, ok: true });
  const liste = entwuerfe(v, tage(21), "pacht").filter((e) => e.zweck === "stand");
  const such = liste.find((e) => e.rolle === "suchender")!;
  const anb = liste.find((e) => e.rolle === "anbieter")!;
  assert.ok(such.faellig, "14 Tage nach der ersten Nachfrage");
  assert.match(such.betreff, /^Erinnerung: /);
  assert.match(such.titel, /2\. Nachfrage/);
  assert.match(such.text, /Zur Erinnerung: Kommt ein Pachtvertrag über diese Fläche zustande, teilen Sie uns das nach unserer Vereinbarung binnen 14 Tagen in Textform mit/);
  assert.equal(anb.faellig, true, "der Anbieter wurde noch nie gefragt: für ihn ist auch die erste Nachfrage fällig");
  assert.doesNotMatch(anb.text, /Zur Erinnerung/);
});

test("Stand-Nachfrage: nach einem Abschluss, einem Widerruf und nach der Schutzfrist gesperrt; ohne Freigabe gar nicht erst angeboten", () => {
  const abgeschlossen = vorgang({ abschluss: { am: tage(9).toISOString(), grundlage: "extern" } });
  assert.ok(entwuerfe(abgeschlossen, tage(10)).filter((e) => e.zweck === "stand").every((e) => e.gesperrt && /schon geschlossen/.test(e.gesperrt)));

  const vorbei = entwuerfe(vorgang(), tage(366 * 2 + 5)).filter((e) => e.zweck === "stand");
  assert.ok(vorbei.every((e) => e.gesperrt && /Schutzfrist/.test(e.gesperrt) && !e.faellig));

  const ohneFreigabe = entwuerfe(M.neuerVorgang("LL-AAAA0001~LL-BBBB0002", "kauf"), tage(10));
  assert.equal(ohneFreigabe.filter((e) => e.zweck === "stand").length, 0);
});
