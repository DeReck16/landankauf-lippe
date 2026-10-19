import type { Metadata } from "next";
import { eckdatenFuer } from "@/lib/admin/boerse-vorschlag";
import { readZustand } from "@/lib/admin/store";
import { haText } from "@/lib/boerse-regeln";
import { ladeLead } from "@/lib/portal/ablauf";
import { pruefeBoerse } from "@/lib/portal/token";
import { FIRMA } from "@/lib/vertraege/firma";
import { boerseBestaetigenAktion, boerseWiderrufAktion } from "./actions";

export const metadata: Metadata = { title: "Anonyme Anzeige: Einwilligung" };

// Einwilligung in die anonyme Anzeige auf lippeforst.de (Fläche in der Flächenbörse bzw. Suchauftrag in der Liste „Gesucht“):
// bestätigen (Link aus der Eingangsbestätigung nach dem Häkchen im Formular) oder zurücknehmen (Link aus der Bestätigungsmail).
// Öffnen allein speichert nichts — gespeichert wird erst per Knopf (Mail-Scanner öffnen Links vorab).
export default async function BoersePage(props: PageProps<"/kunde/boerse">) {
  const sp = await props.searchParams;
  const t = typeof sp.t === "string" ? sp.t : "";
  const token = pruefeBoerse(t);
  const geladen = token ? await ladeLead(token.k) : null;
  if (!token || !geladen) {
    return (
      <div className="lfk-seite" style={{ maxWidth: "40rem" }}>
        <section className="lfk-karte">
          <h1 className="lfk-h1">Dieser Link ist nicht mehr gültig</h1>
          <p className="lfk-unterzeile">
            Schreiben Sie uns einfach eine E-Mail an <a href={`mailto:${FIRMA.email}`} title="Neue E-Mail an Lippe Forst in Ihrem Mailprogramm">{FIRMA.email}</a> — wir nehmen Ihre Anzeige dann sofort von der Website.
          </p>
        </section>
      </div>
    );
  }
  const l = geladen.lead;
  const gesuch = l.rolle === "gesuch";
  const b = gesuch ? l.meta.suche : l.meta.boerse;
  const wer = gesuch ? "Ihr Suchauftrag" : "Ihre Fläche";
  const wo = gesuch ? "in der Liste „Gesucht“" : "in der Flächenbörse";

  // Eckdaten, die öffentlich erscheinen würden — nie Name, Kontakt oder Flurstück.
  const e = eckdatenFuer(l, b, (await readZustand()).zustand.orte);
  const eckdaten = [e.typ, haText(e.groesseHa), e.lage || "grobe Lage wird von uns ergänzt"].join(" · ");

  let inhalt: React.ReactNode;
  if (sp.ok === "1") {
    inhalt = (
      <p className="lfk-hinweis lfk-hinweis-ok" role="status">
        Ihre Einwilligung ist zurückgenommen. {wer} erscheint nicht (mehr) {wo} auf lippeforst.de.
      </p>
    );
  } else if (b?.einwilligung) {
    inhalt = (
      <>
        {sp.ok === "bestaetigt" && (
          <p className="lfk-hinweis lfk-hinweis-ok" role="status">
            Danke — Ihre Zustimmung ist vermerkt.{b.online ? ` ${wer} steht jetzt anonym auf lippeforst.de.` : " Die Anzeige geht online, sobald die Angaben vollständig sind."}
          </p>
        )}
        <p className="lfk-unterzeile">
          {wer} steht {b.online ? "derzeit anonym" : "mit Ihrer Einwilligung zur anonymen Anzeige bereit"} {wo} (Kennung {b.code}): {eckdaten}. Mit dem Knopf nehmen Sie Ihre Einwilligung zurück — die Anzeige verschwindet dann sofort von der Website. Ihre übrigen Vereinbarungen mit Lippe Forst bleiben davon unberührt.
        </p>
        <form action={boerseWiderrufAktion}>
          <input type="hidden" name="t" value={t} />
          <button type="submit" className="btn-primary" title="Nimmt Ihre Einwilligung zurück und die Anzeige sofort von der Website">
            Einwilligung zurücknehmen
          </button>
        </form>
      </>
    );
  } else if (l.veroeffentlichen) {
    inhalt = (
      <>
        <p className="lfk-unterzeile">
          Sie haben im Formular angekreuzt, dass wir {gesuch ? "Ihren Suchauftrag" : "Ihre Fläche"} anonym auf lippeforst.de zeigen dürfen. So würde die Anzeige erscheinen — nur diese Eckdaten, nie Ihr Name, Ihre Kontaktdaten oder das Flurstück:
        </p>
        <p className="lfk-hinweis lfk-hinweis-ok">
          <strong>{eckdaten}</strong>
        </p>
        <p className="lfk-unterzeile">Mit dem Knopf bestätigen Sie das. Erst dann geht die Anzeige online; Sie können die Einwilligung jederzeit über diesen Link wieder zurücknehmen. Möchten Sie das nicht, schließen Sie einfach diese Seite — dann bleibt alles unveröffentlicht.</p>
        <form action={boerseBestaetigenAktion}>
          <input type="hidden" name="t" value={t} />
          <button type="submit" className="btn-primary" title="Bestätigt Ihre Einwilligung: Die Anzeige geht anonym auf lippeforst.de online (nur diese Eckdaten)">
            Ja, anonym anzeigen
          </button>
        </form>
      </>
    );
  } else {
    inhalt = (
      <p className="lfk-hinweis lfk-hinweis-ok" role="status">
        Es liegt keine Einwilligung vor. {wer} erscheint nicht {wo} auf lippeforst.de.
      </p>
    );
  }

  return (
    <div className="lfk-seite" style={{ maxWidth: "40rem" }}>
      <section className="lfk-karte">
        <h1 className="lfk-h1">{gesuch ? "Ihr Suchauftrag auf lippeforst.de" : "Ihre Fläche auf lippeforst.de"}</h1>
        {inhalt}
      </section>
    </div>
  );
}
