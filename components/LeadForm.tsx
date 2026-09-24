"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitLead } from "@/lib/lead";
import { FLAECHENTYPEN, INTENTS, isGesuchIntent, type Flaechentyp, type Intent } from "@/lib/lead-options";

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

function fireFormConversion(userData: Record<string, unknown> | undefined, gesuch: boolean) {
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
    // Gesuche (Pächter/Käufer suchen Fläche) zählen NICHT als Ads-Conversion:
    // Die Kampagnen sollen Flächen-Anbieter bringen, und Smart Bidding würde
    // sonst auf Käufer-Traffic hin optimieren, den die Negatives bewusst aussperren.
    if (!gesuch) {
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
      lead_type: gesuch ? "gesuch" : "angebot",
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
  /** Anfrage zu einem Angebot der Flächenbörse (Kennung + Kurzbeschreibung). */
  boerse?: { code: string; titel: string };
};

export default function LeadForm({
  defaultIntent = "Verkaufen",
  defaultFlaechentyp = "Ackerland",
  source = "homepage",
  variant = "card",
  title = "Kostenlose Anfrage",
  subtitle = "Wir melden uns innerhalb von 24 Stunden persönlich bei Ihnen — diskret und unverbindlich.",
  boerse,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<string>(defaultIntent);
  const gesuch = isGesuchIntent(intent);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const userData = buildUserData(fd);
    const formEl = e.currentTarget;
    const submittedGesuch = isGesuchIntent(String(fd.get("intent") || ""));
    startTransition(async () => {
      const res = await submitLead(fd);
      if (res.ok) {
        // Bot-Submits (Honeypot / Link-im-Namen) kommen serverseitig bewusst als
        // ok:true zurück, damit Bots keinen Unterschied zum Erfolg merken — sie
        // dürfen aber weder die Ads-Conversion noch das GA4-generate_lead
        // auslösen. Sonst zählt jeder Spam-Bot als Lead (Befund 01.08.2026:
        // 79 GA4-Events in 30 Tagen bei 2 echten Leads im Blob-Backup).
        if (!DROPPED_IDS.has(res.id)) fireFormConversion(userData, submittedGesuch);
        setSuccess(res.id);
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
          Wir haben Ihre Anfrage erhalten. Sie hören innerhalb von 24 Stunden persönlich von uns.
        </p>
        <p className="mt-4 text-xs text-[color:var(--color-muted)]">Vorgang {success}</p>
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
        <p className="mb-4 text-sm rounded-md px-3 py-2 bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-dark)]">
          Ihre Anfrage bezieht sich auf Angebot <strong>{boerse.code}</strong>: {boerse.titel}.
        </p>
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
            {gesuch ? "Gesuchter Flächentyp" : "Flächentyp"}
          </label>
          <select id="flaechentyp" name="flaechentyp" defaultValue={defaultFlaechentyp} className="field-select">
            {FLAECHENTYPEN.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="groesse">
            {gesuch ? "Gewünschte Größe" : "Größe (in Hektar oder m²)"}
          </label>
          <input id="groesse" name="groesse" placeholder={gesuch ? "z. B. 5–10 ha" : "z. B. 1,5 ha"} className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="ort">
            {gesuch ? "Wo suchen Sie?" : "Gemeinde / Gemarkung"}
          </label>
          <input
            id="ort"
            name="ort"
            placeholder={gesuch ? "z. B. Lemgo, Kalletal, Lage" : "z. B. Detmold, Leopoldstal"}
            className="field-input"
          />
        </div>
        {!gesuch && (
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
              gesuch
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
        <div>
          <label className="field-label" htmlFor="name">Ihr Name *</label>
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
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending ? "Wird gesendet…" : "Anfrage absenden"}
        </button>
        <ul className="text-xs text-[color:var(--color-muted)] leading-relaxed space-y-0.5">
          <li>✓ Antwort innerhalb 24 h</li>
          {/* Suchende zahlen im Erfolgsfall eine Provision — „Keine Provision“ gilt nur für Eigentümer. */}
          <li>{gesuch ? "✓ Provision nur bei Erfolg" : "✓ Keine Provision für Eigentümer"}</li>
          <li>✓ Völlige Diskretion</li>
        </ul>
      </div>
      <p className="mt-3 text-[11px] text-[color:var(--color-muted)] leading-relaxed">
        Ihre Anfrage geht ausschließlich an die TR Vertriebs GmbH und wird nicht an Pächter, Nachbarn oder Behörden weitergeleitet. Bei Energiepacht-Anfragen geben wir Ihre Flächendaten erst nach Ihrer ausdrücklichen Freigabe an ausgewählte Projektentwickler weiter. Zur Erfolgsmessung übermitteln wir gehashte Kontaktdaten an Google (Enhanced Conversions) — Details in der Datenschutzerklärung. Auf Wunsch löschen wir Ihre Daten nach Abschluss der Beratung.
      </p>
    </form>
  );
}
