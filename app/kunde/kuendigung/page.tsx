import type { Metadata } from "next";
import Link from "next/link";
import { ladeKundenSitzung } from "@/lib/portal/sitzung";
import { istKundeId } from "@/lib/portal/speicher";
import { datumDe } from "@/lib/portal/texte";
import { FIRMA } from "@/lib/vertraege/firma";
import { kuendigungAktion } from "../actions";

export const metadata: Metadata = { title: "Verträge hier kündigen" };

const FEHLER: Record<string, string> = {
  name: "Bitte geben Sie Ihren Namen an.",
  zuordnung: "Wir konnten den Vertrag nicht zuordnen. Bitte prüfen Sie die Vorgangsnummer (steht in der Bestätigungs-E-Mail und im PDF, z. B. „LL-…“) und die E-Mail-Adresse — oder kündigen Sie formlos per E-Mail.",
  widerrufen: "Dieser Vertrag ist bereits widerrufen.",
};

// Kündigung von Verträgen mit Lippe Forst (Nachweisvertrag, Anbieter-Vereinbarung) —
// vorsorglich nach dem Muster der Kündigungsschaltfläche (§ 312k BGB), auch ohne
// Anmeldung erreichbar. Landpachtverträge sind ausgenommen: sie brauchen die
// schriftliche Kündigung mit Unterschrift (§ 594f BGB).
export default async function KuendigungPage(props: PageProps<"/kunde/kuendigung">) {
  const sp = await props.searchParams;
  const sitzung = await ladeKundenSitzung();
  const okId = typeof sp.ok === "string" && istKundeId(sp.ok) ? sp.ok : "";
  if (okId) {
    return (
      <div className="lfk-seite" style={{ maxWidth: "40rem" }}>
        <section className="lfk-karte">
          <h1 className="lfk-h1">Kündigung eingegangen</h1>
          <p className="lfk-hinweis lfk-hinweis-ok">
            Vielen Dank — Ihre Kündigung zum Vorgang {okId} ist bei uns eingegangen und sofort wirksam. Eine Bestätigung haben wir an die hinterlegte E-Mail-Adresse geschickt.
          </p>
        </section>
      </div>
    );
  }
  const vorauswahl = typeof sp.k === "string" ? sp.k : "";
  const eigene = (sitzung?.kunden ?? []).filter((k) => k.vertrag && !k.kuendigung && !k.widerruf);
  const gewaehlt = eigene.find((k) => k.id === vorauswahl) ?? eigene[0];
  const fehler = typeof sp.fehler === "string" ? FEHLER[sp.fehler] : undefined;

  return (
    <div className="lfk-seite" style={{ maxWidth: "40rem" }}>
      <section className="lfk-karte">
        <h1 className="lfk-h1">Verträge hier kündigen</h1>
        <p className="lfk-unterzeile">
          Ihren Vertrag mit Lippe Forst (Nachweisvertrag bzw. Anbieter-Vereinbarung) können Sie jederzeit ohne Frist kündigen. Flächen, die wir Ihnen vorher nachgewiesen haben, bleiben nach den Vertragsregeln geschützt. Einen Landpachtvertrag kündigen Sie bitte schriftlich mit Unterschrift direkt gegenüber Ihrem Vertragspartner (§ 594f BGB).
        </p>
        {fehler && <p className="lfk-hinweis lfk-hinweis-fehler">{fehler}</p>}
        <form action={kuendigungAktion} className="lfk-form">
          <label>
            <span className="field-label">Ihr Name *</span>
            <input name="name" required defaultValue={gewaehlt?.stammdaten?.name ?? ""} autoComplete="name" className="field-input" title="Name der Person, die den Vertrag geschlossen hat" />
          </label>
          {eigene.length > 1 ? (
            <label>
              <span className="field-label">Vertrag *</span>
              <select name="vertrag" defaultValue={gewaehlt?.id} className="field-select" title="Welchen Vertrag möchten Sie kündigen?">
                {eigene.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.vertrag!.titel} vom {datumDe(k.vertrag!.signatur.am)} ({k.id})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              <span className="field-label">Vorgangsnummer des Vertrags *</span>
              <input name="vertrag" required defaultValue={gewaehlt?.id ?? ""} placeholder="LL-…" className="field-input" title="Steht in der Bestätigungs-E-Mail und im Vertrags-PDF (Feld „Vorgang“)" />
            </label>
          )}
          <label>
            <span className="field-label">Art der Kündigung</span>
            <select name="art" className="field-select" title="Unsere Verträge sind jederzeit fristlos kündbar">
              <option value="ordentlich, sofort">ordentlich, sofort wirksam</option>
              <option value="außerordentlich">außerordentlich (bitte Grund angeben)</option>
            </select>
          </label>
          <label>
            <span className="field-label">E-Mail-Adresse für die Bestätigung *</span>
            <input name="email" type="email" required defaultValue={gewaehlt?.email ?? sitzung?.email ?? ""} autoComplete="email" className="field-input" title="Die E-Mail-Adresse, mit der Sie den Vertrag geschlossen haben" />
          </label>
          <label>
            <span className="field-label">Nachricht / Grund (freiwillig)</span>
            <textarea name="nachricht" className="field-textarea" style={{ minHeight: "4rem" }} title="Bei einer außerordentlichen Kündigung bitte den Grund angeben" />
          </label>
          <div className="lfk-knopfreihe">
            <button type="submit" className="lfk-knopf-warn" title="Kündigt den Vertrag sofort — Sie erhalten eine Bestätigung per E-Mail">
              Jetzt kündigen
            </button>
            <Link href="/kunde" className="btn-secondary lfk-knopf-klein" title="Nichts kündigen, zurück zur Übersicht">
              Abbrechen
            </Link>
          </div>
          <p className="lfk-klein">Alternativ genügt eine formlose E-Mail an {FIRMA.email}.</p>
        </form>
      </section>
    </div>
  );
}
