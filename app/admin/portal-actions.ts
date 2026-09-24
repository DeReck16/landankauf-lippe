"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/session";
import { mutateZustand } from "@/lib/admin/store";
import { VORLAGEN, VORLAGEN_REIHENFOLGE, istVorlageId, kundenVorlage, istFreigegeben, vorlageHash } from "@/lib/vertraege/vorlagen";
import * as A from "@/lib/portal/ablauf";
import * as V from "@/lib/portal/vorgang";
import * as M from "@/lib/portal/model";
import { SPERRE_UNTERSCHRIFT, beideUnterschrieben } from "@/lib/portal/schritte";
import { MAIL_ZWECKE, type MailZweck } from "@/lib/portal/entwuerfe";
import { kundenMail } from "@/lib/portal/mail";
import { aendereEinstellungen, aendereKunde, aendereVorgang, istKundeId, istPaarKey, ladeEinstellungen, ladeKunde, ladeVorgang, markiereGesehen } from "@/lib/portal/speicher";

// Server Actions der Verwaltung für Onboarding, Vorgänge, Verträge, Provision
// und Einstellungen. Jede Action prüft die Anmeldung selbst (requireAdmin).

function feld(fd: FormData, key: string, max = 4000): string {
  return String(fd.get(key) ?? "").trim().slice(0, max);
}

function zahl(raw: string): number | null {
  const s = raw.replace(/\s/g, "").replace(/€/g, "");
  if (!s) return null;
  const n = Number(/,/.test(s) ? s.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function datumFeld(fd: FormData, key: string): string {
  const s = feld(fd, key, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

/** Nur Ziele innerhalb der Verwaltung (kein offener Redirect). */
function zurueckZiel(fd: FormData): string {
  const s = feld(fd, "zurueck", 200);
  return /^\/admin(\/[A-Za-z0-9_~%-]+)*$/.test(s) ? s : "/admin";
}

function zurueck(fd: FormData, meldung: string, art: "ok" | "fehler" = "ok", anker = ""): never {
  revalidatePath("/admin", "layout");
  const ziel = zurueckZiel(fd);
  const a = /^[A-Za-z0-9_~-]{1,80}$/.test(anker) ? `#${anker}` : "";
  redirect(`${ziel}?m=${encodeURIComponent(meldung)}&mt=${art}${a}`);
}

function kundeId(fd: FormData): string {
  const id = feld(fd, "kunde", 40);
  if (!istKundeId(id)) throw new Error("Ungültige Anfrage-ID");
  return id;
}

function paarKey(fd: FormData): string {
  const key = feld(fd, "key", 80);
  if (!istPaarKey(key)) throw new Error("Ungültiger Vorgang");
  return key;
}

function rolle(fd: FormData): M.Rolle {
  return feld(fd, "rolle", 20) === "anbieter" ? "anbieter" : "suchender";
}

function eingang(fd: FormData): M.Eingang {
  const e = feld(fd, "eingang", 20);
  return (["online", "email", "post", "telefon", "sonstig"] as const).includes(e as M.Eingang) ? (e as M.Eingang) : "email";
}

// ---------------------------------------------------------------------------
// Onboarding je Kunde

export async function einladungErstellenAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const id = kundeId(fd);
  const geladen = await A.ladeLead(id);
  if (!geladen) zurueck(fd, "Anfrage nicht gefunden.", "fehler");
  const { lead } = geladen;
  const e = await ladeEinstellungen();
  if (!lead.art || (lead.rolle !== "angebot" && lead.rolle !== "gesuch")) {
    zurueck(fd, "Die Anfrage ist nicht als Angebot oder Gesuch mit Kauf/Pacht eingeordnet (rechts unter „Angaben fürs Matching“).", "fehler");
  }
  const vorlage = kundenVorlage(lead.rolle === "angebot" ? "anbieter" : "suchender", lead.art);
  if (!istFreigegeben(e, vorlage)) {
    zurueck(fd, `Die Vorlage „${VORLAGEN[vorlage].titel}“ ist noch nicht freigegeben (Verwaltung → Vorlagen). Ohne Freigabe kann niemand unterschreiben.`, "fehler");
  }
  try {
    await A.einladungErstellen(lead, email);
  } catch (err) {
    zurueck(fd, err instanceof Error ? err.message : "Einladung nicht möglich.", "fehler");
  }
  zurueck(fd, "Einladungslink erstellt. Entwurf unten prüfen und senden — oder den Link kopieren.", "ok", "kundenbereich");
}

export async function einladungZurueckziehenAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  await A.einladungZurueckziehen(kundeId(fd), email);
  zurueck(fd, "Einladungslink ungültig gemacht.", "ok", "kundenbereich");
}

export async function zugangSperrenAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const sperren = feld(fd, "sperren", 2) === "1";
  await A.zugangSperren(kundeId(fd), email, sperren);
  zurueck(fd, sperren ? "Zugang gesperrt — alle Sitzungen des Kunden sind beendet." : "Zugang wieder freigegeben.", "ok", "kundenbereich");
}

export async function widerrufErfassenAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  await A.widerrufErfassen(kundeId(fd), eingang(fd), email, feld(fd, "notiz", 500));
  zurueck(fd, "Widerruf erfasst. Keine Freigaben mehr für diesen Kunden.", "ok", "kundenbereich");
}

