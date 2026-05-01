type Persona = "Landwirt" | "Förster" | "Erbengemeinschaft" | "Flächenbesitzer";

type Story = {
  persona: Persona;
  badge: string;
  quote: string;
  context: string;
  area: string;
};

const stories: Story[] = [
  {
    persona: "Erbengemeinschaft",
    badge: "Drei Geschwister · 3,8 ha Acker",
    quote:
      "Wir wollten still verkaufen — kein Schaufenster, keine Diskussion mit dem Pächter, keine Maklerkette. Lippe Forst hat den Notarvertrag in 6 Wochen sauber durchgezogen, das Pachtverhältnis übernommen und an alle drei Erben getrennt ausgezahlt.",
    context:
      "Ein Miteigentümer lebt im Ausland — alles wurde digital koordiniert. Pächter erfuhr erst nach Vertragsschluss vom Eigentümerwechsel.",
    area: "Raum Blomberg",
  },
  {
    persona: "Förster",
    badge: "Förster im Lipper Land",
    quote:
      "Wenn ein Privatwaldbesitzer bei mir mit alten Eichen oder Buchen sitzt und nicht weiß, ob verkaufen oder behalten, schicke ich ihn zu Lippe Forst. Sie kennen die Förderprogramme — Biotopbaum, Klimawald, Vertragsnaturschutz — und rechnen ehrlich gegen den Verkauf.",
    context:
      "In zwei Fällen 2025 ergab die Prüfung: Behalten und Förderung beantragen war für den Eigentümer wirtschaftlich besser als ein Verkauf. Genau diese Beratung erwarte ich.",
    area: "Forstdienst Kreis Lippe",
  },
  {
    persona: "Landwirt",
    badge: "Vollerwerbsbetrieb · Pacht-Konsolidierung",
    quote:
      "Ich wollte zwei abseitige Flurstücke abgeben und im Gegenzug zwei hofnahe pachten. Lippe Forst hat den Tausch organisiert, mit dem Kollegen verhandelt, GrdstVG-Genehmigung mitgekümmert. Für mich kein Aufwand, kein Bürokratie-Hick-Hack.",
    context:
      "Tauschartig strukturiert über zwei Notartermine — Genehmigung Landwirtschaftskammer, kein siedlungsrechtliches Vorkaufsrecht ausgeübt.",
    area: "Raum Lemgo",
  },
  {
    persona: "Flächenbesitzer",
    badge: "Privatperson · 1,2 ha Hangwiese im FFH-Umfeld",
    quote:
      "Mein alter Pächter wollte raus. Niemand hat die Hangwiese mehr regulär bewirtschaften wollen — sie galt als Problemfläche. Lippe Forst hat den VNS-Antrag fristgerecht eingereicht und einen Lohnunternehmer für die Mahd vermittelt. Heute mehr Ertrag als zu Pachtzeiten — und ich muss nichts tun.",
    context:
      "Förderung NRW Vertragsnaturschutz, Mahd 2× pro Jahr durch regionalen Lohnunternehmer, Eigentum bleibt vollständig erhalten.",
    area: "Raum Schieder-Schwalenberg",
  },
  {
    persona: "Flächenbesitzer",
    badge: "Älterer Eigentümer · 7,1 ha Mischflächen",
    quote:
      "Verstreute Flurstücke aus mehreren Generationen. Ich wollte sortieren, aber nicht alles auf einmal verkaufen. Wert komplett unklar. Lippe Forst hat mir kostenlos einen Stufenplan über zwei Jahre gemacht — was verkaufen, was verpachten, was im Wald als Biotop sichern.",
    context:
      "Acker direkt verkauft, Grünland verpachtet, Wald bleibt im Familienbesitz mit Förster-Anbindung. Klare Reihenfolge, klare Erlöse, keine Hektik.",
    area: "Raum Detmold",
  },
  {
    persona: "Landwirt",
    badge: "Nebenerwerbslandwirt · Auflösung",
    quote:
      "Der Hof wird nicht weitergeführt. 14 ha verteilte Flächen, ein Drittel verpachtet, ein Drittel in Vertragsnaturschutz, Rest Eigenbewirtschaftung. Lippe Forst hat alles in einem Aufwasch durchsortiert — diskret, ohne Dorf-Tratsch.",
    context:
      "Verkäufe gestaffelt, mit dem örtlichen Pächter erst nach Eigentümer-Freigabe gesprochen. Auszahlung in zwei Tranchen über 4 Monate.",
    area: "Raum Extertal",
  },
];

export default function Testimonials() {
  return (
    <section className="section bg-grain">
      <div className="container-page">
        <div className="max-w-2xl">
          <span className="eyebrow">Stimmen aus dem Lipper Land</span>
          <hr className="divider mt-3" />
          <h2 className="text-3xl md:text-4xl">Anonymisierte Fallbeispiele — geordnet nach Situation.</h2>
          <p className="mt-4 text-[color:var(--color-ink-soft)]">
            Aus Diskretionsgründen nennen wir keine Namen, Orte werden nur grob angegeben. Jede Fallschilderung ist mit den Beteiligten abgestimmt. Auf Wunsch stellen wir den Kontakt zu Eigentümern her, die ihre Erfahrung anonym persönlich teilen — nach beidseitigem Einverständnis.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {stories.map((s, i) => (
            <article key={i} className="card flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-block px-2 py-0.5 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-dark)] text-[11px] font-semibold uppercase tracking-wider">
                  {s.persona}
                </span>
              </div>
              <p className="text-xs text-[color:var(--color-muted)] mb-3">{s.badge}</p>
              <blockquote className="font-serif text-base leading-relaxed flex-1 text-[color:var(--color-ink)]">
                <span className="text-[color:var(--color-accent)] font-bold mr-1">„</span>
                {s.quote}
                <span className="text-[color:var(--color-accent)] font-bold ml-1">"</span>
              </blockquote>
              <p className="mt-4 text-xs text-[color:var(--color-ink-soft)] leading-relaxed">{s.context}</p>
              <p className="mt-3 text-[11px] text-[color:var(--color-muted)] border-t border-[color:var(--color-line)] pt-3 uppercase tracking-wider">
                {s.area} · anonymisiert auf Wunsch der Beteiligten
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
