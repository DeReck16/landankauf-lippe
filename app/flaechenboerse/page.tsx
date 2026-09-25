import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import BoerseKarte from "@/components/boerse/BoerseKarte";
import { ladeBoerse, provisionOderStandard } from "@/lib/boerse";
import { seitenMetadaten } from "@/lib/seo";

// Angebote kommen aus der Flächenbörse: alle 5 Minuten bzw. beim Veröffentlichen sofort neu.
export const revalidate = 300;

export const metadata: Metadata = seitenMetadaten({
  title: "Flächenbörse: Flächen kaufen & pachten",
  description:
    "Flächen zum Kauf und zur Pacht im Kreis Lippe — anonym mit den Eckdaten. Interesse anmelden, Vertrag online schließen, Kontakt nach Zustimmung des Eigentümers.",
  pfad: "/flaechenboerse",
});

const SCHRITTE = [
  { titel: "Angebot ansehen", text: "Flächentyp, ungefähre Größe und grobe Lage — ohne Namen und ohne Flurstück." },
  { titel: "Interesse anmelden", text: "Kurz das Formular ausfüllen. Wir melden uns persönlich und schicken Ihnen Ihren Zugang zum Kundenbereich." },
  { titel: "Vertrag online schließen", text: "Einen kurzen Nachweisvertrag lesen und online unterschreiben. Eine Provision fällt nur an, wenn Sie die Fläche wirklich kaufen oder pachten." },
  { titel: "Kontakt nach Zustimmung", text: "Stimmt der Eigentümer zu, sehen Sie Namen, Kontaktdaten und Flurstücke. Einen Pachtvertrag schließen Sie online über uns, einen Kaufvertrag beim Notar." },
];

export default async function Page() {
  const d = await ladeBoerse();
  const provisionKauf = provisionOderStandard(d, "kauf");
  const provisionPacht = provisionOderStandard(d, "pacht");
  return (
    <>
      <PageHero
        eyebrow="Flächenbörse"
        title="Flächen zu kaufen und zu pachten — anonym angeboten."
        subtitle="Hier finden Sie Ackerland, Wiesen und Wald im Kreis Lippe, deren Eigentümer über uns verkaufen oder verpachten möchten. Diskret für beide Seiten: Namen und genaue Lage gibt es erst nach Vertrag und Zustimmung."
        primaryCta={{ href: "#angebote", label: "Angebote ansehen" }}
        secondaryCta={{ href: "#suchauftrag", label: "Suchauftrag hinterlegen" }}
      />

      <section className="section" id="angebote">
        <div className="container-page">
          <span className="eyebrow">Aktuelle Angebote</span>
          <hr className="divider mt-3" />
          <h2 className="text-3xl md:text-4xl">
            {d.angebote.length === 0 ? "Gerade ist keine Fläche frei im Angebot." : `${d.angebote.length} ${d.angebote.length === 1 ? "Fläche" : "Flächen"} im Angebot`}
          </h2>
          {d.angebote.length > 0 ? (
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {d.angebote.map((a) => (
                <BoerseKarte key={a.code} a={a} />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-[color:var(--color-ink-soft)] text-lg max-w-2xl">
              Neue Angebote kommen laufend dazu. Hinterlegen Sie unten einen Suchauftrag — wir melden uns, sobald eine passende Fläche angeboten wird.
            </p>
          )}
        </div>
      </section>

      <section className="section bg-grain">
        <div className="container-page">
          <span className="eyebrow">So funktioniert es</span>
          <hr className="divider mt-3" />
          <h2 className="text-3xl md:text-4xl">In vier Schritten zur Fläche.</h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {SCHRITTE.map((s, i) => (
              <li key={s.titel} className="card">
                <p className="eyebrow">Schritt {i + 1}</p>
                <h3 className="mt-2 font-serif text-xl">{s.titel}</h3>
                <p className="mt-2 text-[color:var(--color-ink-soft)] leading-relaxed">{s.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-[color:var(--color-ink-soft)] max-w-3xl">
            <strong>Provision nur bei Erfolg:</strong> für Käufer {provisionKauf}, für Pächter {provisionPacht}. Die genauen Konditionen stehen in Ihrem Vertrag, bevor Sie Namen oder Lage erfahren. Für Eigentümer ist die Börse kostenlos — Angebote erscheinen hier nur mit ihrer Zustimmung.
          </p>
        </div>
      </section>

      <section className="section" id="suchauftrag">
        <div className="container-narrow">
          <LeadForm
            defaultIntent="Fläche gesucht (Kauf)"
            source="flaechenboerse"
            title="Suchauftrag hinterlegen"
            subtitle="Sagen Sie uns, was Sie suchen — wir melden uns, sobald eine passende Fläche angeboten wird."
          />
        </div>
      </section>
    </>
  );
}
