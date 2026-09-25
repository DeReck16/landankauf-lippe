import type { Metadata } from "next";
import Link from "next/link";
import * as A from "@/lib/portal/ablauf";
import { BERATUNG_THEMEN, antwortGruppe, antwortOptionen, themaVorschlag, type RueckmeldungArt } from "@/lib/portal/rueckmeldung-typen";
import { ladeKunde } from "@/lib/portal/speicher";
import { datumDe, wert } from "@/lib/portal/texte";
import { pruefeAntwort } from "@/lib/portal/token";
import { FIRMA } from "@/lib/vertraege/firma";
import { antwortAktion } from "./actions";

export const metadata: Metadata = { title: "Ihre Antwort" };

// Antwortseite der Nachfass-Mail: Der Kunde wählt, wie es weitergeht (verkaufen,
// verpachten bzw. weitersuchen, Beratung mit Thema, kein Interesse; Anbieter auch
// „Missverständnis — ich suche selbst eine Fläche“) — daraus wird
// im Dashboard ein Ticket (lib/portal/rueckmeldung.ts). Erreichbar nur mit dem
// persönlichen Antwort-Link; Öffnen allein speichert nichts.

type Option = { titel: string; text: string; tipp: string };

function option(art: RueckmeldungArt, sucheKauf: boolean): Option {
  switch (art) {
    case "verkaufen":
      return { titel: "Ja, ich möchte verkaufen", text: "Wir melden uns mit den nächsten Schritten — für Sie als Eigentümer kostenlos.", tipp: "Sie möchten Ihre Fläche verkaufen — wir melden uns per E-Mail" };
    case "verpachten":
      return { titel: "Ja, ich möchte verpachten", text: "Wir suchen passende Pächter und melden uns — für Sie als Eigentümer kostenlos.", tipp: "Sie möchten Ihre Fläche verpachten — wir melden uns per E-Mail" };
    case "suche":
      return {
        titel: `Ja, ich suche weiter eine Fläche ${sucheKauf ? "zum Kauf" : "zur Pacht"}`,
        text: "Wir melden uns, sobald wir Ihnen passende Flächen vorstellen können.",
        tipp: "Sie suchen weiterhin eine Fläche — wir melden uns per E-Mail",
      };
    case "pachten":
      return {
        titel: "Missverständnis — ich suche selbst eine Fläche zur Pacht",
        text: "Dann nehmen wir Sie als Pachtinteressent auf und melden uns mit den nächsten Schritten.",
        tipp: "Sie möchten selbst eine Fläche pachten (nicht verpachten) — wir melden uns per E-Mail",
      };
    case "kaufen":
      return {
        titel: "Missverständnis — ich suche selbst eine Fläche zum Kauf",
        text: "Dann nehmen wir Sie als Kaufinteressent auf und melden uns mit den nächsten Schritten.",
        tipp: "Sie möchten selbst eine Fläche kaufen (nicht verkaufen) — wir melden uns per E-Mail",
      };
    case "beratung":
      return { titel: "Ich möchte mich beraten lassen", text: "Wählen Sie unten das Thema — wir melden uns per E-Mail.", tipp: "Sie wünschen eine Beratung — bitte unten das Thema wählen" };
    case "kein-interesse":
      return { titel: "Kein Interesse mehr", text: "Wir melden uns danach nicht wieder.", tipp: "Sie haben kein Interesse mehr — wir schreiben Ihnen dazu nicht wieder" };
  }
}

function Ungueltig() {
  return (
    <div className="lfk-seite" style={{ maxWidth: "40rem" }}>
      <section className="lfk-karte">
        <h1 className="lfk-h1">Dieser Link ist nicht mehr gültig</h1>
        <p className="lfk-unterzeile">
          Der Antwort-Link ist abgelaufen oder unvollständig. Schreiben Sie uns einfach eine E-Mail an{" "}
          <a href={`mailto:${FIRMA.email}`} title="Neue E-Mail an Lippe Forst in Ihrem Mailprogramm">{FIRMA.email}</a> — oder nutzen Sie unser{" "}
          <Link href="/kontakt" title="Zum Kontaktformular auf lippeforst.de">Kontaktformular</Link>.
        </p>
      </section>
    </div>
  );
}

