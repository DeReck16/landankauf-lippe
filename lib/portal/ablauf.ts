import "server-only";
import { einmalMarker, listLeads, mailDrosseln, readZustand } from "@/lib/admin/store";
import { leadView, type LeadView, type Zustand } from "@/lib/admin/model";
import { dokumentHash } from "@/lib/vertraege/hash";
import type { Dokument } from "@/lib/vertraege/dokument";
import { FIRMA, FIRMA_ANSCHRIFT } from "@/lib/vertraege/firma";
import { site } from "@/lib/site";
import { VORLAGEN, istFreigegeben, kundenVorlage, type VorlageId } from "@/lib/vertraege/vorlagen";
import { dokumentBytes, pdfAblegen, protokollDokument } from "./dokumente";
import { adminInfo, kundenMail, type Anhang } from "./mail";
import * as M from "./model";
import { aendereKunde, alleKunden, ladeKunde } from "./speicher";
import * as T from "./texte";
import { einladungBis, einladungToken, loginToken, neueNonce, pruefeEinladung, pruefeLogin, pruefeZugang, zugangToken } from "./token";

// Abläufe rund um den einzelnen Kunden: Einladung, Anmeldung, Angaben,
// Online-Unterschrift, Vertragsbestätigung, Widerruf, Kündigung, Sperre.

/** Monate Provisionsschutz für weitere Flächen desselben Anbieters (Nachweisvertrag § 3 Abs. 4). */
export const SCHUTZ_MONATE = 24;

export const GRUSS = [
  "Mit freundlichen Grüßen",
  "Lippe Forst",
  "",
  `${FIRMA.name} · ${FIRMA.strasse} · ${FIRMA.plz} ${FIRMA.ort}`,
  `${FIRMA.registergericht} ${FIRMA.registernummer} · Geschäftsführer: ${FIRMA.geschaeftsfuehrer}`,
].join("\n");

/** Link in die Verwaltung für Ereignis-Mails (immer die kanonische Domain). */
export function verwaltungsLink(pfad: string): string {
  return `${site.url}${pfad}`;
}

export async function ladeLead(id: string): Promise<{ lead: LeadView; zustand: Zustand } | null> {
  const [leads, { zustand }] = await Promise.all([listLeads(), readZustand()]);
  const roh = leads.find((l) => l.id === id);
  return roh ? { lead: leadView(roh, zustand.anfragen[id]), zustand } : null;
}

// ---------------------------------------------------------------------------
// Vertragstext des Kunden (Nachweisvertrag bzw. Anbietervereinbarung)

export type KundenVertragEntwurf = {
  vorlageId: VorlageId;
  version: string;
  titel: string;
  dok: Dokument;
  hash: string;
  konditionen: M.VertragsKonditionen | null;
  eigenschaft: M.Eigenschaft;
  provisionKurz: string;
};

export function kundenVertragEntwurf(k: M.KundeRecord, l: LeadView, e: M.Einstellungen): KundenVertragEntwurf {
  const vorlageId = kundenVorlage(k.rolle, k.art);
  const vorlage = VORLAGEN[vorlageId];
  const eigenschaft = k.stammdaten?.eigenschaft ?? "verbraucher";
  const partei = T.parteiText(k, l);
  let dok: Dokument;
  let konditionen: M.VertragsKonditionen | null = null;
  let provisionKurz = "keine";
  if (k.rolle === "anbieter") {
    const flaechen = (k.flaechen ?? []).map(T.flaecheZeile);
    if (flaechen.length === 0 && (T.wert(l.flurstueck) || T.wert(l.ort))) {
      flaechen.push(`laut Anfrage: ${[T.wert(l.ort), T.wert(l.flurstueck)].filter(Boolean).join(", ")}`);
    }
    dok = vorlage.render({ eigenschaft, art: k.art, kunde: partei, vorgang: k.id, angebot: T.angebotText(l), flaechen });
  } else {
    konditionen = M.aktuelleKonditionen(e);
    const andere: M.Art = k.art === "pacht" ? "kauf" : "pacht";
    const verbraucher = eigenschaft === "verbraucher";
    provisionKurz = M.konditionenText(k.art, konditionen);
    dok = vorlage.render({
      eigenschaft,
      kunde: partei,
      vorgang: k.id,
      suchprofil: T.suchprofilText(l),
      provision: provisionKurz,
      provisionBrutto: M.bruttoText(k.art, konditionen),
      provisionAndere: `${M.konditionenText(andere, konditionen)}${verbraucher ? `, Gesamtbetrag ${M.bruttoText(andere, konditionen)}` : ""}`,
      konditionenVersion: `Nr. ${konditionen.version}`,
      schutzMonate: String(SCHUTZ_MONATE),
    });
  }
  return { vorlageId, version: vorlage.version, titel: vorlage.titel, dok, hash: dokumentHash(dok), konditionen, eigenschaft, provisionKurz };
}

