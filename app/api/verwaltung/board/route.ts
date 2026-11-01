import { NextResponse } from "next/server";
import { hasBlobToken } from "@/lib/admin/config";
import { aktionPruefen, boardAktion, boardLesen, rechtFuer } from "@/lib/api/board";
import { zugangPruefen } from "@/lib/api/zugang";

// Board der Verwaltung per API — nur mit API-Zugang (Bearer lfk_…), Rechte siehe lib/api/zugang.ts.
//   GET  ?status=offen|alle  &paare=aktiv|alle            → Anfragen und Paare (ohne Namen/Adressen/Telefon)
//   GET  ?anfrage=LL-…                                    → eine Anfrage mit Paaren (Recht board:details: + Nachricht, Verlauf)
//   POST { aktion:"notiz",  anfrage|paar, text }          → Verlauf-Eintrag
//   POST { aktion:"status", anfrage, status }             → neu | in_arbeit | beantwortet (| erledigt | archiv)
//   POST { aktion:"paar",   angebot, gesuch, status }     → vorgemerkt | verworfen
// Keine Mails, keine Einladungen, keine Freigaben, keine Börse, kein Löschen.

export const runtime = "nodejs";
export const maxDuration = 60;

const KEIN_CACHE = { "cache-control": "no-store" };
const BODY_MAX = 20_000;

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
  if (Number(request.headers.get("content-length") ?? 0) > BODY_MAX) return fehler(413, "Anfrage zu groß.");
  let roh: unknown;
  try {
    const text = await request.text();
    if (text.length > BODY_MAX) return fehler(413, "Anfrage zu groß.");
    roh = JSON.parse(text);
  } catch {
    return fehler(400, "Kein gültiges JSON.");
  }
  const p = aktionPruefen(roh);
  if (!p.ok) return fehler(400, p.fehler);
  const recht = rechtFuer(p.aktion);
  if (!grund.zugang.rechte.includes(recht)) return fehler(403, `Recht fehlt: ${recht}`);
  const r = await boardAktion(p.aktion, grund.von, grund.zugang.id);
  return r.ok ? NextResponse.json({ ok: true, text: r.text }, { headers: KEIN_CACHE }) : fehler(r.status, r.fehler);
}
