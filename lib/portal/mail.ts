import "server-only";
import { antwortAdresse, kundenAbsender, notifyEmails, testModus, verwaltungsAbsender } from "@/lib/admin/config";
import { jsonAendern } from "@/lib/admin/store";

// E-Mail-Versand über Resend (Domain lippeforst.de ist verifiziert).
// Im Testmodus (lokal oder mit LF_DATA_PREFIX) wird NICHTS verschickt — die
// Mail steht nur im Server-Log. Kunden-Mails gehen nur auf ausdrücklichen
// Klick (Verwaltung), als direkte Folge einer Kundenhandlung oder über eine
// von der Verwaltung eingeschaltete Automatik-Regel raus.
//
// Postausgang: Scheitert eine Systemmail (z. B. Resend nicht erreichbar), wird sie
// unter portal/postausgang/ abgelegt und später erneut versucht (lib/portal/postausgang.ts,
// täglicher Cron und Knopf im Dashboard) — so geht keine Pflichtmitteilung verloren.

export type Anhang = { dateiname: string; inhalt: Uint8Array };

export type Versand = { ok: boolean; test: boolean; fehler?: string; eingereiht?: boolean };

/** Worauf sich eine Mail bezieht — damit ein späterer erfolgreicher Versand dort vermerkt wird. */
export type MailBezug =
  | { typ: "kunde"; id: string; mailId: string }
  | { typ: "vorgang"; key: string; mailId: string }
  | { typ: "keiner" };

export type PostausgangEintrag = {
  v: 1;
  id: string;
  zweck: string;
  erstelltAm: string;
  versuche: number;
  naechsterVersuch: string;
  letzterFehler?: string;
  bezug: MailBezug;
  mail: { an: string[]; betreff: string; text: string; von?: string; replyTo?: string; bcc?: string[]; anhaenge?: { dateiname: string; base64: string }[] };
  erledigt?: { am: string; wie: "gesendet" | "aufgegeben" | "verworfen"; von: string };
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Klartext → schlichtes HTML (Absätze, klickbare Links). */
export function textAlsHtml(text: string): string {
  const absaetze = text.split(/\n{2,}/).map((a) => {
    const sicher = escapeHtml(a).replace(
      /(https?:\/\/[^\s<]+)/g,
      (url) => `<a href="${url}" style="color:#2f5d3a;word-break:break-all">${url}</a>`,
    );
    return `<p style="margin:0 0 14px">${sicher.replace(/\n/g, "<br>")}</p>`;
  });
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#1c2519;max-width:640px">${absaetze.join("")}</div>`;
}

export type MailAuftrag = {
  an: string[];
  betreff: string;
  text: string;
  von?: string;
  replyTo?: string;
  bcc?: string[];
  anhaenge?: Anhang[];
};

export async function sende(m: MailAuftrag): Promise<Versand> {
  const an = m.an.map((a) => a.trim()).filter(Boolean);
  if (an.length === 0) return { ok: false, test: testModus(), fehler: "Kein Empfänger" };
  if (testModus()) {
    console.log(
      [
        "──────── [mail:testmodus] NICHT versendet ────────",
        `Von:      ${m.von ?? kundenAbsender()}`,
        `An:       ${an.join(", ")}`,
        m.bcc?.length ? `Bcc:      ${m.bcc.join(", ")}` : "",
        m.replyTo ? `Reply-To: ${m.replyTo}` : "",
        `Betreff:  ${m.betreff}`,
        m.anhaenge?.length ? `Anhang:   ${m.anhaenge.map((a) => `${a.dateiname} (${a.inhalt.byteLength} Bytes)`).join(", ")}` : "",
        "",
        m.text,
        "──────────────────────────────────────────────────",
      ]
        .filter((z) => z !== "")
        .join("\n"),
    );
    return { ok: true, test: true };
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[mail] RESEND_API_KEY fehlt — nicht verschickt:", m.betreff);
    return { ok: false, test: false, fehler: "RESEND_API_KEY fehlt" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: m.von ?? kundenAbsender(),
        to: an,
        ...(m.bcc?.length ? { bcc: m.bcc } : {}),
        ...(m.replyTo ? { reply_to: m.replyTo } : {}),
        subject: m.betreff,
        text: m.text,
        html: textAlsHtml(m.text),
        ...(m.anhaenge?.length
          ? { attachments: m.anhaenge.map((a) => ({ filename: a.dateiname, content: Buffer.from(a.inhalt).toString("base64") })) }
          : {}),
      }),
    });
    if (res.ok) return { ok: true, test: false };
    const fehler = `Resend HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`;
    console.error("[mail]", fehler);
    return { ok: false, test: false, fehler };
  } catch (err) {
    console.error("[mail] Ausnahme", err);
    return { ok: false, test: false, fehler: String(err).slice(0, 300) };
  }
}

