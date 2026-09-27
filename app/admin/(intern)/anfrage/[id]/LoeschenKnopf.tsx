"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { vorgangLoeschenAktion } from "../../../actions";

/** Vorschau fürs Löschen (aus lib/admin/loeschen.ts → loeschPlan) — nur Texte, keine Inhalte der Akte. */
export type LoeschVorschau = {
  loeschen: { was: string; anzahl: number | null }[];
  sperren: { was: string; bis: string; grund: string }[];
  schwaerzen: string[];
  hinweise: string[];
  weitere: string[];
  extern: readonly string[];
  blockiert: { ref: string; gruende: string[] }[];
};

function datum(iso: string): string {
  const [j, m, t] = iso.split("-");
  return t && m && j ? `${t}.${m}.${j}` : iso;
}

function Absenden() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="bestaetigt"
      value="ja"
      className="lfa-knopf lfa-knopf-gefahr lfa-knopf-klein"
      disabled={pending}
      title="Löscht jetzt endgültig, was oben unter „Wird gelöscht“ steht, und sperrt die Verträge — das lässt sich nicht rückgängig machen"
    >
      {pending ? "Wird ausgeführt …" : "Ja – endgültig löschen"}
    </button>
  );
}

function Zurueck({ onClick }: { onClick: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button type="button" className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" disabled={pending} onClick={onClick} title="Nichts löschen, zurück">
      Nein, zurück
    </button>
  );
}

/**
 * „Vorgang endgültig löschen (DSGVO)“ mit Abfrage direkt auf der Seite (kein Browser-Dialog):
 * erst nach „Ja – endgültig löschen“ wird gelöscht. Vorher steht da, was gelöscht und was wegen
 * Aufbewahrungspflicht nur gesperrt wird.
 */
export default function LoeschenKnopf({ id, vorschau, knopfText = "Vorgang endgültig löschen (DSGVO)" }: { id: string; vorschau: LoeschVorschau; knopfText?: string }) {
  const [offen, setOffen] = useState(false);
  const gesperrt = vorschau.blockiert.length > 0;

  if (!offen) {
    return (
      <div className="lfa-knopfreihe">
        <button
          type="button"
          className="lfa-knopf lfa-knopf-gefahr lfa-knopf-klein"
          disabled={gesperrt}
          onClick={() => setOffen(true)}
          title={
            gesperrt
              ? `Gerade nicht möglich: ${vorschau.blockiert.flatMap((b) => b.gruende).join(" ")}`
              : "Zeigt, was gelöscht und was nur gesperrt wird, und fragt dann noch einmal nach — gelöscht wird erst nach „Ja – endgültig löschen“"
          }
        >
          {knopfText}
        </button>
        {gesperrt && <span className="lfa-klein">Erst möglich, wenn der Vorgang abgewickelt ist.</span>}
      </div>
    );
  }

  return (
    <form action={vorgangLoeschenAktion} className="lfa-loeschen" role="alertdialog" aria-label="Sicherheitsabfrage: Vorgang endgültig löschen">
      <input type="hidden" name="id" value={id} />
      <p className="lfa-loeschen-frage">
        <strong>Vorgang {id} endgültig löschen?</strong> Das lässt sich nicht rückgängig machen.
      </p>
      <div className="lfa-loeschen-spalten">
        <div>
          <h4 className="lfa-loeschen-titel" title="Diese Daten werden aus dem Speicher entfernt">Wird gelöscht</h4>
          <ul className="lfa-loeschen-liste">
            {vorschau.loeschen.map((p) => (
              <li key={p.was}>
                {p.was}
                {p.anzahl !== null && p.anzahl > 1 ? <span className="lfa-klein"> ({p.anzahl})</span> : null}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="lfa-loeschen-titel" title="Aufbewahrungspflicht nach HGB/AO geht vor (Art. 17 Abs. 3 lit. b DSGVO) — bis zum Datum nur gesperrt, dann löschen">
            Wird nur gesperrt (Aufbewahrungspflicht)
          </h4>
          {vorschau.sperren.length === 0 ? (
            <p className="lfa-klein">Nichts — es gibt keinen unterschriebenen Vertrag, keinen Nachweis und keine Provision.</p>
          ) : (
            <ul className="lfa-loeschen-liste">
              {vorschau.sperren.map((p) => (
                <li key={`${p.was}|${p.bis}`} title={p.grund}>
                  {p.was} — <strong>gesperrt bis {datum(p.bis)}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {vorschau.schwaerzen.length > 0 && (
        <p className="lfa-klein" title="Einträge, die auch andere betreffen, bleiben stehen — Name, E-Mail, Telefon und Anschrift werden darin durch „[gelöscht]“ ersetzt">
          Geschwärzt statt gelöscht: {vorschau.schwaerzen.join(" · ")}.
        </p>
      )}
      {vorschau.hinweise.map((h) => (
        <p key={h} className="lfa-klein lfa-loeschen-hinweis">
          {h}
        </p>
      ))}
      {vorschau.weitere.length > 0 && (
        <p className="lfa-klein lfa-loeschen-hinweis">
          Weitere Anfragen mit derselben E-Mail-Adresse — bei Bedarf einzeln löschen:{" "}
          {vorschau.weitere.map((w, i) => (
            <span key={w}>
              {i > 0 ? ", " : ""}
              <Link href={`/admin/anfrage/${w}#loeschen`} title={`Anfrage ${w} öffnen (Abschnitt Datenschutz)`}>
                {w}
              </Link>
            </span>
          ))}
        </p>
      )}
      <p className="lfa-klein" title="Diese Stellen erreicht das System nicht">
        Außerhalb von Lippe Forst bitte selbst löschen: {vorschau.extern.join(" · ")}.
      </p>
      <div className="lfa-knopfreihe">
        <Absenden />
        <Zurueck onClick={() => setOffen(false)} />
      </div>
    </form>
  );
}
