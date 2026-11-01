import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { drosseln, jsonAendern, jsonLesen, kurzwert } from "@/lib/admin/store";

// API-Zugänge der Verwaltung (Dennis 01.11.2026: „API-Login, um so etwas künftig per API zu steuern“).
//
// Ein Zugang ist ein eigener Schlüssel mit Namen, festen Rechten und Ablaufdatum. Der Schlüssel wird
// nur einmal angezeigt (Verwaltung → API-Zugänge); gespeichert wird nur sein SHA-256-Wert in
// admin/api-zugaenge.json. Aufruf: `Authorization: Bearer lfk_<kennung>_<geheimnis>`. Sperren wirkt sofort
// (die Datei wird bei jedem Aufruf frisch gelesen). Alles, was ein Zugang ändert, steht mit „API: <Name>“
// im Protokoll und im Verlauf der Anfrage.
//
// Bewusst NICHT per API möglich (nur in der Verwaltung, mit Anmeldung): Mails senden, Einladungen,
// Zustimmungen und Freigabe von Kontakten, Börse veröffentlichen, Verträge, Löschen, Einstellungen.

export const RECHTE = {
  "board:lesen": "Anfragen, Paare, offene Rückmeldungen und Kundenstufe lesen (ohne Namen, Adressen, Telefonnummern)",
  "board:details": "Einzelne Anfrage mit Nachricht und Verlauf lesen (weiterhin ohne Kontaktdaten)",
  "board:notiz": "Notizen im Verlauf einer Anfrage oder eines Paares eintragen",
  "board:status": "Status einer Anfrage auf Neu, In Arbeit oder Beantwortet setzen",
  "board:abschliessen": "Anfrage auf Erledigt oder Archiv setzen (nur ohne Angebot in der Börse)",
  "board:paare": "Paare vormerken oder verwerfen (keine Mail, keine Freigabe)",
} as const;
export type Recht = keyof typeof RECHTE;

export function istRecht(x: string): x is Recht {
  return Object.prototype.hasOwnProperty.call(RECHTE, x);
}

export type Zugang = {
  id: string;
  name: string;
  rechte: Recht[];
  /** SHA-256 des Geheimnisses (Hex). Der Schlüssel selbst wird nie gespeichert. */
  hash: string;
  erstelltAm: string;
  erstelltVon: string;
  /** ISO — danach ungültig. */
  laeuftAb: string;
  gesperrtAm?: string;
  gesperrtVon?: string;
  zuletztGenutzt?: string;
  nutzungen: number;
};

/** Zugang ohne Hash — für Anzeige und Antworten. */
export type ZugangInfo = Omit<Zugang, "hash"> & { aktiv: boolean };

type Datei = { v: 1; zugaenge: Record<string, Zugang> };

const PFAD = "admin/api-zugaenge.json";
const FORMAT = /^lfk_([a-f0-9]{10})_([A-Za-z0-9_-]{43})$/;
export const MAX_AKTIVE_ZUGAENGE = 20;
export const MAX_TAGE = 730;
const leer = (): Datei => ({ v: 1, zugaenge: {} });

const hashVon = (geheimnis: string) => createHash("sha256").update(geheimnis).digest("hex");

function gleich(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function istAktiv(z: Zugang, jetzt = Date.now()): boolean {
  return !z.gesperrtAm && Date.parse(z.laeuftAb) > jetzt;
}

function info(z: Zugang): ZugangInfo {
  const kopie: Partial<Zugang> = { ...z };
  delete kopie.hash;
  return { ...(kopie as Omit<Zugang, "hash">), aktiv: istAktiv(z) };
}

export async function zugaengeListe(): Promise<ZugangInfo[]> {
  const datei = (await jsonLesen<Datei>(PFAD))?.daten ?? leer();
  return Object.values(datei.zugaenge)
    .map(info)
    .sort((a, b) => b.erstelltAm.localeCompare(a.erstelltAm));
}

export type AnlegenErgebnis = { ok: true; id: string; schluessel: string; zugang: ZugangInfo } | { ok: false; fehler: string };

export async function zugangAnlegen(von: string, eingabe: { name: string; rechte: string[]; tage: number }): Promise<AnlegenErgebnis> {
  const name = eingabe.name.trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 60) return { ok: false, fehler: "Der Name braucht 3 bis 60 Zeichen." };
  const rechte = [...new Set(eingabe.rechte.filter(istRecht))];
  if (rechte.length === 0) return { ok: false, fehler: "Mindestens ein Recht auswählen." };
  const tage = Math.round(eingabe.tage);
  if (!Number.isFinite(tage) || tage < 1 || tage > MAX_TAGE) return { ok: false, fehler: `Laufzeit: 1 bis ${MAX_TAGE} Tage.` };

  const id = randomBytes(5).toString("hex");
  const geheimnis = randomBytes(32).toString("base64url");
  const jetzt = new Date();
  const zugang: Zugang = {
    id,
    name,
    rechte,
    hash: hashVon(geheimnis),
    erstelltAm: jetzt.toISOString(),
    erstelltVon: von,
    laeuftAb: new Date(jetzt.getTime() + tage * 86_400_000).toISOString(),
    nutzungen: 0,
  };
  let fehler = "";
  await jsonAendern<Datei>(PFAD, leer, (d) => {
    const aktiv = Object.values(d.zugaenge).filter((z) => istAktiv(z)).length;
    if (aktiv >= MAX_AKTIVE_ZUGAENGE) {
      fehler = `Höchstens ${MAX_AKTIVE_ZUGAENGE} aktive Zugänge — erst einen sperren.`;
      return false;
    }
    if (Object.values(d.zugaenge).some((z) => istAktiv(z) && z.name.toLowerCase() === name.toLowerCase())) {
      fehler = "Es gibt schon einen aktiven Zugang mit diesem Namen.";
      return false;
    }
    d.zugaenge[id] = zugang;
  });
  if (fehler) return { ok: false, fehler };
  return { ok: true, id, schluessel: `lfk_${id}_${geheimnis}`, zugang: info(zugang) };
}

