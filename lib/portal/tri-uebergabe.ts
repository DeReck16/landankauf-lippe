import "server-only";
import { testModus } from "@/lib/admin/config";
import { leadView } from "@/lib/admin/model";
import { triPayload } from "@/lib/portal/tri-payload";
import { leadLesen, mutateZustand, readZustand } from "@/lib/admin/store";

/**
 * Fläche von Hand an die Verwaltung von TR Immobilien (tr-immobilien.com/admin) weitergeben, damit sie von dort
 * an den Partnermakler KurtInvest übergeben werden kann (Dennis 19.10.2026).
 *
 * Datenschutz: Die Datenschutzerklärung verspricht, nichts ohne Einwilligung an Dritte weiterzugeben — darum nur
 * mit dem Pflicht-Häkchen „Eigentümer ist einverstanden“ (Einverständnisse holt Dennis selbst ein, siehe auch den
 * Prozess bei TR Immobilien). Datum und Person gehen mit und stehen dort am Vorgang. Gesendet wird nie von selbst.
 *
 * Schnittstelle: POST {TRI_VERWALTUNG_URL}/api/verwaltung/eingang (Quelle „lippe-forst“), Bearer
 * TRI_VERWALTUNG_TOKEN — derselbe Schlüssel wie bei gewerbe-immobilien-lippe.de (dort VERWALTUNG_EINGANG_TOKEN).
 * Die Vorgangsnummer dort ist fest aus der LL-Nummer abgeleitet: Wiederholen erzeugt keine Dublette.
 */

const TRI_URL = (process.env.TRI_VERWALTUNG_URL || "https://www.tr-immobilien.com").replace(/\/+$/, "");

export type UebergabeErgebnis = { ok: true; triId: string; test?: boolean } | { ok: false; grund: string };

/** Ist die Verbindung zu TR Immobilien eingerichtet (Schlüssel gesetzt)? Im Testmodus immer — dann geht nichts raus. */
export function triVerbunden(): boolean {
  return testModus() || (process.env.TRI_VERWALTUNG_TOKEN ?? "").length >= 32;
}

/** Vorgang bei TR Immobilien in der Verwaltung (nur Link, öffnet nach Anmeldung). */
export function triVorgangUrl(triId: string): string {
  return `${TRI_URL}/admin/lead/${encodeURIComponent(triId)}`;
}

export async function anTriUebergeben(id: string, von: string, einverstanden: boolean): Promise<UebergabeErgebnis> {
  if (!einverstanden) return { ok: false, grund: "Ohne das Einverständnis des Eigentümers wird nichts weitergegeben — bitte das Häkchen setzen." };
  if (!/^LL-[A-Z0-9]+$/.test(id)) return { ok: false, grund: "Ungültige Anfrage-ID." };

  const [lead, { zustand }] = await Promise.all([leadLesen(id), readZustand()]);
  if (!lead) return { ok: false, grund: "Anfrage nicht gefunden." };
  const meta = zustand.anfragen[id];
  const l = leadView(lead, meta);
  if (l.rolle !== "angebot") return { ok: false, grund: "Nur Angebote (Eigentümer, die verkaufen oder verpachten) lassen sich weitergeben." };
  if (l.status === "archiv") return { ok: false, grund: "Die Anfrage ist archiviert (Test, Spam oder Dublette) — nicht weitergegeben." };
  if (meta?.loeschwunsch && !meta.loeschwunsch.erledigtAm) return { ok: false, grund: "Zu dieser Anfrage liegt ein Löschwunsch vor — nichts weitergegeben." };
  if (meta?.triUebergabe) return { ok: false, grund: `Schon an TR Immobilien übergeben (${meta.triUebergabe.triId}).` };

  const am = new Date().toISOString();
  const payload = triPayload(l, meta, am, von);

  let triId: string;
  let test = false;
  if (testModus()) {
    // Lokal und mit Datenpräfix geht nichts an die echte Verwaltung (wie bei den Mails).
    console.log("[tri-uebergabe] Testmodus — nicht gesendet:", id);
    triId = "TRI-TESTMODUS";
    test = true;
  } else {
    const token = process.env.TRI_VERWALTUNG_TOKEN ?? "";
    if (token.length < 32) return { ok: false, grund: "Die Verbindung zu TR Immobilien ist nicht eingerichtet (Umgebungsvariable TRI_VERWALTUNG_TOKEN fehlt)." };
    let antwort: { ok?: boolean; id?: string; error?: string; geloescht?: boolean };
    try {
      const res = await fetch(`${TRI_URL}/api/verwaltung/eingang`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      antwort = (await res.json().catch(() => ({}))) as typeof antwort;
      if (!res.ok || !antwort.ok || !antwort.id) {
        console.error("[tri-uebergabe] abgelehnt", id, res.status, antwort.error);
        return { ok: false, grund: `TR Immobilien hat die Übergabe nicht angenommen (${res.status}${antwort.error ? `: ${antwort.error}` : ""}). Nichts vermerkt — bitte erneut versuchen.` };
      }
    } catch (err) {
      console.error("[tri-uebergabe] nicht erreichbar", id, err);
      return { ok: false, grund: "TR Immobilien war nicht erreichbar. Nichts vermerkt — bitte in ein paar Minuten erneut versuchen." };
    }
    if (antwort.geloescht) {
      return { ok: false, grund: `Der Vorgang ${antwort.id} wurde bei TR Immobilien bereits endgültig gelöscht (DSGVO) und wird nicht neu angelegt.` };
    }
    triId = antwort.id;
  }

  await mutateZustand(von, (z) => {
    const m = { ...(z.anfragen[id] ?? {}) };
    m.triUebergabe = { am, von, triId, einverstaendnis: { am, von } };
    m.geaendert = { am, von };
    z.anfragen[id] = m;
    return { was: `An TR Immobilien übergeben → ${triId} (Einverständnis des Eigentümers bestätigt${test ? ", Testmodus: nichts gesendet" : ""})`, ref: id };
  });
  return { ok: true, triId, test };
}
