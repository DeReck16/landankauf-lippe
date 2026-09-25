import Link from "next/link";
import { ladeBoerse, provisionOderStandard } from "@/lib/boerse";
import BoerseKarte from "./BoerseKarte";

/** Flächenbörse auf der Startseite: aktuelle Angebote zum Kauf und zur Pacht, anonym, mit den groben Eckdaten. */
export default async function BoerseAbschnitt() {
  const d = await ladeBoerse();
  const { angebote } = d;
  const provisionKauf = provisionOderStandard(d, "kauf");
  const provisionPacht = provisionOderStandard(d, "pacht");
  const zeigen = angebote.slice(0, 6);
  return (
    <section className="section" id="flaechenboerse">
      <div className="container-page">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <span className="eyebrow">Flächenbörse</span>
            <hr className="divider mt-3" />
            <h2 className="text-3xl md:text-4xl">Aktuell angebotene Flächen — zum Kauf und zur Pacht</h2>
            <p className="mt-4 text-[color:var(--color-ink-soft)] text-lg">
              Anonym und mit den groben Eckdaten. Namen und genaue Lage erfahren Sie, sobald Sie Ihren Vertrag mit uns online geschlossen haben und der Eigentümer dem Kontakt zustimmt.
            </p>
          </div>
          <Link href="/flaechenboerse" className="btn-secondary" title="Alle Angebote der Flächenbörse und So-funktioniert-es ansehen">
            {angebote.length > zeigen.length ? `Alle ${angebote.length} Angebote` : "So funktioniert die Börse"}
          </Link>
        </div>

        {zeigen.length > 0 ? (
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {zeigen.map((a) => (
              <BoerseKarte key={a.code} a={a} />
            ))}
          </div>
        ) : (
          <div className="mt-10 card">
            <h3 className="font-serif text-2xl">Gerade ist keine Fläche frei im Angebot.</h3>
            <p className="mt-2 text-[color:var(--color-ink-soft)]">
              Hinterlegen Sie einen Suchauftrag — wir melden uns, sobald uns eine passende Fläche angeboten wird.
            </p>
            <div className="mt-5">
              <Link href="/flaechenboerse#suchauftrag" className="btn-primary" title="Suchauftrag für eine Fläche zum Kauf oder zur Pacht hinterlegen — unverbindlich">
                Suchauftrag hinterlegen
              </Link>
            </div>
          </div>
        )}

        <p className="mt-6 text-sm text-[color:var(--color-muted)]">
          Provision nur im Erfolgsfall — für Käufer {provisionKauf}, für Pächter {provisionPacht}. Für Eigentümer ist die Börse kostenlos.
        </p>
      </div>
    </section>
  );
}
