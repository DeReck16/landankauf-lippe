"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { automatikNachAnfrage } from "@/lib/portal/automatik";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { menueErneuern } from "@/lib/admin/menue";
import { site } from "@/lib/site";
import { FLAECHENTYPEN } from "@/lib/lead-options";
import { isAdminEmail } from "@/lib/admin/config";
import { createLoginToken, verifyLoginToken } from "@/lib/admin/token";
import { endSession, requireAdmin, startSession } from "@/lib/admin/session";
import { alleSitzungenBeenden } from "@/lib/admin/sitzungen";
import { loeschwunschErledigt, loeschwunschVermerken } from "@/lib/admin/loeschwunsch";
import { vorgangLoeschen } from "@/lib/admin/loeschen";
import { linkEinloesen, mailDrosseln, mutateZustand, readZustand, listLeads } from "@/lib/admin/store";
import { sendeAnmeldelink } from "@/lib/admin/mail";
import { orteErgaenzen } from "@/lib/admin/daten";
import { orteAusText, ortKey } from "@/lib/admin/geo";
import { ladeKunde } from "@/lib/portal/speicher";
import { beideUnterschrieben } from "@/lib/portal/schritte";
import { LEAD_STATUS, MATCH_STATUS, leadView, type Art, type BoerseMeta, type LeadMeta, type LeadStatus, type MatchMeta, type Rolle } from "@/lib/admin/model";
import { boerseLuecken, boerseNeuSchreiben, neuerBoerseCode } from "@/lib/boerse";
import { DETAIL_FELDER, detailsBereinigen } from "@/lib/boerse-regeln";
import { einwilligungBestaetigen } from "@/lib/portal/boerse-mails";
import { postfachUebernehmen, postfachZurKenntnis } from "@/lib/portal/postfach";
import { rueckmeldungSpeichern } from "@/lib/portal/rueckmeldung";
import { RUECKMELDUNG_NAME, istRueckmeldungArt } from "@/lib/portal/rueckmeldung-typen";
import { ANKAUF_ERGEBNIS_NAME, ankaufErgebnis, preisLesen, wegSetzen } from "@/lib/portal/weg";

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

/**
 * Alle Sitzungen der Verwaltung beenden (z. B. Gerät verloren): alle Geräte aller Admins müssen sich
 * neu anmelden — dieses Gerät bekommt sofort eine neue Sitzung.
 */
export async function alleSitzungenBeendenAktion(): Promise<void> {
  const { email } = await requireAdmin();
  await alleSitzungenBeenden(email);
  // Eine Sekunde später ausstellen, damit die neue Sitzung sicher nach dem Sperrzeitpunkt liegt.
  await new Promise((r) => setTimeout(r, 1100));
  await startSession(email);
  await mutateZustand(email, () => ({ was: "Alle Sitzungen der Verwaltung beendet (alle Geräte müssen sich neu anmelden)" }));
  redirect(`/admin/vorlagen?m=${encodeURIComponent("Alle anderen Sitzungen sind beendet — dieses Gerät ist neu angemeldet.")}&mt=ok#sicherheit`);
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
  menueErneuern();
}

/**
 * Weiche je Angebot (Dennis 27.09.2026): „Selbst kaufen“ (Direktankauf der TR Vertriebs GmbH, ohne
 * Makler und Provision) oder „Vermitteln“ (für Eigentümer kostenlos) — und das Ergebnis des Ankaufs.
 * Es geht keine Mail raus; die passende Mail steht danach unter „E-Mail-Entwürfe“.
 */