// ---------------------------------------------------------------------------
// Einladung und Zugang

export async function kundeSicherstellen(lead: LeadView, von: string): Promise<M.KundeRecord> {
  const rr = T.rolleVonLead(lead);
  const email = T.wert(lead.email).toLowerCase();
  if (!rr) throw new Error("Die Anfrage ist weder als Angebot noch als Gesuch (mit Kauf/Pacht) eingeordnet.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Die Anfrage hat keine gültige E-Mail-Adresse.");
  const name = T.wert(lead.name).trim().slice(0, 200) || undefined;
  return aendereKunde(
    lead.id,
    (k) => {
      // Solange nicht unterschrieben ist, folgt der Kunde der (evtl. korrigierten) Einordnung.
      if (k.vertrag) return false;
      if (k.rolle === rr.rolle && k.art === rr.art && k.email === email && k.name === name) return false;
      k.rolle = rr.rolle;
      k.art = rr.art;
      k.email = email;
      if (name) k.name = name;
      else delete k.name;
    },
    () => {
      const k = M.neuerKunde(lead.id, rr.rolle, rr.art, email, von);
      if (name) k.name = name;
      M.ereignis(k, von, "kunde-angelegt", `Kundenakte angelegt (${M.ROLLE_NAME[rr.rolle]}, ${rr.art === "kauf" ? "Kauf" : "Pacht"})`);
      return k;
    },
  );
}

export async function einladungErstellen(lead: LeadView, von: string): Promise<M.KundeRecord> {
  await kundeSicherstellen(lead, von);
  const nonce = neueNonce();
  const bis = einladungBis().toISOString();
  return aendereKunde(lead.id, (k) => {
    if (k.vertrag) return false;
    k.einladung = { nonce, bis, erstelltAm: new Date().toISOString(), von };
    M.ereignis(k, von, "einladung-erstellt", `Persönlicher Einladungslink erstellt (gültig bis ${T.datumDe(bis)}; ältere Links sind damit ungültig)`);
  });
}

export async function einladungZurueckziehen(kundeId: string, von: string): Promise<void> {
  await aendereKunde(kundeId, (k) => {
    if (!k.einladung) return false;
    delete k.einladung;
    M.ereignis(k, von, "einladung-zurueckgezogen", "Einladungslink ungültig gemacht");
  });
}

export function einladungsLink(k: M.KundeRecord, basis: string): string | null {
  if (!k.einladung || k.vertrag) return null;
  const token = einladungToken(k.id, k.rolle, k.einladung.nonce, new Date(k.einladung.bis));
  return `${basis}/kunde/einladung?t=${encodeURIComponent(token)}`;
}

/** Zugangslink für Mails der Verwaltung (Freigabe, Pachtvertrag): 14 Tage, einmal einlösbar. */
/** Direktzugang zum Kundenbereich; mit Vorgangs-Schlüssel landet der Kunde gleich im Vorgang. */
export function zugangsLink(k: M.KundeRecord, basis: string, vorgangKey?: string): string {
  const ziel = vorgangKey && /^LL-[A-Z0-9]+~LL-[A-Z0-9]+$/.test(vorgangKey) ? `&v=${encodeURIComponent(vorgangKey)}` : "";
  return `${basis}/kunde/anmelden/bestaetigen?z=${encodeURIComponent(zugangToken(k.id).token)}${ziel}`;
}

export type EinladungPruefung =
  | { ok: true; kunde: M.KundeRecord }
  | { ok: false; grund: "ungueltig" | "abgelaufen" | "unterschrieben" | "gesperrt" };

