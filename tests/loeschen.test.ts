import { strict as assert } from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { testUmgebung } from "./hilfe";

const DIR = testUmgebung();

const R = await import("@/lib/admin/loeschen-regeln");
const L = await import("@/lib/admin/loeschen");
const S = await import("@/lib/portal/speicher");
const M = await import("@/lib/portal/model");
const store = await import("@/lib/admin/store");
const { einreihen } = await import("@/lib/portal/mail");
const { boerseNeuSchreiben, BOERSE_PFAD } = await import("@/lib/boerse");
const { einladungToken, antwortToken, pruefeAntwort } = await import("@/lib/portal/token");
const { einladungPruefen, ladeLead } = await import("@/lib/portal/ablauf");
const { tagBerlin } = await import("@/lib/portal/automatik-regeln");

// ---------------------------------------------------------------------------
// Hilfen

type Lead = import("@/lib/admin/model").LeadRecord;

async function anfrage(id: string, felder: Partial<Lead>): Promise<void> {
  const lead: Lead = {
    id,
    receivedAt: "2026-09-10T09:00:00.000Z",
    intent: "Verpachten",
    flaechentyp: "Ackerland",
    groesse: "2,5 ha",
    ort: "Horn-Bad Meinberg",
    flurstueck: "—",
    message: "—",
    name: "—",
    phone: "—",
    email: "—",
    source: "test",
    consent: "on",
    gclid: "—",
    boerse: "—",
    ...felder,
  };
  await store.dateiAnlegen(`leads/${lead.receivedAt.slice(0, 10)}/${id}.json`, JSON.stringify(lead), "application/json");
}

/** Alle Dateien im Testspeicher mit ihrem Inhalt (als Text) — außer den ausdrücklich erlaubten. */
function speicherInhalt(ausser: (rel: string) => boolean = () => false): { rel: string; text: string }[] {
  const out: { rel: string; text: string }[] = [];
  const gehe = (ordner: string) => {
    for (const name of readdirSync(ordner)) {
      const voll = path.join(ordner, name);
      if (statSync(voll).isDirectory()) gehe(voll);
      else {
        const rel = path.relative(DIR, voll).split(path.sep).join("/");
        if (!ausser(rel)) out.push({ rel, text: readFileSync(voll, "utf8") });
      }
    }
  };
  gehe(DIR);
  return out;
}

function fundstellen(muster: RegExp, ausser?: (rel: string) => boolean): string[] {
  return speicherInhalt(ausser)
    .filter((d) => muster.test(d.text))
    .map((d) => d.rel);
}

// ---------------------------------------------------------------------------
// Regeln

test("Aufbewahrung: Frist ab Jahresende, 6 bzw. 8 Jahre (deutsche Zeit)", () => {
  assert.equal(R.aufbewahrenBis("2026-03-10T10:00:00Z", "geschaeftsbrief"), "2032-12-31");
  assert.equal(R.aufbewahrenBis("2026-03-10T10:00:00Z", "buchungsbeleg"), "2034-12-31");
  // Silvesternacht: 23:30 UTC ist in Deutschland schon das neue Jahr.
  assert.equal(R.aufbewahrenBis("2026-12-31T23:30:00Z", "geschaeftsbrief"), "2033-12-31");
});

test("Schwärzen: Telefon in allen Schreibweisen, Namen nur als ganzes Wort", () => {
  const k = R.kennungenSammeln({ lead: { name: "Ali Kaya", email: "ali@example.com", phone: "0170 1234567" } as Lead });
  const t = R.schwaerzen("Anruf 0170/123 45 67, +49 170 1234567, +49 (0)170-1234567; Mail an ali@example.com von Ali Kaya. Qualität gut. Nummer 017012345678 bleibt.", k);
  assert.doesNotMatch(t, /1234567(?!8)|ali@|Ali Kaya/);
  assert.match(t, /Qualität gut/, "kein Treffer mitten im Wort");
  assert.match(t, /017012345678/, "längere Nummer bleibt");
  assert.equal(t.match(/\[gelöscht\]/g)?.length, 5);
});