function postausgangId(): string {
  return `PA-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

/** Gescheiterte Systemmail zur Wiederholung ablegen (portal/postausgang/<id>.json). */
export async function einreihen(m: MailAuftrag, zweck: string, bezug: MailBezug, fehler?: string): Promise<boolean> {
  const id = postausgangId();
  const jetzt = new Date();
  try {
    await jsonAendern<PostausgangEintrag>(`portal/postausgang/${id}.json`, () => ({
      v: 1,
      id,
      zweck,
      erstelltAm: jetzt.toISOString(),
      versuche: 1,
      // Erster neuer Versuch frühestens nach 30 Minuten.
      naechsterVersuch: new Date(jetzt.getTime() + 30 * 60_000).toISOString(),
      ...(fehler ? { letzterFehler: fehler } : {}),
      bezug,
      mail: {
        an: m.an,
        betreff: m.betreff,
        text: m.text,
        ...(m.von ? { von: m.von } : {}),
        ...(m.replyTo ? { replyTo: m.replyTo } : {}),
        ...(m.bcc?.length ? { bcc: m.bcc } : {}),
        ...(m.anhaenge?.length ? { anhaenge: m.anhaenge.map((a) => ({ dateiname: a.dateiname, base64: Buffer.from(a.inhalt).toString("base64") })) } : {}),
      },
    }), () => undefined);
    return true;
  } catch (err) {
    console.error("[mail] Postausgang nicht beschreibbar — Mail verloren:", m.betreff, err);
    return false;
  }
}

/** Senden; scheitert es (nicht im Testmodus), landet die Mail im Postausgang. */
export async function sendeMitPostausgang(m: MailAuftrag, zweck: string, bezug: MailBezug): Promise<Versand> {
  const r = await sende(m);
  if (r.ok || r.test) return r;
  const eingereiht = await einreihen(m, zweck, bezug, r.fehler);
  return { ...r, eingereiht };
}

/**
 * Mail an einen Kunden: Absender lippeforst.de, Antworten ins Anfragenpostfach, Kopie an die Verwaltung.
 * Mit `postausgang` wird eine gescheiterte Mail später erneut versucht (Pflichtmitteilungen, Systemmails).
 */
export async function kundenMail(m: {
  an: string;
  betreff: string;
  text: string;
  anhaenge?: Anhang[];
  ohneBcc?: boolean;
  postausgang?: { zweck: string; bezug: MailBezug };
}): Promise<Versand> {
  const auftrag: MailAuftrag = {
    an: [m.an],
    betreff: m.betreff,
    text: m.text,
    von: kundenAbsender(),
    replyTo: antwortAdresse(),
    bcc: m.ohneBcc ? [] : notifyEmails().filter((a) => a !== m.an.toLowerCase()),
    anhaenge: m.anhaenge,
  };
  return m.postausgang ? sendeMitPostausgang(auftrag, m.postausgang.zweck, m.postausgang.bezug) : sende(auftrag);
}

/** Automatische Ereignis-Mail an die Verwaltung (ADMIN_NOTIFY_EMAILS). Scheitert der Versand, kommt sie in den Postausgang. */
export async function adminInfo(betreff: string, zeilen: string[], link?: string): Promise<void> {
  const an = notifyEmails();
  if (an.length === 0) {
    console.warn("[mail] ADMIN_NOTIFY_EMAILS leer — Ereignis nicht gemeldet:", betreff);
    return;
  }
  const text = [...zeilen, ...(link ? ["", `Öffnen: ${link}`] : []), "", "— automatische Meldung aus der Verwaltung von lippeforst.de"].join("\n");
  try {
    await sendeMitPostausgang({ an, betreff: `[Lippe Forst] ${betreff}`, text, von: verwaltungsAbsender() }, "verwaltung", { typ: "keiner" });
  } catch (err) {
    console.error("[mail] adminInfo", err);
  }
}
