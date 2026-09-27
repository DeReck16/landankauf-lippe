import { NextRequest, NextResponse, after } from "next/server";
import { site } from "@/lib/site";
import { antwortAdresse, dataPrefix, hasBlobToken, kundenAbsender } from "@/lib/admin/config";
import { orteErgaenzen } from "@/lib/admin/daten";
import { dateiAnlegen, drosseln, kurzwert, mutateZustand, readZustand } from "@/lib/admin/store";
import { angebotZuCode, ladeBoerse } from "@/lib/boerse";
import { isGesuchIntent } from "@/lib/lead-options";
import { leadView } from "@/lib/admin/model";
import { katasterNachholen } from "@/lib/portal/kataster";
import { eingangPruefen, eingangsbestaetigung, type Eingabe } from "@/lib/portal/eingang";
import { sendeMitPostausgang } from "@/lib/portal/mail";
import { automatikNachAnfrage } from "@/lib/portal/automatik";

/**
 * Zentraler Lead-Endpoint (alle Formulare gehen hierüber).
 * Mehrkanal-Zustellung für maximale Ausfallsicherheit:
 *   1. Resend    — primär, von verifizierter Domain (DKIM/SPF/DMARC).
 *   2. Formspree — Fallback, parallel als Sicherheitsnetz.
 *   3. Vercel Blob — privater Speicher „lippe-forst-privat“ (Frankfurt), Grundlage
 *      der Verwaltung unter /admin. Nur mit Token lesbar, nie öffentlich.
 *   4. Console   — letzter Floor in den Runtime-Logs.
 * Gibt ok:true zurück, sobald mindestens ein Kanal greift (Blob zählt).
 *
 * Schutz vor Missbrauch: Felder werden geprüft und gekürzt (lib/portal/eingang.ts),
 * je Absender (Kurzwert der IP-Adresse, keine Klartext-IP) höchstens 5 Anfragen in
 * 10 Minuten und 20 am Tag, insgesamt höchstens 120 je Stunde. Danach 429 — dann
 * gehen weder Mails raus noch werden Daten angelegt.
 */

export const runtime = "nodejs";

const FORMSPREE_ENDPOINT = "https://formspree.io/f/xlgrjjvp";

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

