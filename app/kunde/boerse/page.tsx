import type { Metadata } from "next";
import { ladeLead } from "@/lib/portal/ablauf";
import { pruefeBoerse } from "@/lib/portal/token";
import { FIRMA } from "@/lib/vertraege/firma";
import { boerseWiderrufAktion } from "./actions";

export const metadata: Metadata = { title: "Flächenbörse: Einwilligung" };

// Widerruf der Einwilligung in die anonyme Veröffentlichung (Link aus der Bestätigungsmail).
export default async function BoersePage(props: PageProps<"/kunde/boerse">) {
  const sp = await props.searchParams;
  const t = typeof sp.t === "string" ? sp.t : "";
  const token = pruefeBoerse(t);
  const geladen = token ? await ladeLead(token.k) : null;
  const b = geladen?.lead.meta.boerse;
  if (!token || !geladen) {
    return (
      <div className="lfk-seite" style={{ maxWidth: "40rem" }}>
        <section className="lfk-karte">
          <h1 className="lfk-h1">Dieser Link ist nicht mehr gültig</h1>
          <p className="lfk-unterzeile">
            Schreiben Sie uns einfach eine E-Mail an <a href={`mailto:${FIRMA.email}`} title="Neue E-Mail an Lippe Forst in Ihrem Mailprogramm">{FIRMA.email}</a> — wir nehmen Ihr Angebot dann sofort aus der Flächenbörse.
          </p>
        </section>
      </div>
    );
  }
  const widerrufen = sp.ok === "1" || !b?.einwilligung;
  return (
    <div className="lfk-seite" style={{ maxWidth: "40rem" }}>
      <section className="lfk-karte">
        <h1 className="lfk-h1">Ihre Fläche in der Flächenbörse</h1>
        {widerrufen ? (
          <p className="lfk-hinweis lfk-hinweis-ok" role="status">
            Ihre Einwilligung ist zurückgenommen. Ihre Fläche erscheint nicht (mehr) in der Flächenbörse auf lippeforst.de.
          </p>
        ) : (
          <>
            <p className="lfk-unterzeile">
              Ihre Fläche steht {b?.online ? "derzeit anonym" : "mit Ihrer Einwilligung zur anonymen Veröffentlichung bereit"} in der Flächenbörse (Kennung {b?.code}). Mit dem Knopf nehmen Sie Ihre Einwilligung zurück — das Angebot verschwindet dann sofort von der Website. Ihre übrigen Vereinbarungen mit Lippe Forst bleiben davon unberührt.
            </p>
            <form action={boerseWiderrufAktion}>
              <input type="hidden" name="t" value={t} />
              <button type="submit" className="btn-primary" title="Nimmt Ihre Einwilligung zurück und Ihr Angebot sofort aus der Flächenbörse">
                Einwilligung zurücknehmen
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