test("Einstufung: Vorgang löschen, sperren oder blockiert; Kundenakte mit Vertrag sperren", () => {
  assert.deepEqual(R.vorgangEinstufen(null), { wie: "loeschen" });
  const v = M.neuerVorgang("LL-A~LL-B", "pacht");
  assert.equal(R.vorgangEinstufen(v).wie, "loeschen", "nur Vorschlag/Hinweise");
  v.pachtvertrag = { status: "zur_unterschrift", daten: {} as never, erstelltAm: "", von: "", geaendertAm: "", unterschriften: {} };
  assert.equal(R.vorgangEinstufen(v).wie, "blockiert");
  delete v.pachtvertrag;
  v.freigabe = { am: "2026-04-01T10:00:00Z", von: "admin" };
  const b = R.vorgangEinstufen(v);
  assert.equal(b.wie, "blockiert", "freigegeben, weder abgeschlossen noch beendet");
  v.beendet = { am: "2026-05-02T10:00:00Z", von: "admin", grund: "" };
  const s = R.vorgangEinstufen(v);
  assert.equal(s.wie, "sperren");
  assert.equal(s.wie === "sperren" && s.bis, "2032-12-31");

  assert.deepEqual(R.kundeEinstufen(M.neuerKunde("LL-X", "anbieter", "pacht", "x@example.com", "t")), { wie: "loeschen" });
  const k = M.neuerKunde("LL-Y", "suchender", "pacht", "y@example.com", "t");
  k.vertrag = { vorlageId: "nachweis-pacht", version: "1", titel: "Nachweisvertrag – Pacht", dokumentId: "DOK-1", signatur: { name: "Y", email: "y@example.com", am: "2025-06-01T10:00:00Z", ip: "", userAgent: "", textHash: "", vorlageId: "nachweis-pacht", vorlageVersion: "1", erklaerungen: [], sitzung: "" }, eigenschaft: "verbraucher", beginnwunschAm: null, widerrufsfristEnde: null, bestaetigungGesendetAm: null, konditionen: null };
  const ks = R.kundeEinstufen(k);
  assert.equal(ks.wie === "sperren" && ks.bis, "2031-12-31");
  const kb = R.kundeEinstufen(k, "2026-07-01T10:00:00Z");
  assert.equal(kb.wie === "sperren" && kb.bis, "2034-12-31", "als Grundlage einer gebuchten Provision 8 Jahre");
});

// ---------------------------------------------------------------------------
// Ablauf im Speicher

