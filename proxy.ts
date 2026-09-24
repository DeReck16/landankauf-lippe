import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/admin/config";
import { verifySessionToken } from "@/lib/admin/token";

// Vorab-Weiche für /admin: ohne gültiges Sitzungscookie geht es zur Anmeldung.
// Die eigentliche Prüfung machen Seiten und Server Actions selbst (lib/admin/session.ts).

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin/anmelden" || pathname.startsWith("/admin/anmelden/")) {
    return NextResponse.next();
  }
  let angemeldet = false;
  try {
    angemeldet = Boolean(verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value));
  } catch (err) {
    console.error("[verwaltung] Sitzung nicht prüfbar", err);
  }
  if (angemeldet) return NextResponse.next();
  const ziel = new URL("/admin/anmelden", request.url);
  if (pathname !== "/admin") ziel.searchParams.set("weiter", `${pathname}${search}`);
  return NextResponse.redirect(ziel);
}

export const config = {
  matcher: ["/admin/:path*"],
};
