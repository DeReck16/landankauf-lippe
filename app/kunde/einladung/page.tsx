import type { Metadata } from "next";
import Link from "next/link";
import { einladungPruefen, ladeLead } from "@/lib/portal/ablauf";
import { datumDe, wert } from "@/lib/portal/texte";
import { einladungAnnehmenAktion } from "../actions";

export const metadata: Metadata = { title: "Einladung" };

const GRUND: Record<string, string> = {
  abgelaufen: "Dieser Einladungslink ist abgelaufen oder unvollständig.",
  ungueltig: "Dieser Einladungslink ist nicht mehr gültig — vermutlich haben Sie inzwischen einen neueren Link erhalten.",
  unterschrieben: "Sie haben bereits unterschrieben. Bitte melden Sie sich mit Ihrer E-Mail-Adresse an.",
  gesperrt: "Dieser Zugang ist gesperrt. Bitte melden Sie sich bei uns.",
};

// Der Link aus der Mail meldet NICHT sofort an: Mail-Scanner rufen Links vorab
// auf. Erst der Klick auf den Knopf öffnet den Kundenbereich.
export default async function EinladungPage(props: PageProps<"/kunde/einladung">) {
  const sp = await props.searchParams;
  const t = typeof sp.t === "string" ? sp.t : "";
  const pr = await einladungPruefen(t);
  if (!pr.ok) {
    return (
      <div className="lfk-seite">
        <section className="lfk-karte">
          <h1 className="lfk-h1">Link nicht gültig</h1>
          <p className="lfk-hinweis lfk-hinweis-fehler">{GRUND[pr.grund]}</p>
          <div className="lfk-knopfreihe">
            <Link href="/kunde/anmelden" className="btn-primary" title="Anmeldelink an Ihre E-Mail-Adresse schicken lassen">
              Zur Anmeldung
            </Link>
          </div>
        </section>
      </div>
    );
  }
  const k = pr.kunde;
  const lead = (await ladeLead(k.id))?.lead;
  const name = k.stammdaten?.name || wert(lead?.name);
  const anbieter = k.rolle === "anbieter";
  return (
    <div className="lfk-seite">
      <section className="lfk-karte lfk-karte-hervor">
        <h1 className="lfk-h1">{name ? `Willkommen, ${name}` : "Willkommen"}</h1>
        <p className="lfk-unterzeile">
          {anbieter
            ? "Damit wir Ihre Fläche passenden Interessenten vorstellen dürfen, bestätigen Sie online eine kurze, kostenlose Vereinbarung."
            : "Damit wir Ihnen passende Flächen vorstellen und — mit Zustimmung beider Seiten — den Kontakt herstellen dürfen, schließen Sie online einen kurzen Nachweisvertrag."}
        </p>
        <ol className="lfk-schritte">
          <li data-stand="jetzt">Angaben</li>
          <li data-stand="offen">{anbieter ? "Vereinbarung bestätigen" : "Vertrag unterschreiben"}</li>
          <li data-stand="offen">Vorschläge und Kontakt</li>
        </ol>
        <ul className="lfd-liste" style={{ marginBottom: "1rem" }}>
          {anbieter ? (
            <>
              <li>Sie zahlen nichts — keine Provision, keine Gebühren.</li>
              <li>Ihre Kontaktdaten und die genaue Lage geben wir erst weiter, wenn Sie dem konkreten Interessenten zugestimmt haben.</li>
              <li>Sie können jederzeit aussteigen.</li>
            </>
          ) : (
            <>
              <li>Eine Provision fällt nur an, wenn über uns ein Vertrag zustande kommt.</li>
              <li>Flächen stellen wir Ihnen zuerst anonym vor; Kontaktdaten gibt es erst nach Zustimmung beider Seiten.</li>
              <li>Sie können jederzeit kündigen; als Verbraucher haben Sie ein 14-tägiges Widerrufsrecht.</li>
            </>
          )}
        </ul>
        <form action={einladungAnnehmenAktion}>
          <input type="hidden" name="t" value={t} />
          <button type="submit" className="btn-primary" title="Öffnet Ihren persönlichen Kundenbereich auf diesem Gerät (14 Tage angemeldet)">
            Weiter zum Kundenbereich
          </button>
        </form>
        <p className="lfk-klein" style={{ marginTop: "0.9rem" }}>
          Ihr persönlicher Link gilt bis {datumDe(k.einladung?.bis)}. Bitte leiten Sie ihn nicht weiter.
        </p>
      </section>
    </div>
  );
}
