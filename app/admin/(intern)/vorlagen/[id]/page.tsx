import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/session";
import VertragsText from "@/components/vertrag/VertragsText";
import { VORLAGEN, istVorlageId, vorlageHash } from "@/lib/vertraege/vorlagen";

export const metadata: Metadata = { title: "Vorlage" };

export default async function VorlagePage(props: PageProps<"/admin/vorlagen/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  if (!istVorlageId(id)) notFound();
  const v = VORLAGEN[id];
  return (
    <>
      <p style={{ marginBottom: "0.75rem" }}>
        <Link href={`/admin/vorlagen#${id}`} className="lfa-klein" title="Zurück zu Vorlagen & Einstellungen">← Vorlagen</Link>
      </p>
      <div className="lfa-titelzeile">
        <div>
          <h1 className="lfa-h1">{v.titel}</h1>
          <p className="lfa-unterzeile">
            Version {v.version} · Prüfsumme {vorlageHash(id)} — Platzhalter stehen in «spitzen Klammern». Diese Varianten werden gemeinsam freigegeben.
          </p>
        </div>
      </div>
      {v.varianten.map((x) => (
        <section key={x.name} className="lfa-panel">
          <h2 className="lfa-h2">Variante: {x.name}</h2>
          <div className="lfa-vorschau" style={{ maxHeight: "none" }}>
            <VertragsText dok={v.render(x.daten)} />
          </div>
        </section>
      ))}
    </>
  );
}
