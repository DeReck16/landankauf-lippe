import { NextResponse, type NextRequest } from "next/server";
import { KUNDE_COOKIE, SESSION_COOKIE } from "@/lib/admin/config";
import { verifySessionToken } from "@/lib/admin/token";

// Vorab-Weiche für /admin und /kunde: ohne Sitzungscookie geht es zur Anmeldung.
// Die eigentliche Prüfung machen Seiten, Routen und Server Actions selbst
// (lib/admin/session.ts, lib/portal/sitzung.ts).

// Im Kundenbereich ohne Anmeldung erreichbar: Einladung, Anmeldung,
// Widerrufsfunktion (§ 356a BGB), Kündigung und die Antwortseite der
// Nachfass-Mail (nur mit persönlichem Antwort-Link).
const KUNDE_OEFFENTLICH = /^\/kunde\/(einladung|anmelden|widerruf|kuendigung|antwort)(\/|$)/;

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/kunde" || pathname.startsWith("/kunde/")) {
    if (KUNDE_OEFFENTLICH.test(pathname) || request.cookies.has(KUNDE_COOKIE)) return NextResponse.next();
    return NextResponse.redirect(new URL("/kunde/anmelden", request.url));
  }

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
  matcher: ["/admin/:path*", "/kunde/:path*"],
};