export async function kuendigungErfassenAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  await A.kuendigungErfassen(kundeId(fd), eingang(fd), email, feld(fd, "notiz", 500));
  zurueck(fd, "Kündigung erfasst.", "ok", "kundenbereich");
}

/** Widerspruch gegen Bewertungs-E-Mails erfassen (z. B. Antwort „bitte keine Mails“). */
export async function bewertungsWiderspruchAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  await aendereKunde(kundeId(fd), (k) => {
    if (k.bewertungsWiderspruch) return false;
    k.bewertungsWiderspruch = { am: new Date().toISOString(), von: email };
    M.ereignis(k, email, "bewertung-widerspruch", "Widerspruch gegen Bewertungs-E-Mails erfasst — es werden keine mehr vorgeschlagen");
  });
  zurueck(fd, "Widerspruch vermerkt: keine Bewertungs-E-Mails mehr an diesen Kunden.", "ok", "kundenbereich");
}

export async function bestaetigungSendenAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const ok = await A.vertragsbestaetigungSenden(kundeId(fd), email);
  zurueck(fd, ok ? "Vertragsbestätigung mit PDF gesendet." : "Senden fehlgeschlagen — siehe Verlauf.", ok ? "ok" : "fehler", "kundenbereich");
}

// ---------------------------------------------------------------------------
// Vorgang: Zustimmung, Freigabe

export async function zustimmungErfassenAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const key = paarKey(fd);
  const r = rolle(fd);
  const an = feld(fd, "an", 2) === "1";
  const art: M.Art = feld(fd, "art", 10) === "kauf" ? "kauf" : "pacht";
  const erg = await V.zustimmungSetzen(key, art, r, email, an);
  if (!erg.ok) zurueck(fd, erg.fehler ?? "Nicht möglich.", "fehler", key);
  zurueck(fd, an ? `Zustimmung ${M.ROLLE_ARTIKEL[r].gen} erfasst.` : `Zustimmung ${M.ROLLE_ARTIKEL[r].gen} zurückgenommen.`, "ok", key);
}

export async function freigebenAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const key = paarKey(fd);
  const r = await V.freigeben(key, email);
  if (!r.ok) zurueck(fd, `Freigabe nicht möglich: ${r.fehler}`, "fehler", key);
  zurueck(fd, "Kontakt freigegeben. Bitte jetzt die beiden Freigabe-Mitteilungen senden (Entwürfe im Vorgang).", "ok", key);
}

export async function freigabeZurueckziehenAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const key = paarKey(fd);
  const r = await V.freigabeZurueckziehen(key, email, feld(fd, "grund", 300));
  if (!r.ok) zurueck(fd, r.fehler ?? "Nicht möglich.", "fehler", key);
  zurueck(fd, "Freigabe zurückgezogen — Kontaktdaten im Kundenbereich wieder verborgen.", "ok", key);
}