test("Löschen ohne Vertrag: alles weg, Grabstein ohne Personendaten, Gegenseite geschwärzt", async () => {
  const A = "LL-ERIKA1";
  const G = "LL-HANS1";
  await anfrage(A, { name: "Erika Musterfrau", email: "erika@example.com", phone: "0170 1234567", ort: "Musterweg 5, Leopoldstal", flurstueck: "Gemarkung Leopoldstal, Flur 3, Flurstück 12/5", message: "Bitte rufen Sie mich an, Erika Musterfrau" });
  await anfrage(G, { intent: "Fläche gesucht (Pacht)", name: "Hans Pächter", email: "hans@example.com", ort: "Horn-Bad Meinberg" });
  const key = `${A}~${G}`;

  await store.mutateZustand("admin@example.com", (z) => {
    z.anfragen[A] = {
      status: "in_arbeit",
      notiz: "Frau Musterfrau ruft zurück",
      rueckmeldung: { am: "2026-09-12T10:00:00Z", art: "verpachten", text: "Gern, Erika Musterfrau", quelle: "link" },
      postfach: [{ id: "msg-1@example.com", am: "2026-09-13T08:00:00Z", von: "erika@example.com", betreff: "Re: Lippe Forst", text: "Meine Nummer: 0170 1234567", zuordnung: "absender", vorschlag: null, grund: "", erfasstAm: "2026-09-13T08:00:00Z" }],
      boerse: { code: "LF-4711", typ: "Ackerland", groesseHa: 2.5, lage: "Raum Horn-Bad Meinberg", text: "Gut arrondierte Ackerfläche", einwilligung: { am: "2026-09-12", quelle: "per E-Mail", von: "admin" }, online: true, seit: "2026-09-12T10:00:00Z" },
    };
    z.anfragen[G] = { status: "in_arbeit" };
    z.paare[key] = { status: "angefragt", notiz: "Erika Musterfrau passt zu Hans" };
    z.orte["musterweg 5"] = { lat: 51.9, lon: 8.9, name: "Musterweg 5, Leopoldstal", ausdehnungKm: 0.1, am: "2026-09-10T09:00:00Z" };
    return { was: "Einladung an erika@example.com gesendet", ref: A };
  });
  await store.mutateZustand("admin@example.com", () => ({ was: "Paar vorgemerkt: Erika Musterfrau ↔ Hans Pächter", ref: key }));
  await store.mutateZustand("admin@example.com", () => ({ was: "Rückruf bei Erika Musterfrau (0170-1234567) erledigt" }));

  const k = await S.aendereKunde(A, () => undefined, () => M.neuerKunde(A, "anbieter", "pacht", "erika@example.com", "admin"));
  await store.dateiAnlegen(`portal/dokumente/kunde/${A}/DOK-UP1.pdf`, Buffer.from("%PDF-1.4 Lageplan Erika Musterfrau"), "application/pdf");
  await S.aendereKunde(A, (x) => {
    x.einladung = { nonce: "n".repeat(20), bis: "2026-12-31T00:00:00Z", erstelltAm: "2026-09-11T10:00:00Z", von: "admin" };
    x.stammdaten = { name: "Erika Musterfrau", betrieb: "", strasse: "Musterweg 5", plz: "32805", ort: "Horn-Bad Meinberg", telefon: "0170 1234567", eigenschaft: "verbraucher", geaendertAm: "2026-09-11T10:00:00Z" };
    x.dokumente.push({ id: "DOK-UP1", art: "upload", titel: "Lageplan", dateiname: "lageplan.pdf", pfad: `portal/dokumente/kunde/${A}/DOK-UP1.pdf`, contentType: "application/pdf", groesse: 10, sha256: "x", erstelltAm: "2026-09-11T10:00:00Z", von: "admin", sichtbarFuer: ["anbieter"] });
    x.mails.push({ id: "M-1", am: "2026-09-11T10:00:00Z", von: "admin", an: "erika@example.com", betreff: "Einladung", text: "Guten Tag Frau Musterfrau", zweck: "einladung", test: true, ok: true });
    M.ereignis(x, "admin", "mail", "Einladung an erika@example.com");
  });
  assert.ok(k);
  await S.aendereKunde(G, () => undefined, () => M.neuerKunde(G, "suchender", "pacht", "hans@example.com", "admin"));
  await S.aendereVorgang(key, "pacht", (v) => {
    v.mails.push({ id: "M-H", am: "2026-09-14T10:00:00Z", von: "admin", an: "hans@example.com", betreff: "Hinweis", text: "Eine Fläche im Raum Horn", zweck: "hinweis", test: true, ok: true });
  });
  const einladung = einladungToken(A, "anbieter", "n".repeat(20), new Date("2026-12-31T00:00:00Z"));
  const antwort = antwortToken(A);

  await einreihen({ an: ["erika@example.com"], betreff: `Ihre Anfrage bei Lippe Forst ist eingegangen (Vorgang ${A})`, text: "Guten Tag" }, "eingangsbestaetigung", { typ: "keiner" }, "Test");
  await einreihen({ an: ["verwaltung@example.com"], betreff: "[Lippe Forst] Neue Anfrage: Erika Musterfrau", text: "Erika Musterfrau, erika@example.com, 0170 1234567" }, "verwaltung", { typ: "keiner" }, "Test");
  await store.drosseln("bestaetigung", store.kurzwert("erika@example.com", "bestaetigung"), [{ sekunden: 86_400, max: 2 }]);
  await S.markiereGesehen("admin@example.com", [`anfrage:${A}`, `kunde:${A}`, `anfrage:${G}`]);
  const tag = tagBerlin();
  await store.jsonAendern(`automatik/protokoll/${tag}.json`, () => ({ v: 1, tag, eintraege: [{ am: new Date().toISOString(), regel: "r1", ref: A, text: "Probelauf — würde: LF-4711 veröffentlichen und Erika Musterfrau informieren", art: "probe" }], mails: 0 }), () => undefined);
  await boerseNeuSchreiben();
  assert.match(readFileSync(path.join(DIR, BOERSE_PFAD), "utf8"), /LF-4711/, "vorher in der Börse");

  assert.ok(fundstellen(/Musterfrau/).length >= 8, "vorher an vielen Stellen gespeichert");

  // Vorschau: nichts gesperrt, nichts blockiert
  const plan = await L.loeschPlan(A);
  assert.equal(plan.blockiert.length, 0);
  assert.equal(plan.sperren.length, 0);
  assert.ok(plan.loeschen.some((p) => p.was === L.UMFANG.anfrage));
  assert.ok(plan.loeschen.some((p) => p.was === L.UMFANG.vorgaenge));

  const r = await L.vorgangLoeschen(A, "admin@example.com");
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.ok && r.grabstein.stand, "fertig", JSON.stringify(r));

  // Anfrage, Akte, Dokument, Vorgang, Verlauf, Index, Zähler: weg
  assert.equal(await ladeLead(A), null);
  assert.equal(await S.ladeKunde(A), null);
  assert.equal(await S.ladeVorgang(key), null);
  assert.deepEqual(await S.kundenFuerEmail("erika@example.com"), []);
  const { zustand } = await store.readZustand();
  assert.equal(zustand.anfragen[A], undefined);
  assert.equal(zustand.paare[key], undefined);
  assert.equal(zustand.orte["musterweg 5"], undefined, "Ort nur dieser Anfrage aus dem Cache");
  assert.equal((await store.dateienListen(`portal/dokumente/kunde/${A}/`)).length, 0);
  assert.equal((await store.dateienListen(`admin/verlauf/${A}`)).length, 0);
  assert.equal((await store.dateienListen("admin/drossel/bestaetigung/")).length, 0);
  assert.equal((await store.dateienListen(`admin/loeschung/`)).length, 0, "Auftrag mit Kennungen wieder gelöscht");

  // Kundenzugang: Links ungültig
  assert.equal((await einladungPruefen(einladung)).ok, false);
  assert.ok(pruefeAntwort(antwort), "Signatur an sich noch gültig …");
  assert.equal(await ladeLead(pruefeAntwort(antwort)!.k), null, "… aber ohne Anfrage wertlos");

  // Börse: nicht mehr in der öffentlichen Datei
  assert.doesNotMatch(readFileSync(path.join(DIR, BOERSE_PFAD), "utf8"), /LF-4711/);

  // Grabstein ohne Personendaten, Protokolleintrag ohne Personendaten
  const g = zustand.geloescht?.[A];
  assert.ok(g);
  assert.equal(g!.monat, "2026-09");
  assert.equal(g!.art, "Angebot · Pacht (Verpachten)");
  assert.match(g!.status, /In Arbeit/);
  assert.doesNotMatch(JSON.stringify(g), /Erika|Musterfrau|erika@|1234567|Musterweg|Leopoldstal/);
  assert.match(zustand.protokoll[0].was, new RegExp(`^Vorgang ${A} endgültig gelöscht`));
  assert.equal(zustand.protokoll[0].ref, undefined);
  assert.ok(!zustand.protokoll.some((p) => p.ref === A), "Einträge zur Anfrage entfernt");

  // Gegenseite: Akte und Anfrage bleiben, Personendaten in ihrem Verlauf geschwärzt
  assert.ok(await ladeLead(G));
  assert.ok(await S.ladeKunde(G));
  const verlaufG = (await store.jsonLesen<{ eintraege: { was: string }[] }>(`admin/verlauf/${G}.json`))?.daten.eintraege ?? [];
  assert.ok(verlaufG.some((e) => /\[gelöscht\] ↔ Hans Pächter/.test(e.was)), JSON.stringify(verlaufG));

  // Nirgends mehr im Speicher: Name, E-Mail, Telefon, Anschrift, Flurstück
  assert.deepEqual(fundstellen(/Musterfrau|erika@example\.com|1234567|Musterweg|12\/5/), []);
  // Meldung an die Verwaltung im Postausgang bleibt, aber geschwärzt; Eingangsbestätigung an Erika ist weg
  const pa = speicherInhalt().filter((d) => d.rel.startsWith("portal/postausgang/"));
  assert.equal(pa.length, 1);
  assert.match(pa[0].text, /\[gelöscht\]/);

  // Noch einmal: nichts mehr zu tun, der Grabstein bleibt
  const r2 = await L.vorgangLoeschen(A, "admin@example.com");
  assert.ok(r2.ok && r2.grabstein.stand === "fertig");
});