export async function einladungPruefen(token: string): Promise<EinladungPruefung> {
  const t = pruefeEinladung(token);
  if (!t) return { ok: false, grund: "abgelaufen" };
  const k = await ladeKunde(t.k);
  if (!k || !k.einladung || k.einladung.nonce !== t.n || k.rolle !== t.r) return { ok: false, grund: "ungueltig" };
  if (k.gesperrt) return { ok: false, grund: "gesperrt" };
  if (k.vertrag) return { ok: false, grund: "unterschrieben" };
  return { ok: true, kunde: k };
}

/** Einladung annehmen: markiert „geöffnet“ (beim ersten Mal mit Meldung an die Verwaltung). */
export async function einladungAnnehmen(token: string): Promise<EinladungPruefung> {
  const pr = await einladungPruefen(token);
  if (!pr.ok) return pr;
  let erstesMal = false;
  const k = await aendereKunde(pr.kunde.id, (x) => {
    if (!x.einladung || x.einladung.angenommenAm) return false;
    x.einladung.angenommenAm = new Date().toISOString();
    erstesMal = true;
    M.ereignis(x, "kunde", "einladung-geoeffnet", "Einladung angenommen — Kundenbereich betreten");
  });
  if (erstesMal) {
    await adminInfo(`Einladung angenommen: ${k.stammdaten?.name || k.email} (${k.id})`, [
      `${M.ROLLE_NAME[k.rolle]} ${k.id} hat den persönlichen Link geöffnet und den Kundenbereich betreten.`,
    ], verwaltungsLink(`/admin/anfrage/${k.id}`));
  }
  return { ok: true, kunde: k };
}

/** Zugangslink einlösen (einmalig). */
export async function zugangEinloesen(token: string): Promise<M.KundeRecord | null> {
  const t = pruefeZugang(token);
  if (!t) return null;
  const k = await ladeKunde(t.k);
  if (!k || k.gesperrt) return null;
  if (!(await einmalMarker(`portal/auth/zugang/${t.n}.json`))) return null;
  return k;
}

/** Anmeldelink per E-Mail anfordern — Antwort immer neutral. */
export async function anmeldelinkSenden(email: string, basis: string): Promise<void> {
  const adresse = email.trim().toLowerCase();
  const kunden = (await alleKunden()).filter((k) => k.email === adresse && !k.gesperrt);
  if (kunden.length === 0) return;
  if (!(await mailDrosseln(`kunde:${adresse}`))) return;
  const { token, bis } = loginToken(adresse);
  const link = `${basis}/kunde/anmelden/bestaetigen?t=${encodeURIComponent(token)}`;
  const uhr = bis.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  await kundenMail({
    an: adresse,
    ohneBcc: true,
    betreff: "Ihr Anmeldelink für den Kundenbereich von Lippe Forst",
    text: [
      "Guten Tag,",
      "",
      "hier ist Ihr Anmeldelink für den Kundenbereich von Lippe Forst:",
      "",
      link,
      "",
      `Der Link gilt bis ${uhr} Uhr und nur einmal. Haben Sie keinen Link angefordert, können Sie diese E-Mail ignorieren.`,
      "",
      GRUSS,
    ].join("\n"),
  });
}

export async function loginEinloesen(token: string): Promise<string | null> {
  const t = pruefeLogin(token);
  if (!t) return null;
  if (!(await einmalMarker(`portal/auth/login/${t.n}.json`))) return null;
  return t.e;
}

// ---------------------------------------------------------------------------
// Angaben und Unterschrift

