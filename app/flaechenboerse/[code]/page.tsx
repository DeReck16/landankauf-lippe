import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LeadForm from "@/components/LeadForm";
import BoerseKarte from "@/components/boerse/BoerseKarte";
import { artText, haText, ladeBoerse, provisionOderStandard } from "@/lib/boerse";
import { FLAECHENTYPEN, type Flaechentyp } from "@/lib/lead-options";

// Einzelne Angebote sind kurzlebig: nicht indexieren, aber verlinkbar (z. B. aus der Startseite).
export const revalidate = 300;

export async function generateMetadata(props: PageProps<"/flaechenboerse/[code]">): Promise<Metadata> {
  const { code } = await props.params;
  return {
    title: `Angebot ${code} · Flächenbörse`,
    robots: { index: false, follow: true },
    alternates: { canonical: `/flaechenboerse/${code}` },
  };
}

export default async function Page(props: PageProps<"/flaechenboerse/[code]">) {
  const { code: roh } = await props.params;
  const code = decodeURIComponent(roh).toUpperCase();
  const d = await ladeBoerse();
  const a = /^LF-\d{4}$/.test(code) ? d.angebote.find((x) => x.code === code) ?? null : null;

  if (!a) {
    return (
      <>
        <PageHero eyebrow="Flächenbörse" title="Dieses Angebot ist nicht mehr verfügbar." subtitle="Vermutlich ist die Fläche bereits vergeben. Hinterlegen Sie einen Suchauftrag — wir melden uns, sobald eine passende Fläche angeboten wird." />
        <section className="section">
          <div className="container-narrow">
            <p className="mb-6">
              <Link href="/flaechenboerse" className="underline" title="Zur Übersicht aller aktuellen Angebote">Zu den aktuellen Angeboten</Link>
            </p>
            <LeadForm defaultIntent="Fläche gesucht (Kauf)" source="flaechenboerse" title="Suchauftrag hinterlegen" />
          </div>
        </section>
      </>
    );
  }

  const titel = `${a.typ || "Fläche"}, ${haText(a.groesseHa)}, ${a.lage}`;
  const at = artText(a.art);
  const provision = provisionOderStandard(d, a.art);
  const pacht = a.art === "pacht";
  const typ = (FLAECHENTYPEN as readonly string[]).includes(a.typ) ? (a.typ as Flaechentyp) : undefined;
  return (
    <>
      <PageHero eyebrow={`Flächenbörse · Angebot ${a.code}`} title={`${a.typ || "Fläche"} ${at.verb}, ${haText(a.groesseHa)}`} subtitle={`${a.lage} — anonym angeboten. Namen, Kontaktdaten und Flurstücke erhalten Sie nach Vertragsabschluss und Zustimmung des Eigentümers.`} />
      <section className="section">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <BoerseKarte a={a} mitLink={false} />
            <div className="mt-6 text-[color:var(--color-ink-soft)] space-y-3">
              <p>
                <strong>So geht es weiter:</strong> Sie melden hier unverbindlich Ihr Interesse an. Wir schicken Ihnen einen persönlichen Zugang, dort schließen Sie online einen kurzen Nachweisvertrag. Stimmt der Eigentümer dem Kontakt zu, sehen Sie Namen, Kontaktdaten und Flurstücke — {pacht ? "den Pachtvertrag schließen Sie auf Wunsch online über uns." : "den Kaufvertrag schließen Sie beim Notar."}
              </p>
              <p>
                <strong>Provision nur bei Erfolg:</strong> {provision}. Kommt kein {pacht ? "Pachtvertrag" : "Kauf"} zustande, zahlen Sie nichts.
              </p>
              <p>
                <Link href="/flaechenboerse" className="underline" title="Zur Übersicht aller aktuellen Angebote">Alle Angebote ansehen</Link>
              </p>
            </div>
          </div>
          <div>
            <LeadForm
              defaultIntent={pacht ? "Fläche gesucht (Pacht)" : "Fläche gesucht (Kauf)"}
              defaultFlaechentyp={typ}
              source="flaechenboerse"
              title="Interesse anmelden"
              subtitle="Unverbindlich — wir melden uns innerhalb von 24 Stunden persönlich."
              boerse={{ code: a.code, titel }}
            />
          </div>
        </div>
      </section>
    </>
  );
}