export async function wegFormular(formData: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const id = text(formData, "id", 40);
  if (!/^LL-[A-Z0-9]+$/.test(id)) throw new Error("Ungültige Anfrage-ID");
  const zurueck = `/admin/anfrage/${id}`;
  const was = text(formData, "was", 20);
  let m: string;
  let ok = true;
  if (was === "ankauf" || was === "vermittlung" || was === "offen") {
    const preisRoh = text(formData, "preis", 30);
    const preis = preisRoh ? preisLesen(preisRoh) : undefined;
    if (preisRoh && preis === null) {
      ok = false;
      m = "Der Kaufpreis ist nicht lesbar — bitte nur eine Zahl eintragen, z. B. 25000.";
    } else {
      const geaendert = await wegSetzen(id, was === "offen" ? null : was, email, was === "ankauf" ? { preis } : {});
      // Automatik R3 (nur wenn eingeschaltet): Pacht-Angebot mit Weg „Vermitteln“ einladen.
      if (geaendert && was === "vermittlung") after(() => automatikNachAnfrage(id));
      m = !geaendert
        ? "Nichts geändert."
        : was === "ankauf"
          ? "Weg „Selbst kaufen“ gespeichert — die Mail zum Direktankauf steht unter „E-Mail-Entwürfe“. Börse und Matching sind für diese Fläche aus."
          : was === "vermittlung"
            ? "Weg „Vermitteln“ gespeichert — nächster Schritt: Einladung zur kostenlosen Vereinbarung (E-Mail-Entwürfe)."
            : "Weg wieder offen.";
    }
  } else if (was === "gekauft" || was === "abgelehnt") {
    ok = await ankaufErgebnis(id, was, email, text(formData, "notiz", 300));
    m = ok ? `Ergebnis gespeichert: ${ANKAUF_ERGEBNIS_NAME[was]} — die Anfrage steht auf „Erledigt“.` : "Nicht gespeichert — für diese Anfrage ist „Selbst kaufen“ nicht gewählt.";
  } else {
    ok = false;
    m = "Unbekannte Auswahl.";
  }
  revalidatePath("/admin", "layout");
  menueErneuern();
  redirect(`${zurueck}?m=${encodeURIComponent(m)}&mt=${ok ? "ok" : "fehler"}#weg`);
}

/** Löschwunsch (Art. 17 DSGVO) vermerken bzw. ohne Löschen als erledigt vermerken (z. B. zurückgenommen). */
export async function loeschwunschFormular(formData: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const id = text(formData, "id", 40);
  if (!/^LL-[A-Z0-9]+$/.test(id)) throw new Error("Ungültige Anfrage-ID");
  const was = text(formData, "was", 20);
  const ok = was === "erledigt" ? await loeschwunschErledigt(id, email) : await loeschwunschVermerken(id, email, text(formData, "notiz", 300));
  const m = !ok
    ? "Nichts geändert."
    : was === "erledigt"
      ? "Löschwunsch als erledigt vermerkt."
      : "Löschwunsch vermerkt — die Anfrage ist archiviert, ein Börsen-Angebot offline. Innerhalb der Frist mit „Vorgang endgültig löschen (DSGVO)“ erledigen; die Aufgabe steht im Dashboard.";
  revalidatePath("/admin", "layout");
  menueErneuern();
  redirect(`/admin/anfrage/${id}?m=${encodeURIComponent(m)}&mt=${ok ? "ok" : "fehler"}#datenschutz`);
}

/**
 * „Vorgang endgültig löschen (DSGVO)“ (lib/admin/loeschen.ts). Nur mit „Ja – endgültig löschen“ aus der
 * Abfrage auf der Seite; was gelöscht und was gesperrt wird, prüft der Server frisch.
 */
export async function vorgangLoeschenAktion(formData: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const id = text(formData, "id", 40);
  if (!/^LL-[A-Z0-9]+$/.test(id)) throw new Error("Ungültige Anfrage-ID");
  if (text(formData, "bestaetigt", 5) !== "ja") redirect(`/admin/anfrage/${id}?m=${encodeURIComponent("Nicht gelöscht — bitte mit „Ja – endgültig löschen“ bestätigen.")}&mt=fehler#loeschen`);
  const r = await vorgangLoeschen(id, email);
  revalidatePath("/admin", "layout");
  revalidatePath("/kunde", "layout");
  menueErneuern();
  const fertig = r.ok && r.grabstein.stand === "fertig";
  const m = !r.ok
    ? `Nicht gelöscht: ${r.gruende.join(" ")}`
    : fertig
      ? `Vorgang ${id} ist endgültig gelöscht.${r.grabstein.gesperrt.length ? " Verträge bzw. Nachweise bleiben bis zum Ende der Aufbewahrungsfrist gesperrt." : ""}`
      : `Löschen unvollständig (${(r.grabstein.fehler ?? []).join("; ")}) — bitte „Löschen fortsetzen“.`;
  redirect(`/admin/anfrage/${id}?m=${encodeURIComponent(m)}&mt=${fertig ? "ok" : "fehler"}#loeschen`);
}

