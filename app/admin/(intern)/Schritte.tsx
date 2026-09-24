import type { Schritt } from "@/lib/portal/schritte";

// Fortschritt eines Vorgangs in sieben festen Schritten (lib/portal/schritte.ts).
// Erledigt = grün mit Haken, aktuell = Akzentfarbe und pulsierend, offen = grau.

/** Volle Leiste mit Titel und Stand je Schritt (Vorgangsseite). */
export function SchrittLeiste({ schritte, verworfen }: { schritte: Schritt[]; verworfen?: boolean }) {
  return (
    <ol className={`lfa-schritte ${verworfen ? "lfa-schritte-verworfen" : ""}`} aria-label="Fortschritt des Vorgangs">
      {schritte.map((s) => (
        <li
          key={s.id}
          className={`lfa-schritt lfa-schritt-${s.status}`}
          aria-current={s.status === "aktuell" ? "step" : undefined}
          title={`Schritt ${s.nr} von ${schritte.length}: ${s.titel} — ${s.status === "erledigt" ? "erledigt" : s.status === "aktuell" ? "jetzt dran" : "noch gesperrt, erst nach dem vorigen Schritt"}. ${s.detail}`}
        >
          <span className={`lfa-schritt-nr ${s.status === "aktuell" ? "lfa-puls-ring" : ""}`} aria-hidden>
            {s.status === "erledigt" ? "✓" : s.nr}
          </span>
          <span className="lfa-schritt-text">
            <span className="lfa-schritt-titel">{s.titel}</span>
            <span className="lfa-schritt-detail">{s.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Kasten „Jetzt dran“ mit dem nächsten Handgriff. */
export function JetztDran({ aktuell, gesamt, verworfen }: { aktuell: Schritt | null; gesamt: number; verworfen?: boolean }) {
  if (verworfen) {
    return <p className="lfa-hinweis lfa-hinweis-fehler">Dieses Paar ist verworfen — im Matching lässt es sich wieder vorschlagen.</p>;
  }
  if (!aktuell) {
    return <p className="lfa-hinweis lfa-hinweis-ok">Alle {gesamt} Schritte erledigt — Vorgang abgeschlossen und Provision bezahlt.</p>;
  }
  return (
    <div className="lfa-hinweis lfa-jetzt" role="status">
      <strong>
        <span className="lfa-puls" />
        Jetzt dran — Schritt {aktuell.nr} von {gesamt}: {aktuell.titel}
      </strong>
      <div>{aktuell.naechstes}</div>
      <div className="lfa-klein">Stand: {aktuell.detail}</div>
    </div>
  );
}

/** Kurzform für Listen: „Schritt 3/7 · Titel“ mit sieben Segmenten. */
export function SchrittKurz({ schritte, aktuell, verworfen }: { schritte: Schritt[]; aktuell: Schritt | null; verworfen?: boolean }) {
  const text = verworfen ? "verworfen" : aktuell ? `Schritt ${aktuell.nr}/${schritte.length} · ${aktuell.titel}` : "abgeschlossen";
  const tipp = verworfen
    ? "Paar verworfen"
    : aktuell
      ? `Jetzt dran: ${aktuell.titel} — ${aktuell.naechstes ?? aktuell.detail}`
      : "Alle Schritte erledigt";
  return (
    <span className="lfa-schritt-kurz" title={tipp}>
      <span className="lfa-schritt-segmente" aria-hidden>
        {schritte.map((s) => (
          <span key={s.id} className={`lfa-segment lfa-segment-${verworfen ? "offen" : s.status}`} />
        ))}
      </span>
      <span className="lfa-klein">{text}</span>
    </span>
  );
}
