import Link from "next/link";
import { haText, type BoerseEintrag } from "@/lib/boerse";

/** Ein anonymes Kaufangebot der Flächenbörse — ohne Namen, Flurstück oder genaue Lage. */
export default function BoerseKarte({ a, mitLink = true }: { a: Pick<BoerseEintrag, "code" | "typ" | "groesseHa" | "lage" | "text">; mitLink?: boolean }) {
  return (
    <article className="card flex flex-col" aria-label={`Angebot ${a.code}`}>
      <p className="eyebrow">
        Zum Kauf · {a.code}
      </p>
      <h3 className="mt-2 font-serif text-2xl">
        {a.typ || "Fläche"}, {haText(a.groesseHa)}
      </h3>
      <p className="mt-1 text-[color:var(--color-ink-soft)]">{a.lage || "Kreis Lippe"}</p>
      {a.text && <p className="mt-3 text-[color:var(--color-ink-soft)] leading-relaxed">{a.text}</p>}
      <p className="mt-3 text-xs text-[color:var(--color-muted)]">Eigentümer und genaue Lage nennen wir erst nach Vertragsabschluss und Zustimmung des Eigentümers.</p>
      {mitLink && (
        <div className="mt-auto pt-5">
          <Link
            href={`/flaechenboerse/${a.code}`}
            prefetch={false}
            className="btn-primary"
            title={`Interesse an Angebot ${a.code} anmelden — unverbindlich, Provision nur bei Erfolg`}
          >
            Interesse anmelden
          </Link>
        </div>
      )}
    </article>
  );
}
