"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import type { AssistentAktion, AssistentFeld, AssistentPlan } from "@/lib/portal/assistent-typen";
import { assistentAktion, type AssistentState } from "../assistent-actions";
import { zustimmungErfassenAktion } from "../portal-actions";
import BestaetigenKnopf from "./BestaetigenKnopf";

// Klick-Assistent je Vorgang (Plan: lib/portal/assistent.ts). Er sagt ehrlich, wo
// es steht und worauf gewartet wird, und bietet genau EINEN Hauptknopf für den
// nächsten Schritt. Vor dem Ausführen fragt er direkt im Kasten nach und zeigt,
// was passiert und welche Mails an wen mit welchem Betreff rausgehen (Text zum
// Aufklappen). Ausgeführt wird erst mit „Ja – …“.

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

/** Live-Vorschau beim Pachtzins: was ergibt das als Jahrespacht? */
function pachtVorschau(a: AssistentAktion, werte: Record<string, string>): string | null {
  if (a.id !== "pacht-vorbereiten") return null;
  const zins = zahlLesen(werte.zins ?? "");
  if (zins == null || zins <= 0) return null;
  const ha = a.flaecheHa ?? null;
  if (werte.einheit === "jahr") return `= Jahrespacht ${euro(zins)}${ha ? ` (entspricht ${euro(Math.round((zins / ha) * 100) / 100)} je Hektar bei ${haText(ha)})` : ""}`;
  if (ha == null) return "Die Jahrespacht lässt sich erst mit der Flächengröße berechnen — im Formular ergänzen.";
  return `= Jahrespacht ${euro(Math.round(zins * ha * 100) / 100)} (${euro(zins)} × ${haText(ha)})`;
}