export async function angabenSpeichern(kundeId: string, s: Omit<M.Stammdaten, "geaendertAm">, flaechen: M.Flaeche[] | null): Promise<M.KundeRecord> {
  return aendereKunde(kundeId, (k) => {
    const erstmals = !k.stammdaten;
    const eigenschaftFest = k.vertrag?.eigenschaft;
    k.stammdaten = { ...s, eigenschaft: eigenschaftFest ?? s.eigenschaft, geaendertAm: new Date().toISOString() };
    if (flaechen && k.rolle === "anbieter") k.flaechen = flaechen;
    M.ereignis(k, "kunde", "angaben", erstmals ? "Angaben (Stammdaten) erfasst" : "Angaben geändert");
  });
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type Herkunft = { ip: string; userAgent: string; sitzung: string };

export async function kundenvertragUnterschreiben(opts: {
  kunde: M.KundeRecord;
  lead: LeadView;
  einstellungen: M.Einstellungen;
  name: string;
  textHash: string;
  erklaerungen: { id: string; text: string }[];
  beginnwunsch: boolean;
  herkunft: Herkunft;
}): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const { kunde, lead, einstellungen } = opts;
  if (kunde.vertrag) return { ok: false, fehler: "Der Vertrag ist bereits unterschrieben." };
  if (!kunde.stammdaten) return { ok: false, fehler: "Bitte zuerst Ihre Angaben vervollständigen." };
  const entwurf = kundenVertragEntwurf(kunde, lead, einstellungen);
  if (!istFreigegeben(einstellungen, entwurf.vorlageId)) {
    return { ok: false, fehler: "Die Vertragsvorlage ist gerade nicht freigegeben. Bitte melden Sie sich bei uns — wir kümmern uns darum." };
  }
  if (entwurf.hash !== opts.textHash) {
    return { ok: false, fehler: "Der Vertragstext hat sich inzwischen geändert (z. B. durch geänderte Angaben). Bitte lesen Sie ihn noch einmal und unterschreiben Sie dann." };
  }
  const jetzt = new Date().toISOString();
  const signatur: M.Signatur = {
    name: opts.name,
    email: kunde.email,
    am: jetzt,
    ip: opts.herkunft.ip,
    userAgent: opts.herkunft.userAgent,
    textHash: entwurf.hash,
    vorlageId: entwurf.vorlageId,
    vorlageVersion: entwurf.version,
    erklaerungen: opts.erklaerungen,
    sitzung: opts.herkunft.sitzung,
  };
  const dokumentId = M.kurzId("DOK");
  const rolleText = kunde.rolle === "anbieter" ? "Anbieter" : "Auftraggeber";
  const { meta, bytes } = await pdfAblegen({
    eigentuemer: { typ: "kunde", id: kunde.id },
    art: kunde.rolle === "anbieter" ? "anbietervereinbarung" : "maklervertrag",
    titel: entwurf.dok.titel,
    dateiname: `${slug(entwurf.dok.titel)}-${kunde.id}.pdf`,
    teile: [{ dok: entwurf.dok }, { dok: protokollDokument(dokumentId, [{ rolle: `${rolleText}: ${opts.name}`, s: signatur }]), neueSeite: true }],
    fusszeile: `Vorlage ${entwurf.vorlageId} v${entwurf.version} · SHA-256 Vertragstext ${entwurf.hash.slice(0, 16)}…`,
    sichtbarFuer: [kunde.rolle],
    von: "kunde",
    version: entwurf.version,
    dokumentId,
  });
  const widerruf = kunde.rolle === "suchender" && entwurf.eigenschaft === "verbraucher";
  let doppelt = false;
  const k = await aendereKunde(kunde.id, (x) => {
    if (x.vertrag) {
      doppelt = true;
      return false;
    }
    x.vertrag = {
      vorlageId: entwurf.vorlageId,
      version: entwurf.version,
      titel: entwurf.dok.titel,
      dokumentId,
      signatur,
      eigenschaft: entwurf.eigenschaft,
      beginnwunschAm: widerruf && opts.beginnwunsch ? jetzt : null,
      widerrufsfristEnde: widerruf ? M.widerrufsfristEnde(jetzt) : null,
      bestaetigungGesendetAm: null,
      konditionen: entwurf.konditionen,
    };
    x.dokumente.unshift(meta);
    M.ereignis(x, "kunde", "vertrag-unterschrieben", `${entwurf.dok.titel} online unterschrieben von „${opts.name}“`);
    if (widerruf && opts.beginnwunsch) M.ereignis(x, "kunde", "beginnwunsch", "Ausdrücklicher Wunsch auf Beginn vor Ablauf der Widerrufsfrist erklärt (§ 356 Abs. 4 BGB)");
  });
  if (doppelt) return { ok: false, fehler: "Der Vertrag ist bereits unterschrieben." };

  // Vertragsbestätigung auf dauerhaftem Datenträger (§ 312f BGB) — ausgelöst durch die Unterschrift.
  await vertragsbestaetigungSenden(k.id, "kunde", bytes);

  await adminInfo(`Vertrag unterschrieben: ${opts.name} (${k.id})`, [
    `${M.ROLLE_NAME[k.rolle]} ${k.id} hat „${entwurf.dok.titel}“ online unterschrieben.`,
    `Handelt als: ${entwurf.eigenschaft === "verbraucher" ? "Verbraucher" : "Unternehmer"}`,
    ...(widerruf ? [`Widerrufsfrist bis: ${T.datumDe(M.widerrufsfristEnde(jetzt))}`, `Beginnwunsch vor Fristende: ${opts.beginnwunsch ? "ja" : "nein"}`] : []),
    ...(entwurf.konditionen ? [`Provision (Konditionen Nr. ${entwurf.konditionen.version}): ${entwurf.provisionKurz}`] : []),
    `PDF: ${meta.dateiname} (SHA-256 ${meta.sha256.slice(0, 16)}…)`,
  ], verwaltungsLink(`/admin/anfrage/${k.id}`));
  return { ok: true };
}

