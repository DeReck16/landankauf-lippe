import "server-only";
import { cache } from "react";
import type { Ereignis, KundeRecord, VorgangRecord } from "@/lib/portal/model";
import { alleKunden, alleVorgaenge, ladeEinstellungen, ladeGesehen } from "@/lib/portal/speicher";
import type { LeadView } from "./model";

// „Neu“ für das Pulsieren in der Verwaltung: je Admin wird gespeichert, wann er
// eine Anfrage, einen Vorschlag, eine Kundenakte oder einen Vorgang zuletzt
// angesehen hat (admin/gesehen/<hash>.json). Neu ist, was danach passiert ist —
// Ereignisse, die der Admin selbst ausgelöst hat, zählen nicht.

/** Kundenakten, Vorgänge und Einstellungen einmal pro Seitenaufruf laden. */
export const ladePortal = cache(async () => {
  const [kunden, vorgaenge, einstellungen] = await Promise.all([alleKunden(), alleVorgaenge(), ladeEinstellungen()]);
  return {
    kunden: new Map(kunden.map((k) => [k.id, k])),
    vorgaenge: new Map(vorgaenge.map((v) => [v.key, v])),
    einstellungen,
  };
});

export const ladeNeu = cache(async (email: string) => {
  const g = await ladeGesehen(email);
  const e = g.eintraege;
  const selbst = email.toLowerCase();

  function neueEreignisse(liste: Ereignis[] | undefined, key: string): Ereignis[] {
    if (!liste?.length) return [];
    const seit = e[key] ?? "";
    return liste.filter((x) => x.am > seit && x.von.toLowerCase() !== selbst);
  }

  return {
    gesehen: e,
    /** Neue Anfrage: Status „neu“ und noch nicht geöffnet. */
    anfrage(l: LeadView): boolean {
      return l.status === "neu" && !e[`anfrage:${l.id}`];
    },
    /** Neuer Matching-Vorschlag: noch nie im Matching angezeigt. */
    vorschlag(key: string): boolean {
      return !e[`paar:${key}`];
    },
    kunde(k: KundeRecord | null | undefined): Ereignis[] {
      return k ? neueEreignisse(k.ereignisse, `kunde:${k.id}`) : [];
    },
    vorgang(v: VorgangRecord | null | undefined): Ereignis[] {
      return v ? neueEreignisse(v.ereignisse, `vorgang:${v.key}`) : [];
    },
    /** Neue Dokumente (Unterschriften, Uploads) in Akte oder Vorgang. */
    dokumentNeu(quelle: KundeRecord | VorgangRecord, dokId: string): boolean {
      const key = "key" in quelle ? `vorgang:${quelle.key}` : `kunde:${quelle.id}`;
      const d = quelle.dokumente.find((x) => x.id === dokId);
      return Boolean(d && d.erstelltAm > (e[key] ?? "") && d.von.toLowerCase() !== selbst);
    },
  };
});

export type Neu = Awaited<ReturnType<typeof ladeNeu>>;
