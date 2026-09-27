"use server";

import { redirect } from "next/navigation";
import { boerseEinwilligungKunde } from "@/lib/boerse";
import { pruefeBoerse } from "@/lib/portal/token";

// Widerruf der Einwilligung in die Flächenbörse mit einem Klick — ohne Anmeldung, nur mit
// dem persönlichen Link aus der Bestätigungsmail. Gespeichert wird erst per Knopf
// (Mail-Scanner öffnen Links vorab).

export async function boerseWiderrufAktion(fd: FormData): Promise<void> {
  const t = String(fd.get("t") ?? "").slice(0, 1500);
  const token = pruefeBoerse(t);
  if (!token) redirect("/kunde/boerse?fehler=link");
  await boerseEinwilligungKunde(token.k, false, null);
  redirect(`/kunde/boerse?t=${encodeURIComponent(t)}&ok=1`);
}