function Ergebnis({ state }: { state: AssistentState }) {
  const farbe = state.status === "ok" ? "lfa-hinweis-ok" : state.status === "fehler" ? "lfa-hinweis-fehler" : "";
  return (
    <div className={`lfa-hinweis lfa-assistent-ergebnis ${farbe}`} role="status">
      <strong>
        {state.titel}
        {state.am ? <span className="lfa-klein"> · {datumZeit(state.am)}</span> : null}
      </strong>
      {state.zeilen?.length ? (
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

function Rueckfrage({ a, test, pending, abbrechen }: { a: AssistentAktion; test: boolean; pending: boolean; abbrechen: () => void }) {
  return (
    <div className="lfa-assistent-frage" role="alertdialog" aria-label="Sicherheitsabfrage">
      <strong>{a.frage}</strong>
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
                    <strong>{m.wer}</strong> · {m.an} — Betreff „{m.betreff}“
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
      </div>
    </div>
  );
}

/** Hauptknopf mit Eingabefeldern und Rückfrage — je Plan-Stand neu (key = Signatur). */
function AktionsForm({ a, plan, action, pending, zurueck }: { a: AssistentAktion; plan: AssistentPlan; action: (fd: FormData) => void; pending: boolean; zurueck?: string }) {
  const [fragen, setFragen] = useState(false);
  const [werte, setWerte] = useState<Record<string, string>>(() =>
    Object.fromEntries((a.felder ?? []).map((f) => [f.name, f.wert ?? f.optionen?.[0]?.wert ?? ""])),
  );
  // Nach dem Ausführen (pending → fertig) die Rückfrage schließen.
  const [warPending, setWarPending] = useState(false);
  if (pending !== warPending) {
    setWarPending(pending);
    if (!pending) setFragen(false);
  }
  const vorschau = pachtVorschau(a, werte);

  return (
    <form
      className="lfa-assistent-form"
      onSubmit={(ev) => {
        // Selbst abschicken: <form action> würde die Eingaben nach jeder Antwort zurücksetzen.
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="key" value={plan.key} />
      <input type="hidden" name="aktion" value={a.id} />
      <input type="hidden" name="signatur" value={a.signatur} />
      {zurueck && <input type="hidden" name="zurueck" value={zurueck} />}
      {a.felder?.length ? (
        <div className="lfa-inline lfa-assistent-felder">
          {a.felder.map((f) => (
            <Feld key={f.name} f={f} wert={werte[f.name] ?? ""} setzen={(w) => setWerte((x) => ({ ...x, [f.name]: w }))} />
          ))}
        </div>
      ) : null}
      {vorschau && <p className="lfa-klein" style={{ margin: 0 }}>{vorschau}</p>}
      {fragen ? (
        <Rueckfrage a={a} test={plan.test} pending={pending} abbrechen={() => setFragen(false)} />
      ) : (
        <div className="lfa-knopfreihe">
          <button
            type="button"
            className={`lfa-knopf lfa-assistent-knopf ${a.dran && !a.gesperrt ? "lfa-puls-ring" : ""}`}
            disabled={Boolean(a.gesperrt) || pending}
            title={a.gesperrt ? `Gesperrt: ${a.gesperrt}` : a.tipp}
            onClick={(e) => {
              // Pflichtfelder gleich hier melden, nicht erst nach dem „Ja“.
              const form = e.currentTarget.form;
              if (form && !form.reportValidity()) return;
              setFragen(true);
            }}
          >
            {a.knopf}
          </button>
          {a.link && (
            <Link href={a.link.href} className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" title={a.link.tipp}>
              {a.link.text}
            </Link>
          )}
        </div>
      )}
      {a.gesperrt && (
        <p className="lfa-assistent-sperre" role="note">
          Warum gesperrt: {a.gesperrt}
        </p>
      )}
    </form>
  );
}

/**
 * `zurueck`: Seite für Rückmeldungen der Nebenknöpfe. `umleiten`: nach dem Hauptknopf zurück
 * zu dieser Seite mit Meldung (Listen wie Dashboard und Matching — die Karte kann dort den
 * Abschnitt wechseln); sonst bleibt das Ergebnis im Kasten stehen (Vorgangsseite).
 * `meldung`: Rückmeldung für genau diese Karte nach der Umleitung.
 */
export default function Assistent({
  plan,
  zurueck,
  kompakt = false,
  umleiten = false,
  meldung,
}: {
  plan: AssistentPlan;
  zurueck: string;
  kompakt?: boolean;
  umleiten?: boolean;
  meldung?: { text: string; fehler: boolean } | null;
}) {
  const [state, action, pending] = useActionState<AssistentState, FormData>(assistentAktion, { status: "idle" });
  // Nach dem Ausführen das Ergebnis ins Bild holen (die Rückfrage mit aufgeklappten Mails kann lang sein).
  const ergebnisRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.am) ergebnisRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [state.am]);
  const a = plan.aktion;
  const jetzt = Boolean(a && a.dran && !a.gesperrt);
  const titel = plan.nr ? `Schritt ${plan.nr} von ${plan.gesamt}: ${plan.titel}` : plan.titel;

  return (
    <section className={`lfa-assistent${kompakt ? " lfa-assistent-kompakt" : ""}${jetzt ? "" : " lfa-assistent-ruhig"}`} aria-label="Assistent: nächster Schritt">
      <div className="lfa-assistent-kopf">
        <span className="lfa-assistent-marke" title="Der Assistent zeigt den nächsten Schritt und erledigt ihn mit einem Klick — immer erst nach Rückfrage, nie automatisch">
          Assistent
        </span>
        {jetzt && <span className="lfa-puls" title="Jetzt dran — dieser Schritt ist zu erledigen" aria-label="jetzt dran" />}
        <span className="lfa-assistent-titel">{titel}</span>
      </div>
      {state.status !== "idle" && (
        <div ref={ergebnisRef}>
          <Ergebnis state={state} />
        </div>
      )}
      {meldung && state.status === "idle" && (
        <p className={`lfa-hinweis lfa-assistent-ergebnis ${meldung.fehler ? "lfa-hinweis-fehler" : "lfa-hinweis-ok"}`} role="status">
          {meldung.text}
        </p>
      )}
      <p className="lfa-assistent-stand">{plan.stand}</p>
      {plan.warten.length > 0 && (
        <div className="lfa-assistent-warten">
          <span className="lfa-assistent-zwischen" title="Darauf wartet der Vorgang gerade — der Assistent kann das nicht selbst erledigen">
            Worauf gewartet wird:
          </span>
          <ul className="lfa-assistent-liste">
            {plan.warten.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {plan.hinweise.map((h) => (
        <p key={h.text} className={`lfa-hinweis lfa-assistent-hinweis ${h.warn ? "lfa-hinweis-fehler" : ""}`}>
          {h.text}
        </p>
      ))}
      {a && <AktionsForm key={a.signatur} a={a} plan={plan} action={action} pending={pending} zurueck={umleiten ? zurueck : undefined} />}
      {plan.zustimmungen.length > 0 && (
        <div className="lfa-assistent-neben">
          <span className="lfa-klein">Telefonisch geklärt?</span>
          {plan.zustimmungen.map((z) => (
            <form key={z.rolle} action={zustimmungErfassenAktion}>
              <input type="hidden" name="key" value={plan.key} />
              <input type="hidden" name="rolle" value={z.rolle} />
              <input type="hidden" name="art" value={plan.art} />
              <input type="hidden" name="an" value="1" />
              <input type="hidden" name="zurueck" value={zurueck} />
              <BestaetigenKnopf className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" frage={z.frage} tipp={z.tipp}>
                {z.text}
              </BestaetigenKnopf>
            </form>
          ))}
        </div>
      )}
    </section>
  );
}
