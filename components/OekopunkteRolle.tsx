import { OEKOPUNKTE_NICHT, OEKOPUNKTE_TUN } from "@/lib/oekopunkte";

/**
 * Kasten „Was wir bei Ökopunkten tun — und was nicht“. Steht auf den Ökopunkte-Seiten oben, damit sofort klar ist,
 * ob Lippe Forst nur berät/vermittelt oder selbst ein Ökokonto betreibt (Aussagen: lib/oekopunkte.ts).
 */
export default function OekopunkteRolle({ titel = "Kurz und ehrlich: Was wir bei Ökopunkten tun — und was nicht" }: { titel?: string }) {
  return (
    <aside aria-label="Rolle von Lippe Forst bei Ökopunkten" className="rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-brand-soft)] p-5">
      <h2 className="font-serif text-xl md:text-2xl leading-snug">{titel}</h2>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--color-brand-dark)]">Das tun wir</h3>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
            {OEKOPUNKTE_TUN.map((t) => (
              <li key={t} className="flex gap-2">
                <span aria-hidden className="text-[color:var(--color-brand-dark)]">✓</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--color-ink)]">Das tun wir nicht</h3>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed text-[color:var(--color-ink-soft)]">
            {OEKOPUNKTE_NICHT.map((t) => (
              <li key={t} className="flex gap-2">
                <span aria-hidden className="text-[color:var(--color-muted)]">–</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