// ---------------------------------------------------------------------------
// Pachtvertrag

function flaechenAusFormular(fd: FormData): M.Flaeche[] {
  const gem = fd.getAll("f_gemarkung").map(String);
  const flur = fd.getAll("f_flur").map(String);
  const fst = fd.getAll("f_flurstueck").map(String);
  const ha = fd.getAll("f_ha").map(String);
  const nutz = fd.getAll("f_nutzung").map(String);
  const out: M.Flaeche[] = [];
  for (let i = 0; i < Math.min(gem.length, 40); i++) {
    const f: M.Flaeche = {
      gemarkung: gem[i]?.trim().slice(0, 80) ?? "",
      flur: flur[i]?.trim().slice(0, 20) ?? "",
      flurstueck: fst[i]?.trim().slice(0, 40) ?? "",
      groesseHa: zahl(ha[i] ?? ""),
      nutzung: nutz[i]?.trim().slice(0, 60) ?? "",
    };
    if (f.gemarkung || f.flur || f.flurstueck || f.groesseHa != null) out.push(f);
  }
  return out;
}

function staffelAusText(raw: string): { pachtjahr: number; betrag: number }[] {
  return raw
    .split(/\n|;/)
    .map((z) => z.match(/^\s*(\d{1,2})\s*[:.=-]\s*([\d.,\s]+)/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => ({ pachtjahr: Number(m[1]), betrag: zahl(m[2]) ?? -1 }))
    .filter((s) => s.pachtjahr >= 1 && s.pachtjahr <= 30 && s.betrag >= 0)
    .slice(0, 30);
}

export async function pachtSpeichernAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const key = paarKey(fd);
  const laufzeit = zahl(feld(fd, "laufzeitJahre", 5));
  const daten: M.PachtDaten = {
    verpaechter: { name: feld(fd, "vp_name", 120), anschrift: feld(fd, "vp_anschrift", 200) },
    paechter: { name: feld(fd, "p_name", 120), anschrift: feld(fd, "p_anschrift", 200), betrieb: feld(fd, "p_betrieb", 120) },
    flaechen: flaechenAusFormular(fd),
    nutzungsart: feld(fd, "nutzungsart", 80),
    pachtBeginn: datumFeld(fd, "pachtBeginn"),
    laufzeitJahre: laufzeit && laufzeit > 0 ? Math.min(30, Math.round(laufzeit)) : null,
    pachtjahr: feld(fd, "pachtjahr", 20) === "kalenderjahr" ? "kalenderjahr" : "wirtschaftsjahr",
    pachtzinsJeHa: zahl(feld(fd, "pachtzinsJeHa", 20)),
    pachtzinsJahr: zahl(feld(fd, "pachtzinsJahr", 20)),
    staffel: staffelAusText(feld(fd, "staffel", 600)),
    zahlweise: feld(fd, "zahlweise", 20) === "halbjaehrlich" ? "halbjaehrlich" : "jaehrlich",
    faelligkeit: feld(fd, "faelligkeit", 120),
    umsatzsteuer: feld(fd, "umsatzsteuer", 20) === "zuzueglich" ? "zuzueglich" : "ohne",
    kontoinhaber: feld(fd, "kontoinhaber", 120),
    iban: feld(fd, "iban", 40).replace(/\s+/g, " ").toUpperCase(),
    wasserverband: feld(fd, "wasserverband", 20) === "paechter" ? "paechter" : "verpaechter",
    verpflichtungen: feld(fd, "verpflichtungen", 1000),
    besonderes: feld(fd, "besonderes", 2000),
  };
  const art: M.Art = feld(fd, "art", 10) === "kauf" ? "kauf" : "pacht";
  const r = await V.pachtSpeichern(key, art, daten, email);
  if (!r.ok) zurueck(fd, r.fehler ?? "Speichern nicht möglich.", "fehler", "pachtvertrag");
  const luecken = V.pachtLuecken(daten);
  zurueck(fd, luecken.length ? `Entwurf gespeichert. Noch offen: ${luecken.join(", ")}.` : "Entwurf gespeichert — vollständig. Jetzt „Zur Unterschrift freigeben“.", "ok", "pachtvertrag");
}