/** Vertragsbestätigung mit PDF an den Kunden senden (Kunde selbst oder Verwaltung löst aus). */
export async function vertragsbestaetigungSenden(kundeId: string, von: string, pdf?: Uint8Array): Promise<boolean> {
  const k = await ladeKunde(kundeId);
  if (!k?.vertrag) return false;
  const doc = k.dokumente.find((d) => d.id === k.vertrag!.dokumentId);
  const bytes = pdf ?? (doc ? await dokumentBytes(doc) : null);
  if (!doc || !bytes) return false;
  const v = k.vertrag;
  const name = k.stammdaten?.name || v.signatur.name;
  const widerruf = k.rolle === "suchender" && v.eigenschaft === "verbraucher";
  const zeilen = [
    `Guten Tag ${name},`,
    "",
    `vielen Dank — Ihr Vertrag „${v.titel}“ ist am ${T.datumZeitDe(v.signatur.am)} online zustande gekommen. Im Anhang finden Sie den vollständigen Vertragstext als PDF mit Unterschriftsprotokoll${widerruf ? ", der Widerrufsbelehrung und dem Muster-Widerrufsformular" : ""}.`,
    "",
  ];
  if (widerruf) {
    zeilen.push(
      `Sie können den Vertrag bis zum ${T.datumDe(v.widerrufsfristEnde)} ohne Angabe von Gründen widerrufen — im Kundenbereich über „Vertrag widerrufen“ oder formlos per E-Mail an ${FIRMA.email} bzw. per Post an ${FIRMA_ANSCHRIFT}.`,
      "",
    );
  }
  zeilen.push(
    k.rolle === "suchender"
      ? `So geht es weiter: Passende Flächen stellen wir Ihnen zuerst anonym vor. Erst wenn Sie und der Eigentümer zustimmen, geben wir die Kontaktdaten frei. Eine Provision fällt nur an, wenn ein ${k.art === "kauf" ? "Kaufvertrag" : "Pachtvertrag"} zustande kommt.`
      : "So geht es weiter: Wir stellen Ihre Fläche passenden Interessenten zunächst anonym vor. Ihre Kontaktdaten geben wir erst weiter, wenn Sie dem konkreten Interessenten zugestimmt haben. Für Sie entstehen keine Kosten.",
    "",
    `Ihr Kundenbereich: ${site.url}/kunde`,
    "",
    GRUSS,
  );
  const betreff = `Ihr Vertrag mit Lippe Forst — Bestätigung und Vertragstext (${k.id})`;
  const text = zeilen.join("\n");
  const anhang: Anhang = { dateiname: doc.dateiname, inhalt: bytes };
  const r = await kundenMail({ an: k.email, betreff, text, anhaenge: [anhang] });
  await aendereKunde(k.id, (x) => {
    x.mails.unshift({ id: M.kurzId("M"), am: new Date().toISOString(), von, an: x.email, betreff, text, zweck: "vertragsbestaetigung", test: r.test, ok: r.ok, fehler: r.fehler, anhang: doc.dateiname });
    if (r.ok && x.vertrag && !x.vertrag.bestaetigungGesendetAm) x.vertrag.bestaetigungGesendetAm = new Date().toISOString();
    M.ereignis(x, von, "bestaetigung", r.ok ? `Vertragsbestätigung mit PDF an ${x.email} gesendet${r.test ? " (Testmodus: nur protokolliert)" : ""}` : `Vertragsbestätigung NICHT gesendet: ${r.fehler ?? "Fehler"}`);
  });
  return r.ok;
}

