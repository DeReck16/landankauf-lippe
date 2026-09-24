import type { NextRequest } from "next/server";
import { TELEFON } from "@/lib/telefon";

// WhatsApp-Weiterleitung: Alle WhatsApp-Knöpfe der Website zeigen auf
// /whatsapp?text=…, erst hier wird zu wa.me mit der Nummer weitergeleitet.
// So steht die Nummer weder im HTML noch im JavaScript der Seiten.
export function GET(req: NextRequest) {
  const text = (req.nextUrl.searchParams.get("text") ?? "").slice(0, 500);
  const ziel = `https://wa.me/${TELEFON.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: ziel,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
