"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { NACHFASS_TYP_NAME, type NachfassKandidat, type NachfassTyp } from "@/lib/portal/anfrage-typen";
import { nachfassenAktion } from "../../assistent-actions";
import { ergebnisSetzen } from "../ergebnisse";

// Gesammeltes Nachfassen (Dashboard): Liste alter Anfragen mit Häkchen (standardmäßig
// an), Vorschau des Textes je Art und EIN Knopf „Nachfass-Mail an N Kunden senden“.
// Erst die Rückfrage mit allen Empfängern und „Ja – …“ sendet — je Empfänger eine
// eigene Mail. Die Rückmeldung (✓/✗ je Empfänger) steht über der Liste.

function datum(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
}

const TYP_REIHENFOLGE: NachfassTyp[] = ["verkauf", "verpachtung", "suche-pacht", "suche-kauf", "beratung"];

export default function Nachfassen({ kandidaten, test }: { kandidaten: NachfassKandidat[]; test: boolean }) {
  // Gemerkt wird, was abgewählt ist — neue Kandidaten sind so automatisch ausgewählt.
  const [ab, setAb] = useState<Set<string>>(() => new Set());
  const [fragen, setFragen] = useState(false);
  const [pending, starten] = useTransition();
  const auswahl = kandidaten.filter((k) => !ab.has(k.id));
  const n = auswahl.length;
  const knopf = `Nachfass-Mail an ${n} Kunden senden`;
  const typen = TYP_REIHENFOLGE.filter((t) => kandidaten.some((k) => k.typ === t));
  const gesperrt = fragen || pending;

  function umschalten(id: string) {
    setAb((alt) => {
      const neu = new Set(alt);
      if (neu.has(id)) neu.delete(id);
      else neu.add(id);
      return neu;
    });
  }

  function senden() {
    starten(async () => {
      const fd = new FormData();
      for (const k of auswahl) fd.append("id", k.id);
      ergebnisSetzen("nachfassen", await nachfassenAktion(fd));
      setFragen(false);
      setAb(new Set());
    });
  }

  return (
    <div className="lfa-nachfass">
      <div className="lfa-knopfreihe lfa-nachfass-wahlknoepfe">
        <button type="button" className="lfa-link-knopf" disabled={gesperrt || n === kandidaten.length} onClick={() => setAb(new Set())} title="Setzt bei allen das Häkchen — alle bekommen die Nachfass-Mail">
          Alle auswählen
        </button>
        <button type="button" className="lfa-link-knopf" disabled={gesperrt || n === 0} onClick={() => setAb(new Set(kandidaten.map((k) => k.id)))} title="Entfernt alle Häkchen — danach einzeln auswählen">
          Keine auswählen
        </button>
        <span className="lfa-klein">{n} von {kandidaten.length} ausgewählt</span>
      </div>

      <ul className="lfa-nachfass-liste">
        {kandidaten.map((k) => {
          const an = !ab.has(k.id);
          return (
            <li key={k.id} className={`lfa-nachfass-zeile ${an ? "" : "lfa-nachfass-ab"}`}>
              <label className="lfa-nachfass-wahl" title={an ? "Häkchen entfernen: bekommt keine Nachfass-Mail" : "Häkchen setzen: bekommt die Nachfass-Mail"}>
                <input type="checkbox" checked={an} disabled={gesperrt} onChange={() => umschalten(k.id)} />
                <span className="lfa-nachfass-text">
                  <span>
                    {k.neu && <span className="lfa-puls" title="Neu in dieser Liste seit Ihrem letzten Besuch" />}
                    <strong>{k.name}</strong> · {k.anliegen}
                  </span>
                  <span className="lfa-klein">
                    Eingang {datum(k.eingang)} · letzter Kontakt: {k.letzterKontakt ? `${datum(k.letzterKontakt.am)} (${k.letzterKontakt.text})` : "noch keiner"}
                  </span>
                </span>
              </label>
              <Link href={`/admin/anfrage/${k.id}`} className="lfa-link-knopf lfa-anfrage-oeffnen" title="Anfrage öffnen: Angaben, Verlauf und Status — z. B. „Erledigt“, wenn schon feststeht, dass kein Interesse mehr besteht">
                Anfrage öffnen
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="lfa-nachfass-vorschauen">
        <span className="lfa-assistent-zwischen">Vorschau des Textes — Name, Datum und Anliegen stehen je Empfänger passend drin:</span>
        {typen.map((t) => {
          const bsp = auswahl.find((k) => k.typ === t) ?? kandidaten.find((k) => k.typ === t)!;
          const anzahl = auswahl.filter((k) => k.typ === t).length;
          const betreffe = new Set(kandidaten.filter((k) => k.typ === t).map((k) => k.betreff));
          return (
            <details key={t} className="lfa-nachfass-vorschau">
              <summary title="Zeigt den Text dieser Art Nachfass-Mail am Beispiel eines Empfängers">
                {NACHFASS_TYP_NAME[t]} ({anzahl} ausgewählt) — {betreffe.size === 1 ? <>Betreff „{bsp.betreff}“</> : "Betreff je nach Anfrage"}
              </summary>
              <p className="lfa-klein" style={{ margin: "0.4rem 0 0" }}>
                Beispiel an {bsp.name} ({bsp.an}){betreffe.size > 1 ? <> — Betreff „{bsp.betreff}“</> : null}
              </p>
              <div className="lfa-mailtext">{bsp.text}</div>
            </details>
          );
        })}
      </div>

      {fragen ? (
        <div className="lfa-assistent-frage" role="alertdialog" aria-label="Sicherheitsabfrage">
          <strong>Nachfass-Mail jetzt an {n} Kunden senden?</strong>
          <div>
            <span className="lfa-assistent-zwischen">Das passiert:</span>
            <ul className="lfa-assistent-liste">
              <li>Jeder Empfänger bekommt eine eigene E-Mail — kein Sammelversand, niemand sieht andere Adressen.</li>
              <li>Die Mail fragt nur, ob zur eigenen Anfrage noch Interesse besteht — mit einem persönlichen Antwort-Link (verkaufen, verpachten bzw. weitersuchen, Beratung mit Thema oder „kein Interesse“, 120 Tage gültig).</li>
              <li>Jede Antwort über den Link erscheint oben unter „Rückmeldungen“ als Ticket mit dem nächsten Schritt, und Sie bekommen eine Meldung per E-Mail. „Kein Interesse“ setzt die Anfrage automatisch auf „Erledigt“ — danach geht keine weitere Mail raus.</li>
              <li>Vermerkt werden „nachgefasst am …“ und der Status „Beantwortet“; die Mail steht im Verlauf (Kundenakte bzw. Verlauf der Anfrage).</li>
              <li>Die Angeschriebenen erscheinen hier frühestens in 60 Tagen wieder.</li>
            </ul>
          </div>
          <div>
            <span className="lfa-assistent-zwischen">{n === 1 ? "Diese E-Mail geht raus:" : `Diese ${n} E-Mails gehen raus:`}</span>
            <ul className="lfa-assistent-mails lfa-nachfass-empfaenger">
              {auswahl.map((k) => (
                <li key={k.id}>
                  <details>
                    <summary title="Zeigt den vollständigen Text dieser E-Mail">
                      an <strong>{k.name}</strong> · {k.an} — Betreff „{k.betreff}“
                    </summary>
                    <div className="lfa-mailtext">{k.text}</div>
                  </details>
                </li>
              ))}
            </ul>
            <p className="lfa-klein" style={{ margin: "0.35rem 0 0" }}>
              Absender lippeforst.de, Antworten gehen ins Anfragenpostfach, eine Kopie (Bcc) an die Verwaltung.
              {test ? " Testmodus: Es wird nichts verschickt, nur protokolliert." : ""}
            </p>
          </div>
          <div className="lfa-knopfreihe">
            <button type="button" className="lfa-knopf lfa-anfrage-knopf" disabled={pending || n === 0} onClick={senden} title={n === 1 ? "Sendet jetzt die Nachfass-Mail über lippeforst.de" : `Sendet jetzt ${n} einzelne Nachfass-Mails über lippeforst.de`}>
              {pending ? "Wird gesendet … (etwa eine Sekunde je Empfänger)" : `Ja – ${knopf}`}
            </button>
            <button type="button" className="lfa-knopf lfa-knopf-leise lfa-anfrage-knopf" disabled={pending} onClick={() => setFragen(false)} title="Nichts senden, zurück zur Auswahl">
              Nein, zurück
            </button>
          </div>
        </div>
      ) : (
        <div className="lfa-knopfreihe">
          <button
            type="button"
            className="lfa-knopf lfa-anfrage-knopf"
            disabled={n === 0 || pending}
            onClick={() => setFragen(true)}
            title={n === 0 ? "Erst mindestens ein Häkchen setzen" : `Fragt noch einmal nach und zeigt ${n === 1 ? "den Empfänger" : `alle ${n} Empfänger`} mit Betreff und Text — gesendet wird erst mit „Ja“`}
          >
            {knopf}
          </button>
        </div>
      )}
    </div>
  );
}
