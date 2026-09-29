"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitLead } from "@/lib/lead";
import { FLAECHENTYPEN, INTENTS, isGesuchIntent, isOekopunkteNachfrage, type Flaechentyp, type Intent } from "@/lib/lead-options";

// Google-Ads-Conversion "LIPPEFORST Form Lead" (Label ist öffentlich/safe)
const FORM_CONVERSION = "AW-18000118202/kDUqCKC7u7ocELqDkIdD";

// Marker-IDs, die /api/lead für verworfene Bot-Submits zurückgibt (siehe onSubmit).
const DROPPED_IDS = new Set(["HONEYPOT", "SPAM"]);

/** Telefonnummer auf E.164 normalisieren (DE-Default). */
function normalisePhone(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  let d = String(raw).replace(/[^\d+]/g, "");
  if (!d) return undefined;
  if (d.startsWith("00")) d = "+" + d.slice(2);
  if (d.startsWith("+")) return d;
  if (d.startsWith("0")) return "+49" + d.slice(1);
  return "+" + d;
}

/** Enhanced-Conversions user_data aus dem Formular (gtag hasht client-seitig per SHA-256). */
function buildUserData(fd: FormData): Record<string, unknown> | undefined {
  const data: Record<string, unknown> = {};
  const email = String(fd.get("email") || "").trim().toLowerCase();
  if (email) data.email = email;
  const phone = normalisePhone(fd.get("phone") as string);
  if (phone) data.phone_number = phone;
  const name = String(fd.get("name") || "").trim();
  if (name) {
    const parts = name.split(/\s+/);
    const address: Record<string, string> = { first_name: parts[0].toLowerCase() };
    if (parts.length > 1) address.last_name = parts.slice(1).join(" ").toLowerCase();
    data.address = address;
  }
  return Object.keys(data).length ? data : undefined;
}

type LeadArt = "angebot" | "gesuch" | "nachfrage";

/** „gesuch“ = jemand sucht Fläche, „nachfrage“ = jemand sucht Ökopunkte/Kompensationsflächen, sonst Eigentümer („angebot“). */
function leadArt(intent: string): LeadArt {
  return isOekopunkteNachfrage(intent) ? "nachfrage" : isGesuchIntent(intent) ? "gesuch" : "angebot";
}

function fireFormConversion(userData: Record<string, unknown> | undefined, art: LeadArt) {
  try {
    const w = window as unknown as {
      dataLayer?: unknown[];
      gtag?: (...args: unknown[]) => void;
    };
    w.dataLayer = w.dataLayer || [];
    if (typeof w.gtag !== "function") {
      w.gtag = function (...args: unknown[]) {
        w.dataLayer!.push(args);
      };
    }
    // Gesuche (Pächter/Käufer suchen Fläche) und Ökopunkte-Nachfragen (Projektentwickler
    // suchen Punkte) zählen NICHT als Ads-Conversion: Die Kampagnen sollen Flächen-Anbieter
    // bringen, und Smart Bidding würde sonst auf Käufer-Traffic hin optimieren, den die
    // Negatives bewusst aussperren.
    if (art === "angebot") {
      w.gtag("event", "conversion", {
        send_to: FORM_CONVERSION,
        transport_type: "beacon",
        ...(userData ? { user_data: userData } : {}),
      });
    }

    // No send_to → goes to every configured target on the page (GA4
    // G-0Y4K8M7RJS included), so leads from organic/direct traffic become
    // visible as a GA4 key event, not just Ads-attributed ones.
    w.gtag("event", "generate_lead", {
      transport_type: "beacon",
      lead_type: art,
      ...(userData ? { user_data: userData } : {}),
    });
  } catch {
    /* noop */
  }
}

type Props = {
  defaultIntent?: Intent;
  defaultFlaechentyp?: Flaechentyp;
  source?: string;
  variant?: "embedded" | "card";
  title?: string;
  subtitle?: string;
  /** Anfrage zu einem Angebot der Flächenbörse (Kennung + Kurzbeschreibung, bei Paketen alle Kennungen). */
  boerse?: { code: string; titel: string; paket?: string[] };
};