/**
 * Rückmeldung auf die Nachfass-Mail von Hand erfassen (Antwort kam per E-Mail, WhatsApp o. Ä.) —
 * wie beim Antwort-Link entsteht ein Ticket im Dashboard bzw. „Erledigt“ bei „kein Interesse“.
 */
export async function rueckmeldungErfassen(formData: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const id = text(formData, "id", 40);
  if (!/^LL-[A-Z0-9]+$/.test(id)) throw new Error("Ungültige Anfrage-ID");
  const zurueck = `/admin/anfrage/${id}`;
  const art = text(formData, "art", 20);
  if (!istRueckmeldungArt(art)) redirect(`${zurueck}?m=${encodeURIComponent("Bitte die Antwort des Kunden auswählen.")}&mt=fehler#rueckmeldung`);
  const r = await rueckmeldungSpeichern(id, { art, thema: text(formData, "thema", 80), text: text(formData, "notiz", 1500) }, { quelle: "verwaltung", von: email, basis: await basisUrl() });
  const m = !r.ok
    ? r.fehler
    : r.art === "kein-interesse"
      ? "Rückmeldung gespeichert: kein Interesse — die Anfrage steht auf „Erledigt“."
      : "Rückmeldung gespeichert — die Anfrage steht wieder auf „Neu“ und im Dashboard unter „Rückmeldungen“.";
  redirect(`${zurueck}?m=${encodeURIComponent(m)}&mt=${r.ok ? "ok" : "fehler"}#rueckmeldung`);
}

/**
 * E-Mail aus dem Anfragenpostfach (Anfrage-Seite, Abschnitt „E-Mails aus dem Postfach“): gewählte
 * Antwort übernehmen oder nur zur Kenntnis nehmen — wie die Knöpfe im Dashboard.
 */
export async function postfachFormular(formData: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const id = text(formData, "id", 40);
  if (!/^LL-[A-Z0-9]+$/.test(id)) throw new Error("Ungültige Anfrage-ID");
  const zurueck = `/admin/anfrage/${id}`;
  const mail = text(formData, "mail", 40);
  const art = text(formData, "art", 20);
  let m: string;
  let ok: boolean;
  if (text(formData, "aktion", 20) === "kenntnis") {
    const r = await postfachZurKenntnis(id, mail, email);
    ok = r.ok;
    m = r.ok ? "E-Mail zur Kenntnis genommen — Einordnung und Status bleiben, wie sie sind." : r.fehler;
  } else {
    if (!istRueckmeldungArt(art)) redirect(`${zurueck}?m=${encodeURIComponent("Bitte eine Antwort auswählen.")}&mt=fehler#postfach`);
    const r = await postfachUebernehmen(id, mail, art, { von: email, basis: await basisUrl(), thema: text(formData, "thema", 80) || undefined });
    ok = r.ok;
    m = !r.ok
      ? r.fehler
      : art === "kein-interesse"
        ? "Übernommen: kein Interesse — die Anfrage steht auf „Erledigt“ (bzw. ist im laufenden Vorgang vermerkt)."
        : `Übernommen: ${RUECKMELDUNG_NAME[art]} — die Anfrage steht im Dashboard unter „Rückmeldungen“ mit dem nächsten Schritt.`;
  }
  redirect(`${zurueck}?m=${encodeURIComponent(m)}&mt=${ok ? "ok" : "fehler"}#postfach`);
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
  menueErneuern();
}

export type OrteState = { text?: string };

export async function alleOrteNachschlagen(): Promise<OrteState> {
  const { email } = await requireAdmin();
  const leads = await listLeads();
  const { zustand } = await readZustand();
  const texte = leads.map((l) => leadView(l, zustand.anfragen[l.id])).filter((l) => l.status !== "archiv").map((l) => l.ortText);
  const { neu, offen } = await orteErgaenzen(email, texte, 25_000);
  revalidatePath("/admin", "layout");
  menueErneuern();
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
  menueErneuern();
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
  menueErneuern();
}

// ---------------------------------------------------------------------------
// Flächenbörse: Angaben, Einwilligung des Eigentümers, veröffentlichen

const BOERSE_QUELLEN = ["telefonisch", "per E-Mail", "schriftlich", "im Kundenbereich"];