export async function pachtZurUnterschriftAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const r = await V.pachtZurUnterschrift(paarKey(fd), email);
  if (!r.ok) zurueck(fd, r.fehler ?? "Nicht möglich.", "fehler", "pachtvertrag");
  zurueck(fd, "Pachtvertrag liegt beiden Seiten zur Unterschrift vor. Jetzt die Entwürfe „Pachtvertrag zur Unterschrift“ senden.", "ok", "pachtvertrag");
}

export async function pachtZurueckAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const verwerfen = feld(fd, "verwerfen", 2) === "1";
  await V.pachtZurueck(paarKey(fd), email, verwerfen);
  zurueck(fd, verwerfen ? "Pachtvertrag verworfen." : "Zurück zum Entwurf — bereits geleistete Unterschriften sind ungültig.", "ok", "pachtvertrag");
}

export async function pachtAnzeigeAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const key = paarKey(fd);
  await aendereVorgang(key, "pacht", (x) => {
    if (!x.pachtvertrag || x.pachtvertrag.anzeigeErledigtAm) return false;
    x.pachtvertrag.anzeigeErledigtAm = new Date().toISOString();
    M.ereignis(x, email, "pacht-anzeige", "Anzeige nach § 2 LPachtVG als erledigt vermerkt");
  });
  zurueck(fd, "Pachtanzeige als erledigt vermerkt.", "ok", "pachtvertrag");
}

export async function pachtReparierenAktion(fd: FormData): Promise<void> {
  await requireAdmin();
  const key = paarKey(fd);
  const ctx = await V.ladeVorgangKontext(key);
  const id = ctx?.vorgang?.pachtvertrag?.dokumentId;
  if (id) await V.pachtAbschliessen(key, id);
  zurueck(fd, "Abschluss nachbearbeitet (PDF/Provision).", "ok", "pachtvertrag");
}

// ---------------------------------------------------------------------------
// Kauf

export async function kaufSpeichernAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const key = paarKey(fd);
  const daten: M.KaufDaten = {
    verkaeufer: { name: feld(fd, "vk_name", 120), anschrift: feld(fd, "vk_anschrift", 200) },
    kaeufer: { name: feld(fd, "k_name", 120), anschrift: feld(fd, "k_anschrift", 200), betrieb: feld(fd, "k_betrieb", 120) },
    flaechen: flaechenAusFormular(fd),
    kaufpreis: zahl(feld(fd, "kaufpreis", 20)),
    uebergabe: feld(fd, "uebergabe", 200),
    bestehendePacht: feld(fd, "bestehendePacht", 400),
    notarWunsch: feld(fd, "notarWunsch", 200),
    besonderes: feld(fd, "besonderes", 1500),
  };
  const r = await V.kaufSpeichern(key, daten, email);
  zurueck(fd, r.ok ? "Kaufabsicht gespeichert." : (r.fehler ?? "Nicht möglich."), r.ok ? "ok" : "fehler", "kauf");
}

export async function kaufZurBestaetigungAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const r = await V.kaufZurBestaetigung(paarKey(fd), email);
  zurueck(fd, r.ok ? "Kaufabsicht liegt beiden Seiten zur Bestätigung vor." : (r.fehler ?? "Nicht möglich."), r.ok ? "ok" : "fehler", "kauf");
}

export async function kaufZurueckAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  await V.kaufZurueck(paarKey(fd), email);
  zurueck(fd, "Kaufabsicht zurück zum Entwurf.", "ok", "kauf");
}

export async function kaufNotarAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  await V.kaufNotarSpeichern(paarKey(fd), email, { name: feld(fd, "notar", 200), termin: datumFeld(fd, "termin") });
  zurueck(fd, "Notar gespeichert.", "ok", "kauf");
}