export default function LeadForm({
  defaultIntent = "Verkaufen",
  defaultFlaechentyp = "Ackerland",
  source = "homepage",
  variant = "card",
  title = "Kostenlose Anfrage",
  subtitle = "Wir antworten in der Regel innerhalb eines Werktags per E-Mail — diskret und unverbindlich.",
  boerse,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState<{ id: string; bestaetigung: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<string>(defaultIntent);
  const gesuch = isGesuchIntent(intent);
  const nachfrage = isOekopunkteNachfrage(intent);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const userData = buildUserData(fd);
    const formEl = e.currentTarget;
    const submittedArt = leadArt(String(fd.get("intent") || ""));
    startTransition(async () => {
      const res = await submitLead(fd);
      if (res.ok) {
        // Bot-Submits (Honeypot / Link-im-Namen) kommen serverseitig bewusst als
        // ok:true zurück, damit Bots keinen Unterschied zum Erfolg merken — sie
        // dürfen aber weder die Ads-Conversion noch das GA4-generate_lead
        // auslösen. Sonst zählt jeder Spam-Bot als Lead (Befund 01.08.2026:
        // 79 GA4-Events in 30 Tagen bei 2 echten Leads im Blob-Backup).
        if (!DROPPED_IDS.has(res.id)) fireFormConversion(userData, submittedArt);
        setSuccess({ id: res.id, bestaetigung: Boolean(res.bestaetigung) });
        formEl.reset();
      } else {
        setError(res.error);
      }
    });
  }

  if (success) {
    return (
      <div className={variant === "card" ? "card text-center" : "text-center"}>
        <h3 className="font-serif text-2xl mb-2">Vielen Dank!</h3>
        <p className="text-[color:var(--color-ink-soft)]">
          Wir haben Ihre Anfrage erhalten.{success.bestaetigung ? " Eine Eingangsbestätigung mit Ihrer Vorgangsnummer ist per E-Mail unterwegs." : ""} Unsere Antwort folgt in der Regel innerhalb eines Werktags per E-Mail.
        </p>
        <p className="mt-4 text-xs text-[color:var(--color-muted)]">Vorgang {success.id}</p>
      </div>
    );
  }

  const wrapper = variant === "card" ? "card" : "";

  return (
    <form onSubmit={onSubmit} className={wrapper}>
      <input type="hidden" name="source" value={source} />
      {boerse && <input type="hidden" name="boerse" value={boerse.code} />}
      {/* Honeypot — für Menschen unsichtbar, Bots füllen es aus → serverseitig verworfen */}
      <input
        type="text"
        name="_hp"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] top-[-9999px] h-0 w-0 opacity-0"
      />
      {(title || subtitle) && (
        <div className="mb-5">
          {title && <h3 className="font-serif text-2xl">{title}</h3>}
          {subtitle && (
            <p className="text-sm text-[color:var(--color-ink-soft)] mt-1">{subtitle}</p>
          )}
        </div>
      )}
      {boerse && (
        <div className="mb-4 text-sm rounded-md px-3 py-2 bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-dark)]">
          <p>
            Ihre Anfrage bezieht sich auf {boerse.paket?.length ? "das Paket" : "Angebot"} <strong>{boerse.paket?.length ? boerse.paket.join(", ") : boerse.code}</strong>: {boerse.titel}.
          </p>
          {boerse.paket && boerse.paket.length > 1 && (
            <label className="checkbox-row mt-2" title="Mit Häkchen gilt Ihr Interesse für alle Flächen des Pakets, sonst nur für die angezeigte Fläche">
              <input type="checkbox" name="paket" value="1" defaultChecked />
              <span>Interesse am ganzen Paket ({boerse.paket.length} Flächen) — ohne Häkchen nur an {boerse.code}</span>
            </label>
          )}
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor="intent">Anliegen</label>
          <select
            id="intent"
            name="intent"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            className="field-select"
          >
            {INTENTS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="flaechentyp">
            {nachfrage ? "Gesuchte Maßnahme (Flächentyp)" : gesuch ? "Gesuchter Flächentyp" : "Flächentyp"}
          </label>
          <select id="flaechentyp" name="flaechentyp" defaultValue={defaultFlaechentyp} className="field-select">
            {FLAECHENTYPEN.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {/* Interesse an einem Börsen-Angebot: Größe und Lage stehen im Angebot — nicht erneut abfragen. */}
        {!boerse && (
          <>
            <div>
              <label className="field-label" htmlFor="groesse">
                {nachfrage ? "Gesuchter Umfang (Ökopunkte oder Hektar)" : gesuch ? "Gewünschte Größe" : "Größe (in Hektar oder m²)"}
              </label>
              <input id="groesse" name="groesse" placeholder={nachfrage ? "z. B. 250.000 Punkte oder 5 ha" : gesuch ? "z. B. 5–10 ha" : "z. B. 1,5 ha"} className="field-input" />
            </div>
            <div>
              <label className="field-label" htmlFor="ort">
                {nachfrage ? "Suchraum (Kreis, Gemeinde oder Naturraum)" : gesuch ? "Wo suchen Sie?" : "Gemeinde / Gemarkung"}
              </label>
              <input
                id="ort"
                name="ort"
                placeholder={nachfrage ? "z. B. Kreis Lippe, Ostwestfalen-Lippe" : gesuch ? "z. B. Lemgo, Kalletal, Lage" : "z. B. Detmold, Leopoldstal"}
                className="field-input"
              />
            </div>
          </>
        )}
        {!gesuch && !nachfrage && (
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="flurstueck">Flur / Flurstück (optional)</label>
            <input id="flurstueck" name="flurstueck" placeholder="z. B. Flur 9, Flst. 113" className="field-input" />
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="message">Ihre Nachricht (optional)</label>
          <textarea
            id="message"
            name="message"
            className="field-textarea"
            placeholder={
              nachfrage
                ? "Welche Maßnahme suchen Sie (z. B. Erstaufforstung), bis wann, zu welchem Preis je Ökopunkt und mit welcher Anerkennung? …"
                : gesuch
                  ? "Was bewirtschaften Sie, ab wann und wie lange möchten Sie pachten oder kaufen? …"
                  : "Was sollten wir noch wissen? Pacht- oder Bewirtschaftungsstatus, Zeitvorstellung, …"
            }
          />
        </div>
        {gesuch && (
          <p className="sm:col-span-2 text-sm text-[color:var(--color-ink-soft)] bg-[color:var(--color-brand-soft)] rounded-md px-3 py-2">
            Wir melden uns, sobald uns eine passende Fläche angeboten wird. Kontaktdaten geben wir nur weiter, wenn beide Seiten zugestimmt haben. Für Suchende fällt nur bei Erfolg eine Provision an — die Konditionen erhalten Sie vorab schriftlich, bevor wir Ihnen eine Fläche nachweisen.
          </p>
        )}
        {nachfrage && (
          <p className="sm:col-span-2 text-sm text-[color:var(--color-ink-soft)] bg-[color:var(--color-brand-soft)] rounded-md px-3 py-2">
            Wir betreiben kein eigenes Ökokonto und haben keine fertigen Ökopunkte. Wir prüfen, ob unter den Eigentümern in unserem Netzwerk passende Flächen sind, und melden uns bei Ihnen. Kontaktdaten geben wir nur weiter, wenn beide Seiten zugestimmt haben.
          </p>
        )}
        <div>
          <label className="field-label" htmlFor="name">{nachfrage ? "Ihr Name und Unternehmen *" : "Ihr Name *"}</label>
          <input id="name" name="name" required className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="phone">Telefon (optional)</label>
          <input id="phone" name="phone" className="field-input" inputMode="tel" />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="email">E-Mail *</label>
          <input id="email" name="email" type="email" required className="field-input" />
        </div>
        <label className="checkbox-row sm:col-span-2">
          <input type="checkbox" name="consent" required />
          <span>
            Ich stimme der Verarbeitung meiner Daten gemäß <Link href="/datenschutz" target="_blank" className="underline" title="Datenschutzerklärung in einem neuen Tab öffnen – Ihre Eingaben bleiben erhalten">Datenschutzerklärung</Link> zur Kontaktaufnahme zu. Keine Weitergabe an Dritte ohne Ihre ausdrückliche Freigabe.
          </span>
        </label>
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>
      )}
      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <button type="submit" className="btn-primary" disabled={isPending} title="Schickt Ihre Anfrage an Lippe Forst — Sie erhalten eine Eingangsbestätigung per E-Mail">
          {isPending ? "Wird gesendet…" : "Anfrage absenden"}
        </button>
        <ul className="text-xs text-[color:var(--color-muted)] leading-relaxed space-y-0.5">
          <li>✓ Antwort in der Regel innerhalb eines Werktags per E-Mail</li>
          {/* Suchende zahlen im Erfolgsfall eine Provision — „Keine Provision“ gilt nur für Eigentümer. */}
          {!nachfrage && <li>{gesuch ? "✓ Provision nur bei Erfolg" : "✓ Keine Provision für Eigentümer"}</li>}
          <li>✓ Völlige Diskretion</li>
        </ul>
      </div>
      <p className="mt-3 text-[11px] text-[color:var(--color-muted)] leading-relaxed">
        Ihre Anfrage geht ausschließlich an die TR Vertriebs GmbH und wird nicht an Pächter, Nachbarn oder Behörden weitergeleitet. Bei Energiepacht-Anfragen geben wir Ihre Flächendaten erst nach Ihrer ausdrücklichen Freigabe an ausgewählte Projektentwickler weiter. Zur Erfolgsmessung übermitteln wir gehashte Kontaktdaten an Google (Enhanced Conversions) — Details in der Datenschutzerklärung. Auf Wunsch löschen wir Ihre Daten nach Abschluss der Beratung.
      </p>
    </form>
  );
}
