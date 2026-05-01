"use server";

import { site } from "@/lib/site";

export type LeadInput = {
  intent: string;
  flaechentyp: string;
  groesse: string;
  ort: string;
  flurstueck?: string;
  message?: string;
  name: string;
  phone?: string;
  email: string;
  source?: string;
  consent?: string;
};

export type LeadResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function fmt(v?: string | null) {
  return (v ?? "—").toString().trim() || "—";
}

export async function submitLead(formData: FormData): Promise<LeadResult> {
  const input: LeadInput = {
    intent: fmt(formData.get("intent") as string),
    flaechentyp: fmt(formData.get("flaechentyp") as string),
    groesse: fmt(formData.get("groesse") as string),
    ort: fmt(formData.get("ort") as string),
    flurstueck: fmt(formData.get("flurstueck") as string),
    message: fmt(formData.get("message") as string),
    name: fmt(formData.get("name") as string),
    phone: fmt(formData.get("phone") as string),
    email: fmt(formData.get("email") as string),
    source: fmt(formData.get("source") as string),
    consent: fmt(formData.get("consent") as string),
  };

  if (!input.email || input.email === "—") {
    return { ok: false, error: "Bitte geben Sie eine E-Mail-Adresse an." };
  }
  if (!input.name || input.name === "—") {
    return { ok: false, error: "Bitte geben Sie Ihren Namen an." };
  }
  if (input.consent !== "on") {
    return { ok: false, error: "Bitte stimmen Sie der Datenschutzerklärung zu." };
  }

  const id = `LL-${Date.now().toString(36).toUpperCase()}`;
  const lines = [
    `Neue Anfrage über ${site.url}`,
    "",
    `Anliegen:    ${input.intent}`,
    `Flächentyp:  ${input.flaechentyp}`,
    `Größe:       ${input.groesse}`,
    `Ort/Gemarkung: ${input.ort}`,
    `Flurstück:   ${input.flurstueck}`,
    "",
    `Name:    ${input.name}`,
    `E-Mail:  ${input.email}`,
    `Telefon: ${input.phone}`,
    "",
    `Nachricht:`,
    input.message ?? "—",
    "",
    `Quelle: ${input.source}`,
    `ID: ${id}`,
  ];
  const text = lines.join("\n");
  const subject = `Anfrage [${input.intent} · ${input.flaechentyp}] – ${input.name}`;

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_TO_EMAIL || site.contact.emailFallback;
  const from = process.env.LEAD_FROM_EMAIL || `Landankauf Lippe <onboarding@resend.dev>`;

  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          reply_to: input.email,
          subject,
          text,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("[lead] resend error", res.status, body);
      }
    } catch (err) {
      console.error("[lead] resend exception", err);
    }
  } else {
    console.log("[lead] RESEND_API_KEY not set — logging only");
    console.log(text);
  }

  return { ok: true, id };
}