export async function kaufBeurkundetAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const datum = datumFeld(fd, "datum");
  const kaufpreis = zahl(feld(fd, "kaufpreis", 20));
  const g = feld(fd, "genehmigung", 20);
  const genehmigung = (["offen", "nicht_noetig", "beantragt", "erteilt"] as const).includes(g as never) ? (g as "offen") : "offen";
  if (!datum || kaufpreis == null || kaufpreis <= 0) zurueck(fd, "Bitte Datum der Beurkundung und Kaufpreis angeben.", "fehler", "kauf");
  const r = await V.kaufBeurkundet(paarKey(fd), email, { datum, kaufpreis, genehmigung });
  zurueck(fd, r.ok ? "Beurkundung erfasst — Provision angelegt." : (r.fehler ?? "Nicht möglich."), r.ok ? "ok" : "fehler", "kauf");
}

export async function kaufWirksamAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const datum = datumFeld(fd, "datum") || new Date().toISOString().slice(0, 10);
  await V.kaufWirksam(paarKey(fd), email, datum);
  zurueck(fd, "Kaufvertrag wirksam — Provision fällig.", "ok", "kauf");
}

export async function kaufAbbrechenAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  await V.kaufAbbrechen(paarKey(fd), email, feld(fd, "grund", 300));
  zurueck(fd, "Kauf abgebrochen.", "ok", "kauf");
}

// ---------------------------------------------------------------------------
// Externe Abschlüsse, Provision, Gutschein

export async function externErfassenAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const key = paarKey(fd);
  const datum = datumFeld(fd, "datum");
  const betrag = zahl(feld(fd, "betrag", 20));
  if (!datum || betrag == null) zurueck(fd, "Bitte Datum und Jahrespacht bzw. Kaufpreis angeben.", "fehler", "extern");
  const art: M.Art = feld(fd, "art", 10) === "kauf" ? "kauf" : "pacht";
  const r = await V.externErfassen(key, art, email, {
    datum,
    flaecheHa: zahl(feld(fd, "flaeche", 20)),
    betrag,
    quelle: feld(fd, "quelle", 200),
    notiz: feld(fd, "notiz", 1000),
  });
  if (!r.ok) zurueck(fd, r.fehler ?? "Nicht möglich.", "fehler", "extern");
  zurueck(
    fd,
    r.widerrufen
      ? "Vertrag erfasst. Der Suchende hat widerrufen — die Provision ist nur vorgemerkt; bitte prüfen."
      : "Außerhalb geschlossenen Vertrag erfasst — Provision fällig.",
    r.widerrufen ? "fehler" : "ok",
    "provision",
  );
}

export async function provisionStatusAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const s = feld(fd, "status", 20);
  if (!(s in M.PROVISION_STATUS)) zurueck(fd, "Unbekannter Status.", "fehler", "provision");
  await V.provisionStatusSetzen(paarKey(fd), feld(fd, "id", 40), s as M.ProvisionStatus, feld(fd, "notiz", 500), email);
  zurueck(fd, "Provision aktualisiert.", "ok", "provision");
}

export async function gutscheinAnrechnenAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const r = await V.gutscheinAnrechnen(paarKey(fd), feld(fd, "id", 40), feld(fd, "code", 20), email);
  zurueck(fd, r.ok ? "Gutschein angerechnet." : (r.fehler ?? "Nicht möglich."), r.ok ? "ok" : "fehler", "provision");
}

export async function gutscheinStornierenAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  await V.gutscheinStornieren(paarKey(fd), email, feld(fd, "grund", 300));
  zurueck(fd, "Gutschein storniert.", "ok", "provision");
}

// ---------------------------------------------------------------------------
// Vorlagen und Einstellungen