export async function boerseAktion(formData: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const id = text(formData, "id", 40);
  if (!/^LL-[A-Z0-9]+$/.test(id)) throw new Error("Ungültige Anfrage-ID");
  const aktion = text(formData, "aktion", 30);
  // Aus dem Dashboard zurück dorthin (fester Pfad, keine offene Weiterleitung), sonst zur Anfrage.
  const vomDashboard = text(formData, "zurueck", 40) === "/admin/dashboard";
  const zurueck = vomDashboard ? "/admin/dashboard" : `/admin/anfrage/${id}`;
  const lead = (await listLeads()).find((l) => l.id === id);
  if (!lead) redirect(`${zurueck}?m=${encodeURIComponent("Anfrage nicht gefunden.")}&mt=fehler`);
  const jetzt = new Date().toISOString();
  let meldung = "";
  let fehler = false;
  let oeffentlichBetroffen = false;
  let bestaetigen = false;

  await mutateZustand(email, (z) => {
    meldung = "";
    fehler = false;
    oeffentlichBetroffen = false;
    bestaetigen = false;
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
        const details = detailsBereinigen(Object.fromEntries(DETAIL_FELDER.map((f) => [f.key, text(formData, `d_${f.key}`, 80)])));
        if (details) b.details = details;
        else delete b.details;
        // Steht das Angebot online, darf das Speichern es nicht still von der Website nehmen:
        // enthalten die neuen Angaben etwas Verräterisches, wird nichts gespeichert.
        if (b.online) {
          const luecken = boerseLuecken(b, leadView(lead!, { ...meta, boerse: b }));
          if (luecken.length) {
            meldung = `Nicht gespeichert — das Angebot steht online, und so dürfte es nicht erscheinen: ${luecken.join(" · ")}.`;
            fehler = true;
            return;
          }
        }
        was = `Angaben für die Flächenbörse gespeichert (${b.code})`;
        oeffentlichBetroffen = b.online;
        break;
      }
      case "einwilligung": {
        const quelle = text(formData, "quelle", 40);
        const am = text(formData, "am", 10);
        b.einwilligung = { am: /^\d{4}-\d{2}-\d{2}$/.test(am) ? am : jetzt.slice(0, 10), quelle: BOERSE_QUELLEN.includes(quelle) ? quelle : "telefonisch", von: email };
        delete b.offline;
        bestaetigen = text(formData, "bestaetigen", 2) === "1" && b.einwilligung.quelle !== "im Kundenbereich";
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
        delete b.offline;
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
      case "einzeln": {
        b.einzeln = text(formData, "wert", 2) === "1";
        oeffentlichBetroffen = b.online;
        was = b.einzeln ? `Flächenbörse: ${b.code} wird einzeln gezeigt (kein Paket)` : `Flächenbörse: ${b.code} darf mit weiteren Flächen desselben Eigentümers ein Paket bilden`;
        break;
      }
      case "eigen": {
        const eigen = text(formData, "wert", 2) === "1";
        if (Boolean(meta.eigeneFlaeche) === eigen && meta.eigeneFlaeche !== undefined) return;
        meta.eigeneFlaeche = eigen;
        z.anfragen[id] = { ...meta, boerse: meta.boerse ?? b, geaendert: { am: jetzt, von: email } };
        meldung = eigen ? "Als eigene Fläche gekennzeichnet — ohne Provision, in der öffentlichen Börse nicht sichtbar." : "Nicht mehr als eigene Fläche gekennzeichnet — normale Vermittlung mit Provision.";
        return { was: meldung, ref: id };
      }
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
  // Telefonisch, per E-Mail oder schriftlich erteilte Einwilligung: Bestätigung mit Widerrufslink (Klick der Verwaltung).
  if (bestaetigen && !fehler) {
    const r = await einwilligungBestaetigen(id, email, await basisUrl());
    meldung = `${meldung} ${r.text}`;
    if (!r.ok) fehler = true;
  }
  revalidatePath("/admin", "layout");
  menueErneuern();
  const name = lead && lead.name !== "—" ? `${lead.name}: ` : "";
  redirect(`${zurueck}?m=${encodeURIComponent(`${vomDashboard ? name : ""}${meldung || "Keine Änderung."}`)}&mt=${fehler ? "fehler" : "ok"}#boerse`);
}
