import { NextResponse } from "next/server";
import { zugangPruefen } from "@/lib/api/zugang";

// Anmeldeprobe für API-Zugänge: GET mit `Authorization: Bearer lfk_…` → Name, Rechte, Ablauf (nie der Schlüssel).
export const runtime = "nodejs";

export async function GET(request: Request) {
  const p = await zugangPruefen(request);
  const kopf = { "cache-control": "no-store" };
  if (!p.ok) return NextResponse.json({ ok: false, fehler: p.fehler }, { status: p.status, headers: kopf });
  const { name, rechte, laeuftAb, erstelltAm } = p.zugang;
  return NextResponse.json({ ok: true, zugang: { name, rechte, laeuftAb, erstelltAm } }, { headers: kopf });
}
