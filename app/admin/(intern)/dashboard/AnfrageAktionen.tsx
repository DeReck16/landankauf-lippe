"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { AnfrageVorschlag } from "@/lib/portal/anfrage-typen";
import { anfrageStatusAktion, anfrageVorschlagAktion } from "../../assistent-actions";
import { ergebnisSetzen } from "../ergebnisse";
import { EinKlick } from "./EinKlick";

// Knöpfe einer neuen Anfrage ohne Paar (Dashboard): genau EIN vorgeschlagener
// Hauptknopf (lib/portal/anfrage-vorschlag.ts). Vor dem Ausführen fragt er direkt
// in der Zeile nach und zeigt, was passiert und welche Mail an wen mit welchem
// Betreff rausgeht (Text zum Aufklappen). Daneben zweitrangig: „Antwort schreiben“
// (nur reine Auskunft), „Archiv (Test/Spam)“ und „Anfrage öffnen“. Die Rückmeldung
// steht über der Liste (die Zeile verschwindet nach dem Klick meist).

function datumZeit(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
}

export default function AnfrageAktionen({ id, v, test }: { id: string; v: AnfrageVorschlag; test: boolean }) {
  const [fragen, setFragen] = useState(false);
  const [pending, starten] = useTransition();
  const a = v.aktion;

  function ausfuehren() {
    starten(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("aktion", a.id);
      fd.set("signatur", a.signatur);
      ergebnisSetzen("anfragen", await anfrageVorschlagAktion(fd));
      setFragen(false);
    });
  }

  if (fragen) {
    return (
      <div className="lfa-assistent-frage lfa-anfrage-frage" role="alertdialog" aria-label="Sicherheitsabfrage">
        <strong>{a.frage}</strong>
        <div>
          <span className="lfa-assistent-zwischen">Das passiert:</span>
          <ul className="lfa-assistent-liste">
            {a.passiert.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        {a.mails.length > 0 ? (
          <div>
            <span className="lfa-assistent-zwischen">{a.mails.length === 1 ? "Diese E-Mail geht raus:" : `Diese ${a.mails.length} E-Mails gehen raus:`}</span>
            <ul className="lfa-assistent-mails">
              {a.mails.map((m) => (
                <li key={m.an}>
                  <details>
                    <summary title="Zeigt den vollständigen Text dieser E-Mail">
                      an <strong>{m.wer}</strong> · {m.an} — Betreff „{m.betreff}“
                    </summary>
                    {m.hinweis && <p className="lfa-klein" style={{ margin: "0.4rem 0 0" }}>{m.hinweis}</p>}
                    <div className="lfa-mailtext">{m.text}</div>
                  </details>
                  {m.zuletzt && <div className="lfa-klein">Zuletzt mit diesem Zweck gesendet am {datumZeit(m.zuletzt)} — dies ist eine erneute Mail.</div>}
                </li>
              ))}
            </ul>
            <p className="lfa-klein" style={{ margin: "0.35rem 0 0" }}>
              Absender lippeforst.de, Antworten gehen ins Anfragenpostfach, eine Kopie (Bcc) an die Verwaltung. Der gesendete Text steht danach im Verlauf der Kundenakte.
              {test ? " Testmodus: Es wird nichts verschickt, nur protokolliert." : ""}
            </p>
          </div>
        ) : (
          <p className="lfa-klein" style={{ margin: 0 }}>Es geht keine E-Mail raus.</p>
        )}
        <div className="lfa-knopfreihe">
          <button type="button" className="lfa-knopf lfa-anfrage-knopf" disabled={pending} onClick={ausfuehren} title={`Führt jetzt aus: ${a.knopf}`}>
            {pending ? "Wird ausgeführt …" : `Ja – ${a.knopf}`}
          </button>
          <button type="button" className="lfa-knopf lfa-knopf-leise lfa-anfrage-knopf" disabled={pending} onClick={() => setFragen(false)} title="Nichts ausführen, zurück">
            Nein, zurück
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lfa-anfrage-aktionen">
      <div className="lfa-knopfreihe lfa-anfrage-knoepfe">
        <button
          type="button"
          className="lfa-knopf lfa-anfrage-knopf"
          disabled={Boolean(a.gesperrt) || pending}
          title={a.gesperrt ? `Gesperrt: ${a.gesperrt}` : a.tipp}
          onClick={() => setFragen(true)}
        >
          {a.knopf}
        </button>
        {a.link && (
          <Link href={a.link.href} className="lfa-knopf lfa-knopf-leise lfa-anfrage-knopf" title={a.link.tipp}>
            {a.link.text}
          </Link>
        )}
        {v.antworten && (
          <a
            href={v.antworten.href}
            className="lfa-knopf lfa-knopf-hell lfa-anfrage-knopf"
            title={`Öffnet eine neue E-Mail an ${v.antworten.an} in Ihrem Mailprogramm (Betreff „Ihre Anfrage bei Lippe Forst“, Text schreiben Sie selbst) — gesendet wird dort und nicht im Verlauf gespeichert. Danach „Als beantwortet markieren“.`}
          >
            Antwort schreiben
          </a>
        )}
        <EinKlick
          aktion={anfrageStatusAktion}
          werte={{ id, status: "archiv" }}
          ziel="anfragen"
          klasse="lfa-link-knopf"
          knopf="Archiv (Test/Spam)"
          tipp="Test, Spam oder Dublette — archivieren: nicht mehr im Dashboard, nicht im Matching und nicht beim Nachfassen. Es geht keine E-Mail raus; in der Anfrage jederzeit zurückholbar."
        />
        <Link href={`/admin/anfrage/${id}`} className="lfa-link-knopf lfa-anfrage-oeffnen" title="Anfrage öffnen: alle Angaben, Kontakt, E-Mail-Entwürfe, Einordnung fürs Matching und Verlauf">
          Anfrage öffnen
        </Link>
      </div>
      {a.gesperrt && (
        <p className="lfa-assistent-sperre" role="note">
          Gesperrt: {a.gesperrt}
        </p>
      )}
    </div>
  );
}
