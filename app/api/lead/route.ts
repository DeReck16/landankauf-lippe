import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { site } from "@/lib/site";

/**
 * Zentraler Lead-Endpoint (alle Formulare gehen hierüber).
 * Mehrkanal-Zustellung für maximale Ausfallsicherheit:
 *   1. Resend    — primär, von verifizierter Domain (DKIM/SPF/DMARC).
 *   2. Formspree — Fallback, parallel als Sicherheitsnetz.
 *   3. Vercel Blob — durable Backup, damit nie ein Lead verloren geht.
 *   4. Console   — letzter Floor in den Runtime-Logs.
 * Gibt ok:true zurück, sobald mindestens ein Kanal greift (Blob zählt).
 */

export const runtime = "nodejs";

const FORMSPREE_ENDPOINT = "https://formspree.io/f/xlgrjjvp";

function fmt(v?: unknown) {
  return (v ?? "—").toString().trim() || "—";
}

type Input = {
  intent: string;
  flaechentyp: string;
  groesse: string;
  ort: string;
  flurstueck: string;
  message: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  consent: string;
  gclid: string;
};

async function sendResend(
  apiKey: string | undefined,
  from: string,
  to: string,
  subject: string,
  text: string,
  replyTo: string,
): Promise<boolean> {
  if (!apiKey) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], reply_to: replyTo, subject, text }),
    });
    if (res.ok) return true;
    console.error("[lead] resend error", res.status, await res.text());
    return false;
  } catch (err) {
    console.error("[lead] resend exception", err);
    return false;
  }
}

async function sendFormspree(input: Input, subject: string, id: string): Promise<boolean> {
  try {
    const res = await fetch(FORMSPREE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: subject,
        _replyto: input.email,
        email: input.email,
        name: input.name,
        telefon: input.phone,
        anliegen: input.intent,
        flaechentyp: input.flaechentyp,
        groesse: input.groesse,
        ort: input.ort,
        flurstueck: input.flurstueck,
        nachricht: input.message,
        quelle: input.source,
        gclid: input.gclid,
        site: site.url,
        id,
      }),
    });
    if (res.ok) return true;
    console.error("[lead] formspree HTTP", res.status, await res.text());
    return false;
  } catch (err) {
    console.error("[lead] formspree exception", err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  // Honeypot — Bots füllen versteckte Felder, echte Menschen nicht.
  if (body._hp) return NextResponse.json({ ok: true, id: "HONEYPOT" });

  const input: Input = {
    intent: fmt(body.intent),
    flaechentyp: fmt(body.flaechentyp),
    groesse: fmt(body.groesse),
    ort: fmt(body.ort),
    flurstueck: fmt(body.flurstueck),
    message: fmt(body.message),
    name: fmt(body.name),
    phone: fmt(body.phone),
    email: fmt(body.email),
    source: fmt(body.source),
    consent: fmt(body.consent),
    gclid: fmt(body.gclid),
  };

  // Leichter Spam-Filter: Links im Namen sind ein sehr starkes Bot-Signal.
  if (/https?:\/\/|\[url=|<a\s/i.test(input.name)) {
    return NextResponse.json({ ok: true, id: "SPAM" });
  }

  if (!input.email || input.email === "—") {
    return NextResponse.json({ ok: false, error: "Bitte geben Sie eine E-Mail-Adresse an." }, { status: 400 });
  }
  if (!input.name || input.name === "—") {
    return NextResponse.json({ ok: false, error: "Bitte geben Sie Ihren Namen an." }, { status: 400 });
  }
  if (input.consent !== "on") {
    return NextResponse.json({ ok: false, error: "Bitte stimmen Sie der Datenschutzerklärung zu." }, { status: 400 });
  }

  const id = `LL-${Date.now().toString(36).toUpperCase()}`;
  const text = [
    `Neue Anfrage über ${site.url}`,
    "",
    `Anliegen:      ${input.intent}`,
    `Flächentyp:    ${input.flaechentyp}`,
    `Größe:         ${input.groesse}`,
    `Ort/Gemarkung: ${input.ort}`,
    `Flurstück:     ${input.flurstueck}`,
    "",
    `Name:    ${input.name}`,
    `E-Mail:  ${input.email}`,
    `Telefon: ${input.phone}`,
    "",
    `Nachricht:`,
    input.message ?? "—",
    "",
    `Quelle: ${input.source}`,
    input.gclid && input.gclid !== "—"
      ? `🎯 Aus Google-Anzeige (gclid): ${input.gclid}`
      : `Kanal: organisch / direkt (keine gclid)`,
    `ID: ${id}`,
  ].join("\n");
  const subject = `Anfrage [${input.intent} · ${input.flaechentyp}] – ${input.name}`;

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_TO_EMAIL || site.contact.email || site.contact.emailFallback;
  const from = process.env.LEAD_FROM_EMAIL || `Lippe Forst <onboarding@resend.dev>`;

  // 1. Durable Backup: Vercel Blob
  let blobOk = false;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const date = new Date().toISOString().slice(0, 10);
      await put(
        `leads/${date}/${id}.json`,
        JSON.stringify({ id, receivedAt: new Date().toISOString(), ...input }, null, 2),
        { access: "public", contentType: "application/json", addRandomSuffix: false },
      );
      blobOk = true;
    } catch (err) {
      console.error("[lead] blob exception", err);
    }
  }

  // 2 + 3: Resend + Formspree parallel
  const [resendOk, formspreeOk] = await Promise.all([
    sendResend(apiKey, from, to, subject, text, input.email),
    sendFormspree(input, subject, id),
  ]);

  if (!resendOk && !formspreeOk) {
    console.log(`[lead] ${id} — beide Mailkanäle fehlgeschlagen, siehe Vercel Blob /leads`);
    console.log(text);
  }

  return NextResponse.json({ ok: true, id, delivered: { resend: resendOk, formspree: formspreeOk, blob: blobOk } });
}
