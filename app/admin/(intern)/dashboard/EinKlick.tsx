"use client";

import { useEffect, useRef, useTransition } from "react";
import type { AssistentState } from "../../assistent-actions";
import { ergebnisLoeschen, ergebnisSetzen, useErgebnis, useFrischesErgebnis } from "../ergebnisse";

// Ein-Klick-Knöpfe im Dashboard ohne Rückfrage (nichts wird verschickt, alles ist
// umkehrbar): Vorschlag vormerken bzw. verwerfen, Anfrage auf „In Arbeit“ oder
// „Archiv“. Das Ergebnis erscheint dort, wo es hingehört (`ziel`): bei der neuen
// Karte bzw. über der Liste — nicht in der Adresse, also nicht erneut nach dem Neuladen.

export function EinKlick({
  aktion,
  werte,
  knopf,
  tipp,
  klasse,
  ziel,
}: {
  aktion: (fd: FormData) => Promise<AssistentState>;
  werte: Record<string, string>;
  knopf: string;
  tipp: string;
  klasse: string;
  ziel: string;
}) {
  const [pending, starten] = useTransition();
  return (
    <button
      type="button"
      className={klasse}
      title={tipp}
      disabled={pending}
      onClick={() =>
        starten(async () => {
          const fd = new FormData();
          for (const [k, v] of Object.entries(werte)) fd.set(k, v);
          ergebnisSetzen(ziel, await aktion(fd));
        })
      }
    >
      {pending ? "Einen Moment …" : knopf}
    </button>
  );
}

/** Rückmeldung für einen Abschnitt (z. B. „Neue Vorschläge“) — mit Schließen-Knopf. */
export function AbschnittErgebnis({ ziel }: { ziel: string }) {
  const e = useErgebnis(ziel);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Neue Rückmeldung ins Bild holen (z. B. oben, wenn die Karte weiter unten verschwunden ist).
    if (e?.am) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [e?.am]);
  if (!e) return null;
  return (
    <div ref={ref} className={`lfa-hinweis lfa-assistent-ergebnis ${e.status === "ok" ? "lfa-hinweis-ok" : "lfa-hinweis-fehler"}`} role="status">
      <div className="lfa-assistent-ergebnis-kopf">
        <strong>{e.titel}</strong>
        <button type="button" className="lfa-assistent-zu" onClick={() => ergebnisLoeschen(ziel)} title="Rückmeldung ausblenden" aria-label="Rückmeldung ausblenden">
          ×
        </button>
      </div>
      <ul className="lfa-assistent-zeilen">
        {e.zeilen.map((z, i) => (
          <li key={i} className={`lfa-assistent-zeile-${z.art}`}>
            {z.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Klappt den umgebenden Abschnitt (details) auf, sobald eine seiner Karten gerade ein
 * Ergebnis bekommen hat — z. B. nach „Vorgang beenden“ oder „Als bezahlt markieren“
 * wandert die Karte nach „Abgeschlossen & beendet“ und soll dort sichtbar bleiben.
 */
export function AufklappenBeiErgebnis({ keys }: { keys: string[] }) {
  const ref = useRef<HTMLSpanElement>(null);
  const frisch = useFrischesErgebnis(keys);
  const erledigt = useRef<string | null>(null);
  useEffect(() => {
    if (!frisch || frisch === erledigt.current) return;
    erledigt.current = frisch;
    const details = ref.current?.closest("details");
    if (details && !details.open) details.open = true;
    const key = frisch.slice(0, frisch.lastIndexOf("|"));
    document.getElementById(key)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [frisch]);
  return <span ref={ref} hidden />;
}