export async function vorlageFreigebenAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const id = feld(fd, "id", 40);
  if (!istVorlageId(id)) zurueck(fd, "Unbekannte Vorlage.", "fehler");
  if (feld(fd, "geprueft", 2) !== "1") zurueck(fd, "Bitte bestätigen, dass die Vorlage geprüft wurde.", "fehler", id);
  const v = VORLAGEN[id];
  const hash = vorlageHash(id);
  await aendereEinstellungen((e) => {
    const liste = e.freigaben[id] ?? [];
    if (liste.some((f) => f.version === v.version && f.hash === hash && !f.zurueckgezogen)) return false;
    liste.unshift({ version: v.version, hash, am: new Date().toISOString(), von: email });
    e.freigaben[id] = liste.slice(0, 50);
  });
  await mutateZustand(email, () => ({ was: `Vorlage „${v.titel}“ (Version ${v.version}) freigegeben`, ref: `vorlage:${id}` }));
  zurueck(fd, `Vorlage „${v.titel}“ freigegeben.`, "ok", id);
}

/** Alle noch nicht freigegebenen Vorlagen in der aktuellen Fassung auf einmal freigeben. */
export async function alleVorlagenFreigebenAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  if (feld(fd, "geprueft", 2) !== "1") zurueck(fd, "Bitte bestätigen, dass die Vorlagen geprüft wurden.", "fehler", "alle-freigeben");
  const am = new Date().toISOString();
  let neu: string[] = [];
  await aendereEinstellungen((e) => {
    neu = []; // bei einer ETag-Wiederholung neu zählen
    for (const id of VORLAGEN_REIHENFOLGE) {
      const v = VORLAGEN[id];
      const hash = vorlageHash(id);
      const liste = e.freigaben[id] ?? [];
      if (liste.some((f) => f.version === v.version && f.hash === hash && !f.zurueckgezogen)) continue;
      liste.unshift({ version: v.version, hash, am, von: email });
      e.freigaben[id] = liste.slice(0, 50);
      neu.push(v.titel);
    }
    if (neu.length === 0) return false;
  });
  if (neu.length > 0) {
    await mutateZustand(email, () => ({ was: `Vorlagen freigegeben: ${neu.join(" · ")}`, ref: "vorlage:alle" }));
  }
  zurueck(
    fd,
    neu.length > 0
      ? `${neu.length} Vorlage${neu.length === 1 ? "" : "n"} freigegeben — Kunden können jetzt online unterschreiben.`
      : "Alle Vorlagen waren bereits freigegeben.",
    "ok",
  );
}

export async function vorlageZurueckziehenAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const id = feld(fd, "id", 40);
  if (!istVorlageId(id)) zurueck(fd, "Unbekannte Vorlage.", "fehler");
  await aendereEinstellungen((e) => {
    const f = (e.freigaben[id] ?? []).find((x) => !x.zurueckgezogen && x.version === VORLAGEN[id].version);
    if (!f) return false;
    f.zurueckgezogen = { am: new Date().toISOString(), von: email };
  });
  await mutateZustand(email, () => ({ was: `Freigabe der Vorlage „${VORLAGEN[id].titel}“ zurückgezogen`, ref: `vorlage:${id}` }));
  zurueck(fd, "Freigabe zurückgezogen — neue Unterschriften sind damit gesperrt.", "ok", id);
}

export async function konditionenAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const pacht = zahl(feld(fd, "pachtJahrespachten", 10));
  const kauf = zahl(feld(fd, "kaufProzent", 10));
  const ust = zahl(feld(fd, "ustProzent", 6));
  if (pacht == null || pacht <= 0 || pacht > 5 || kauf == null || kauf <= 0 || kauf > 15 || ust == null || ust > 30) {
    zurueck(fd, "Bitte plausible Werte eingeben (Pacht 0–5 Jahrespachten, Kauf 0–15 %, USt 0–30 %).", "fehler", "konditionen");
  }
  const neu: M.Konditionen = {
    pachtJahrespachten: pacht,
    kaufProzent: kauf,
    ust: {
      pacht: feld(fd, "ustPacht", 20) === "inklusive" ? "inklusive" : "zuzueglich",
      kauf: feld(fd, "ustKauf", 20) === "inklusive" ? "inklusive" : "zuzueglich",
    },
    ustProzent: ust,
  };
  let geaendert = false;
  await aendereEinstellungen((e) => {
    const alt = M.aktuelleKonditionen(e);
    if (JSON.stringify({ ...alt, version: 0 }) === JSON.stringify({ ...neu, version: 0 })) return false;
    e.konditionenVerlauf = [{ version: alt.version, konditionen: e.konditionen ?? M.STANDARD_KONDITIONEN, am: new Date().toISOString(), von: email }, ...(e.konditionenVerlauf ?? [])].slice(0, 50);
    e.konditionen = neu;
    e.konditionenVersion = alt.version + 1;
    geaendert = true;
  });
  if (geaendert) await mutateZustand(email, () => ({ was: "Provisionskonditionen geändert (gilt nur für neu unterschriebene Verträge)", ref: "einstellungen" }));
  zurueck(fd, geaendert ? "Konditionen gespeichert — neue Version gilt nur für künftig unterschriebene Verträge." : "Keine Änderung.", "ok", "konditionen");
}

