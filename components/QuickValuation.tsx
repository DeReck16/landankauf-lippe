"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  valuate,
  flaechenTypOptions,
  qualityOptions,
  gemeindeOptions,
  type FlaechenTyp,
  type ValuationInput,
} from "@/lib/valuation";

const eur = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const eurM2 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function QuickValuation({ compact = false }: { compact?: boolean }) {
  const [typ, setTyp] = useState<FlaechenTyp>("ackerland");
  const [groesseStr, setGroesseStr] = useState("1.0");
  const [gemeinde, setGemeinde] = useState<string>("Detmold");
  const [qualitaet, setQualitaet] =
    useState<NonNullable<ValuationInput["qualitaet"]>>("durchschnitt");

  const groesseHa = useMemo(() => {
    const v = parseFloat(groesseStr.replace(",", "."));
    return Number.isFinite(v) && v > 0 ? v : 0;
  }, [groesseStr]);

  const result = useMemo(() => {
    if (groesseHa <= 0) return null;
    return valuate({ typ, groesseHa, gemeinde, qualitaet });
  }, [typ, groesseHa, gemeinde, qualitaet]);

  return (
    <div className={compact ? "" : "card"}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <p className="eyebrow">Sofort-Indikation</p>
          <h3 className="font-serif text-2xl mt-1">Was könnte meine Fläche bringen?</h3>
        </div>
        <span className="text-xs text-[color:var(--color-muted)]">100 % anonym · keine Daten gespeichert</span>
      </div>

      <div className="mt-5 grid sm:grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor="qv-typ">Flächentyp</label>
          <select
            id="qv-typ"
            value={typ}
            onChange={(e) => setTyp(e.target.value as FlaechenTyp)}
            className="field-select"
          >
            {flaechenTypOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="qv-groesse">Größe (Hektar)</label>
          <input
            id="qv-groesse"
            inputMode="decimal"
            value={groesseStr}
            onChange={(e) => setGroesseStr(e.target.value)}
            className="field-input"
            placeholder="z. B. 1,5"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="qv-gemeinde">Gemeinde / Lage</label>
          <select
            id="qv-gemeinde"
            value={gemeinde}
            onChange={(e) => setGemeinde(e.target.value)}
            className="field-select"
          >
            {gemeindeOptions.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="qv-quali">Qualität / Bestand</label>
          <select
            id="qv-quali"
            value={qualitaet}
            onChange={(e) => setQualitaet(e.target.value as NonNullable<ValuationInput["qualitaet"]>)}
            className="field-select"
          >
            {qualityOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {result ? (
        <div className="mt-6 rounded-xl bg-[color:var(--color-brand)] text-white p-5">
          <p className="text-xs uppercase tracking-wider text-[color:var(--color-accent)]">Indikative Bandbreite</p>
          <p className="font-serif text-3xl md:text-4xl mt-1">
            {eur.format(result.totalRange[0])} € – {eur.format(result.totalRange[1])} €
          </p>
          <p className="mt-2 text-sm text-white/80">
            entspricht {eurM2.format(result.perM2Range[0])} €/m² – {eurM2.format(result.perM2Range[1])} €/m² · {groesseHa.toLocaleString("de-DE")} ha
          </p>
          <p className="mt-3 text-xs text-white/70 leading-relaxed">
            {result.hint} Diese Indikation ist <strong>kein Verkehrswertgutachten</strong> — sie basiert auf öffentlichen Bodenrichtwerten und tatsächlich gezahlten Kaufpreisen 2024 im Kreis Lippe und ist als Orientierung zu verstehen.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/kontakt" className="btn-on-dark">
              Genaue Bewertung anfragen
            </Link>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-[color:var(--color-muted)]">Bitte eine gültige Größe eingeben.</p>
      )}

      <details className="mt-4 text-xs text-[color:var(--color-muted)]">
        <summary className="cursor-pointer">Datenbasis &amp; Hinweise</summary>
        {result && (
          <>
            <p className="mt-2 leading-relaxed">{result.basis}</p>
            <ul className="mt-2 list-disc pl-4 space-y-1">
              {result.sources.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p className="mt-2 leading-relaxed">
              Eingaben werden <strong>ausschließlich im Browser</strong> verarbeitet. Es findet keine Übermittlung an unseren Server statt — wir sehen nicht, welche Werte Sie eingeben.
            </p>
          </>
        )}
      </details>
    </div>
  );
}
