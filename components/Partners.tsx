const partners = [
  { name: "FBG Passadetal", role: "Forstbetriebsgemeinschaft Lippe" },
  { name: "Landesverband Lippe", role: "Forstabteilung" },
  { name: "WLV Kreisverband Lippe", role: "Westfälisch-Lippischer Landwirtschaftsverband" },
  { name: "NABU Kreisverband Lippe", role: "Naturschutzbund" },
  { name: "Heimatbund Lippe", role: "Regional verwurzelt" },
  { name: "Naturpark Teuto · Egge", role: "Teutoburger Wald & Eggegebirge" },
];

export default function Partners() {
  return (
    <section className="py-12 px-5 border-t border-b border-[color:var(--color-line)] bg-white/60">
      <div className="container-page">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
          Wir arbeiten regelmäßig zusammen mit
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3 text-center">
          {partners.map((p) => (
            <div key={p.name} className="px-3 py-3 rounded-lg border border-[color:var(--color-line)] bg-white">
              <p className="font-serif text-[color:var(--color-ink)] text-sm leading-tight">{p.name}</p>
              <p className="text-xs text-[color:var(--color-muted)] mt-1">{p.role}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-center text-[11px] text-[color:var(--color-muted)] max-w-2xl mx-auto">
          Kooperationspartner mit aktiven Arbeitsbeziehungen. Bei konkreten Anliegen leiten wir nach Rücksprache weiter — niemals ohne Ihre ausdrückliche Zustimmung.
        </p>
      </div>
    </section>
  );
}