export async function beginnwunschErklaeren(kundeId: string): Promise<void> {
  const k = await aendereKunde(kundeId, (x) => {
    if (!x.vertrag || x.vertrag.beginnwunschAm || x.widerruf) return false;
    x.vertrag.beginnwunschAm = new Date().toISOString();
    M.ereignis(x, "kunde", "beginnwunsch", "Ausdrücklicher Wunsch auf Beginn vor Ablauf der Widerrufsfrist im Kundenbereich erklärt (§ 356 Abs. 4 BGB)");
  });
  await adminInfo(`Beginnwunsch erklärt: ${k.stammdaten?.name || k.email} (${k.id})`, [
    "Der Kunde möchte, dass schon vor Ablauf der Widerrufsfrist begonnen wird. Eine Freigabe ist damit (bei Zustimmung beider Seiten) möglich.",
  ], verwaltungsLink(`/admin/anfrage/${k.id}`));
}

// ---------------------------------------------------------------------------
// Widerruf, Kündigung, Sperre

const EINGANG_TEXT: Record<M.Eingang, string> = {
  online: "online im Kundenbereich",
  email: "per E-Mail",
  post: "per Post",
  telefon: "telefonisch",
  sonstig: "auf sonstigem Weg",
};

export async function widerrufErfassen(kundeId: string, eingang: M.Eingang, von: string, notiz: string): Promise<M.KundeRecord> {
  const k = await aendereKunde(kundeId, (x) => {
    if (!x.vertrag || x.widerruf) return false;
    x.widerruf = { am: new Date().toISOString(), eingang, erfasstVon: von, ...(notiz ? { notiz } : {}) };
    M.ereignis(x, von, "widerruf", `Widerruf ${EINGANG_TEXT[eingang]} eingegangen${notiz ? `: ${notiz}` : ""}`);
  });
  await aufGleicheVereinbarung(k, "widerruf", von);
  if (eingang === "online" && k.widerruf) {
    const name = k.stammdaten?.name || k.vertrag?.signatur.name || "";
    const betreff = `Eingangsbestätigung Ihres Widerrufs (${k.id})`;
    const text = [
      `Guten Tag ${name},`,
      "",
      "wir bestätigen den Eingang Ihres Widerrufs:",
      "",
      `Eingang: ${T.datumZeitDe(k.widerruf.am)}`,
      `Inhalt Ihrer Erklärung: Widerruf des Vertrags „${k.vertrag?.titel}“ (Vorgang ${k.id}, online unterschrieben am ${T.datumDe(k.vertrag?.signatur.am)})${notiz ? ` — ${notiz}` : ""}`,
      "",
      "Wir geben ab sofort keine Kontaktdaten mehr weiter und stellen Ihnen keine Flächen mehr vor. Zahlungen haben Sie an uns nicht geleistet; es ist nichts zu erstatten.",
      "",
      GRUSS,
    ].join("\n");
    const r = await kundenMail({ an: k.email, betreff, text });
    await aendereKunde(k.id, (x) => {
      x.mails.unshift({ id: M.kurzId("M"), am: new Date().toISOString(), von: "system", an: x.email, betreff, text, zweck: "widerruf-bestaetigung", test: r.test, ok: r.ok, fehler: r.fehler });
      if (x.widerruf && r.ok) x.widerruf.bestaetigtAm = new Date().toISOString();
    });
  }
  await adminInfo(`WIDERRUF: ${k.stammdaten?.name || k.email} (${k.id})`, [
    `${M.ROLLE_NAME[k.rolle]} ${k.id} hat den Vertrag widerrufen (${EINGANG_TEXT[eingang]}).`,
    "Keine Freigaben mehr für diesen Kunden. Bereits freigegebene Kontakte bitte prüfen.",
    ...(notiz ? [`Notiz: ${notiz}`] : []),
  ], verwaltungsLink(`/admin/anfrage/${k.id}`));
  return k;
}

/**
 * Anbieter mit mehreren Flächen teilen eine Vereinbarung (gleiche dokumentId, lib/portal/anbieter-gruppe.ts):
 * Widerruf bzw. Kündigung über eine Anfrage gilt für alle Anfragen mit derselben Vereinbarung.
 */
