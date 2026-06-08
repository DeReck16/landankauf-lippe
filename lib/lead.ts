// Client-Helper: schickt das Formular an die /api/lead-Route.
// Serverseitig läuft dort die Mehrkanal-Zustellung (Resend + Formspree + Blob).
// Signatur bleibt (FormData rein) — LeadForm muss nicht angepasst werden.

export type LeadResult =
  | { ok: true; id: string; delivered?: { resend: boolean; formspree: boolean; blob: boolean } }
  | { ok: false; error: string };

export async function submitLead(formData: FormData): Promise<LeadResult> {
  const payload: Record<string, string> = {};
  formData.forEach((value, key) => {
    payload[key] = typeof value === "string" ? value : "";
  });

  try {
    const res = await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as LeadResult;
  } catch {
    return { ok: false, error: "Netzwerkfehler — bitte versuchen Sie es später erneut." };
  }
}
