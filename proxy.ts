import { NextResponse, type NextRequest } from "next/server";
import { KUNDE_COOKIE, SESSION_COOKIE } from "@/lib/admin/config";
import { verifySessionToken } from "@/lib/admin/token";

// Vorab-Weiche für /admin und /kunde: ohne Sitzungscookie geht es zur Anmeldung.
// Die eigentliche Prüfung machen Seiten, Routen und Server Actions selbst
// (lib/admin/session.ts, lib/portal/sitzung.ts).

// Im Kundenbereich ohne Anmeldung erreichbar: Einladung, Anmeldung,
// Widerrufsfunktion (§ 356a BGB), Kündigung, die Antwortseite der
// Nachfass-Mail, der Widerruf der Börsen-Einwilligung und „Das war nicht ich“
// zu einer Erklärung ohne Anmeldung (jeweils nur mit persönlichem Link).
const KUNDE_OEFFENTLICH = /^\/kunde\/(einladung|anmelden|widerruf|kuendigung|antwort|boerse|erklaerung)(\/|$)/;

/**
 * Content-Security-Policy für Verwaltung und Kundenbereich (Review, Abschnitt 5): Skripte nur mit
 * Nonce je Anfrage (Next setzt sie selbst auf seine Skripte), nichts von fremden Servern, keine
 * Einbettung in fremde Seiten (frame-ancestors 'none'). Inline-Styles bleiben erlaubt — die
 * Oberfläche nutzt style-Attribute, und ein Nonce würde 'unsafe-inline' für Styles aushebeln.
 */
function weiterMitCsp(request: NextRequest): NextResponse {
  // PDF-Abrufe (Route-Handler) ohne CSP: Der PDF-Betrachter des Browsers verträgt „object-src 'none'“ nicht.
  if (/^\/(kunde|admin)\/dokument\//.test(request.nextUrl.pathname)) return NextResponse.next();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
  const kopf = new Headers(request.headers);
  kopf.set("x-nonce", nonce);
  kopf.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: kopf } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/kunde" || pathname.startsWith("/kunde/")) {
    if (KUNDE_OEFFENTLICH.test(pathname) || request.cookies.has(KUNDE_COOKIE)) return weiterMitCsp(request);
    return NextResponse.redirect(new URL("/kunde/anmelden", request.url));
  }

  if (pathname === "/admin/anmelden" || pathname.startsWith("/admin/anmelden/")) {
    return weiterMitCsp(request);
  }
  let angemeldet = false;
  try {
    angemeldet = Boolean(verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value));
  } catch (err) {
    console.error("[verwaltung] Sitzung nicht prüfbar", err);
  }
  if (angemeldet) return weiterMitCsp(request);
  const ziel = new URL("/admin/anmelden", request.url);
  if (pathname !== "/admin") ziel.searchParams.set("weiter", `${pathname}${search}`);
  return NextResponse.redirect(ziel);
}

export const config = {
  matcher: ["/admin/:path*", "/kunde/:path*"],
};
