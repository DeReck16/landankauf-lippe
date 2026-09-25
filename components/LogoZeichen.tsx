import { LOGO_FARBEN, LOGO_TANNE } from "@/lib/logo";

/**
 * Bildzeichen von Lippe Forst (Tanne auf goldenem Hügel, lib/logo.ts). `id` muss je
 * Einsatzort auf der Seite eindeutig sein (z. B. „kopf“, „fuss“) — wegen des Clip-Pfads.
 */
export default function LogoZeichen({ id, className }: { id: string; className?: string }) {
  const clip = `lf-logo-${id}`;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      <defs>
        <clipPath id={clip}>
          <rect width="64" height="64" rx="12" />
        </clipPath>
      </defs>
      <rect width="64" height="64" rx="12" fill={LOGO_FARBEN.gruen} />
      <g clipPath={`url(#${clip})`}>
        <circle cx="32" cy="118" r="70" fill={LOGO_FARBEN.gold} />
      </g>
      <path d={LOGO_TANNE} fill={LOGO_FARBEN.creme} />
    </svg>
  );
}
