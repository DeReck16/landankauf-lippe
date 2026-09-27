import { strict as assert } from "node:assert";
import { test } from "node:test";
import { testUmgebung } from "./hilfe";

testUmgebung();

const { boerseLuecken, oeffentlicheLage } = await import("@/lib/boerse-regeln");
const { leadView } = await import("@/lib/admin/model");
const { gleichePerson } = await import("@/lib/portal/anbieter-regeln");
const T = await import("@/lib/portal/token");
const M = await import("@/lib/portal/model");
const V = await import("@/lib/portal/vorgang");

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
const b = { code: "LF-1234", typ: "Ackerland", groesseHa: 5, lage: "Raum Horn-Bad Meinberg", text: "", einwilligung: { am: "2026-09-21", quelle: "im Kundenbereich", von: "kunde" }, online: false };

test("Börse: vollständig und mit Einwilligung ohne Lücken", () => {
  assert.deepEqual(boerseLuecken(b, leadView(lead, {})), []);
});

test("Börse: Direktankauf, erledigt, fehlende Einwilligung und Klarnamen sperren", () => {
  assert.ok(boerseLuecken(b, leadView(lead, { weg: "ankauf" })).some((x) => /Direktankauf/.test(x)));
  assert.ok(boerseLuecken(b, leadView(lead, { status: "erledigt" })).length > 0);
  assert.ok(boerseLuecken({ ...b, einwilligung: null }, leadView(lead, {})).some((x) => /Einwilligung/.test(x)));
  assert.ok(boerseLuecken({ ...b, text: "Acker von Erika Muster" }, leadView(lead, {})).length > 0);
});

test("Börse: Ortsteile in Klammern erscheinen nie öffentlich", () => {
  assert.equal(oeffentlicheLage("Raum Horn-Bad Meinberg (Leopoldstal)"), "Raum Horn-Bad Meinberg");
});

test("Gleiche Person: Klammerzusätze egal, andere Vornamen nicht", () => {
  assert.equal(gleichePerson("Erika Muster", "Erika Muster (vertreten durch Tom)"), true);
  assert.equal(gleichePerson("Muster, Erika", "Erika Muster"), true);
  assert.equal(gleichePerson("Erika Muster", "Hans Muster"), false);
});

test("Tokens: Zweck gebunden, Vorgangskennung undurchsichtig", () => {
  const t = T.boerseToken("LL-TEST1");
  assert.equal(T.pruefeBoerse(t)?.k, "LL-TEST1");
  assert.equal(T.pruefeBoerse(`${t}x`), null, "manipuliert");
  const k = T.vorgangsKennung("LL-A~LL-B");
  assert.ok(T.istVorgangsKennung(k));
  assert.ok(!k.includes("LL-"), "keine Anfrage-ID in der Kennung");
});

test("Freigabe bei Verbrauchern: erst Widerrufsfrist plus vier Tage, mit Beginnwunsch sofort", () => {
  const am = "2026-09-01T10:00:00.000Z";
  const k = {
    ...M.neuerKunde("LL-S1", "suchender", "pacht", "s@example.com", "test"),
    vertrag: {
      vorlageId: "nachweis-pacht",
      version: "x",
      titel: "Nachweisvertrag",
      dokumentId: "D",
      signatur: { name: "S", email: "s@example.com", am, ip: "", userAgent: "", textHash: "", vorlageId: "nachweis-pacht", vorlageVersion: "x", erklaerungen: [], sitzung: "" },
      eigenschaft: "verbraucher" as const,
      beginnwunschAm: null,
      widerrufsfristEnde: M.widerrufsfristEnde(am),
      bestaetigungGesendetAm: am,
      konditionen: null,
    },
  } as unknown as import("@/lib/portal/model").KundeRecord;
  assert.equal(M.freigabeBereit(k, new Date("2026-09-18T12:00:00.000Z")).bereit, false);
  assert.equal(M.freigabeBereit(k, new Date("2026-09-20T12:00:00.000Z")).bereit, true);
  const mitWunsch = { ...k, vertrag: { ...k.vertrag!, beginnwunschAm: am } };
  assert.equal(M.freigabeBereit(mitWunsch, new Date("2026-09-02T12:00:00.000Z")).bereit, true);
});

test("Online-Pachtvertrag: Unternehmer ↔ Verbraucher und Wald sind gesperrt", () => {
  const angebot = leadView({ ...lead, flaechentyp: "Wald / Forst" }, {});
  const anbieter = { stammdaten: { eigenschaft: "unternehmer" } } as unknown as import("@/lib/portal/model").KundeRecord;
  const suchender = { stammdaten: { eigenschaft: "verbraucher" } } as unknown as import("@/lib/portal/model").KundeRecord;
  const arten = V.pachtOnlineSperren({ angebot, anbieter, suchender }, null).map((x) => x.art).sort();
  assert.deepEqual(arten, ["fernabsatz", "wald"]);
  assert.deepEqual(V.pachtOnlineSperren({ angebot: leadView(lead, {}), anbieter: null, suchender: null }, null), []);
});

test("Börse: öffentliche Größe gerundet — nie die genaue Fläche", async () => {
  const { oeffentlicheHa, haText } = await import("@/lib/boerse-regeln");
  assert.equal(oeffentlicheHa(0.1832), 0.2);
  assert.equal(haText(oeffentlicheHa(0.1832)), "unter 0,5 ha");
  assert.equal(oeffentlicheHa(4.37), 4.5);
  assert.equal(oeffentlicheHa(12.61), 13);
  assert.equal(oeffentlicheHa(23.9), 25);
  assert.equal(oeffentlicheHa(null), null);
});
