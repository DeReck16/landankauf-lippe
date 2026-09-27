// Ablauf mit Fristen (Dennis 27.09.2026, Marktidee „Ablauf mit Fristen“): was wann passiert —
// für beide Wege getrennt (Direktankauf durch die TR Vertriebs GmbH oder Vermittlung). Nur Fristen,
// die das Gesetz oder wir selbst verlässlich einhalten; alles andere heißt ehrlich „hängt ab von …“.

type Schritt = { t: string; d: string; frist: string };

const GEMEINSAM: Schritt[] = [
  {
    t: "Anfrage",
    d: "Sie nennen uns Lage, Größe und Anliegen — über das Formular, per E-Mail oder WhatsApp.",
    frist: "Antwort in der Regel innerhalb eines Werktags per E-Mail, mit erster Wertindikation",
  },
  {
    t: "Weg wählen",
    d: "Selbst kaufen lassen oder vermitteln lassen — beides ist für Sie als Eigentümer ohne Provision.",
    frist: "Sie entscheiden, ohne Frist und ohne Druck",
  },
];

const ANKAUF: Schritt[] = [
  {
    t: "Kaufangebot",
    d: "Die TR Vertriebs GmbH prüft Flurstück, Bodenrichtwert und Lage, auf Wunsch mit Vor-Ort-Termin, und macht Ihnen ein Angebot.",
    frist: "sobald Flurstück und Lage geprüft sind; unverbindlich bis zum Notartermin",
  },
  {
    t: "Notar",
    d: "Beurkundung beim Notar Ihrer Wahl. Notar- und Grundbuchkosten des Kaufvertrags trägt nach der gesetzlichen Regel der Käufer.",
    frist: "Termin nach Absprache, den Entwurf erhalten Sie vorher",
  },
  {
    t: "Genehmigung",
    d: "Land- und forstwirtschaftliche Flächen über 1 ha brauchen in NRW eine Genehmigung nach dem Grundstückverkehrsgesetz; ab 2 ha kann ein siedlungsrechtliches Vorkaufsrecht bestehen.",
    frist: "Entscheidung binnen 1 Monat, mit Zwischenbescheid binnen 2, bei möglichem Vorkaufsrecht binnen 3 Monaten (§ 6 GrdstVG)",
  },
  {
    t: "Kaufpreis",
    d: "Fällig, wenn der Notar bestätigt, dass Genehmigung und Sicherheiten vorliegen (Fälligkeitsmitteilung).",
    frist: "üblicherweise wenige Wochen nach der Genehmigung",
  },
];

const VERMITTLUNG: Schritt[] = [
  {
    t: "Vereinbarung",
    d: "Kurze, kostenlose Vereinbarung online. Auf Wunsch zeigen wir die Fläche anonym in der Flächenbörse — nur mit Ihrer Zustimmung.",
    frist: "wenige Minuten im Kundenbereich; jederzeit kündbar",
  },
  {
    t: "Interessenten",
    d: "Passende Käufer oder Pächter lernen Ihre Fläche zuerst anonym kennen. Kontaktdaten gibt es erst, wenn beide Seiten zugestimmt haben.",
    frist: "hängt von der Nachfrage ab — jeden Schritt sehen Sie im Kundenbereich",
  },
  {
    t: "Vertrag",
    d: "Pacht: auf Wunsch online in Textform (§ 585a BGB), gültig ab der zweiten Unterschrift. Kauf: wie links über Notar und Genehmigung.",
    frist: "Pachtanzeige durch den Verpächter binnen 1 Monat (§ 2 LPachtVG; in NRW nicht bei Flächen bis 1 ha)",
  },
  {
    t: "Provision",
    d: "Zahlt nur der Käufer bzw. Pächter, und nur im Erfolgsfall. Für Sie als Eigentümer bleibt die Vermittlung kostenlos.",
    frist: "hat ein Interessent als Verbraucher ein Widerrufsrecht und keinen früheren Beginn gewünscht, geben wir den Kontakt erst 18 Tage nach seinem Vertrag frei",
  },
];

function Liste({ schritte, start }: { schritte: Schritt[]; start: number }) {
  return (
    <ol className="grid gap-5">
      {schritte.map((s, i) => (
        <li key={s.t} className="border-l-2 border-white/30 pl-5">
          <p className="font-serif text-2xl text-[color:var(--color-accent)]">{String(start + i).padStart(2, "0")}</p>
          <h4 className="mt-1 text-white text-lg">{s.t}</h4>
          <p className="mt-1 text-sm text-white/80 leading-relaxed">{s.d}</p>
          <p className="mt-2 text-xs uppercase tracking-wider text-[color:var(--color-accent)]">Frist: {s.frist}</p>
        </li>
      ))}
    </ol>
  );
}

/** `art`: „kauf“ zeigt nur Direktankauf und Vermittlung beim Verkauf, „pacht“ nur die Vermittlung. */
export default function AblaufFristen({ art = "beide" }: { art?: "beide" | "kauf" | "pacht" }) {
  const mitAnkauf = art !== "pacht";
  return (
    <section className="section bg-[color:var(--color-brand)] text-white" id="ablauf">
      <div className="container-page">
        <div className="max-w-2xl">
          <span className="eyebrow text-[color:var(--color-accent)]">Ablauf mit Fristen</span>
          <hr className="divider mt-3 bg-[color:var(--color-accent)]" />
          <h2 className="text-3xl md:text-4xl text-white">Was wann passiert.</h2>
          <p className="mt-4 text-white/85 text-lg">
            Ehrlich statt geschönt: die Fristen, die das Gesetz setzt oder die wir selbst einhalten — und wo es vom Einzelfall abhängt.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Liste schritte={GEMEINSAM} start={1} />
        </div>
        <div className={`mt-10 grid gap-10 ${mitAnkauf ? "lg:grid-cols-2" : ""}`}>
          {mitAnkauf && (
            <div>
              <h3 className="font-serif text-2xl text-white">Weg A · Die TR Vertriebs GmbH kauft selbst</h3>
              <p className="mt-1 mb-5 text-sm text-white/75">Ohne Makler, ohne Provision.</p>
              <Liste schritte={ANKAUF} start={3} />
            </div>
          )}
          <div>
            <h3 className="font-serif text-2xl text-white">{mitAnkauf ? "Weg B · " : ""}Wir vermitteln Käufer oder Pächter</h3>
            <p className="mt-1 mb-5 text-sm text-white/75">Für Sie als Eigentümer kostenlos.</p>
            <Liste schritte={VERMITTLUNG} start={3} />
          </div>
        </div>
      </div>
    </section>
  );
}
