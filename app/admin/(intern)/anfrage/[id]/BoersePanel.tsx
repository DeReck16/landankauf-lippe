import Link from "next/link";
import BoerseKarte from "@/components/boerse/BoerseKarte";
import { grobeLage } from "@/lib/admin/matching";
import type { LeadView, Zustand } from "@/lib/admin/model";
import { angebotZuCode, boerseLuecken } from "@/lib/boerse";
import { FLAECHENTYPEN } from "@/lib/lead-options";
import { boerseAktion } from "../../../actions";
import BestaetigenKnopf from "../../BestaetigenKnopf";

function heute(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function tag(ymdOderIso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(ymdOderIso) ? new Date(`${ymdOderIso}T12:00:00`) : new Date(ymdOderIso);
  return d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
}

function Versteckt({ id, aktion }: { id: string; aktion: string }) {
  return (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="aktion" value={aktion} />
    </>
  );
}

/** Hinweis bei einem Gesuch, das über ein Börsen-Angebot kam. */
export function BoerseHerkunft({ l, zustand }: { l: LeadView; zustand: Zustand }) {
  if (l.boerse === "—") return null;
  const angebotId = angebotZuCode(zustand.anfragen, l.boerse);
  const key = angebotId ? `${angebotId}~${l.id}` : null;
  return (
    <p className="lfa-hinweis lfa-hinweis-ok">
      Interesse über die Flächenbörse: Angebot <strong>{l.boerse}</strong>.{" "}
      {angebotId && (
        <>
          <Link href={`/admin/anfrage/${angebotId}`} title="Anfrage des Eigentümers dieses Börsen-Angebots öffnen">Angebot öffnen</Link>
          {" · "}
          <Link href={`/admin/vorgang/${key}`} title="Vorgang dieses Paares öffnen — dort geht es Schritt für Schritt weiter">Vorgang öffnen</Link>
        </>
      )}
    </p>
  );
}

/** Flächenbörse für ein Angebot (Kauf oder Pacht): Einwilligung, anonyme Angaben, Vorschau, veröffentlichen. */
export default function BoersePanel({ l, zustand }: { l: LeadView; zustand: Zustand }) {
  const b = l.meta.boerse;
  if (!b && !(l.rolle === "angebot" && (l.art === "kauf" || l.art === "pacht"))) return null;
  const pacht = l.art === "pacht";
  const vorschlagHa = l.groesseWert.minHa ?? l.groesseWert.maxHa;
  const gemeinde = grobeLage(l, zustand.orte);
  const werte = {
    code: b?.code ?? "LF-…",
    art: (pacht ? "pacht" : "kauf") as "pacht" | "kauf",
    typ: b?.typ || ((FLAECHENTYPEN as readonly string[]).includes(l.typ) ? l.typ : "Ackerland"),
    // Vorschläge auch nach dem Erfassen der Einwilligung (dann gibt es b schon, aber noch ohne Angaben).
    groesseHa: b?.groesseHa ?? (vorschlagHa != null ? Math.round(vorschlagHa * 2) / 2 : null),
    lage: b?.lage || (gemeinde ? `Raum ${gemeinde}` : ""),
    text: b?.text ?? "",
  };
  const luecken = boerseLuecken(b, l);
  const name = l.name !== "—" ? l.name : "";
  const betreff = "Ihre Fläche anonym in der Flächenbörse von Lippe Forst?";
  const bitte = [
    `Guten Tag${name ? ` ${name}` : ""},`,
    "",
    `damit wir Ihre Fläche schneller an passende ${pacht ? "Pächter" : "Käufer"} vermitteln können, würden wir sie gern anonym in unserer Flächenbörse auf lippeforst.de zeigen — nur mit Flächentyp, ungefährer Größe und grober Lage (z. B. „Grünland, ca. 5 ha, Raum Kalletal“).`,
    "",
    "Ihren Namen, das Flurstück und die genaue Lage nennen wir niemandem, bevor Sie dem konkreten Interessenten zugestimmt haben. Für Sie bleibt alles kostenlos.",
    "",
    "Sind Sie einverstanden? Eine kurze Antwort auf diese E-Mail genügt. Ihre Einwilligung können Sie jederzeit widerrufen — dann nehmen wir das Angebot sofort heraus.",
    "",
    "Mit freundlichen Grüßen",
    "Dennis Reckling",
    "Lippe Forst · lippeforst.de",
  ].join("\n");

  return (
    <section className="lfa-panel" id="boerse">
      <div className="lfa-titelzeile" style={{ marginBottom: "0.4rem" }}>
        <h2 className="lfa-h2" style={{ marginBottom: 0 }}>Flächenbörse</h2>
        <span className={`lfa-badge lfa-badge-lang ${b?.online ? "lfa-badge-ok" : "lfa-badge-keine"}`} title={b?.online ? "Das Angebot steht anonym auf lippeforst.de" : "Das Angebot steht nicht auf der Website"}>
          {b?.online ? `online seit ${tag(b.seit ?? b.geaendert?.am ?? new Date().toISOString())} · ${b.code}` : "nicht online"}
        </span>
      </div>
      <p className="lfa-klein" style={{ marginBottom: "0.75rem" }}>
        Anonym auf der Startseite und unter /flaechenboerse: nur Flächentyp, ungefähre Größe, grobe Lage und ein kurzer Text. Nur mit Einwilligung des Eigentümers. Interessenten landen als Gesuch hier und laufen durch die normalen Schritte (Provisionsvereinbarung vor der Freigabe).
        {b?.online && (
          <>
            {" "}
            <a href={`/flaechenboerse/${b.code}`} target="_blank" rel="noopener" title="Öffentliche Angebotsseite in neuem Tab öffnen">Öffentliche Seite ansehen</a>
          </>
        )}
      </p>

      <h3 className="lfa-h3">1. Einwilligung des Eigentümers</h3>
      {b?.einwilligung ? (
        <div className="lfa-knopfreihe" style={{ marginBottom: "0.75rem" }}>
          <span className="lfa-klein">
            ✓ Eingewilligt am {tag(b.einwilligung.am)} ({b.einwilligung.quelle}), erfasst von {b.einwilligung.von}
          </span>
          <form action={boerseAktion}>
            <Versteckt id={l.id} aktion="einwilligung-zurueck" />
            <BestaetigenKnopf className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" frage="Einwilligung widerrufen? Das Angebot wird sofort von der Website genommen." tipp="Der Eigentümer hat seine Einwilligung widerrufen — Angebot sofort offline nehmen">
              Einwilligung widerrufen
            </BestaetigenKnopf>
          </form>
        </div>
      ) : (
        <>
          <form action={boerseAktion} className="lfa-inline" style={{ marginBottom: "0.5rem" }}>
            <Versteckt id={l.id} aktion="einwilligung" />
            <label>
              Datum
              <input type="date" name="am" defaultValue={heute()} required className="field-input" title="Wann der Eigentümer eingewilligt hat" />
            </label>
            <label>
              Wie
              <select name="quelle" defaultValue="telefonisch" className="field-select" title="Wie die Einwilligung erteilt wurde">
                <option value="telefonisch">telefonisch</option>
                <option value="per E-Mail">per E-Mail</option>
                <option value="schriftlich">schriftlich</option>
                <option value="im Kundenbereich">im Kundenbereich</option>
              </select>
            </label>
            <button type="submit" className="lfa-knopf lfa-knopf-klein" title="Einwilligung des Eigentümers in die anonyme Veröffentlichung erfassen (Pflicht vor dem Veröffentlichen)">
              Einwilligung erfassen
            </button>
          </form>
          <details className="lfa-details" style={{ marginBottom: "0.75rem" }}>
            <summary title="Fertiger Text, um den Eigentümer um seine Einwilligung zu bitten">Einwilligung erfragen: Text</summary>
            <textarea readOnly defaultValue={bitte} className="field-textarea" rows={9} title="Text zum Kopieren — oder unten im Mailprogramm öffnen" style={{ marginTop: "0.5rem" }} />
            {l.email !== "—" && (
              <a
                href={`mailto:${l.email}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(bitte)}`}
                className="lfa-knopf lfa-knopf-hell lfa-knopf-klein"
                style={{ marginTop: "0.4rem" }}
                title="Öffnet Ihr Mailprogramm mit Empfänger, Betreff und Text — gesendet wird dort"
              >
                Im Mailprogramm öffnen
              </a>
            )}
          </details>
        </>
      )}

      <h3 className="lfa-h3">2. Anonyme Angaben</h3>
      <form action={boerseAktion} className="lfa-formraster" style={{ marginBottom: "0.75rem" }}>
        <Versteckt id={l.id} aktion="speichern" />
        <label>
          Flächentyp
          <select name="typ" defaultValue={werte.typ} className="field-select" title="Flächentyp, wie er öffentlich erscheint">
            {FLAECHENTYPEN.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          Ungefähre Größe (ha)
          <input name="groesseHa" inputMode="decimal" defaultValue={werte.groesseHa != null ? String(werte.groesseHa).replace(".", ",") : ""} className="field-input" title="Öffentlich als „ca. … ha“ — lieber runden, damit die Fläche nicht erkennbar wird" />
        </label>
        <label className="lfa-breit">
          Grobe Lage
          <input name="lage" defaultValue={werte.lage} placeholder="z. B. Raum Kalletal" className="field-input" title="Nur Gemeinde oder Raum — keine Ortsteile, Straßen oder Flurnamen" />
        </label>
        <label className="lfa-breit">
          Kurzbeschreibung (optional, höchstens 300 Zeichen)
          <textarea name="text" defaultValue={werte.text} maxLength={300} rows={3} className="field-textarea" title="Z. B. Bodenqualität, Zuwegung, Pachtstatus — ohne Namen, Flurstücke oder Adressen" />
        </label>
        <div className="lfa-breit">
          <button type="submit" className="lfa-knopf lfa-knopf-klein" title="Angaben speichern — ist das Angebot online, wird die Website sofort aktualisiert">
            Angaben speichern
          </button>
        </div>
      </form>

      <h3 className="lfa-h3">3. Vorschau und veröffentlichen</h3>
      <div style={{ maxWidth: "26rem", marginBottom: "0.75rem" }}>
        <BoerseKarte a={werte} mitLink={false} />
      </div>
      {luecken.length > 0 && (
        <ul className="lfa-pruefliste" style={{ marginBottom: "0.6rem" }}>
          {luecken.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      <div className="lfa-knopfreihe">
        {!b?.online ? (
          <form action={boerseAktion}>
            <Versteckt id={l.id} aktion="online" />
            <BestaetigenKnopf
              disabled={luecken.length > 0}
              frage="Angebot jetzt anonym auf lippeforst.de zeigen (Startseite und Flächenbörse)?"
              tipp={luecken.length ? `Noch nicht möglich: ${luecken.join(" · ")}` : "Zeigt das Angebot sofort anonym auf der Website"}
            >
              Veröffentlichen
            </BestaetigenKnopf>
          </form>
        ) : (
          <form action={boerseAktion}>
            <Versteckt id={l.id} aktion="offline" />
            <BestaetigenKnopf className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" frage="Angebot von der Website nehmen?" tipp="Nimmt das Angebot sofort von der Website (z. B. verkauft, verpachtet oder Einwilligung widerrufen)">
              Aus der Börse nehmen
            </BestaetigenKnopf>
          </form>
        )}
      </div>
    </section>
  );
}
