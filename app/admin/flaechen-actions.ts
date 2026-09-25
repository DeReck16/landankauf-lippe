"use server";

import { revalidatePath } from "next/cache";
import type { Art } from "@/lib/admin/model";
import { requireAdmin } from "@/lib/admin/session";
import { flaechenEinstellen, flaechenPruefen, type EinstellErgebnis, type FlaechenZeile } from "@/lib/portal/eigene-flaechen";

// Server Actions für „Flächen einstellen“ (app/admin/(intern)/flaechen-einstellen): erst
// im Kataster prüfen (Vorschau), dann einzeln anonym veröffentlichen. Beide prüfen die
// Anmeldung selbst; das Einstellen fragt das Kataster erneut ab.

function feld(fd: FormData, key: string, max: number): string {
  return String(fd.get(key) ?? "").trim().slice(0, max);
}

export async function flaechenPruefenAktion(fd: FormData): Promise<{ zeilen: FlaechenZeile[] } | { fehler: string }> {
  await requireAdmin();
  const zeilen = feld(fd, "zeilen", 4000);
  if (!zeilen) return { fehler: "Bitte mindestens eine Zeile mit einem Flurstück eingeben." };
  return { zeilen: await flaechenPruefen(zeilen, feld(fd, "text", 400), feld(fd, "typ", 40)) };
}

export async function flaechenEinstellenAktion(fd: FormData): Promise<{ ergebnisse: EinstellErgebnis[] } | { fehler: string }> {
  const { email } = await requireAdmin();
  const art: Art = feld(fd, "art", 10) === "kauf" ? "kauf" : "pacht";
  const eigentuemer = feld(fd, "eigentuemer", 120);
  const mail = feld(fd, "email", 200).toLowerCase();
  if (!eigentuemer) return { fehler: "Bitte den Eigentümer angeben (nur intern, nie öffentlich)." };
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(mail)) return { fehler: "Bitte eine gültige E-Mail-Adresse des Eigentümers angeben (für den weiteren Ablauf)." };
  let eintraege: { zeile: string; typ: string; text: string }[];
  try {
    const roh = JSON.parse(String(fd.get("eintraege") ?? "[]")) as unknown;
    eintraege = (Array.isArray(roh) ? roh : [])
      .filter((x): x is { zeile: string; typ: string; text: string } => Boolean(x) && typeof x === "object" && typeof (x as { zeile?: unknown }).zeile === "string")
      .map((x) => ({ zeile: String(x.zeile).slice(0, 200), typ: String(x.typ ?? "").slice(0, 40), text: String(x.text ?? "").slice(0, 400) }))
      .slice(0, 20);
  } catch {
    return { fehler: "Ungültige Auswahl." };
  }
  if (eintraege.length === 0) return { fehler: "Keine Fläche ausgewählt." };
  const ergebnisse = await flaechenEinstellen({ eintraege, art, eigentuemer, email: mail, von: email });
  revalidatePath("/admin", "layout");
  revalidatePath("/");
  revalidatePath("/flaechenboerse");
  return { ergebnisse };
}
