import { NextResponse } from "next/server";
import { ladeBoerse } from "@/lib/boerse";

// Wie viele Angebote gerade live in der Flächenbörse stehen — für die pulsierende Zahl an
// „Flächenbörse“ in der Kopfzeile (components/boerse/BoerseZaehler.tsx). Nur Zahlen, keine
// Angebotsdaten; eine Minute gepuffert und beim Veröffentlichen sofort erneuert (boerseNeuSchreiben).
export const revalidate = 60;

export async function GET() {
  const d = await ladeBoerse();
  const pacht = d.angebote.filter((a) => a.art === "pacht").length;
  return NextResponse.json(
    { anzahl: d.angebote.length, pacht, kauf: d.angebote.length - pacht },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300", "X-Robots-Tag": "noindex" } },
  );
}
