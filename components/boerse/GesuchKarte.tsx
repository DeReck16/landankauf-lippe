import { haText, type BoerseEintrag } from "@/lib/boerse-regeln";

type Karte = Pick<BoerseEintrag, "code" | "art" | "typ" | "groesseHa" | "lage" | "text">;

/** Ein anonymer Suchauftrag („Gesucht“) der Flächenbörse — ohne Namen und Kontaktdaten, Größe gerundet. */
export default function GesuchKarte({ a, mitLink = true }: { a: Karte; mitLink?: boolean }) {
  return (
    <article className="card flex flex-col" aria-label={`Suchauftrag ${a.code}`}>
      <p className="eyebrow">
        {a.art === "pacht" ? "Zur Pacht gesucht" : "Zum Kauf gesucht"} · {a.code}
      </p>
      <h3 className="mt-2 font-serif text-2xl">
        {a.typ || "Fläche"}
        {a.groesseHa ? `, ${haText(a.groesseHa)}` : ""}
      </h3>
      <p className="mt-1 text-[color:var(--color-ink-soft)]">{a.lage || "Kreis Lippe"}</p>
      {a.text && <p className="mt-3 text-[color:var(--color-ink-soft)] leading-relaxed">{a.text}</p>}
      <p className="mt-3 text-xs text-[color:var(--color-muted)]">Wer sucht, nennen wir nicht — Sie erreichen den Suchenden nur über uns, und nur mit Ihrer Zustimmung.</p>
      {mitLink && (
        <div className="mt-auto pt-5">
          <a href="#flaeche-anbieten" className="btn-primary" title={`Eine passende Fläche zum Suchauftrag ${a.code} anbieten — unverbindlich und für Eigentümer kostenlos`}>
            Passende Fläche anbieten
          </a>
        </div>
      )}
    </article>
  );
}
