import "server-only";
import type { LeadMeta } from "@/lib/admin/model";
import { mutateZustand } from "@/lib/admin/store";
import { boerseNeuSchreiben } from "@/lib/boerse";

/**
 * Weiche je Angebot (Dennis 27.09.2026): Die TR Vertriebs GmbH kauft Flächen selbst („ankauf“,
 * ohne Makler und ohne Provision) ODER vermittelt sie („vermittlung“, für Eigentümer kostenlos).
 * Der Weg steuert den nächsten Schritt und die Mail-Texte: Beim Direktankauf gibt es keine
 * Einladung zur Vereinbarung, kein Matching und keine Flächenbörse.
 */
export type Weg = "ankauf" | "vermittlung";

export const WEG_NAME: Record<Weg, string> = {
  ankauf: "Selbst kaufen (Direktankauf)",
  vermittlung: "Vermitteln",
};

export const WEG_TIPP: Record<Weg, string> = {
  ankauf: "Die TR Vertriebs GmbH kauft die Fläche selbst — ohne Makler, ohne Provision. Keine Vereinbarung, kein Matching, keine Flächenbörse.",
  vermittlung: "Lippe Forst vermittelt die Fläche an Käufer bzw. Pächter — für den Eigentümer kostenlos, Provision zahlt nur der Käufer bzw. Pächter im Erfolgsfall.",
};

export type AnkaufErgebnis = "gekauft" | "abgelehnt";

export const ANKAUF_ERGEBNIS_NAME: Record<AnkaufErgebnis, string> = {
  gekauft: "Gekauft (Kaufvertrag beurkundet)",
  abgelehnt: "Eigentümer hat abgelehnt",
};

/** Kaufpreis-Eingabe („25.000“, „25000 €“, „25.000,50“) → Euro oder null. */
export function preisLesen(roh: string): number | null {
  const t = roh.replace(/[€\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 && n < 100_000_000 ? Math.round(n * 100) / 100 : null;
}

/**
 * Weg setzen oder zurücknehmen (null = wieder offen). Beim Direktankauf geht ein Börsen-Angebot
 * sofort offline. Gibt zurück, ob sich etwas geändert hat.
 */
export async function wegSetzen(id: string, weg: Weg | null, von: string, opt: { preis?: number | null } = {}): Promise<boolean> {
  const am = new Date().toISOString();
  let geaendert = false;
  let offline = false;
  await mutateZustand(von, (z) => {
    geaendert = false;
    offline = false;
    const meta: LeadMeta = { ...(z.anfragen[id] ?? {}) };
    const alt = JSON.stringify(meta);
    const was: string[] = [];
    if (weg === null) {
      if (meta.weg) {
        delete meta.weg;
        was.push("Weg wieder offen (Selbst kaufen oder Vermitteln)");
      }
    } else if (weg === "ankauf") {
      meta.weg = "ankauf";
      const preis = opt.preis === undefined ? (meta.ankauf?.preis ?? null) : opt.preis;
      // Ein früheres Ergebnis (z. B. „zurück zur Vermittlung“) gilt nicht mehr, wenn neu „Selbst kaufen“ gewählt wird.
      meta.ankauf = { gewaehltAm: meta.ankauf && !meta.ankauf.ergebnis ? meta.ankauf.gewaehltAm : am, von, preis };
      was.push(`Weg → ${WEG_NAME.ankauf}${preis ? ` · Kaufpreis-Angebot ${preis.toLocaleString("de-DE")} €` : ""}`);
      if (meta.boerse?.online) {
        meta.boerse = { ...meta.boerse, online: false, offline: { am, grund: "Direktankauf gewählt" }, geaendert: { am, von } };
        offline = true;
        was.push(`Flächenbörse ${meta.boerse.code} offline`);
      }
    } else {
      meta.weg = "vermittlung";
      if (meta.ankauf && !meta.ankauf.ergebnis) meta.ankauf = { ...meta.ankauf, ergebnis: { am, von, wie: "zurueck" } };
      was.push(`Weg → ${WEG_NAME.vermittlung}`);
    }
    if (JSON.stringify(meta) === alt) return;
    meta.geaendert = { am, von };
    z.anfragen[id] = meta;
    geaendert = true;
    return { was: was.join(" · "), ref: id };
  });
  if (offline) await boerseNeuSchreiben().catch((err) => console.error("[weg] Börse neu schreiben fehlgeschlagen", err));
  return geaendert;
}

/** Kaufpreis-Angebot vermerken (nach dem Senden der Ankauf-Mail). */
export async function ankaufAngebotVermerken(id: string, von: string): Promise<void> {
  const am = new Date().toISOString();
  await mutateZustand(von, (z) => {
    const meta = z.anfragen[id];
    if (meta?.weg !== "ankauf" || !meta.ankauf) return;
    z.anfragen[id] = { ...meta, ankauf: { ...meta.ankauf, angebotAm: am } };
    return { was: meta.ankauf.preis ? `Kaufangebot gesendet (${meta.ankauf.preis.toLocaleString("de-DE")} €)` : "Direktankauf: Mail mit den nächsten Schritten gesendet", ref: id };
  });
}

/** Ergebnis des Direktankaufs: gekauft oder abgelehnt → Anfrage erledigt. */
export async function ankaufErgebnis(id: string, wie: AnkaufErgebnis, von: string, notiz: string): Promise<boolean> {
  const am = new Date().toISOString();
  let ok = false;
  await mutateZustand(von, (z) => {
    ok = false;
    const meta = z.anfragen[id];
    if (meta?.weg !== "ankauf" || !meta.ankauf) return;
    z.anfragen[id] = {
      ...meta,
      status: "erledigt",
      ankauf: { ...meta.ankauf, ergebnis: { am, von, wie, ...(notiz ? { notiz } : {}) } },
      geaendert: { am, von },
    };
    ok = true;
    return { was: `Direktankauf: ${ANKAUF_ERGEBNIS_NAME[wie]}${notiz ? ` — ${notiz}` : ""} · Status → Erledigt`, ref: id };
  });
  return ok;
}