test("Löschen mit Vertrag und bezahlter Provision: nur gesperrt (8 Jahre), Rest gelöscht", async () => {
  const S1 = "LL-KARL1";
  const A2 = "LL-ANNA1";
  const key = `${A2}~${S1}`;
  await anfrage(S1, { intent: "Fläche gesucht (Pacht)", name: "Karl Käufer", email: "karl@example.com", phone: "05234 998877", receivedAt: "2026-02-01T09:00:00.000Z" });
  await anfrage(A2, { name: "Anna Anbieter", email: "anna@example.com", receivedAt: "2026-02-02T09:00:00.000Z" });
  await store.mutateZustand("admin@example.com", (z) => {
    z.anfragen[S1] = { status: "erledigt", rolle: "gesuch", art: "pacht" };
    z.anfragen[A2] = { status: "erledigt" };
    z.paare[key] = { status: "abschluss", notiz: "Karl zahlt pünktlich" };
  });
  const signatur = { name: "Karl Käufer", email: "karl@example.com", am: "2026-03-10T10:00:00Z", ip: "203.0.113.5", userAgent: "Test", textHash: "h", vorlageId: "nachweis-pacht", vorlageVersion: "2026-09-27", erklaerungen: [], sitzung: "s" };
  await store.dateiAnlegen(`portal/dokumente/kunde/${S1}/DOK-V1.pdf`, Buffer.from("%PDF-1.4 Nachweisvertrag Karl Käufer"), "application/pdf");
  await store.dateiAnlegen(`portal/dokumente/kunde/${S1}/DOK-UP2.pdf`, Buffer.from("%PDF-1.4 Ausweis Karl Käufer"), "application/pdf");
  await S.aendereKunde(S1, () => undefined, () => M.neuerKunde(S1, "suchender", "pacht", "karl@example.com", "admin"));
  await S.aendereKunde(S1, (x) => {
    x.stammdaten = { name: "Karl Käufer", betrieb: "Hof Käufer", strasse: "Hofweg 1", plz: "32805", ort: "Horn", telefon: "05234 998877", eigenschaft: "unternehmer", geaendertAm: "2026-03-10T10:00:00Z" };
    x.vertrag = { vorlageId: "nachweis-pacht", version: "2026-09-27", titel: "Nachweisvertrag – Pacht", dokumentId: "DOK-V1", signatur, eigenschaft: "unternehmer", beginnwunschAm: null, widerrufsfristEnde: null, bestaetigungGesendetAm: "2026-03-10T10:01:00Z", konditionen: null };
    x.flaechenAngaben = { preis: "Karl zahlt bis 600 €" };
    x.dokumente.push(
      { id: "DOK-V1", art: "maklervertrag", titel: "Nachweisvertrag – Pacht", dateiname: "nachweis.pdf", pfad: `portal/dokumente/kunde/${S1}/DOK-V1.pdf`, contentType: "application/pdf", groesse: 10, sha256: "x", erstelltAm: "2026-03-10T10:00:00Z", von: "kunde", sichtbarFuer: ["suchender"] },
      { id: "DOK-UP2", art: "upload", titel: "Ausweis", dateiname: "ausweis.pdf", pfad: `portal/dokumente/kunde/${S1}/DOK-UP2.pdf`, contentType: "application/pdf", groesse: 10, sha256: "x", erstelltAm: "2026-03-11T10:00:00Z", von: "admin", sichtbarFuer: ["suchender"] },
    );
    x.mails.push(
      { id: "M-V", am: "2026-03-10T10:01:00Z", von: "system", an: "karl@example.com", betreff: "Ihr Nachweisvertrag", text: "Anbei", zweck: "vertragsbestaetigung", test: true, ok: true },
      { id: "M-N", am: "2026-02-20T10:00:00Z", von: "admin", an: "karl@example.com", betreff: "Noch Interesse?", text: "Hallo Herr Käufer", zweck: "nachfassen", test: true, ok: true },
    );
  });
  await S.aendereKunde(A2, () => undefined, () => M.neuerKunde(A2, "anbieter", "pacht", "anna@example.com", "admin"));
  await S.aendereVorgang(key, "pacht", (v) => {
    v.freigabe = { am: "2026-04-01T10:00:00Z", von: "admin" };
    v.abschluss = { am: "2026-05-01T10:00:00Z", grundlage: "pachtvertrag" };
    v.provisionen.push({ id: "P-1", grundlage: "pachtvertrag", art: "pacht", bemessung: 5000, konditionen: null, netto: 5000, ustProzent: 19, brutto: 5950, entstandenAm: "2026-05-01T10:00:00Z", faelligAm: "2026-05-15", status: "bezahlt", rechnung: { datum: "2026-06-01", faelligAm: "2026-06-15" }, verlauf: [{ am: "2026-06-20T10:00:00Z", von: "admin", was: "Bezahlt" }] });
    v.mails.push(
      { id: "M-F", am: "2026-04-01T10:00:00Z", von: "admin", an: "karl@example.com", betreff: "Kontaktdaten", text: "Anna Anbieter, anna@example.com", zweck: "freigabe", test: true, ok: true },
      { id: "M-H", am: "2026-03-20T10:00:00Z", von: "admin", an: "karl@example.com", betreff: "Hinweis", text: "Fläche im Raum Horn", zweck: "hinweis", test: true, ok: true },
    );
    v.meldungen.push({ id: "K-1", am: "2026-04-05T10:00:00Z", rolle: "suchender", art: "rueckfrage", text: "Karl fragt nach dem Pachtbeginn" });
  });

  assert.ok(fundstellen(/Karl Käufer/).length >= 4, "vorher an mehreren Stellen gespeichert");
  const plan = await L.loeschPlan(S1);
  assert.equal(plan.blockiert.length, 0, JSON.stringify(plan.blockiert));
  assert.equal(plan.sperren.length, 2, JSON.stringify(plan.sperren));
  assert.ok(plan.sperren.every((p) => p.bis === "2034-12-31"), JSON.stringify(plan.sperren));

  const r = await L.vorgangLoeschen(S1, "admin@example.com");
  assert.ok(r.ok && r.grabstein.stand === "fertig", JSON.stringify(r));

  // Sperrakte: nur Vertrag, Vertrags-PDF und Vertragskorrespondenz
  const akte = await L.ladeSperrakte(S1);
  assert.ok(akte?.kunde?.vertrag);
  assert.equal(akte!.bis, "2034-12-31");
  assert.deepEqual(akte!.kunde!.dokumente.map((d) => d.id), ["DOK-V1"]);
  assert.deepEqual(akte!.kunde!.mails.map((m) => m.zweck), ["vertragsbestaetigung"]);
  assert.equal(akte!.kunde!.flaechenAngaben, undefined);
  assert.deepEqual((await store.dateienListen(`portal/dokumente/kunde/${S1}/`)).sort(), [`portal/dokumente/kunde/${S1}/DOK-V1.pdf`]);

  // Kundenzugang und Alltag sehen die Akte nicht mehr
  assert.equal(await S.ladeKunde(S1), null);
  assert.deepEqual(await S.kundenFuerEmail("karl@example.com"), []);
  assert.ok(!(await S.alleKunden()).some((x) => x.id === S1));

  // Vorgang bleibt gesperrt, gekürzt um Mails an Karl ohne Vertragsbezug und seine Meldungen
  const v = await S.ladeVorgang(key);
  assert.ok(v?.sperre);
  assert.deepEqual(v!.sperre!.parteien, ["suchender"]);
  assert.equal(v!.sperre!.bis, "2034-12-31");
  assert.deepEqual(v!.mails.map((m) => m.zweck), ["freigabe"]);
  assert.equal(v!.meldungen.length, 0);
  assert.equal(v!.provisionen.length, 1);
  const { zustand } = await store.readZustand();
  assert.ok(zustand.paare[key]);
  assert.equal(zustand.paare[key].notiz, undefined);

  // Grabstein ohne Personendaten, mit gesperrten Posten
  const g = zustand.geloescht?.[S1];
  assert.equal(g?.gesperrt.length, 2);
  assert.doesNotMatch(JSON.stringify(g), /Karl|Käufer|karl@|998877|Hofweg/);

  // Personendaten nur noch in Sperrakte, Vertrags-PDF und gesperrtem Vorgang (Vertragskorrespondenz)
  const erlaubt = (rel: string) => rel === `portal/gesperrt/${S1}.json` || rel === `portal/dokumente/kunde/${S1}/DOK-V1.pdf` || rel === `portal/vorgaenge/${key}.json`;
  assert.deepEqual(fundstellen(/Karl Käufer|karl@example\.com|998877|Hofweg/, erlaubt), []);
  // Die Gegenseite bleibt unberührt
  assert.ok(await S.ladeKunde(A2));
  assert.ok(await ladeLead(A2));
  // Gesperrtes bleibt absichtlich — danach gibt es nichts mehr zu tun (kein „Löschen fortsetzen“)
  assert.equal((await L.loeschPlan(S1)).vorhanden, false);
  const r2 = await L.vorgangLoeschen(S1, "admin@example.com");
  assert.ok(r2.ok && r2.grabstein.geloeschtAm === g!.geloeschtAm);
});

