import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ladeKundenSitzung } from "@/lib/portal/sitzung";
import AnmeldeFormular from "../AnmeldeFormular";

export const metadata: Metadata = { title: "Anmelden" };

const MELDUNG: Record<string, { text: string; ok?: boolean }> = {
  abgelaufen: { text: "Der Link ist abgelaufen oder unvollständig. Fordern Sie hier einfach einen neuen Anmeldelink an." },
  ungueltig: { text: "Der Link ist nicht mehr gültig. Fordern Sie hier einen neuen Anmeldelink an." },
  benutzt: { text: "Dieser Link wurde schon benutzt oder ist abgelaufen. Fordern Sie hier einen neuen Anmeldelink an." },
  unterschrieben: { text: "Sie haben bereits unterschrieben — melden Sie sich bitte mit Ihrer E-Mail-Adresse an." },
  gesperrt: { text: "Dieser Zugang ist gesperrt. Bitte melden Sie sich bei uns." },
  abgemeldet: { text: "Sie sind abgemeldet.", ok: true },
};

export default async function KundeAnmeldenPage(props: PageProps<"/kunde/anmelden">) {
  if (await ladeKundenSitzung()) redirect("/kunde");
  const sp = await props.searchParams;
  const m = typeof sp.grund === "string" ? MELDUNG[sp.grund] : undefined;
  return (
    <div className="lfk-seite" style={{ maxWidth: "30rem" }}>
      <section className="lfk-karte">
        <h1 className="lfk-h1">Anmelden</h1>
        <p className="lfk-unterzeile">Kein Passwort nötig: Wir schicken Ihnen einen Anmeldelink an die E-Mail-Adresse, mit der Sie bei uns angefragt haben.</p>
        {m && <p className={`lfk-hinweis ${m.ok ? "lfk-hinweis-ok" : "lfk-hinweis-fehler"}`}>{m.text}</p>}
        <AnmeldeFormular />
      </section>
    </div>
  );
}