export async function zugangSperren(von: string, id: string): Promise<boolean> {
  let gefunden = false;
  await jsonAendern<Datei>(PFAD, leer, (d) => {
    const z = d.zugaenge[id];
    if (!z || z.gesperrtAm) return false;
    z.gesperrtAm = new Date().toISOString();
    z.gesperrtVon = von;
    gefunden = true;
  });
  return gefunden;
}

/** Notschalter (gehört zu „Alle Sitzungen beenden“): sperrt alle noch gültigen Zugänge, damit ein von einem fremden Gerät angelegter Schlüssel nicht überlebt. */
export async function alleZugaengeSperren(von: string): Promise<number> {
  let n = 0;
  await jsonAendern<Datei>(PFAD, leer, (d) => {
    const am = new Date().toISOString();
    for (const z of Object.values(d.zugaenge)) {
      if (z.gesperrtAm) continue;
      z.gesperrtAm = am;
      z.gesperrtVon = von;
      n++;
    }
    if (n === 0) return false;
  });
  return n;
}

export type Pruefung = { ok: true; zugang: ZugangInfo; von: string } | { ok: false; status: 401 | 403 | 429; fehler: string };

function clientKennung(request: Request): string {
  return (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unbekannt";
}

/**
 * Prüft den Schlüssel im Kopf der Anfrage und (optional) ein Recht. Fehlversuche werden je Absender
 * gezählt (zu viele → 429), gültige Aufrufe je Zugang gedrosselt. Die Antwort verrät nicht, ob ein
 * Schlüssel unbekannt, abgelaufen oder gesperrt ist.
 */
export async function zugangPruefen(request: Request, recht?: Recht): Promise<Pruefung> {
  const roh = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const teile = FORMAT.exec(roh);
  const abgelehnt = async (): Promise<Pruefung> => {
    const erlaubt = await drosseln("api-fehl", kurzwert(clientKennung(request), "api"), [{ sekunden: 300, max: 20 }]);
    return erlaubt ? { ok: false, status: 401, fehler: "Zugang ungültig." } : { ok: false, status: 429, fehler: "Zu viele Fehlversuche — später erneut." };
  };
  if (!teile) return abgelehnt();

  const datei = (await jsonLesen<Datei>(PFAD))?.daten ?? leer();
  const z = datei.zugaenge[teile[1]];
  // Immer vergleichen (auch bei unbekannter Kennung), damit die Antwortzeit nichts verrät.
  const passt = gleich(hashVon(teile[2]), z?.hash ?? "0".repeat(64));
  if (!z || !passt || !istAktiv(z)) return abgelehnt();
  if (recht && !z.rechte.includes(recht)) return { ok: false, status: 403, fehler: `Recht fehlt: ${recht}` };

  const frei = await drosseln("api", kurzwert(z.id, "api"), [
    { sekunden: 60, max: 60 },
    { sekunden: 3600, max: 190 },
  ]);
  if (!frei) return { ok: false, status: 429, fehler: "Zu viele Aufrufe — später erneut." };

  // Nutzung vermerken, höchstens alle 10 Minuten (spart Schreibvorgänge).
  if (!z.zuletztGenutzt || Date.now() - Date.parse(z.zuletztGenutzt) > 600_000) {
    await jsonAendern<Datei>(PFAD, leer, (d) => {
      const x = d.zugaenge[z.id];
      if (!x) return false;
      x.zuletztGenutzt = new Date().toISOString();
      x.nutzungen = (x.nutzungen ?? 0) + 1;
    }).catch((err) => console.error("[api] Nutzung nicht vermerkt", err));
  }
  return { ok: true, zugang: info(z), von: `API: ${z.name}` };
}