async function sendFormspree(input: Eingabe, subject: string, id: string): Promise<boolean> {
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

/** IP-Adresse des Absenders (Vercel setzt x-forwarded-for) — nur für den Kurzwert der Drosselung. */
function ipVon(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unbekannt").trim().slice(0, 64);
}

const ZU_VIELE = "Es sind gerade sehr viele Anfragen eingegangen. Bitte versuchen Sie es in einigen Minuten erneut — oder schreiben Sie uns eine E-Mail an info@tr-immobilien.com.";

// Nach der Antwort laufen noch Ortssuche, Kataster-Abfrage und Eingangsbestätigung (after).
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    const roh = await req.text();
    if (roh.length > 20_000) return NextResponse.json({ ok: false, error: "Die Anfrage ist zu lang." }, { status: 413 });
    body = JSON.parse(roh) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("kein Objekt");
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  // Honeypot — Bots füllen versteckte Felder, echte Menschen nicht.
  if (body._hp) return NextResponse.json({ ok: true, id: "HONEYPOT" });

  const pr = eingangPruefen(body);
  if (!pr.ok) return NextResponse.json({ ok: false, error: pr.fehler }, { status: 400 });
  if (pr.spam) return NextResponse.json({ ok: true, id: "SPAM" });
  const input = pr.eingabe;

  // Drosselung je Absender und insgesamt (nur mit Speicher — ohne ihn gibt es auch keine Zähler).
  if (hasBlobToken()) {
    const ip = kurzwert(ipVon(req), "lead");
    const jeAbsender = await drosseln("lead", ip, [
      { sekunden: 600, max: 5 },
      { sekunden: 86_400, max: 20 },
    ]);
    if (!jeAbsender) return NextResponse.json({ ok: false, error: ZU_VIELE }, { status: 429 });
    const gesamt = await drosseln("lead-gesamt", "alle", [{ sekunden: 3600, max: 120 }]);
    if (!gesamt) return NextResponse.json({ ok: false, error: ZU_VIELE }, { status: 429 });
  }

  const id = `LL-${Date.now().toString(36).toUpperCase()}`;
  const receivedAt = new Date().toISOString();
  const text = [
    `Neue Anfrage über ${site.url}`,
    "",
    ...(input.boerse !== "—" ? [`Flächenbörse:  Interesse an Angebot ${input.boerse}${body.paket === "1" ? " (ganzes Paket)" : ""}`, ""] : []),
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
  const subject = `${input.boerse !== "—" ? `[Flächenbörse ${input.boerse}] ` : ""}Anfrage [${input.intent} · ${input.flaechentyp}] – ${input.name}`;

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_TO_EMAIL || site.contact.email || site.contact.emailFallback;
  const from = process.env.LEAD_FROM_EMAIL || `Lippe Forst <onboarding@resend.dev>`;

  // 1. Durable Backup: privater Vercel-Blob-Speicher
  let blobOk = false;
  if (hasBlobToken()) {
    try {
      const date = new Date().toISOString().slice(0, 10);
      await dateiAnlegen(`leads/${date}/${id}.json`, JSON.stringify({ id, receivedAt, ...input }, null, 2), "application/json");
      blobOk = true;
    } catch (err) {
      console.error("[lead] blob exception", err);
    }
  }

  // Interesse aus der Flächenbörse: gleich mit dem Angebot verknüpfen (Paar „vorgemerkt“) —
  // nur für Angebote, die gerade online stehen (keine vergebenen oder zurückgezogenen).
  // Weiter geht es danach im normalen Ablauf: Einladung → Nachweisvertrag → Zustimmung → Freigabe.
  // Interesse am ganzen Paket (mehrere Flächen desselben Eigentümers): mit jeder Fläche des Pakets verknüpfen.
  if (blobOk && input.boerse !== "—" && isGesuchIntent(input.intent)) {
    try {
      const { zustand } = await readZustand();
      let codes = [input.boerse];
      if (body.paket === "1" || body.paket === true) {
        const d = await ladeBoerse();
        const paket = d.angebote.find((a) => a.code === input.boerse)?.paket;
        if (paket) codes = d.angebote.filter((a) => a.paket === paket).map((a) => a.code);
      }
      const angebote = codes.map((c) => angebotZuCode(zustand.anfragen, c, { nurOnline: true })).filter((x): x is string => Boolean(x));
      for (const angebotId of angebote) {
        const key = `${angebotId}~${id}`;
        await mutateZustand("Flächenbörse", (z) => {
          if (z.paare[key]) return;
          z.paare[key] = { status: "vorgemerkt", geaendert: { am: new Date().toISOString(), von: "Flächenbörse" } };
          return { was: `Interesse über die Flächenbörse (${codes.length > 1 ? `Paket ${codes.join(", ")}` : input.boerse}) — Paar vorgemerkt`, ref: key };
        });
      }
    } catch (err) {
      console.error("[lead] boerse", err);
    }
  }

  // Ort fürs Matching schon jetzt nachschlagen, damit die Verwaltung ihn kennt.
  // Begrenzt (kurzer Text, max. 5 s), damit Formular-Spam OpenStreetMap nicht flutet;
  // Rest erledigt der Knopf „Fehlende Orte nachschlagen“ in der Verwaltung.
  if (blobOk && input.ort !== "—" && input.ort.length <= 120) {
    after(() =>
      orteErgaenzen("Formular", [input.ort], 5_000).catch((err) => console.error("[lead] orte", err)),
    );
  }

  // Mit Flurstück: amtliche Daten (ALKIS NRW) und Bodenrichtwert (BORIS NRW) gleich nachschlagen —
  // für den Antwortentwurf mit Wertindikation (lib/portal/antwort.ts). Läuft nach der Antwort ans Formular.
  if (blobOk && input.flurstueck !== "—" && input.flurstueck.length <= 120) {
    after(() =>
      katasterNachholen([leadView({ id, receivedAt, ...input }, undefined)], 20_000).then(
        () => undefined,
        (err) => console.error("[lead] kataster", err),
      ),
    );
  }

  // Eingangsbestätigung an den Kunden (vom Kunden selbst ausgelöst, rein informativ) —
  // höchstens zwei je Adresse und Tag, damit das Formular nicht zum Mailversand an fremde
  // Adressen taugt. Im Testmodus steht sie nur im Log; scheitert der Versand, Postausgang.
  let bestaetigung = false;
  if (blobOk) {
    bestaetigung = await drosseln("bestaetigung", kurzwert(input.email, "bestaetigung"), [{ sekunden: 86_400, max: 2 }]);
    if (bestaetigung) {
      const b = eingangsbestaetigung(input, id, receivedAt);
      after(() =>
        sendeMitPostausgang({ an: [input.email], betreff: b.betreff, text: b.text, von: kundenAbsender(), replyTo: antwortAdresse() }, "eingangsbestaetigung", { typ: "keiner" }).then(
          (r) => {
            if (!r.ok && !r.test) console.error("[lead] Eingangsbestätigung nicht gesendet", id, r.fehler);
          },
          (err) => console.error("[lead] Eingangsbestätigung", id, err),
        ),
      );
    }
    // Automatik (nur wenn eingeschaltet): Matching für die neue Anfrage.
    after(() => automatikNachAnfrage(id).catch((err) => console.error("[lead] automatik", id, err)));
  }

  // Testmodus: Mit Daten-Präfix (lokale Tests, z. B. LF_DATA_PREFIX="dev/") geht
  // weder eine Mail über Resend noch eine Kopie an Formspree raus — sonst landen
  // Testanfragen im echten Postfach. Die Anfrage liegt nur im Blob (unter dem Präfix).
  if (dataPrefix()) {
    console.log(`[lead] Testmodus (${dataPrefix()}): ${id} nur im Speicher abgelegt — kein Resend, kein Formspree.`);
    return NextResponse.json({ ok: true, id, bestaetigung, delivered: { resend: false, formspree: false, blob: blobOk }, test: true });
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

  return NextResponse.json({ ok: true, id, bestaetigung, delivered: { resend: resendOk, formspree: formspreeOk, blob: blobOk } });
}
