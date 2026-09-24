"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { site } from "@/lib/site";
import { FLAECHENTYPEN } from "@/lib/lead-options";
import { isAdminEmail } from "@/lib/admin/config";
import { createLoginToken, verifyLoginToken } from "@/lib/admin/token";
import { endSession, requireAdmin, startSession } from "@/lib/admin/session";
import { linkEinloesen, mailDrosseln, mutateZustand, readZustand, listLeads } from "@/lib/admin/store";
import { sendeAnmeldelink } from "@/lib/admin/mail";
import { orteErgaenzen } from "@/lib/admin/daten";
import { orteAusText, ortKey } from "@/lib/admin/geo";
import { LEAD_STATUS, MATCH_STATUS, leadView, type Art, type LeadMeta, type LeadStatus, type MatchMeta, type Rolle } from "@/lib/admin/model";

// ---------------------------------------------------------------------------
// Anmeldung per Link

export type AnmeldeState = { status: "idle" | "gesendet" | "fehler"; text?: string };

/** Nur interne Ziele unter /admin zulassen (kein offener Redirect). */
function sicheresZiel(raw: FormDataEntryValue | null): string {
  const s = typeof raw === "string" ? raw : "";
  return /^\/admin(\/[A-Za-z0-9_~-]+)*\/?(\?[A-Za-z0-9_=&%~.-]*)?$/.test(s) ? s : "/admin";
}

async function basisUrl(): Promise<string> {
  // In Produktion fest die kanonische Domain — nie den Host-Header in einen
  // Mail-Link übernehmen (sonst ließe sich der Link auf fremde Domains umbiegen).
  if (process.env.NODE_ENV === "production") return site.url;
  const h = await headers();
  return `http://${h.get("host") ?? "localhost:3000"}`;
}

export async function anmeldelinkAnfordern(_prev: AnmeldeState, formData: FormData): Promise<AnmeldeState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "fehler", text: "Bitte eine gültige E-Mail-Adresse eingeben." };
  }
  const neutral: AnmeldeState = {
    status: "gesendet",
    text: "Wenn die Adresse freigeschaltet ist, ist ein Anmeldelink unterwegs. Er gilt 20 Minuten und nur einmal.",
  };
  if (!isAdminEmail(email)) return neutral;
  if (!(await mailDrosseln(email))) return neutral;

  const { token, expiresAt } = createLoginToken(email);
  const weiter = sicheresZiel(formData.get("weiter"));
  const link = new URL("/admin/anmelden/bestaetigen", await basisUrl());
  link.searchParams.set("t", token);
  if (weiter !== "/admin") link.searchParams.set("weiter", weiter);
  const ok = await sendeAnmeldelink(email, link.toString(), expiresAt);
  return ok ? neutral : { status: "fehler", text: "Der Versand hat nicht geklappt. Bitte in einer Minute erneut versuchen." };
}

export async function anmeldungBestaetigen(formData: FormData): Promise<void> {
  const token = verifyLoginToken(String(formData.get("t") || ""));
  if (!token) redirect("/admin/anmelden?fehler=abgelaufen");
  if (!(await linkEinloesen(token.n))) redirect("/admin/anmelden?fehler=benutzt");
  await startSession(token.e);
  redirect(sicheresZiel(formData.get("weiter")));
}

export async function abmelden(): Promise<void> {
  await endSession();
  redirect("/admin/anmelden?abgemeldet=1");
}

// ---------------------------------------------------------------------------
// Anfragen bearbeiten

