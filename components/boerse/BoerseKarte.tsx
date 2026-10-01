import Link from "next/link";
import { DETAIL_FELDER, artText, haText, paketGroesse, type BoerseEintrag } from "@/lib/boerse-regeln";

type Karte = Pick<BoerseEintrag, "code" | "art" | "typ" | "groesseHa" | "lage" | "text"> & Partial<Pick<BoerseEintrag, "details" | "paket">>;

function Details({ a }: { a: Karte }) {
  const felder = DETAIL_FELDER.filter((f) => a.details?.[f.key]);
  if (!felder.length) return null;
  return (
    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {felder.map((f) => (
        <div key={f.key} className="contents">
          <dt className="text-[color:var(--color-muted)]">{f.label}</dt>
          <dd className="text-[color:var(--color-ink-soft)]">{a.details![f.key]}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Ein anonymes Angebot der Flächenbörse — oder ein Paket mehrerer Flächen desselben Eigentümers
 * (`teile`). Ohne Namen, Flurstück oder genaue Lage; Größen gerundet.
 */
export default function BoerseKarte({ a, teile, mitLink = true }: { a: Karte; teile?: Karte[]; mitLink?: boolean }) {
  const paket = teile && teile.length > 1 ? teile : null;
  const groesse = paket ? paketGroesse(paket as BoerseEintrag[]) : a.groesseHa;
  return (
    <article className="card flex flex-col" aria-label={paket ? `Paket mit ${paket.length} Flächen` : `Angebot ${a.code}`}>
      <p className="eyebrow">
        {artText(a.art).eyebrow} · {paket ? `Paket aus ${paket.length} Flächen` : a.code}
      </p>
      <h3 className="mt-2 font-serif text-2xl">
        {a.typ || "Fläche"}, {paket ? `zusammen ${haText(groesse)}` : haText(groesse)}
      </h3>
      <p className="mt-1 text-[color:var(--color-ink-soft)]">{a.lage || "Kreis Lippe"}</p>
      {a.text && <p className="mt-3 text-[color:var(--color-ink-soft)] leading-relaxed">{a.text}</p>}
      <Details a={a} />
      {paket && (
        <ul className="mt-3 text-sm text-[color:var(--color-ink-soft)] space-y-0.5">
          {paket.map((t) => (
            <li key={t.code}>
              {t.code}: {haText(t.groesseHa)}
            </li>
          ))}
          <li className="text-[color:var(--color-muted)]">Einzeln oder zusammen {a.art === "pacht" ? "zu pachten" : "zu kaufen"}.</li>
        </ul>
      )}
      <p className="mt-3 text-xs text-[color:var(--color-muted)]">Eigentümer und genaue Lage nennen wir erst nach Vertragsabschluss und Zustimmung des Eigentümers.</p>
      {mitLink && (
        <div className="mt-auto pt-5">
          <Link
            href={paket ? `/flaechenboerse/${a.code}?paket=1` : `/flaechenboerse/${a.code}`}
            prefetch={false}
            className="btn-primary"
            title={paket ? `Interesse am Paket (${paket.map((t) => t.code).join(", ")}) anmelden — unverbindlich` : `Interesse an Angebot ${a.code} anmelden — unverbindlich, Provision nur bei Erfolg`}
          >
            Interesse anmelden
          </Link>
        </div>
      )}
    </article>
  );
}
