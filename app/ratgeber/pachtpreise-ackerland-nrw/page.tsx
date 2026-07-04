import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";

export const metadata: Metadata = {
  title: "Pachtpreise Ackerland NRW 2026 — was pro Hektar gezahlt wird",
  description:
    "Aktuelle Pachtpreise in NRW: Ø 659 €/ha Ackerland (Bestand), Neupachten ~780 €/ha — bundesweit Spitze. Alle Zahlen nach Region, plus Rechnung pro Monat und die Frage: verpachten oder verkaufen?",
  alternates: { canonical: "/ratgeber/pachtpreise-ackerland-nrw" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Ratgeber · Pachtpreise"
        title="Pachtpreise für Ackerland in NRW — die echten Zahlen."
        subtitle="NRW hat die höchsten Pachtpreise Deutschlands: im Bestand rund 659 € je Hektar Ackerland und Jahr, bei Neupachten deutlich mehr. Hier die offiziellen Werte — und wann Verkaufen die bessere Rechnung ist."
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <article className="prose-lippe">
            <h2>Wie viel Pacht bekommt man für 1 Hektar Ackerland?</h2>
            <p>
              Nach der Agrarstrukturerhebung zahlen Landwirte in Nordrhein-Westfalen im Bestand durchschnittlich <strong>659 € je Hektar Ackerland und Jahr</strong> — bundesweit der höchste Wert. Bei <strong>Neupachten</strong> liegt der Schnitt mit rund <strong>780 € je Hektar</strong> nochmals deutlich darüber; in gefragten Lagen werden auch vierstellige Beträge gezahlt.
            </p>
            <table className="w-full mt-3 border-collapse text-sm">
              <thead>
                <tr className="bg-[color:var(--color-brand-soft)] text-left">
                  <th className="p-3 border border-[color:var(--color-line)]">Pacht Ackerland</th>
                  <th className="p-3 border border-[color:var(--color-line)] text-right">€/ha/Jahr</th>
                  <th className="p-3 border border-[color:var(--color-line)] text-right">≈ €/ha/Monat</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3 border border-[color:var(--color-line)]">NRW Bestandspacht (Ø)</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">659 €</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">≈ 55 €</td>
                </tr>
                <tr>
                  <td className="p-3 border border-[color:var(--color-line)]">NRW Neupacht (Ø)</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">≈ 780 €</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">≈ 65 €</td>
                </tr>
                <tr>
                  <td className="p-3 border border-[color:var(--color-line)]">Regierungsbezirk Münster (Ø)</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">787 €</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">≈ 66 €</td>
                </tr>
                <tr>
                  <td className="p-3 border border-[color:var(--color-line)]">Regierungsbezirk Düsseldorf (Ø)</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">638 €</td>
                  <td className="p-3 border border-[color:var(--color-line)] text-right">≈ 53 €</td>
                </tr>
              </tbody>
            </table>
            <p className="text-sm text-[color:var(--color-muted)] mt-2">
              Quellen: Agrarstrukturerhebung / IT.NRW, BMEL-Pachtstatistik. Grünland liegt regelmäßig deutlich unter den Ackerland-Werten. Zwischen 2013 und 2023 sind die Ackerland-Pachten in NRW um über 40 % gestiegen.
            </p>

            <h2>Was eine faire Pacht für Ihre Fläche bestimmt</h2>
            <ul>
              <li><strong>Bodengüte:</strong> Hohe Ackerzahlen rechtfertigen Pachten deutlich über dem Schnitt — schwache Standorte liegen darunter.</li>
              <li><strong>Konkurrenzdruck vor Ort:</strong> Wo mehrere Betriebe aufstocken wollen, steigen Neupachten schnell über 800–1.000 €/ha.</li>
              <li><strong>Vertragslaufzeit und Anpassungsklauseln:</strong> Ohne Indexierung frisst die Inflation die Pacht real auf.</li>
              <li><strong>Sonderverträge:</strong> Flächen für PV-Freiflächenanlagen erzielen ein Vielfaches der Agrar-Pacht — sind aber an lange Laufzeiten und Standortkriterien gebunden.</li>
            </ul>

            <h2>Verpachten oder verkaufen — die ehrliche Rechnung</h2>
            <p>
              659 € Pacht bei rund 87.000 € Verkehrswert je Hektar (NRW-Schnitt) entsprechen einer Bruttorendite von <strong>unter 1 %</strong> — vor Steuern, Flächenpflege und Verwaltungsaufwand. Wer die Fläche nicht selbst bewirtschaften oder in der Familie halten will, fährt mit einem Verkauf zum heutigen Preisniveau oft besser: Die Bodenpreise sind auf Rekordniveau, während die Pachtrendite seit Jahren sinkt.
            </p>
            <p>
              Wir rechnen Ihnen beides durch — konkrete Pachtempfehlung für Ihre Gemarkung gegen realistisch erzielbaren Verkaufspreis: <Link href="/flaeche-verpachten">Fläche verpachten</Link> oder <Link href="/flaeche-bewerten">kostenlos bewerten lassen</Link>. Aktuelle Kaufpreise finden Sie im Ratgeber <Link href="/ratgeber/ackerland-preis-nrw">Was kostet 1 ha Ackerland in NRW?</Link>
            </p>
          </article>
          <aside className="lg:sticky lg:top-24 self-start">
            <LeadForm
              source="ratgeber-pachtpreise-nrw"
              defaultIntent="Verpachten"
              title="Pacht- oder Verkaufs-Check"
              subtitle="Wir sagen Ihnen, welche Pacht für Ihre Fläche fair ist — und was ein Verkauf heute bringen würde."
            />
          </aside>
        </div>
      </section>
    </>
  );
}