export async function bewertungEinstellungAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const url = feld(fd, "url", 400);
  if (url && !/^https:\/\/[^\s]+$/.test(url)) zurueck(fd, "Der Bewertungslink muss mit https:// beginnen.", "fehler", "bewertung");
  const tage = zahl(feld(fd, "nachTagen", 3));
  await aendereEinstellungen((e) => {
    e.bewertung = { url, nachTagen: tage != null ? Math.min(60, Math.max(0, Math.round(tage))) : 3, autoVersand: feld(fd, "autoVersand", 2) === "1" };
  });
  await mutateZustand(email, () => ({ was: "Einstellungen zur Bewertungsbitte geändert", ref: "einstellungen" }));
  zurueck(fd, "Einstellungen zur Bewertungsbitte gespeichert.", "ok", "bewertung");
}

export async function gutscheinEinstellungAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const betrag = zahl(feld(fd, "betrag", 10));
  await aendereEinstellungen((e) => {
    e.gutschein = { aktiv: feld(fd, "aktiv", 2) === "1", betrag: betrag != null ? Math.min(1000, betrag) : 100 };
  });
  await mutateZustand(email, () => ({ was: "Einstellungen zum Treue-Gutschein geändert", ref: "einstellungen" }));
  zurueck(fd, "Gutschein-Einstellung gespeichert.", "ok", "gutschein");
}

// ---------------------------------------------------------------------------
// E-Mail senden (Entwurf aus der Verwaltung) — immer erst nach Klick und Sicherheitsabfrage

export type MailState = { status: "idle" | "ok" | "fehler"; text?: string; am?: string };

