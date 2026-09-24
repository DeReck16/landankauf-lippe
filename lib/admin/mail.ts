import "server-only";

// Versand des Anmeldelinks über Resend (Domain lippeforst.de ist verifiziert).
// Lokal (NODE_ENV !== "production") wird nichts verschickt — der Link steht
// dann nur im Server-Log.

const FROM = process.env.ADMIN_FROM_EMAIL || "Lippe Forst Verwaltung <anmeldung@lippeforst.de>";

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function sendeAnmeldelink(to: string, link: string, gueltigBis: Date): Promise<boolean> {
  const bis = gueltigBis.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  if (process.env.NODE_ENV !== "production") {
    console.log(`[verwaltung] Anmeldelink für ${to} (gültig bis ${bis}): ${link}`);
    return true;
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[verwaltung] RESEND_API_KEY fehlt — Anmeldelink nicht verschickt");
    return false;
  }
  const text = [
    "Hier ist der Anmeldelink für die Verwaltung von lippeforst.de:",
    "",
    link,
    "",
    `Der Link gilt bis ${bis} Uhr und nur einmal.`,
    "",
    "Wurde kein Link angefordert, kann diese E-Mail ignoriert werden — ohne den Link ist keine Anmeldung möglich.",
    "",
    "Lippe Forst",
  ].join("\n");
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#1c2519">
<p>Hier ist der Anmeldelink für die Verwaltung von lippeforst.de:</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#2f5d3a;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600">Zur Verwaltung anmelden</a></p>
<p style="color:#4b5848">Der Link gilt bis ${bis} Uhr und nur einmal.</p>
<p style="color:#7a8479;font-size:13px">Wurde kein Link angefordert, kann diese E-Mail ignoriert werden — ohne den Link ist keine Anmeldung möglich.</p>
<p style="color:#7a8479;font-size:13px">Lippe Forst</p>
</div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject: "Anmeldelink für die Lippe-Forst-Verwaltung", text, html }),
    });
    if (res.ok) return true;
    console.error("[verwaltung] resend error", res.status, await res.text());
    return false;
  } catch (err) {
    console.error("[verwaltung] resend exception", err);
    return false;
  }
}