test("Vorgang in Abwicklung: Löschen gesperrt, nichts verändert", async () => {
  const A3 = "LL-OTTO1";
  const G3 = "LL-PAUL1";
  const key = `${A3}~${G3}`;
  await anfrage(A3, { name: "Otto Offen", email: "otto@example.com" });
  await anfrage(G3, { intent: "Fläche gesucht (Pacht)", name: "Paul Pacht", email: "paul@example.com" });
  await store.mutateZustand("admin@example.com", (z) => {
    z.paare[key] = { status: "abschluss" };
  });
  await S.aendereVorgang(key, "pacht", (v) => {
    v.abschluss = { am: "2026-09-01T10:00:00Z", grundlage: "pachtvertrag" };
    v.provisionen.push({ id: "P-2", grundlage: "pachtvertrag", art: "pacht", bemessung: 1000, konditionen: null, netto: 1000, ustProzent: 19, brutto: 1190, entstandenAm: "2026-09-01T10:00:00Z", faelligAm: "2026-09-15", status: "faellig", verlauf: [] });
  });
  const plan = await L.loeschPlan(A3);
  assert.equal(plan.blockiert.length, 1);
  assert.match(plan.blockiert[0].gruende.join(" "), /Provision noch offen \(Fällig\)/);
  const r = await L.vorgangLoeschen(A3, "admin@example.com");
  assert.equal(r.ok, false);
  assert.ok(await ladeLead(A3), "Anfrage unverändert");
  assert.equal((await store.readZustand()).zustand.geloescht?.[A3], undefined);
});

