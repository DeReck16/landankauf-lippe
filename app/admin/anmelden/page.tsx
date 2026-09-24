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

/** Nach der Anmeldung: das gewünschte Ziel in der Verwaltung, sonst das Dashboard. */
const STANDARD_ZIEL = "/admin/dashboard";
const ZIEL = /^\/admin(\/[A-Za-z0-9_~-]+)*\/?(\?[A-Za-z0-9_=&%~.-]*)?$/;

export default async function AnmeldenPage(props: PageProps<"/admin/anmelden">) {
  const sp = await props.searchParams;
  const weiter = typeof sp.weiter === "string" && ZIEL.test(sp.weiter) ? sp.weiter : STANDARD_ZIEL;
  if (await getAdminSession()) redirect(weiter);
  const fehler = typeof sp.fehler === "string" ? MELDUNGEN[sp.fehler] : undefined;
  const meldung = fehler ?? (sp.abgemeldet ? MELDUNGEN.abgemeldet : undefined);

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
