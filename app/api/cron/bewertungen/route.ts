import { NextResponse } from "next/server";
import { hasBlobToken } from "@/lib/admin/config";
import { bewertungenAutomatisch } from "@/lib/portal/vorgang";

// Täglicher Vercel-Cron (vercel.json): sendet fällige Bitten um eine
// Google-Bewertung — aber NUR, wenn „automatisch senden“ in der Verwaltung
// eingeschaltet ist (Standard: aus). Ohne Anreiz, an alle Abschlüsse.

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!hasBlobToken()) return NextResponse.json({ gesendet: 0, aus: "Kein Speicher verbunden." });
  const r = await bewertungenAutomatisch(process.env.GOOGLE_REVIEW_URL);
  return NextResponse.json(r);
}
