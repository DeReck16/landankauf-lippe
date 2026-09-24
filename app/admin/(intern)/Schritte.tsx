import type { Schritt } from "@/lib/portal/schritte";

// Fortschritt eines Vorgangs in sieben festen Schritten (lib/portal/schritte.ts).
// Erledigt = grün mit Haken, aktuell = Akzentfarbe und pulsierend, offen = grau.
// Den nächsten Handgriff erledigt der Assistent (Assistent.tsx).

/** Volle Leiste mit Titel und Stand je Schritt (Vorgangsseite). */
export function SchrittLeiste({ schritte, verworfen }: { schritte: Schritt[]; verworfen?: boolean }) {
  return (
    <ol className={`lfa-schritte ${verworfen ? "lfa-schritte-verworfen" : ""}`} aria-label="Fortschritt des Vorgangs">
      {schritte.map((s) => (
        <li
          key={s.id}
          className={`lfa-schritt lfa-schritt-${s.status}`}
          aria-current={s.status === "aktuell" ? "step" : undefined}
          title={`Schritt ${s.nr} von ${schritte.length}: ${s.titel} — ${s.status === "erledigt" ? "erledigt" : s.status === "aktuell" ? "jetzt dran" : "noch offen, erst nach dem vorigen Schritt"}. ${s.detail}`}
        >
          <span className={`lfa-schritt-nr ${s.status === "aktuell" && !verworfen ? "lfa-puls-ring" : ""}`} aria-hidden>
            {s.status === "erledigt" ? "✓" : s.nr}
          </span>
          <span className="lfa-schritt-text">
            <span className="lfa-schritt-titel">{s.status === "aktuell" && !verworfen ? `Jetzt: ${s.titel}` : s.titel}</span>
            <span className="lfa-schritt-detail">{s.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Kurzform für Listen: „Schritt 3/7 · Titel“ mit sieben Segmenten. */
export function SchrittKurz({ schritte, aktuell, verworfen, beendet }: { schritte: Schritt[]; aktuell: Schritt | null; verworfen?: boolean; beendet?: boolean }) {
  const text = verworfen
    ? "verworfen"
    : beendet
      ? `ohne Abschluss beendet${aktuell ? ` (bei Schritt ${aktuell.nr}/${schritte.length})` : ""}`
      : aktuell
        ? `Schritt ${aktuell.nr}/${schritte.length} · Jetzt: ${aktuell.titel}`
        : "alle Schritte erledigt";
  const tipp = verworfen
    ? "Paar verworfen"
    : beendet
      ? "Vorgang ohne Abschluss beendet — über „Wieder aufnehmen“ geht es an dieser Stelle weiter"
      : aktuell
        ? `Jetzt dran: ${aktuell.titel} — ${aktuell.naechstes ?? aktuell.detail}`
        : "Alle Schritte erledigt";
  return (
    <span className="lfa-schritt-kurz" title={tipp}>
      <span className="lfa-schritt-segmente" aria-hidden>
        {schritte.map((s) => (
          <span key={s.id} className={`lfa-segment lfa-segment-${verworfen || (beendet && s.status === "aktuell") ? "offen" : s.status}`} />
        ))}
      </span>
      <span className="lfa-klein">{text}</span>
    </span>
  );
}
