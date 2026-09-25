// Bildzeichen von Lippe Forst: Tanne auf goldenem Hügel (Wald und Land in einem
// Zeichen, gewählt am 25.09.2026). Dieselbe Form steht in app/icon.svg (Favicon),
// app/apple-icon.png, app/favicon.ico, public/icon-512.png (Logo in den
// strukturierten Daten), im Kopf und Fuß der Website (components/LogoZeichen.tsx)
// und im Vorschaubild für geteilte Links (app/opengraph-image.tsx).

export const LOGO_FARBEN = { gruen: "#2f5d3a", gold: "#c89b3c", creme: "#faf8f3" } as const;

/** Umriss der Tanne im 64er-Raster; der Hügel ist ein Kreis (Mitte 32/118, Radius 70), auf die Kachel beschnitten. */
export const LOGO_TANNE =
  "M 32 5 Q 36.5 14.375 44 20 L 38 20 Q 41.75 30 48 36 L 42 36 Q 45.75 43.5 52 48 L 12 48 Q 18.25 43.5 22 36 L 16 36 Q 22.25 30 26 20 L 20 20 Q 27.5 14.375 32 5 Z";

/** Das Zeichen als eigenständige SVG-Datei (z. B. als Bild im Vorschaubild). */
export function logoSvg(): string {
  const f = LOGO_FARBEN;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><clipPath id="k"><rect width="64" height="64" rx="12"/></clipPath></defs><rect width="64" height="64" rx="12" fill="${f.gruen}"/><g clip-path="url(#k)"><circle cx="32" cy="118" r="70" fill="${f.gold}"/></g><path d="${LOGO_TANNE}" fill="${f.creme}"/></svg>`;
}
