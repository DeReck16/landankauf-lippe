import Link from "next/link";
import type { Ueberblick as UeberblickDaten, Zaehler } from "@/lib/admin/ueberblick";

// Überblick oben im Dashboard (Dennis 19.10.2026: „alle Leads sauber erfassen, Status erkennen, was die Leads wollen,
// Flächen und Gesuche online veröffentlichen, ggf. Matching-Paare“). Vier Spalten, jede Zeile eine Zahl, die zur
// passend gefilterten Liste führt. Es wird nichts geschrieben; pulsierend nur, was neu und noch nicht geöffnet ist.

function Zeile({ z }: { z: Zaehler }) {
  const leer = z.n === 0;
  return (
    <li>
      <Link href={z.href} className={`lfa-ueb-zeile ${leer ? "lfa-ueb-leer" : ""}`} title={z.tipp}>
        <span className="lfa-ueb-label">
          {z.puls && <span className="lfa-puls" />}
          {z.label}
          {z.neu ? <span className="lfa-klein"> · {z.neu} neu</span> : null}
        </span>
        <span className={`lfa-ueb-zahl ${z.ton ? `lfa-ueb-${z.ton}` : ""}`}>{z.n}</span>
      </Link>
    </li>
  );
}

function Spalte({ titel, tipp, zeilen, fuss }: { titel: string; tipp: string; zeilen: Zaehler[]; fuss?: React.ReactNode }) {
  return (
    <div className="lfa-ueb-spalte">
      <h2 className="lfa-ueb-titel" title={tipp}>
        {titel}
      </h2>
      <ul className="lfa-ueb-liste">
        {zeilen.map((z) => (
          <Zeile key={z.schluessel} z={z} />
        ))}
      </ul>
      {fuss && <p className="lfa-klein lfa-ueb-fuss">{fuss}</p>}
    </div>
  );
}

export default function Ueberblick({ u }: { u: UeberblickDaten }) {
  return (
    <section className="lfa-ueb" aria-label="Überblick">
      <Spalte
        titel="Was die Leads wollen"
        tipp="Laufende Anfragen (ohne Erledigte und Archiv) nach Anliegen — jede Zahl öffnet die gefilterte Anfragen-Liste"
        zeilen={u.wollen}
      />
      <Spalte
        titel="Kundenkonto"
        tipp="Wie weit sind Anbieter und Suchende im Kundenbereich: eingeladen → angemeldet → onboarded (Vereinbarung unterschrieben)"
        zeilen={u.konto}
      />
      <Spalte
        titel="Auf der Seite"
        tipp="Flächen in der anonymen Flächenbörse auf lippeforst.de — Online, bereit zum Veröffentlichen oder noch ohne Einwilligung"
        zeilen={u.seite}
        fuss={
          <>
            Gesuche ({u.gesucheImAbgleich}) stehen nicht auf der Seite, nur im{" "}
            <Link href="/admin/matching" title="Zum Matching: Paare aus Angebot und Gesuch">
              Matching
            </Link>
            .
          </>
        }
      />
      <Spalte
        titel="Matching-Paare"
        tipp="Passende Paare aus Angebot und Gesuch nach Stand — vom Vorschlag bis zum geschlossenen Vertrag"
        zeilen={u.matching}
      />
    </section>
  );
}
