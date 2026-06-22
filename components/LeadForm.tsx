"use client";

import { useState, useTransition } from "react";
import { submitLead } from "@/lib/lead";

// Google-Ads-Conversion "LIPPEFORST Form Lead" (Label ist öffentlich/safe)
const FORM_CONVERSION = "AW-18000118202/kDUqCKC7u7ocELqDkIdD";

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

function fireFormConversion(userData?: Record<string, unknown>) {
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
    w.gtag("event", "conversion", {
      send_to: FORM_CONVERSION,
      transport_type: "beacon",
      ...(userData ? { user_data: userData } : {}),
    });
  } catch {
    /* noop */
  }
}

type Props = {
  defaultIntent?: "Verkaufen" | "Verpachten" | "Bewertung" | "VNS / Ökopunkte" | "Lohnunternehmer" | "Bauland-Beratung" | "Allgemein";
  defaultFlaechentyp?: "Ackerland" | "Wiese / Grünland" | "Wald / Forst" | "Bauland" | "Sonstiges";
  source?: string;
  variant?: "embedded" | "card";
  title?: string;
  subtitle?: string;
};

const intents = [
  "Verkaufen",
  "Verpachten",
  "Bewertung",
  "VNS / Ökopunkte",
  "Lohnunternehmer",
  "Bauland-Beratung",
  "Allgemein",
];

const flaechentypen = ["Ackerland", "Wiese / Grünland", "Wald / Forst", "Bauland", "Sonstiges"];

export default function LeadForm({
  defaultIntent = "Verkaufen",
  defaultFlaechentyp = "Ackerland",
  source = "homepage",
  variant = "card",
  title = "Kostenlose Anfrage",
  subtitle = "Wir melden uns innerhalb von 24 Stunden persönlich bei Ihnen — diskret und unverbindlich.",
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const userData = buildUserData(fd);
    const formEl = e.currentTarget;
    startTransition(async () => {
      const res = await submitLead(fd);
      if (res.ok) {
        fireFormConversion(userData);
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
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="field-label" htmlFor="intent">Anliegen</label>
          <select id="intent" name="intent" defaultValue={defaultIntent} className="field-select">
            {intents.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="flaechentyp">Flächentyp</label>
          <select id="flaechentyp" name="flaechentyp" defaultValue={defaultFlaechentyp} className="field-select">
            {flaechentypen.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="groesse">Größe (in Hektar oder m²)</label>
          <input id="groesse" name="groesse" placeholder="z. B. 1,5 ha" className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="ort">Gemeinde / Gemarkung</label>
          <input id="ort" name="ort" placeholder="z. B. Detmold, Leopoldstal" className="field-input" />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="flurstueck">Flur / Flurstück (optional)</label>
          <input id="flurstueck" name="flurstueck" placeholder="z. B. Flur 9, Flst. 113" className="field-input" />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="message">Ihre Nachricht (optional)</label>
          <textarea id="message" name="message" className="field-textarea" placeholder="Was sollten wir noch wissen? Pacht- oder Bewirtschaftungsstatus, Zeitvorstellung, …" />
        </div>
        <div>
          <label className="field-label" htmlFor="name">Ihr Name *</label>
          <input id="name" name="name" required className="field-input" />
        </div>
        <div>
          <label className="field-label" htmlFor="phone">Telefon</label>
          <input id="phone" name="phone" className="field-input" inputMode="tel" />
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="email">E-Mail *</label>
          <input id="email" name="email" type="email" required className="field-input" />
        </div>
        <label className="checkbox-row sm:col-span-2">
          <input type="checkbox" name="consent" required />
          <span>
            Ich stimme der Verarbeitung meiner Daten gemäß <a href="/datenschutz" className="underline">Datenschutzerklärung</a> zur Kontaktaufnahme zu. Keine Weitergabe an Dritte.
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
          <li>✓ Keine Provision</li>
          <li>✓ Völlige Diskretion</li>
        </ul>
      </div>
      <p className="mt-3 text-[11px] text-[color:var(--color-muted)] leading-relaxed">
        Ihre Anfrage geht ausschließlich an die TR Vertriebs GmbH. Sie wird nicht in CRM- oder Marketing-Systeme eingespielt, nicht an Pächter, Nachbarn oder Behörden weitergeleitet. Auf Wunsch löschen wir Ihre Daten nach Abschluss der Beratung.
      </p>
    </form>
  );
}
