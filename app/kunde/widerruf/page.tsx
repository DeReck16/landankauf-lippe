import type { Metadata } from "next";
import Link from "next/link";
import * as M from "@/lib/portal/model";
import { ladeKundenSitzung } from "@/lib/portal/sitzung";
import { istKundeId } from "@/lib/portal/speicher";
import { datumDe } from "@/lib/portal/texte";
import { FIRMA, FIRMA_ANSCHRIFT } from "@/lib/vertraege/firma";
import { widerrufAktion } from "../actions";

export const metadata: Metadata = { title: "Vertrag widerrufen" };

const FEHLER: Record<string, string> = {
  name: "Bitte geben Sie Ihren Namen an.",
  zuordnung: "Wir konnten den Vertrag nicht zuordnen. Bitte prüfen Sie die Vorgangsnummer (steht in der Bestätigungs-E-Mail und im PDF, z. B. „LL-…“) und die E-Mail-Adresse — oder widerrufen Sie formlos per E-Mail.",
  "kein-widerrufsrecht": "Für diesen Vertrag besteht kein gesetzliches Widerrufsrecht (z. B. als Unternehmer oder bei der kostenlosen Anbieter-Vereinbarung). Sie können ihn aber jederzeit kündigen.",
};

// Widerrufsfunktion nach § 356a BGB: Schaltfläche „Vertrag widerrufen“ →
// Angaben (Name, Vertrag, E-Mail für die Bestätigung) → „Widerruf bestätigen“ →
// Eingangsbestätigung per E-Mail mit Inhalt, Datum und Uhrzeit. Auch ohne
// Anmeldung erreichbar.
export default async function WiderrufPage(props: PageProps<"/kunde/widerruf">) {
  const sp = await props.searchParams;
  const sitzung = await ladeKundenSitzung();
  const okId = typeof sp.ok === "string" && istKundeId(sp.ok) ? sp.ok : "";
  if (okId) {
    return (
      <div className="lfk-seite" style={{ maxWidth: "40rem" }}>
        <section className="lfk-karte">
          <h1 className="lfk-h1">Widerruf eingegangen</h1>
          <p className="lfk-hinweis lfk-hinweis-ok">
            Vielen Dank — Ihr Widerruf zum Vorgang {okId} ist bei uns eingegangen. Eine Eingangsbestätigung mit Inhalt, Datum und Uhrzeit haben wir an die hinterlegte E-Mail-Adresse geschickt.
          </p>
          <p className="lfk-klein">Wir geben ab sofort keine Kontaktdaten mehr weiter und stellen Ihnen keine Flächen mehr vor.</p>
        </section>
      </div>
    );
  }

  const vorauswahl = typeof sp.k === "string" ? sp.k : "";
  const eigene = (sitzung?.kunden ?? []).filter((k) => k.vertrag && M.hatWiderrufsrecht(k) && !k.widerruf);
  const gewaehlt = eigene.find((k) => k.id === vorauswahl) ?? eigene[0];
  const fehler = typeof sp.fehler === "string" ? FEHLER[sp.fehler] : undefined;

  return (
    <div className="lfk-seite" style={{ maxWidth: "40rem" }}>
      <section className="lfk-karte">
        <h1 className="lfk-h1">Vertrag widerrufen</h1>
        <p className="lfk-unterzeile">
          Hier können Sie Ihren Vertrag mit Lippe Forst innerhalb der Widerrufsfrist online widerrufen. Sie erhalten sofort eine Eingangsbestätigung per E-Mail. Alternativ genügt eine formlose E-Mail an {FIRMA.email} oder ein Brief an {FIRMA_ANSCHRIFT}.
        </p>
        {fehler && <p className="lfk-hinweis lfk-hinweis-fehler">{fehler}</p>}
        <form action={widerrufAktion} className="lfk-form">
          <label>
            <span className="field-label">Ihr Name *</span>
            <input name="name" required defaultValue={gewaehlt?.stammdaten?.name ?? ""} autoComplete="name" className="field-input" title="Name der Person, die den Vertrag geschlossen hat" />
          </label>
          {eigene.length > 1 ? (
            <label>
              <span className="field-label">Vertrag *</span>
              <select name="vertrag" defaultValue={gewaehlt?.id} className="field-select" title="Welchen Vertrag möchten Sie widerrufen?">
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
              <input
                name="vertrag"
                required
                defaultValue={gewaehlt?.id ?? ""}
                placeholder="LL-…"
                className="field-input"
                title="Steht in der Bestätigungs-E-Mail und im Vertrags-PDF (Feld „Vorgang“)"
              />
              {gewaehlt?.vertrag && <span className="lfk-klein">{gewaehlt.vertrag.titel}, unterschrieben am {datumDe(gewaehlt.vertrag.signatur.am)}</span>}
            </label>
          )}
          <label>
            <span className="field-label">E-Mail-Adresse für die Eingangsbestätigung *</span>
            <input name="email" type="email" required defaultValue={gewaehlt?.email ?? sitzung?.email ?? ""} autoComplete="email" className="field-input" title="Die E-Mail-Adresse, mit der Sie den Vertrag geschlossen haben — dorthin geht die Bestätigung" />
          </label>
          <label>
            <span className="field-label">Nachricht (freiwillig)</span>
            <textarea name="nachricht" className="field-textarea" style={{ minHeight: "4rem" }} title="Eine Begründung ist nicht nötig" />
          </label>
          <p className="lfk-klein">
            Mit dem Knopf erklären Sie: Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über die Erbringung der Dienstleistung (Nachweis und Vermittlung von Flächen).
          </p>
          <div className="lfk-knopfreihe">
            <button type="submit" className="lfk-knopf-warn" title="Sendet Ihren Widerruf verbindlich ab — Sie erhalten sofort eine Eingangsbestätigung per E-Mail">
              Widerruf bestätigen
            </button>
            <Link href="/kunde" className="btn-secondary lfk-knopf-klein" title="Nichts widerrufen, zurück zur Übersicht">
              Abbrechen
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