test("Abgebrochener Lauf lässt sich fortsetzen (Kennungen aus dem Auftrag)", async () => {
  const X = "LL-RESTE1";
  await anfrage(X, { name: "Rita Rest", email: "rita@example.com" });
  await S.aendereKunde(X, () => undefined, () => M.neuerKunde(X, "anbieter", "pacht", "rita@example.com", "admin"));
  // Wie nach einem Abbruch: Auftrag geschrieben, Anfrage-Datei schon weg, Akte noch da.
  await store.jsonAendern(`admin/loeschung/${X}.json`, () => ({ v: 1, id: X, von: "admin@example.com", gestartet: "2026-09-27T10:00:00Z", kennungen: { texte: ["Rita Rest", "rita@example.com"], telefone: [] }, emails: ["rita@example.com"], ortTexte: [], receivedAt: "2026-09-10T09:00:00.000Z", art: "Angebot · Pacht (Verpachten)", status: "Neu", postfachKeys: [] }), () => undefined);
  await store.dateienLoeschen(await store.leadPfade(X));
  const plan = await L.loeschPlan(X);
  assert.ok(plan.vorhanden);
  const r = await L.vorgangLoeschen(X, "admin@example.com");
  assert.ok(r.ok && r.grabstein.stand === "fertig", JSON.stringify(r));
  assert.equal(r.ok && r.grabstein.art, "Angebot · Pacht (Verpachten)");
  assert.equal(await S.ladeKunde(X), null);
  assert.deepEqual(await S.kundenFuerEmail("rita@example.com"), []);
  assert.equal((await store.dateienListen(`admin/loeschung/${X}`)).length, 0);
  assert.deepEqual(fundstellen(/Rita Rest|rita@example\.com/), []);
});