export default async function AntwortPage(props: PageProps<"/kunde/antwort">) {
  const sp = await props.searchParams;
  const t = typeof sp.t === "string" ? sp.t : "";
  const token = pruefeAntwort(t);
  const geladen = token ? await A.ladeLead(token.k) : null;
  if (!token || !geladen || geladen.lead.status === "archiv") return <Ungueltig />;

  const l = geladen.lead;
  const kunde = await ladeKunde(l.id);
  if (kunde?.gesperrt || sp.fehler === "anfrage") return <Ungueltig />;
  const name = kunde?.stammdaten?.name || wert(l.name);
  const gruppe = antwortGruppe(l.rolle);
  const sucheKauf = l.art === "kauf";
  const r = l.meta.rueckmeldung;
  const selbst = `/kunde/antwort?t=${encodeURIComponent(t)}`;

  if (sp.ok === "1" && r) {
    const nein = r.art === "kein-interesse";
    return (
      <div className="lfk-seite" style={{ maxWidth: "40rem" }}>
        <section className="lfk-karte">
          <h1 className="lfk-h1">{nein ? "Danke für Ihre Rückmeldung" : "Vielen Dank — Ihre Antwort ist angekommen"}</h1>
          <p className="lfk-hinweis lfk-hinweis-ok">
            {nein
              ? "Wir haben vermerkt, dass Sie kein Interesse mehr haben, und melden uns dazu nicht wieder."
              : `Ihre Antwort: ${option(r.art, sucheKauf).titel}${r.thema ? ` (Thema: ${r.thema})` : ""}. Wir melden uns zeitnah per E-Mail bei Ihnen.`}
          </p>
          <p className="lfk-klein">
            {nein ? "Falls Sie es sich anders überlegen, " : "Möchten Sie noch etwas ergänzen oder ändern, "}
            <Link href={selbst} title="Antwort ansehen und ändern — die neueste Antwort zählt">ändern Sie Ihre Antwort hier</Link> oder schreiben Sie uns an{" "}
            <a href={`mailto:${FIRMA.email}`} title="Neue E-Mail an Lippe Forst in Ihrem Mailprogramm">{FIRMA.email}</a>.
          </p>
        </section>
      </div>
    );
  }

  const optionen = antwortOptionen(gruppe, l.art);
  const gewaehlt = r && optionen.includes(r.art) ? r.art : null;
  const themaStart = r?.thema ?? themaVorschlag(wert(l.intent), wert(l.flaechentyp)) ?? "";
  const eckdaten = [wert(l.intent), wert(l.flaechentyp), wert(l.ort)].filter(Boolean).join(" · ");
  const fehler =
    sp.fehler === "auswahl"
      ? "Bitte wählen Sie eine der Antworten aus."
      : sp.fehler === "zuviel"
        ? `Über diesen Link sind heute schon sehr viele Antworten eingegangen. Bitte versuchen Sie es später noch einmal oder schreiben Sie uns an ${FIRMA.email}.`
        : null;

  return (
    <div className="lfk-seite" style={{ maxWidth: "40rem" }}>
      <section className="lfk-karte">
        <h1 className="lfk-h1">Wie möchten Sie weitermachen?</h1>
        <p className="lfk-unterzeile">
          {name ? `Guten Tag ${name}, ` : "Guten Tag, "}
          vielen Dank, dass Sie sich die Zeit nehmen. Ihre Anfrage vom {datumDe(l.receivedAt)}
          {eckdaten ? `: ${eckdaten}` : ""}.
        </p>
        {r && (
          <p className="lfk-hinweis lfk-hinweis-ok">
            Ihre Antwort vom {datumDe(r.am)}: {option(r.art, sucheKauf).titel}
            {r.thema ? ` (Thema: ${r.thema})` : ""}. Sie können sie hier ändern; es zählt die neueste Antwort.
          </p>
        )}
        {fehler && <p className="lfk-hinweis lfk-hinweis-fehler">{fehler}</p>}
        <form action={antwortAktion} className="lfk-form lfk-antwort-form">
          <input type="hidden" name="t" value={t} />
          <fieldset className="lfk-auswahl" style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="field-label">Ihre Antwort *</legend>
            {optionen.map((art) => {
              const o = option(art, sucheKauf);
              return (
                <label key={art} className="lfk-option" title={o.tipp}>
                  <input type="radio" name="art" value={art} required defaultChecked={gewaehlt === art} />
                  <span>
                    <strong>{o.titel}</strong>
                    {o.text}
                  </span>
                </label>
              );
            })}
          </fieldset>
          <div className="lfk-antwort-beratung">
            <label>
              <span className="field-label">Thema der Beratung</span>
              <select name="thema" defaultValue={themaStart} className="field-select" title="Worüber möchten Sie sich beraten lassen? Ohne Auswahl ordnen wir Ihre Nachricht selbst zu.">
                <option value="">Bitte wählen …</option>
                {BERATUNG_THEMEN.map((th) => (
                  <option key={th} value={th}>
                    {th}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span className="field-label">Nachricht (freiwillig)</span>
            <textarea
              name="nachricht"
              maxLength={1500}
              defaultValue={r?.quelle === "link" ? (r.text ?? "") : ""}
              className="field-textarea"
              style={{ minHeight: "5rem" }}
              placeholder="z. B. Größe und Lage der Fläche, Ihr Zeitrahmen oder Ihre Fragen"
              title="Freiwillig: alles, was uns bei der Antwort hilft"
            />
          </label>
          <div className="lfk-knopfreihe">
            <button type="submit" className="btn-primary" title="Schickt Ihre Antwort an Lippe Forst — über diesen Link können Sie sie später noch ändern">
              Antwort senden
            </button>
          </div>
          <p className="lfk-klein">
            Wir antworten per E-Mail. Ihre Angaben verwenden wir nur zur Bearbeitung Ihrer Anfrage — mehr in der{" "}
            <Link href="/datenschutz" title="Datenschutzerklärung von Lippe Forst">Datenschutzerklärung</Link>.
          </p>
        </form>
      </section>
    </div>
  );
}
