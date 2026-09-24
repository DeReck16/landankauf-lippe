import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/session";
import AnmeldeFormular from "../AnmeldeFormular";

export const metadata: Metadata = { title: "Anmelden" };

const MELDUNGEN: Record<string, { text: string; art: "ok" | "fehler" }> = {
  abgelaufen: { text: "Der Anmeldelink ist abgelaufen oder ungültig. Bitte einen neuen anfordern.", art: "fehler" },
  benutzt: { text: "Dieser Anmeldelink wurde schon benutzt. Bitte einen neuen anfordern.", art: "fehler" },
  abgemeldet: { text: "Sie sind abgemeldet.", art: "ok" },
};

export default async function AnmeldenPage(props: PageProps<"/admin/anmelden">) {
  if (await getAdminSession()) redirect("/admin");
  const sp = await props.searchParams;
  const fehler = typeof sp.fehler === "string" ? MELDUNGEN[sp.fehler] : undefined;
  const meldung = fehler ?? (sp.abgemeldet ? MELDUNGEN.abgemeldet : undefined);
  const weiter = typeof sp.weiter === "string" && sp.weiter.startsWith("/admin") ? sp.weiter : undefined;

  return (
    <div className="lfa-anmeldung">
      <p className="lfa-marke" style={{ marginBottom: "1rem" }}>
        Lippe Forst <small>Verwaltung</small>
      </p>
      <div className="lfa-panel">
        <h1 className="lfa-h2">Anmelden</h1>
        <p className="lfa-unterzeile" style={{ marginBottom: "1rem" }}>
          Kein Passwort nötig: Sie bekommen einen Anmeldelink per E-Mail.
        </p>
        {meldung && (
          <p className={`lfa-hinweis ${meldung.art === "ok" ? "lfa-hinweis-ok" : "lfa-hinweis-fehler"}`}>{meldung.text}</p>
        )}
        <AnmeldeFormular weiter={weiter} />
      </div>
    </div>
  );
}