function text(formData: FormData, key: string, max = 4000): string {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

function zahlOderNull(raw: string): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function istStatus(s: string): s is LeadStatus {
  return s in LEAD_STATUS;
}

export async function anfrageSpeichern(formData: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const id = text(formData, "id", 40);
  if (!/^LL-[A-Z0-9]+$/.test(id)) throw new Error("Ungültige Anfrage-ID");
  const bereich = text(formData, "bereich", 20);
  let ortGeaendert: string | null = null;

  await mutateZustand(email, (z) => {
    const meta: LeadMeta = { ...(z.anfragen[id] ?? {}) };
    const alt = JSON.stringify(meta);
    const aenderungen: string[] = [];

    if (bereich === "status" || bereich === "bearbeitung") {
      const status = text(formData, "status", 20);
      if (istStatus(status) && status !== (meta.status ?? "neu")) {
        meta.status = status;
        aenderungen.push(`Status → ${LEAD_STATUS[status].label}`);
      }
    }
    if (bereich === "bearbeitung") {
      const notiz = text(formData, "notiz");
      if (notiz !== (meta.notiz ?? "")) {
        if (notiz) meta.notiz = notiz;
        else delete meta.notiz;
        aenderungen.push("Notiz geändert");
      }
    }
    if (bereich === "matching") {
      const rolle = text(formData, "rolle", 20);
      if (rolle === "auto") delete meta.rolle;
      else if (["angebot", "gesuch", "keine"].includes(rolle)) meta.rolle = rolle as Rolle;

      const art = text(formData, "art", 20);
      if (art === "auto") delete meta.art;
      else if (art === "kauf" || art === "pacht") meta.art = art as Art;

      const typ = text(formData, "flaechentyp", 40);
      if (typ === "auto") delete meta.flaechentyp;
      else if ((FLAECHENTYPEN as readonly string[]).includes(typ)) meta.flaechentyp = typ;

      // Größe nur übersteuern, wenn sie gegenüber dem angezeigten Wert geändert wurde.
      const einzel = text(formData, "groesseModus", 10) === "einzel";
      const min = text(formData, "groesseMin", 20);
      const max = einzel ? min : text(formData, "groesseMax", 20);
      const unveraendert = min === text(formData, "groesseMinAlt", 20) && max === text(formData, "groesseMaxAlt", 20);
      if (!unveraendert) {
        if (!min && !max) {
          delete meta.groesseMinHa;
          delete meta.groesseMaxHa;
        } else {
          meta.groesseMinHa = zahlOderNull(min);
          meta.groesseMaxHa = zahlOderNull(max);
        }
      }

      const ort = text(formData, "ortMatching", 200);
      if (ort !== (meta.ortMatching ?? "")) {
        if (ort) meta.ortMatching = ort;
        else delete meta.ortMatching;
        ortGeaendert = ort;
      }

      const radius = zahlOderNull(text(formData, "radiusKm", 6));
      if (radius == null) delete meta.radiusKm;
      else meta.radiusKm = Math.min(150, Math.max(1, Math.round(radius)));

      if (JSON.stringify(meta) !== alt) aenderungen.push("Matching-Angaben geändert");
    }

    if (aenderungen.length === 0) return;
    meta.geaendert = { am: new Date().toISOString(), von: email };
    z.anfragen[id] = meta;
    return { was: aenderungen.join(" · "), ref: id };
  });

  if (ortGeaendert !== null) {
    const lead = (await listLeads()).find((l) => l.id === id);
    const zustand = (await readZustand()).zustand;
    if (lead) await orteErgaenzen(email, [leadView(lead, zustand.anfragen[id]).ortText], 15_000);
  }
  revalidatePath("/admin", "layout");
}

export async function ortNeuSuchen(formData: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const id = text(formData, "id", 40);
  const lead = (await listLeads()).find((l) => l.id === id);
  if (!lead) return;
  const { zustand } = await readZustand();
  const ortText = leadView(lead, zustand.anfragen[id]).ortText;
  const keys = orteAusText(ortText).map(ortKey);
  await mutateZustand(email, (z) => {
    for (const k of keys) delete z.orte[k];
  });
  await orteErgaenzen(email, [ortText], 15_000);
  revalidatePath("/admin", "layout");
}

export type OrteState = { text?: string };

export async function alleOrteNachschlagen(): Promise<OrteState> {
  const { email } = await requireAdmin();
  const leads = await listLeads();
  const { zustand } = await readZustand();
  const texte = leads.map((l) => leadView(l, zustand.anfragen[l.id])).filter((l) => l.status !== "archiv").map((l) => l.ortText);
  const { neu, offen } = await orteErgaenzen(email, texte, 25_000);
  revalidatePath("/admin", "layout");
  if (neu === 0 && offen === 0) return { text: "Alle Orte sind bereits bekannt." };
  return {
    text: offen > 0
      ? `${neu} Orte nachgeschlagen, ${offen} noch offen — bitte gleich noch einmal klicken.`
      : `${neu} Orte nachgeschlagen — fertig.`,
  };
}

// ---------------------------------------------------------------------------
// Paare (Matching)

export async function paarAktion(formData: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const key = text(formData, "key", 80);
  if (!/^LL-[A-Z0-9]+~LL-[A-Z0-9]+$/.test(key)) throw new Error("Ungültiges Paar");
  const aktion = text(formData, "aktion", 30);
  const heute = new Date().toISOString();

  await mutateZustand(email, (z) => {
    const alt = z.paare[key];
    const meta: MatchMeta = alt ? { ...alt } : { status: "vorschlag" };
    let was = "";
    switch (aktion) {
      case "vormerken":
        meta.status = "vorgemerkt";
        was = "Paar vorgemerkt";
        break;
      case "angefragt":
        meta.status = "angefragt";
        was = "Beide Seiten anonym angefragt";
        break;
      case "zustimmung_anbieter":
        meta.zustimmungAnbieter = meta.zustimmungAnbieter ? null : heute;
        was = meta.zustimmungAnbieter ? "Zustimmung des Anbieters erfasst" : "Zustimmung des Anbieters zurückgenommen";
        break;
      case "zustimmung_suchender":
        meta.zustimmungSuchender = meta.zustimmungSuchender ? null : heute;
        was = meta.zustimmungSuchender ? "Zustimmung des Suchenden erfasst" : "Zustimmung des Suchenden zurückgenommen";
        break;
      case "kontakt":
        // Kontaktdaten erst weitergeben, wenn beide Seiten zugestimmt haben.
        if (!meta.zustimmungAnbieter || !meta.zustimmungSuchender) return;
        meta.status = "kontakt";
        was = "Kontakt hergestellt";
        break;
      case "verwerfen":
        meta.status = "verworfen";
        was = "Paar verworfen";
        break;
      case "zuruecksetzen":
        delete z.paare[key];
        return { was: "Paar zurückgesetzt", ref: key };
      case "notiz": {
        const notiz = text(formData, "notiz");
        if (notiz === (meta.notiz ?? "")) return;
        if (notiz) meta.notiz = notiz;
        else delete meta.notiz;
        was = "Notiz zum Paar geändert";
        break;
      }
      default:
        return;
    }
    if (!(meta.status in MATCH_STATUS)) return;
    meta.geaendert = { am: heute, von: email };
    z.paare[key] = meta;
    return { was, ref: key };
  });
  revalidatePath("/admin", "layout");
}
