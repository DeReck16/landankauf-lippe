"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { seitText, type AssistentAktion, type AssistentChip, type AssistentFeld, type AssistentMeldung, type AssistentPlan } from "@/lib/portal/assistent-typen";
import { assistentAktion, type AssistentState } from "../assistent-actions";
import { ergebnisLoeschen, ergebnisSetzen, useErgebnis } from "./ergebnisse";

// Klick-Assistent je Vorgang (Plan: lib/portal/assistent.ts). Er sagt ehrlich, wo
// es steht und worauf gewartet wird, zeigt offene Meldungen der Kunden und bietet
// genau EINEN Hauptknopf für den nächsten Schritt (groß und pulsierend nur, wenn
// jetzt etwas zu tun ist). Vor dem Ausführen fragt er direkt im Kasten nach und
// zeigt, was passiert und welche Mails an wen mit welchem Betreff rausgehen (Text
// zum Aufklappen). Ausgeführt wird erst mit „Ja – …“; das Ergebnis steht danach
// an der Karte (✓/✗ je Schritt und je Mail).

function zahlLesen(raw: string): number | null {
  const s = raw.replace(/\s/g, "").replace(/€/g, "");
  if (!s) return null;
  const n = Number(/,/.test(s) ? s.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function euro(n: number): string {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function haText(ha: number): string {
  return `${ha.toLocaleString("de-DE", { maximumFractionDigits: 4 })} ha`;
}

function datumZeit(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
}

function tagDe(ymd: string): string {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : ymd;
}

const CHIP_FARBE: Record<AssistentChip["art"], string> = { ok: "lfa-badge-ok", warn: "lfa-badge-warn", rot: "lfa-badge-rot", grau: "lfa-badge-keine" };

/** Status-Chips (z. B. „Freigegeben am …“, „Pachtvertrag geschlossen (PDF)“). */
export function Chips({ chips }: { chips: AssistentChip[] }) {
  if (chips.length === 0) return null;
  return (
    <span className="lfa-dash-chips">
      {chips.map((c) =>
        c.href ? (
          <a key={c.text} href={c.href} target="_blank" rel="noopener" className={`lfa-badge lfa-badge-lang ${CHIP_FARBE[c.art]}`} title={c.tipp}>
            {c.text}
          </a>
        ) : (
          <span key={c.text} className={`lfa-badge lfa-badge-lang ${CHIP_FARBE[c.art]}`} title={c.tipp}>
            {c.text}
          </span>
        ),
      )}
    </span>
  );
}

/** Live-Vorschau beim Pachtzins: was ergibt das als Jahrespacht? */
function pachtVorschau(a: AssistentAktion, werte: Record<string, string>): string | null {
  if (a.id !== "pacht-vorbereiten") return null;
  const zins = zahlLesen(werte.zins ?? "");
  if (zins == null || zins <= 0) return null;
  const ha = a.flaecheHa ?? null;
  if (werte.einheit === "jahr") return `= Jahrespacht ${euro(zins)} netto${ha ? ` (entspricht ${euro(Math.round((zins / ha) * 100) / 100)} je Hektar bei ${haText(ha)})` : ""}`;
  if (ha == null) return "Die Jahrespacht lässt sich erst mit der Flächengröße berechnen — im Formular ergänzen.";
  return `= Jahrespacht ${euro(Math.round(zins * ha * 100) / 100)} netto (${euro(zins)} × ${haText(ha)})`;
}

/** Zahlungsziel: Rechnungsdatum + Tage → „zahlbar bis …“ */
function zahlungVorschau(a: AssistentAktion, werte: Record<string, string>): string | null {
  if (a.id !== "provision-abgerechnet") return null;
  const tage = zahlLesen(werte.zahlungsziel ?? "");
  const m = (werte.rechnungsdatum ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m || tage == null || tage < 1) return null;
  const bis = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + Math.round(tage)));
  return `= zahlbar bis ${tagDe(bis.toISOString().slice(0, 10))}`;
}

function Ergebnis({ state, schliessen }: { state: AssistentState; schliessen: () => void }) {
  const farbe = state.status === "ok" ? "lfa-hinweis-ok" : state.status === "fehler" ? "lfa-hinweis-fehler" : "";
  return (
    <div className={`lfa-hinweis lfa-assistent-ergebnis ${farbe}`} role="status">
      <div className="lfa-assistent-ergebnis-kopf">
        <strong>
          {state.titel} <span className="lfa-klein">· {datumZeit(state.am)}</span>
        </strong>
        <button type="button" className="lfa-assistent-zu" onClick={schliessen} title="Rückmeldung ausblenden" aria-label="Rückmeldung ausblenden">
          ×
        </button>
      </div>
      {state.zeilen.length ? (
        <ul className="lfa-assistent-zeilen">
          {state.zeilen.map((z, i) => (
            <li key={i} className={`lfa-assistent-zeile-${z.art}`}>
              {z.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Feld({ f, wert, setzen }: { f: AssistentFeld; wert: string; setzen: (w: string) => void }) {
  if (f.typ === "auswahl") {
    return (
      <label>
        {f.label}
        <select name={f.name} value={wert} onChange={(e) => setzen(e.target.value)} className="field-select" title={f.tipp}>
          {(f.optionen ?? []).map((o) => (
            <option key={o.wert} value={o.wert}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <label>
      {f.label}
      <input
        name={f.name}
        type={f.typ === "datum" ? "date" : "text"}
        inputMode={f.typ === "zahl" ? "decimal" : undefined}
        required={f.pflicht}
        value={wert}
        onChange={(e) => setzen(e.target.value)}
        placeholder={f.platzhalter}
        autoComplete="off"
        className="field-input"
        title={f.tipp}
      />
    </label>
  );
}

function Rueckfrage({ a, test, pending, werte, abbrechen }: { a: AssistentAktion; test: boolean; pending: boolean; werte: Record<string, string>; abbrechen: () => void }) {
  const eingaben = (a.felder ?? [])
    .map((f) => {
      const w = werte[f.name] ?? "";
      if (!w) return null;
      const anzeige = f.typ === "auswahl" ? (f.optionen?.find((o) => o.wert === w)?.label ?? w) : f.typ === "datum" ? tagDe(w) : w;
      return `${f.label}: ${anzeige}`;
    })
    .filter(Boolean);
  const vorschau = pachtVorschau(a, werte) ?? zahlungVorschau(a, werte);
  return (
    <div className="lfa-assistent-frage" role="alertdialog" aria-label="Sicherheitsabfrage">
      <strong>{a.frage}</strong>
      {eingaben.length > 0 && (
        <p className="lfa-klein" style={{ margin: 0 }}>
          Ihre Eingaben: {eingaben.join(" · ")}
          {vorschau ? ` ${vorschau}` : ""}
        </p>
      )}
      <div>
        <span className="lfa-assistent-zwischen">Das passiert:</span>
        <ul className="lfa-assistent-liste">
          {a.passiert.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
      {a.mails.length > 0 ? (
        <div>
          <span className="lfa-assistent-zwischen">{a.mails.length === 1 ? "Diese E-Mail geht raus:" : `Diese ${a.mails.length} E-Mails gehen raus:`}</span>
          <ul className="lfa-assistent-mails">
            {a.mails.map((m) => (
              <li key={`${m.zweck}-${m.rolle}`}>
                <details>
                  <summary title="Zeigt den vollständigen Text dieser E-Mail">
                    an <strong>{m.wer}</strong> · {m.an} — Betreff „{m.betreff}“
                  </summary>
                  {m.hinweis && <p className="lfa-klein" style={{ margin: "0.4rem 0 0" }}>{m.hinweis}</p>}
                  <div className="lfa-mailtext">{m.text}</div>
                </details>
                {m.zuletzt && <div className="lfa-klein">Zuletzt mit diesem Zweck gesendet am {datumZeit(m.zuletzt)} — dies ist eine erneute Mail.</div>}
              </li>
            ))}
          </ul>
          <p className="lfa-klein" style={{ margin: "0.35rem 0 0" }}>
            Absender lippeforst.de, Antworten gehen ins Anfragenpostfach, eine Kopie (Bcc) an die Verwaltung. Der gesendete Text steht danach im Verlauf.
            {test ? " Testmodus: Es wird nichts verschickt, nur protokolliert." : ""}
          </p>
        </div>
      ) : a.folgeMails?.length ? null : (
        <p className="lfa-klein" style={{ margin: 0 }}>Es geht keine E-Mail an Kunden raus.</p>
      )}
      {a.folgeMails?.length ? (
        <div>
          <span className="lfa-assistent-zwischen">{a.mails.length ? "Außerdem automatisch:" : "Dabei geht automatisch raus:"}</span>
          <ul className="lfa-assistent-liste">
            {a.folgeMails.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="lfa-knopfreihe">
        <button type="submit" className="lfa-knopf lfa-assistent-knopf" disabled={pending} title={`Führt jetzt aus: ${a.knopf}`}>
          {pending ? "Wird ausgeführt …" : `Ja – ${a.knopf}`}
        </button>
        <button type="button" className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" disabled={pending} onClick={abbrechen} title="Nichts ausführen, zurück">
          Nein, zurück
        </button>
        {a.vorschau && (
          <a href={a.vorschau.href} target="_blank" rel="noopener" className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" title={`${a.vorschau.tipp} (neuer Tab)`}>
            {a.vorschau.text}
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Ein Knopf mit Eingabefeldern und Rückfrage — je Plan-Stand neu (key = Signatur).
 * `gross`: Hauptknopf (gefüllt und pulsierend, wenn jetzt dran; sonst ruhig umrandet).
 */
function AktionsForm({ a, planKey, test, gross }: { a: AssistentAktion; planKey: string; test: boolean; gross: boolean }) {
  const [fragen, setFragen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [werte, setWerte] = useState<Record<string, string>>(() => Object.fromEntries((a.felder ?? []).map((f) => [f.name, f.wert ?? f.optionen?.[0]?.wert ?? ""])));
  const vorschau = pachtVorschau(a, werte) ?? zahlungVorschau(a, werte);
  const aktiv = gross && a.dran && !a.gesperrt;
  const knopfKlasse = gross
    ? `lfa-knopf lfa-assistent-knopf ${aktiv ? "lfa-puls-ring" : "lfa-knopf-hell"}`
    : "lfa-knopf lfa-knopf-hell lfa-knopf-klein";

  return (
    <form
      className={`lfa-assistent-form ${gross ? "" : "lfa-assistent-form-klein"}`}
      onSubmit={(ev) => {
        // Selbst abschicken: das Ergebnis geht an die Karte, auch wenn sie danach den Abschnitt wechselt.
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        startTransition(async () => {
          const r = await assistentAktion(fd);
          ergebnisSetzen(planKey, r);
          // Verschwindet die Karte (Paar verworfen), zeigt das Dashboard die Rückmeldung oben.
          if (r.weg) ergebnisSetzen("weg", r);
          setFragen(false);
        });
      }}
    >
      <input type="hidden" name="key" value={planKey} />
      <input type="hidden" name="aktion" value={a.id} />
      <input type="hidden" name="ziel" value={a.ziel ?? ""} />
      <input type="hidden" name="signatur" value={a.signatur} />
      {a.felder?.length && (gross || fragen) ? (
        <div className="lfa-inline lfa-assistent-felder">
          {a.felder.map((f) => (
            <Feld key={f.name} f={f} wert={werte[f.name] ?? ""} setzen={(w) => setWerte((x) => ({ ...x, [f.name]: w }))} />
          ))}
        </div>
      ) : null}
      {vorschau && (gross || fragen) && <p className="lfa-klein" style={{ margin: 0 }}>{vorschau}</p>}
      {fragen ? (
        <Rueckfrage a={a} test={test} pending={pending} werte={werte} abbrechen={() => setFragen(false)} />
      ) : (
        <div className="lfa-knopfreihe">
          <button
            type="button"
            className={knopfKlasse}
            disabled={Boolean(a.gesperrt) || pending}
            title={a.gesperrt ? `Gesperrt: ${a.gesperrt}` : a.tipp}
            onClick={(e) => {
              // Kleine Knöpfe mit Feldern zeigen die Felder erst jetzt; Pflichtfelder prüft dann „Ja – …“.
              const form = e.currentTarget.form;
              if (form && gross && !form.reportValidity()) return;
              setFragen(true);
            }}
          >
            {a.knopf}
          </button>
          {gross && a.link && (
            <Link href={a.link.href} className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" title={a.link.tipp}>
              {a.link.text}
            </Link>
          )}
        </div>
      )}
      {gross && a.gesperrt && (
        <p className="lfa-assistent-sperre" role="note">
          Gesperrt: {a.gesperrt}
        </p>
      )}
    </form>
  );
}

function MeldungBox({ m, planKey, test }: { m: AssistentMeldung; planKey: string; test: boolean }) {
  const [erste, ...rest] = m.aktionen;
  return (
    <div className={`lfa-assistent-meldung lfa-assistent-meldung-${m.art}`} role="note">
      <div className="lfa-assistent-meldung-kopf">
        <span className="lfa-puls" title="Offene Meldung aus dem Kundenbereich" />
        <strong>{m.titel}</strong>
        <span className="lfa-klein">{datumZeit(m.am)}</span>
      </div>
      <div className="lfa-assistent-meldungstext">{m.text}</div>
      {erste && <AktionsForm key={erste.signatur} a={erste} planKey={planKey} test={test} gross />}
      {(rest.length > 0 || m.antworten) && (
        <div className="lfa-assistent-neben">
          {m.antworten && (
            <a href={m.antworten.href} className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" title={m.antworten.tipp}>
              {m.antworten.text}
            </a>
          )}
          {rest.map((a) => (
            <AktionsForm key={a.signatur} a={a} planKey={planKey} test={test} gross={false} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * `weitere`: „Weitere Aktionen“ des Assistenten zeigen (Paar beenden, Zurück zum Entwurf,
 * außerhalb geschlossen …). `ohneChips`: Chips stehen schon im Kopf der Karte (Dashboard).
 */
export default function Assistent({
  plan,
  kompakt = false,
  weitere = true,
  ohneChips = false,
}: {
  plan: AssistentPlan;
  kompakt?: boolean;
  weitere?: boolean;
  ohneChips?: boolean;
}) {
  const ergebnis = useErgebnis(plan.key);
  const ergebnisRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Nach dem Ausführen das Ergebnis ins Bild holen (die Rückfrage mit aufgeklappten Mails kann lang sein).
    if (ergebnis?.am) ergebnisRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [ergebnis?.am]);
  const a = plan.aktion;
  const zusatz = plan.neben.filter((x) => x.platz === "zusatz");
  const mehr = plan.neben.filter((x) => x.platz === "weitere");
  const jetzt = plan.meldungen.length > 0 || Boolean(a && a.dran && !a.gesperrt);
  const titel = plan.nr ? `Schritt ${plan.nr} von ${plan.gesamt}: ${plan.titel}` : plan.titel;

  return (
    <section className={`lfa-assistent${kompakt ? " lfa-assistent-kompakt" : ""}${jetzt ? "" : " lfa-assistent-ruhig"}`} aria-label="Assistent: nächster Schritt">
      <div className="lfa-assistent-kopf">
        <span className="lfa-assistent-marke" title="Der Assistent zeigt den nächsten Schritt und erledigt ihn mit einem Klick — immer erst nach Rückfrage, nie automatisch">
          Assistent
        </span>
        {jetzt && <span className="lfa-puls" title="Jetzt dran — hier ist etwas zu tun" aria-label="jetzt dran" />}
        <span className="lfa-assistent-titel">{titel}</span>
      </div>
      {!ohneChips && <Chips chips={plan.chips} />}
      {ergebnis && (
        <div ref={ergebnisRef}>
          <Ergebnis state={ergebnis} schliessen={() => ergebnisLoeschen(plan.key)} />
        </div>
      )}
      <p className="lfa-assistent-stand">{plan.stand}</p>
      {plan.warten.length > 0 && (
        <div className="lfa-assistent-warten">
          <span className="lfa-assistent-zwischen" title="Darauf wartet der Vorgang gerade — der Assistent kann das nicht selbst erledigen">
            Worauf gewartet wird:
          </span>
          <ul className="lfa-assistent-liste">
            {plan.warten.map((w) => (
              <li key={w.text}>
                {w.text}
                {w.seit ? <span className="lfa-klein"> — wartet {seitText(w.seit, plan.am)}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      {plan.hinweise.map((h) => (
        <p key={h.text} className={`lfa-hinweis lfa-assistent-hinweis ${h.warn ? "lfa-hinweis-fehler" : ""}`}>
          {h.text}
        </p>
      ))}
      {plan.meldungen.map((m) => (
        <MeldungBox key={m.id} m={m} planKey={plan.key} test={plan.test} />
      ))}
      {a && <AktionsForm key={a.signatur} a={a} planKey={plan.key} test={plan.test} gross />}
      {zusatz.length > 0 && (
        <div className="lfa-assistent-neben">
          {zusatz.map((x) => (
            <AktionsForm key={x.signatur} a={x} planKey={plan.key} test={plan.test} gross={false} />
          ))}
        </div>
      )}
      {weitere && mehr.length > 0 && (
        <details className="lfa-weitere lfa-weitere-klein">
          <summary title="Seltener gebraucht: Paar beenden, zurück zum Entwurf, außerhalb geschlossen erfassen …">Weitere Aktionen</summary>
          <div className="lfa-assistent-neben">
            {mehr.map((x) => (
              <AktionsForm key={x.signatur} a={x} planKey={plan.key} test={plan.test} gross={false} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
