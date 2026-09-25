"use server";

import { redirect } from "next/navigation";
import { rueckmeldungSpeichern } from "@/lib/portal/rueckmeldung";
import { istRueckmeldungArt } from "@/lib/portal/rueckmeldung-typen";
import { basisUrl } from "@/lib/portal/sitzung";
import { pruefeAntwort } from "@/lib/portal/token";

// Antwort auf die Nachfass-Mail (/kunde/antwort) — ohne Anmeldung, nur mit dem
// persönlichen Antwort-Link. Gespeichert wird erst hier (Knopf „Antwort senden“),
// nie beim bloßen Öffnen des Links: Mail-Scanner rufen Links vorab auf.

function feld(fd: FormData, key: string, max: number): string {
  return String(fd.get(key) ?? "").trim().slice(0, max);
}

export async function antwortAktion(fd: FormData): Promise<void> {
  const t = feld(fd, "t", 1500);
  const token = pruefeAntwort(t);
  if (!token) redirect("/kunde/antwort?fehler=link");
  const zurueck = `/kunde/antwort?t=${encodeURIComponent(t)}`;
  const art = feld(fd, "art", 20);
  if (!istRueckmeldungArt(art)) redirect(`${zurueck}&fehler=auswahl`);
  const r = await rueckmeldungSpeichern(
    token.k,
    { art, thema: feld(fd, "thema", 80), text: feld(fd, "nachricht", 2000) },
    { quelle: "link", von: "kunde", basis: await basisUrl() },
  );
  if (!r.ok) redirect(`${zurueck}&fehler=${r.code}`);
  redirect(`${zurueck}&ok=1`);
}
