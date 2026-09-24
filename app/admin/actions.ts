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
import { ladeKunde } from "@/lib/portal/speicher";
import { beideUnterschrieben } from "@/lib/portal/schritte";
import { LEAD_STATUS, MATCH_STATUS, leadView, type Art, type BoerseMeta, type LeadMeta, type LeadStatus, type MatchMeta, type Rolle } from "@/lib/admin/model";
import { boerseLuecken, boerseNeuSchreiben, neuerBoerseCode } from "@/lib/boerse";

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

  // Erledigt/archiviert: ein Börsen-Angebot verschwindet sofort von der Website.
  if (bereich === "status" || bereich === "bearbeitung") {
    const { zustand } = await readZustand();
    if (zustand.anfragen[id]?.boerse?.online) await boerseNeuSchreiben();
  }

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

  // Schritt 4 (anonym vorstellen) erst, wenn beide unterschrieben haben — der Knopf ist dann ohnehin gesperrt.
  if (aktion === "angefragt") {
    const [aId, gId] = key.split("~");
    const [ka, kg] = await Promise.all([ladeKunde(aId), ladeKunde(gId)]);
    if (!beideUnterschrieben(ka, kg)) {
      revalidatePath("/admin", "layout");
      return;
    }
  }

  await mutateZustand(email, (z) => {
    const alt = z.paare[key];
    const meta: MatchMeta = alt ? { ...alt } : { status: "vorschlag" };
    let was = "";
    // Nach der Freigabe nicht mehr verwerfen/zurücksetzen — erst „Freigabe zurückziehen“ im Vorgang.
    if ((alt?.status === "kontakt" || alt?.status === "abschluss") && aktion !== "notiz") return;
    switch (aktion) {
      case "vormerken":
        meta.status = "vorgemerkt";
        was = "Paar vorgemerkt";
        break;
      case "angefragt":
        // Hinweise wurden außerhalb der Verwaltung verschickt (Telefon, eigenes Postfach).
        if (meta.status !== "vorschlag" && meta.status !== "vorgemerkt") return;
        meta.status = "angefragt";
        was = "Beide Seiten anonym angefragt";
        break;
      // Zustimmungen und die Freigabe laufen über app/admin/portal-actions.ts
      // (zustimmungErfassenAktion, freigebenAktion) — dort werden Unterschrift,
      // Widerrufsfrist und Zustimmung beider Seiten geprüft.
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

// ---------------------------------------------------------------------------
// Flächenbörse: Angaben, Einwilligung des Eigentümers, veröffentlichen

const BOERSE_QUELLEN = ["telefonisch", "per E-Mail", "schriftlich", "im Kundenbereich"];

export async function boerseAktion(formData: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const id = text(formData, "id", 40);
  if (!/^LL-[A-Z0-9]+$/.test(id)) throw new Error("Ungültige Anfrage-ID");
  const aktion = text(formData, "aktion", 30);
  const zurueck = `/admin/anfrage/${id}`;
  const lead = (await listLeads()).find((l) => l.id === id);
  if (!lead) redirect(`${zurueck}?m=${encodeURIComponent("Anfrage nicht gefunden.")}&mt=fehler`);
  const jetzt = new Date().toISOString();
  let meldung = "";
  let fehler = false;
  let oeffentlichBetroffen = false;

  await mutateZustand(email, (z) => {
    meldung = "";
    fehler = false;
    const meta: LeadMeta = { ...(z.anfragen[id] ?? {}) };
    const vorhanden = new Set(Object.values(z.anfragen).map((m) => m.boerse?.code).filter((c): c is string => Boolean(c)));
    const b: BoerseMeta = meta.boerse ? { ...meta.boerse } : { code: neuerBoerseCode(vorhanden), typ: "", groesseHa: null, lage: "", text: "", einwilligung: null, online: false };
    let was = "";
    switch (aktion) {
      case "speichern": {
        const typ = text(formData, "typ", 40);
        if ((FLAECHENTYPEN as readonly string[]).includes(typ)) b.typ = typ;
        b.groesseHa = zahlOderNull(text(formData, "groesseHa", 12));
        b.lage = text(formData, "lage", 80);
        b.text = text(formData, "text", 300);
        was = `Angaben für die Flächenbörse gespeichert (${b.code})`;
        oeffentlichBetroffen = b.online;
        break;
      }
      case "einwilligung": {
        const quelle = text(formData, "quelle", 40);
        const am = text(formData, "am", 10);
        b.einwilligung = { am: /^\d{4}-\d{2}-\d{2}$/.test(am) ? am : jetzt.slice(0, 10), quelle: BOERSE_QUELLEN.includes(quelle) ? quelle : "telefonisch", von: email };
        was = `Einwilligung des Eigentümers in die Flächenbörse erfasst (${b.einwilligung.quelle})`;
        break;
      }
      case "einwilligung-zurueck":
        b.einwilligung = null;
        oeffentlichBetroffen = b.online;
        b.online = false;
        was = "Einwilligung in die Flächenbörse widerrufen — Angebot offline";
        break;
      case "online": {
        const luecken = boerseLuecken(b, leadView(lead!, { ...meta, boerse: b }));
        if (luecken.length) {
          meldung = `Nicht veröffentlicht: ${luecken.join(" · ")}.`;
          fehler = true;
          return;
        }
        b.online = true;
        b.seit ??= jetzt;
        oeffentlichBetroffen = true;
        was = `In der Flächenbörse veröffentlicht (${b.code})`;
        break;
      }
      case "offline":
        if (!b.online) return;
        b.online = false;
        oeffentlichBetroffen = true;
        was = `Aus der Flächenbörse genommen (${b.code})`;
        break;
      default:
        return;
    }
    b.geaendert = { am: jetzt, von: email };
    meta.boerse = b;
    z.anfragen[id] = meta;
    meldung = was;
    return { was, ref: id };
  });

  if (oeffentlichBetroffen) await boerseNeuSchreiben();
  revalidatePath("/admin", "layout");
  redirect(`${zurueck}?m=${encodeURIComponent(meldung || "Keine Änderung.")}&mt=${fehler ? "fehler" : "ok"}#boerse`);
}
