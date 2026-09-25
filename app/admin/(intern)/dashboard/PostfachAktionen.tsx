"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { RUECKMELDUNG_NAME, type RueckmeldungArt } from "@/lib/portal/rueckmeldung-typen";
import { postfachKenntnisAktion, postfachUebernehmenAktion } from "../../assistent-actions";
import { ergebnisSetzen } from "../ergebnisse";

// Knöpfe einer E-Mail aus dem Anfragenpostfach (Postfach-Abgleich): EIN Hauptknopf übernimmt
// den Vorschlag als Rückmeldung, darunter lässt sich eine andere Antwort wählen oder die Mail
// nur zur Kenntnis nehmen. Nichts davon verschickt eine E-Mail — deshalb ohne Rückfrage.

/** Was die Übernahme bewirkt — für die Tooltips. */
const WIRKUNG: Record<RueckmeldungArt, string> = {
  verkaufen: "ordnet die Anfrage als Verkaufsangebot ein; danach steht sie unter „Rückmeldungen“ mit dem nächsten Schritt (Einladung)",
  verpachten: "ordnet die Anfrage als Pachtangebot ein; danach steht sie unter „Rückmeldungen“ mit dem nächsten Schritt (Einladung)",
  pachten: "ordnet die Anfrage als Pachtgesuch ein (ein Börsen-Angebot geht offline); danach steht sie unter „Rückmeldungen“ mit „Einladen — Suchauftrag“",
  kaufen: "ordnet die Anfrage als Kaufgesuch ein (ein Börsen-Angebot geht offline); danach steht sie unter „Rückmeldungen“ mit „Einladen — Suchauftrag“",
  suche: "vermerkt, dass weiter gesucht wird; danach steht die Anfrage unter „Rückmeldungen“ mit dem nächsten Schritt",
  beratung: "vermerkt den Beratungswunsch; danach steht die Anfrage unter „Rückmeldungen“ mit einem fertigen Antwortschreiben bzw. „Antwort schreiben“",
  "kein-interesse": "setzt die Anfrage auf „Erledigt“ (im laufenden Vorgang: dort vermerkt) — es geht keine E-Mail raus, Nachfassen entfällt",
};

export default function PostfachAktionen({ id, mail, vorschlag, optionen, ziel = "rueckmeldungen" }: { id: string; mail: string; vorschlag: RueckmeldungArt | null; optionen: RueckmeldungArt[]; ziel?: string }) {
  const [pending, starten] = useTransition();
  const [andere, setAndere] = useState<RueckmeldungArt | "">("");

  function uebernehmen(art: RueckmeldungArt) {
    starten(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("mail", mail);
      fd.set("art", art);
      ergebnisSetzen(ziel, await postfachUebernehmenAktion(fd));
    });
  }

  function kenntnis() {
    starten(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("mail", mail);
      ergebnisSetzen(ziel, await postfachKenntnisAktion(fd));
    });
  }

  return (
    <div className="lfa-anfrage-aktionen">
      <div className="lfa-knopfreihe lfa-anfrage-knoepfe">
        {vorschlag ? (
          <button
            type="button"
            className="lfa-knopf lfa-anfrage-knopf"
            disabled={pending}
            onClick={() => uebernehmen(vorschlag)}
            title={`Übernimmt den Vorschlag „${RUECKMELDUNG_NAME[vorschlag]}“ als Antwort des Kunden: ${WIRKUNG[vorschlag]}. Es geht keine E-Mail raus.`}
          >
            {pending ? "Einen Moment …" : `Übernehmen: ${RUECKMELDUNG_NAME[vorschlag]}`}
          </button>
        ) : null}
        <button
          type="button"
          className={vorschlag ? "lfa-link-knopf" : "lfa-knopf lfa-knopf-hell lfa-anfrage-knopf"}
          disabled={pending}
          onClick={kenntnis}
          title="Nur abhaken (z. B. Dank oder eine Rückfrage, die Sie selbst beantwortet haben) — Einordnung und Status der Anfrage bleiben, wie sie sind. Es geht keine E-Mail raus."
        >
          Zur Kenntnis (nichts ändern)
        </button>
        <Link href={`/admin/anfrage/${id}#postfach`} className="lfa-link-knopf lfa-anfrage-oeffnen" title="Anfrage öffnen: alle Angaben, alle E-Mails aus dem Postfach und der Verlauf">
          Anfrage öffnen
        </Link>
      </div>
      <details className="lfa-weitere lfa-weitere-klein" style={{ marginTop: "0.35rem" }}>
        <summary title="Der Vorschlag passt nicht? Hier die Antwort des Kunden selbst wählen">{vorschlag ? "Andere Antwort wählen" : "Antwort des Kunden wählen"}</summary>
        <div className="lfa-knopfreihe" style={{ marginTop: "0.4rem" }}>
          <select
            className="field-select"
            value={andere}
            onChange={(e) => setAndere(e.target.value as RueckmeldungArt | "")}
            title="Was hat der Kunde geantwortet? Die Wirkung steht am Knopf daneben."
            style={{ maxWidth: "22rem" }}
          >
            <option value="">Bitte wählen …</option>
            {optionen.map((a) => (
              <option key={a} value={a}>
                {RUECKMELDUNG_NAME[a]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="lfa-knopf lfa-knopf-hell lfa-knopf-klein"
            disabled={pending || !andere}
            onClick={() => andere && uebernehmen(andere)}
            title={andere ? `Übernimmt „${RUECKMELDUNG_NAME[andere]}“: ${WIRKUNG[andere]}. Es geht keine E-Mail raus.` : "Erst links eine Antwort wählen"}
          >
            Übernehmen
          </button>
        </div>
      </details>
    </div>
  );
}
