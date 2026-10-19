"use server";

import { redirect } from "next/navigation";
import { boerseEinwilligungKunde, veroeffentlichungBestaetigen } from "@/lib/boerse";
import { pruefeBoerse } from "@/lib/portal/token";

// Bestätigen bzw. Widerruf der Einwilligung in die anonyme Anzeige mit einem Klick — ohne Anmeldung, nur mit dem
// persönlichen Link aus der Eingangs- bzw. Bestätigungsmail. Gespeichert wird erst per Knopf (Mail-Scanner öffnen Links vorab).

export async function boerseBestaetigenAktion(fd: FormData): Promise<void> {
  const t = String(fd.get("t") ?? "").slice(0, 1500);
  const token = pruefeBoerse(t);
  if (!token) redirect("/kunde/boerse?fehler=link");
  const r = await veroeffentlichungBestaetigen(token.k);
  redirect(`/kunde/boerse?t=${encodeURIComponent(t)}&${r.ok ? "ok=bestaetigt" : `hinweis=${r.code ?? "keine"}`}`);
}

export async function boerseWiderrufAktion(fd: FormData): Promise<void> {
  const t = String(fd.get("t") ?? "").slice(0, 1500);
  const token = pruefeBoerse(t);
  if (!token) redirect("/kunde/boerse?fehler=link");
  await boerseEinwilligungKunde(token.k, false, null);
  redirect(`/kunde/boerse?t=${encodeURIComponent(t)}&ok=1`);
}
