import { NextResponse } from "next/server";
import { hasBlobToken } from "@/lib/admin/config";
import { aktionPruefen, boardAktion, boardLesen, rechteFuer } from "@/lib/api/board";
import { zugangPruefen } from "@/lib/api/zugang";

// Board der Verwaltung per API — nur mit API-Zugang (Bearer lfk_…), Rechte siehe lib/api/zugang.ts.
//   GET  ?status=offen|alle  &paare=aktiv|alle            → Anfragen und Paare (ohne Namen/Adressen/Telefon)
//   GET  ?anfrage=LL-…                                    → eine Anfrage mit Paaren (Recht board:details: + Nachricht, Verlauf)
//   POST { aktion:"notiz",  anfrage|paar, text }          → Verlauf-Eintrag
//   POST { aktion:"status", anfrage, status }             → neu | in_arbeit | beantwortet (| erledigt | archiv)
//   POST { aktion:"paar",   angebot, gesuch, status }     → vorgemerkt | verworfen
//   POST { aktion:"boerse", anfrage, was:"offline" }      → Börsen-Angebot offline nehmen
//   POST { aktion:"boerse", anfrage, was:"aendern", typ?, groesseHa?, lage?, text?, details? } → öffentliche Angaben anpassen
// Keine Mails, keine Einladungen, keine Freigaben, keine Börse, kein Löschen.

export const runtime = "nodejs";
export const maxDuration = 60;

const KEIN_CACHE = { "cache-control": "no-store" };
const BODY_MAX = 20_000;

/** Body höchstens `max` Byte lesen — auch ohne Content-Length (chunked) wird abgebrochen, bevor alles im Speicher liegt. null = zu groß. */
async function bodyBegrenzt(request: Request, max: number): Promise<string | null> {
  const leser = request.body?.getReader();
  if (!leser) return "";
  const teile: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    n += value.length;
    if (n > max) {
      await leser.cancel();
      return null;
    }
    teile.push(value);
  }
  return Buffer.concat(teile).toString("utf8");
}

function fehler(status: number, text: string) {
  return NextResponse.json({ ok: false, fehler: text }, { status, headers: KEIN_CACHE });
}

export async function GET(request: Request) {
  const pruefung = await zugangPruefen(request, "board:lesen");
  if (!pruefung.ok) return fehler(pruefung.status, pruefung.fehler);
  if (!hasBlobToken()) return fehler(503, "Kein Speicher verbunden.");
  const q = new URL(request.url).searchParams;
  const anfrage = q.get("anfrage") ?? undefined;
  if (anfrage && !/^LL-[A-Z0-9]+$/.test(anfrage)) return fehler(400, "Anfrage-ID ungültig.");
  const details = pruefung.zugang.rechte.includes("board:details");
  const daten = await boardLesen({
    status: q.get("status") === "alle" ? "alle" : "offen",
    paare: q.get("paare") === "alle" ? "alle" : "aktiv",
    anfrage,
    details: Boolean(anfrage) && details,
  });
  if (!daten) return fehler(404, "Anfrage nicht gefunden.");
  return NextResponse.json({ ok: true, ...daten }, { headers: KEIN_CACHE });
}

export async function POST(request: Request) {
  // Erst nur der Schlüssel; das Recht hängt von der Aktion ab.
  const grund = await zugangPruefen(request);
  if (!grund.ok) return fehler(grund.status, grund.fehler);
  if (!hasBlobToken()) return fehler(503, "Kein Speicher verbunden.");
  const text = await bodyBegrenzt(request, BODY_MAX);
  if (text === null) return fehler(413, "Anfrage zu groß.");
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return fehler(400, "Kein gültiges JSON.");
  }
  const p = aktionPruefen(roh);
  if (!p.ok) return fehler(400, p.fehler);
  const rechte = rechteFuer(p.aktion);
  if (!rechte.some((r) => grund.zugang.rechte.includes(r))) return fehler(403, `Recht fehlt: ${rechte.join(" oder ")}`);
  const r = await boardAktion(p.aktion, grund.von, grund.zugang.id);
  return r.ok ? NextResponse.json({ ok: true, text: r.text }, { headers: KEIN_CACHE }) : fehler(r.status, r.fehler);
}
