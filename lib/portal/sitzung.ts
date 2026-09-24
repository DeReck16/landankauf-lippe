import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { KUNDE_COOKIE } from "@/lib/admin/config";
import { site } from "@/lib/site";
import type { KundeRecord } from "./model";
import { alleKunden } from "./speicher";
import { pruefeSitzung, sitzungToken } from "./token";

// Sitzung im Kundenbereich: eigenes Cookie (lf_kunde, Pfad /kunde), eigener
// Zweck-Tag. Jede Seite und jede Server Action prüft selbst (requireKunde).

export type KundenSitzung = { email: string; seit: number; kunden: KundeRecord[] };

function hatZugang(k: KundeRecord, email: string, seit: number): boolean {
  if (k.email !== email || k.gesperrt) return false;
  if (k.zugangAb && seit * 1000 < Date.parse(k.zugangAb)) return false;
  return true;
}

export const ladeKundenSitzung = cache(async (): Promise<KundenSitzung | null> => {
  const t = pruefeSitzung((await cookies()).get(KUNDE_COOKIE)?.value);
  if (!t) return null;
  const kunden = (await alleKunden()).filter((k) => hatZugang(k, t.e, t.i));
  if (kunden.length === 0) return null;
  kunden.sort((a, b) => b.angelegtAm.localeCompare(a.angelegtAm));
  return { email: t.e, seit: t.i, kunden };
});

export async function requireKunde(): Promise<KundenSitzung> {
  const s = await ladeKundenSitzung();
  if (!s) redirect("/kunde/anmelden");
  return s;
}

/** Den Kunden-Datensatz aus der Sitzung holen — nie einen fremden. */
export async function requireKundeId(id: string): Promise<{ sitzung: KundenSitzung; kunde: KundeRecord }> {
  const sitzung = await requireKunde();
  const kunde = sitzung.kunden.find((k) => k.id === id);
  if (!kunde) redirect("/kunde");
  return { sitzung, kunde };
}

export async function starteKundenSitzung(email: string): Promise<void> {
  const { token, maxAge } = sitzungToken(email);
  (await cookies()).set(KUNDE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/kunde",
    maxAge,
  });
}

export async function beendeKundenSitzung(): Promise<void> {
  (await cookies()).delete({ name: KUNDE_COOKIE, path: "/kunde" });
}

/** IP-Adresse und Browser für das Unterschriftsprotokoll. */
export async function anfrageHerkunft(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "unbekannt").trim().slice(0, 64);
  return { ip, userAgent: (h.get("user-agent") || "unbekannt").slice(0, 400) };
}

/** Basis-URL für Links in Mails: in Produktion fest die kanonische Domain (nie der Host-Header). */
export async function basisUrl(): Promise<string> {
  if (process.env.NODE_ENV === "production") return site.url;
  const h = await headers();
  return `http://${h.get("host") ?? "localhost:3101"}`;
}