async function aufGleicheVereinbarung(k: M.KundeRecord, art: "widerruf" | "kuendigung", von: string): Promise<void> {
  const dok = k.vertrag?.dokumentId;
  const erkl = k[art];
  if (!dok || !erkl) return;
  for (const x of await alleKunden()) {
    if (x.id === k.id || x.vertrag?.dokumentId !== dok || x[art]) continue;
    await aendereKunde(x.id, (y) => {
      if (!y.vertrag || y[art]) return false;
      y[art] = { ...erkl };
      M.ereignis(y, von, art, `${art === "widerruf" ? "Widerruf" : "Kündigung"} der Vereinbarung über Anfrage ${k.id} — gilt auch für diese Fläche (gleiche Vereinbarung)`);
    }).catch((err) => console.error("[ablauf] gleiche Vereinbarung nicht angepasst", x.id, err));
  }
}

export async function kuendigungErfassen(kundeId: string, eingang: M.Eingang, von: string, notiz: string): Promise<M.KundeRecord> {
  const k = await aendereKunde(kundeId, (x) => {
    if (!x.vertrag || x.kuendigung || x.widerruf) return false;
    x.kuendigung = { am: new Date().toISOString(), eingang, erfasstVon: von, ...(notiz ? { notiz } : {}) };
    M.ereignis(x, von, "kuendigung", `Kündigung ${EINGANG_TEXT[eingang]} eingegangen${notiz ? `: ${notiz}` : ""}`);
  });
  await aufGleicheVereinbarung(k, "kuendigung", von);
  if (eingang === "online" && k.kuendigung) {
    const name = k.stammdaten?.name || k.vertrag?.signatur.name || "";
    const betreff = `Bestätigung Ihrer Kündigung (${k.id})`;
    const text = [
      `Guten Tag ${name},`,
      "",
      "wir bestätigen den Eingang Ihrer Kündigung:",
      "",
      `Abgegeben am: ${T.datumZeitDe(k.kuendigung.am)}`,
      `Inhalt Ihrer Erklärung: Kündigung des Vertrags „${k.vertrag?.titel}“ (Vorgang ${k.id}, online unterschrieben am ${T.datumDe(k.vertrag?.signatur.am)})${notiz ? ` — ${notiz}` : ""}`,
      `Das Vertragsverhältnis endet: sofort, am ${T.datumZeitDe(k.kuendigung.am)}.`,
      "",
      "Wir stellen Ihnen ab sofort keine neuen Flächen bzw. Interessenten mehr vor.",
      k.rolle === "suchender"
        ? "Für Flächen, die wir Ihnen vor der Kündigung nachgewiesen haben, gelten die Regeln des Vertrags weiter (Provision nur, wenn Sie darüber einen Vertrag schließen)."
        : "Ihre Einwilligung in die Weitergabe Ihrer Daten endet mit der Kündigung; bereits erfolgte Weitergaben bleiben davon unberührt.",
      "",
      "Ihre Unterlagen bleiben im Kundenbereich abrufbar.",
      "",
      GRUSS,
    ].join("\n");
    const r = await kundenMail({ an: k.email, betreff, text });
    await aendereKunde(k.id, (x) => {
      x.mails.unshift({ id: M.kurzId("M"), am: new Date().toISOString(), von: "system", an: x.email, betreff, text, zweck: "kuendigung-bestaetigung", test: r.test, ok: r.ok, fehler: r.fehler });
      if (x.kuendigung && r.ok) x.kuendigung.bestaetigtAm = new Date().toISOString();
    });
  }
  await adminInfo(`Kündigung: ${k.stammdaten?.name || k.email} (${k.id})`, [
    `${M.ROLLE_NAME[k.rolle]} ${k.id} hat gekündigt (${EINGANG_TEXT[eingang]}).`,
    ...(notiz ? [`Notiz: ${notiz}`] : []),
  ], verwaltungsLink(`/admin/anfrage/${k.id}`));
  return k;
}

export async function zugangSperren(kundeId: string, von: string, sperren: boolean): Promise<void> {
  await aendereKunde(kundeId, (k) => {
    if (sperren) {
      if (k.gesperrt) return false;
      const jetzt = new Date().toISOString();
      k.gesperrt = { am: jetzt, von };
      k.zugangAb = jetzt;
      M.ereignis(k, von, "gesperrt", "Zugang zum Kundenbereich gesperrt (alle Sitzungen beendet)");
    } else {
      if (!k.gesperrt) return false;
      delete k.gesperrt;
      M.ereignis(k, von, "entsperrt", "Zugang zum Kundenbereich wieder freigegeben");
    }
  });
}