export async function mailSendenAktion(_prev: MailState, fd: FormData): Promise<MailState> {
  const { email } = await requireAdmin();
  const zweck = feld(fd, "zweck", 30) as MailZweck;
  if (!MAIL_ZWECKE.includes(zweck)) return { status: "fehler", text: "Unbekannter Zweck." };
  const id = feld(fd, "kunde", 40);
  if (!istKundeId(id)) return { status: "fehler", text: "Ungültige Anfrage." };
  const key = feld(fd, "key", 80);
  if (key && (!istPaarKey(key) || !key.split("~").includes(id))) return { status: "fehler", text: "Ungültiger Vorgang." };
  const an = feld(fd, "an", 200).toLowerCase();
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(an)) return { status: "fehler", text: "Bitte genau eine gültige Empfängeradresse angeben." };
  const betreff = feld(fd, "betreff", 200);
  const text = feld(fd, "text", 20000);
  if (!betreff || !text) return { status: "fehler", text: "Betreff und Text dürfen nicht leer sein." };
  if (/\[Link erscheint/.test(text)) return { status: "fehler", text: "Im Text fehlt noch der persönliche Link — erst „Einladung erstellen“." };
  const r = rolle(fd);

  const geladen = await A.ladeLead(id);
  if (!geladen) return { status: "fehler", text: "Anfrage nicht gefunden." };
  let kunde = await ladeKunde(id);
  if (!kunde) {
    try {
      kunde = await A.kundeSicherstellen(geladen.lead, email);
    } catch (err) {
      return { status: "fehler", text: err instanceof Error ? err.message : "Kundenakte nicht anlegbar." };
    }
  }

  // Serverseitige Sperren (der Knopf ist im Entwurf schon deaktiviert — hier noch einmal prüfen):
  // Anonyme Hinweise erst, wenn beide unterschrieben haben (Schritt 3 vor Schritt 4).
  if (zweck === "hinweis") {
    if (!key) return { status: "fehler", text: "Hinweise gehören zu einem Vorgang." };
    const [aId, gId] = key.split("~");
    const [ka, kg] = await Promise.all([ladeKunde(aId), ladeKunde(gId)]);
    if (!beideUnterschrieben(ka, kg)) return { status: "fehler", text: SPERRE_UNTERSCHRIFT };
  }
  // Bewertungsbitte nur mit Einwilligung (§ 7 UWG), Vorgangs-Mitteilungen nicht nach einem Widerruf.
  if (zweck === "bewertung" && !M.bewertungsmailErlaubt(kunde)) {
    return { status: "fehler", text: "Keine Einwilligung in Bewertungs-E-Mails (oder Widerspruch) — nicht gesendet." };
  }
  if (key && (zweck === "freigabe" || zweck === "pachtvertrag" || zweck === "kaufabsicht")) {
    const [aId, gId] = key.split("~");
    const [ka, kg, vg] = await Promise.all([ladeKunde(aId), ladeKunde(gId), ladeVorgang(key)]);
    if ((ka?.widerruf || kg?.widerruf) && !vg?.abschluss) {
      return { status: "fehler", text: "Eine Seite hat ihren Vertrag widerrufen — diese Mitteilung wird nicht mehr gesendet." };
    }
  }

  const res = await kundenMail({ an, betreff, text });
  const jetzt = new Date().toISOString();
  const eintrag: M.GesendeteMail = { id: M.kurzId("M"), am: jetzt, von: email, an, betreff, text, zweck, test: res.test, ok: res.ok, fehler: res.fehler };

  await aendereKunde(id, (k) => {
    k.mails.unshift(eintrag);
    if (zweck === "einladung" && res.ok && k.einladung) k.einladung.gesendetAm = jetzt;
    M.ereignis(k, email, "mail", `${res.ok ? "E-Mail gesendet" : "E-Mail NICHT gesendet"}: „${betreff}“ an ${an}${res.test ? " (Testmodus)" : ""}`);
  });
  if (key) {
    const art: M.Art = geladen.lead.art === "kauf" ? "kauf" : "pacht";
    await aendereVorgang(key, art, (v) => {
      v.mails.unshift(eintrag);
    });
    if (res.ok && zweck === "hinweis") await V.hinweisVermerken(key, art, r, email);
    if (res.ok && zweck === "bewertung") await V.bewertungVermerken(key, art, r, email);
  }
  // Eine neue Anfrage gilt nach der ersten Antwort als beantwortet.
  if (res.ok && (geladen.lead.status === "neu")) {
    await mutateZustand(email, (z) => {
      const meta = { ...(z.anfragen[id] ?? {}) };
      if ((meta.status ?? "neu") !== "neu") return;
      meta.status = "beantwortet";
      meta.geaendert = { am: jetzt, von: email };
      z.anfragen[id] = meta;
      return { was: "Status → Beantwortet (E-Mail gesendet)", ref: id };
    });
  }
  revalidatePath("/admin", "layout");
  if (!res.ok) return { status: "fehler", text: `Nicht gesendet: ${res.fehler ?? "unbekannter Fehler"}` };
  return { status: "ok", text: res.test ? "Testmodus: nicht versendet, nur protokolliert." : `Gesendet an ${an}.`, am: jetzt };
}

// ---------------------------------------------------------------------------
// „Gesehen“ (für das Pulsieren neuer Dinge)

export async function gesehenAktion(keys: string[]): Promise<void> {
  const { email } = await requireAdmin();
  if (!Array.isArray(keys)) return;
  await markiereGesehen(email, keys.map(String));
}

export async function alleGesehenAktion(fd: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const keys = feld(fd, "keys", 20000).split(",").filter(Boolean);
  await markiereGesehen(email, keys);
  zurueck(fd, "Alles als gesehen markiert.");
}
