"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as A from "@/lib/portal/ablauf";
import { boerseEinwilligungKunde } from "@/lib/boerse";
import * as V from "@/lib/portal/vorgang";
import * as M from "@/lib/portal/model";
import { erklaerungenKaufabsicht, erklaerungenKundenvertrag, erklaerungenPachtvertrag, type ErklaerungDef } from "@/lib/portal/erklaerungen";
import { anfrageHerkunft, basisUrl, beendeKundenSitzung, requireKundeId, starteKundenSitzung } from "@/lib/portal/sitzung";
import { aendereKunde, alleKunden, istKundeId, istPaarKey, ladeEinstellungen, ladeKunde } from "@/lib/portal/speicher";
import { kennung } from "@/lib/portal/token";

// Server Actions des Kundenbereichs. Jede Action prüft die Sitzung selbst und
// arbeitet nur mit Datensätzen, die zur angemeldeten E-Mail-Adresse gehören.

function feld(fd: FormData, key: string, max = 2000): string {
  return String(fd.get(key) ?? "").trim().slice(0, max);
}

function zahl(raw: string): number | null {
  const s = raw.replace(/\s/g, "").replace(/€/g, "");
  if (!s) return null;
  const n = Number(/,/.test(s) ? s.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function nachricht(pfad: string, m: string, fehler = false): never {
  const trenner = pfad.includes("?") ? "&" : "?";
  redirect(`${pfad}${trenner}m=${encodeURIComponent(m)}${fehler ? "&mt=fehler" : ""}`);
}

function normName(s: string): string {
  return s.toLowerCase().normalize("NFC").replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
}

/** Angehakte Erklärungen prüfen: alle Pflichtfelder gesetzt? */
function erklaerungenAus(fd: FormData, defs: ErklaerungDef[]): { ok: boolean; liste: { id: string; text: string }[]; fehlt: string[] } {
  const liste: { id: string; text: string }[] = [];
  const fehlt: string[] = [];
  for (const d of defs) {
    const an = fd.get(`e_${d.id}`) === "1";
    if (an) liste.push({ id: d.id, text: d.text });
    else if (d.pflicht) fehlt.push(d.id);
  }
  return { ok: fehlt.length === 0, liste, fehlt };
}

// ---------------------------------------------------------------------------
// Zugang: Einladung, Anmeldelink, Abmelden

export async function einladungAnnehmenAktion(fd: FormData): Promise<void> {
  const t = feld(fd, "t", 1500);
  const r = await A.einladungAnnehmen(t);
  if (!r.ok) redirect(`/kunde/anmelden?grund=${r.grund}`);
  await starteKundenSitzung(r.kunde.email);
  redirect(r.kunde.stammdaten ? `/kunde/vertrag?k=${r.kunde.id}` : `/kunde/angaben?k=${r.kunde.id}`);
}

export type AnmeldeState = { status: "idle" | "gesendet" | "fehler"; text?: string };

export async function anmeldelinkAktion(_prev: AnmeldeState, fd: FormData): Promise<AnmeldeState> {
  const email = feld(fd, "email", 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: "fehler", text: "Bitte eine gültige E-Mail-Adresse eingeben." };
  await A.anmeldelinkSenden(email, await basisUrl());
  return {
    status: "gesendet",
    text: "Wenn zu dieser Adresse ein Kundenbereich besteht, ist ein Anmeldelink unterwegs. Er gilt 20 Minuten und nur einmal.",
  };
}

export async function anmeldungBestaetigenAktion(fd: FormData): Promise<void> {
  const t = feld(fd, "t", 1500);
  const z = feld(fd, "z", 1500);
  if (t) {
    const email = await A.loginEinloesen(t);
    if (!email) redirect("/kunde/anmelden?grund=benutzt");
    if (!(await alleKunden()).some((k) => k.email === email && !k.gesperrt)) redirect("/kunde/anmelden?grund=ungueltig");
    await starteKundenSitzung(email);
    redirect("/kunde");
  }
  if (z) {
    const k = await A.zugangEinloesen(z);
    if (!k) redirect("/kunde/anmelden?grund=benutzt");
    await starteKundenSitzung(k.email);
    // Direkt in den Vorgang, wenn der Link dafür gedacht war (nur eigene Vorgänge, feste Form — keine offene Weiterleitung).
    const v = feld(fd, "v", 80);
    if (/^LL-[A-Z0-9]+~LL-[A-Z0-9]+$/.test(v) && v.split("~").includes(k.id)) redirect(`/kunde/vorgang/${v}?k=${k.id}`);
    redirect("/kunde");
  }
  redirect("/kunde/anmelden");
}

export async function abmeldenAktion(): Promise<void> {
  await beendeKundenSitzung();
  redirect("/kunde/anmelden?grund=abgemeldet");
}

// ---------------------------------------------------------------------------
// Angaben und Unterschrift

export async function angabenAktion(fd: FormData): Promise<void> {
  const id = feld(fd, "k", 40);
  const { kunde } = await requireKundeId(id);
  const zurueck = `/kunde/angaben?k=${id}`;
  const s = {
    name: feld(fd, "name", 120),
    betrieb: feld(fd, "betrieb", 120),
    strasse: feld(fd, "strasse", 120),
    plz: feld(fd, "plz", 10),
    ort: feld(fd, "ort", 80),
    telefon: feld(fd, "telefon", 40),
    eigenschaft: (feld(fd, "eigenschaft", 20) === "unternehmer" ? "unternehmer" : "verbraucher") as M.Eigenschaft,
  };
  if (!s.name || s.name.split(" ").length < 2) nachricht(zurueck, "Bitte geben Sie Ihren vollständigen Namen (Vor- und Nachname) an.", true);
  if (!s.strasse || !/^\d{5}$/.test(s.plz) || !s.ort) nachricht(zurueck, "Bitte vollständige Anschrift angeben (Straße und Hausnummer, fünfstellige PLZ, Ort).", true);
  if (!["verbraucher", "unternehmer"].includes(feld(fd, "eigenschaft", 20))) nachricht(zurueck, "Bitte wählen Sie aus, ob Sie privat (Verbraucher) oder als Unternehmer handeln.", true);
  let flaechen: M.Flaeche[] | null = null;
  if (kunde.rolle === "anbieter") {
    const gem = fd.getAll("f_gemarkung").map(String);
    const flur = fd.getAll("f_flur").map(String);
    const fst = fd.getAll("f_flurstueck").map(String);
    const ha = fd.getAll("f_ha").map(String);
    const nutz = fd.getAll("f_nutzung").map(String);
    flaechen = [];
    for (let i = 0; i < Math.min(gem.length, 40); i++) {
      const f: M.Flaeche = { gemarkung: gem[i].trim().slice(0, 80), flur: (flur[i] ?? "").trim().slice(0, 20), flurstueck: (fst[i] ?? "").trim().slice(0, 40), groesseHa: zahl(ha[i] ?? ""), nutzung: (nutz[i] ?? "").trim().slice(0, 60) };
      if (f.gemarkung || f.flurstueck || f.groesseHa != null) flaechen.push(f);
    }
  }
  await A.angabenSpeichern(id, s, flaechen);
  // Flächenbörse: Einwilligung per Häkchen (nur Verkäufer; veröffentlicht wird erst per Klick in der Verwaltung).
  if (kunde.rolle === "anbieter" && kunde.art === "kauf" && feld(fd, "boerse_feld", 2) === "1") {
    const summeHa = flaechen?.reduce((sum, f) => sum + (f.groesseHa ?? 0), 0) || null;
    await boerseEinwilligungKunde(id, feld(fd, "boerse", 2) === "1", summeHa);
  }
  revalidatePath("/kunde", "layout");
  if (!kunde.vertrag) redirect(`/kunde/vertrag?k=${id}`);
  nachricht("/kunde", "Ihre Angaben sind gespeichert.");
}

export type UnterschriftState = { status: "idle" | "fehler"; text?: string; fehlt?: string[] };

export async function kundenvertragAktion(_prev: UnterschriftState, fd: FormData): Promise<UnterschriftState> {
  const id = feld(fd, "k", 40);
  const { sitzung, kunde } = await requireKundeId(id);
  if (kunde.vertrag) redirect("/kunde");
  const geladen = await A.ladeLead(id);
  if (!geladen) return { status: "fehler", text: "Ihre Anfrage wurde nicht gefunden. Bitte melden Sie sich bei uns." };
  const e = await ladeEinstellungen();
  const entwurf = A.kundenVertragEntwurf(kunde, geladen.lead, e);
  const verbraucher = kunde.stammdaten?.eigenschaft === "verbraucher";
  const defs = erklaerungenKundenvertrag(kunde.rolle, verbraucher, entwurf.provisionKurz);
  const erkl = erklaerungenAus(fd, defs);
  if (!erkl.ok) return { status: "fehler", text: "Bitte bestätigen Sie alle Pflicht-Erklärungen.", fehlt: erkl.fehlt };
  const name = feld(fd, "name", 120);
  if (!kunde.stammdaten || normName(name) !== normName(kunde.stammdaten.name)) {
    return { status: "fehler", text: `Bitte geben Sie zur Unterschrift Ihren Namen genau so ein, wie in Ihren Angaben: „${kunde.stammdaten?.name ?? ""}“.` };
  }
  const herkunft = await anfrageHerkunft();
  const r = await A.kundenvertragUnterschreiben({
    kunde,
    lead: geladen.lead,
    einstellungen: e,
    name,
    textHash: feld(fd, "hash", 80),
    erklaerungen: erkl.liste,
    beginnwunsch: erkl.liste.some((x) => x.id === "beginnwunsch"),
    herkunft: { ...herkunft, sitzung: kennung(`${sitzung.email}:${sitzung.seit}`) },
  });
  if (!r.ok) return { status: "fehler", text: r.fehler };
  revalidatePath("/kunde", "layout");
  redirect(`/kunde?m=${encodeURIComponent("Vielen Dank — Ihr Vertrag ist unterschrieben. Die Bestätigung mit dem PDF ist per E-Mail unterwegs.")}`);
}

export async function beginnwunschAktion(fd: FormData): Promise<void> {
  const id = feld(fd, "k", 40);
  const { kunde } = await requireKundeId(id);
  if (fd.get("bestaetigt") !== "1") nachricht("/kunde", "Bitte bestätigen Sie den Hinweis zum Widerrufsrecht.", true);
  if (!M.widerrufMoeglich(kunde) || kunde.vertrag?.beginnwunschAm) nachricht("/kunde", "Nicht erforderlich.");
  await A.beginnwunschErklaeren(id);
  revalidatePath("/kunde", "layout");
  nachricht("/kunde", "Danke — wir dürfen jetzt schon vor Ablauf der Widerrufsfrist Kontakte freigeben.");
}

// ---------------------------------------------------------------------------
// Widerruf (§ 356a BGB) und Kündigung — auch ohne Anmeldung möglich

async function kundeFuerErklaerung(fd: FormData): Promise<M.KundeRecord | null> {
  const id = feld(fd, "vertrag", 40).toUpperCase();
  const email = feld(fd, "email", 200).toLowerCase();
  if (!istKundeId(id)) return null;
  const k = await ladeKunde(id);
  return k && k.email === email ? k : null;
}

export async function widerrufAktion(fd: FormData): Promise<void> {
  const name = feld(fd, "name", 120);
  if (!name) redirect(`/kunde/widerruf?fehler=name`);
  const k = await kundeFuerErklaerung(fd);
  if (!k || !k.vertrag) redirect(`/kunde/widerruf?fehler=zuordnung`);
  if (!M.hatWiderrufsrecht(k)) redirect(`/kunde/widerruf?fehler=kein-widerrufsrecht`);
  if (k.widerruf) redirect(`/kunde/widerruf?ok=${k.id}`);
  const notiz = [`Name laut Erklärung: ${name}`, feld(fd, "nachricht", 1000)].filter(Boolean).join(" · ");
  await A.widerrufErfassen(k.id, "online", "kunde", notiz);
  revalidatePath("/kunde", "layout");
  redirect(`/kunde/widerruf?ok=${k.id}`);
}

export async function kuendigungAktion(fd: FormData): Promise<void> {
  const name = feld(fd, "name", 120);
  if (!name) redirect(`/kunde/kuendigung?fehler=name`);
  const k = await kundeFuerErklaerung(fd);
  if (!k || !k.vertrag) redirect(`/kunde/kuendigung?fehler=zuordnung`);
  if (k.widerruf) redirect(`/kunde/kuendigung?fehler=widerrufen`);
  if (!k.kuendigung) {
    const notiz = [`Name laut Erklärung: ${name}`, `Art: ${feld(fd, "art", 40) || "ordentlich, sofort"}`, feld(fd, "nachricht", 1000)].filter(Boolean).join(" · ");
    await A.kuendigungErfassen(k.id, "online", "kunde", notiz);
  }
  revalidatePath("/kunde", "layout");
  redirect(`/kunde/kuendigung?ok=${k.id}`);
}

// ---------------------------------------------------------------------------
// Vorgänge: Zustimmung, Meldungen, Pachtvertrag, Kaufabsicht, Danke-Dialog

async function vorgangFuerKunde(fd: FormData): Promise<{ kunde: M.KundeRecord; key: string; ctx: V.VorgangKontext; sitzungKennung: string }> {
  const id = feld(fd, "k", 40);
  const key = feld(fd, "key", 80);
  const { sitzung, kunde } = await requireKundeId(id);
  if (!istPaarKey(key)) redirect("/kunde");
  const [a, g] = key.split("~");
  if ((kunde.rolle === "anbieter" && a !== kunde.id) || (kunde.rolle === "suchender" && g !== kunde.id)) redirect("/kunde");
  const ctx = await V.ladeVorgangKontext(key);
  if (!ctx || !ctx.meta || !V.SICHTBAR.includes(ctx.meta.status)) redirect("/kunde");
  return { kunde, key, ctx, sitzungKennung: kennung(`${sitzung.email}:${sitzung.seit}`) };
}

export async function zustimmenAktion(fd: FormData): Promise<void> {
  const { kunde, key, ctx } = await vorgangFuerKunde(fd);
  const pfad = `/kunde/vorgang/${key}?k=${kunde.id}`;
  if (kunde.widerruf || kunde.kuendigung) nachricht(pfad, "Ihr Vertrag ist beendet — eine Zustimmung ist nicht mehr möglich.", true);
  const erg = await V.zustimmungSetzen(key, ctx.art, kunde.rolle, "kunde", true);
  if (!erg.ok) {
    nachricht(
      pfad,
      kunde.vertrag
        ? "Die Gegenseite hat ihren Vertrag noch nicht unterschrieben — wir melden uns, sobald Sie zustimmen können."
        : "Bitte unterschreiben Sie zuerst Ihren Vertrag mit Lippe Forst — danach können Sie dem Kontakt zustimmen.",
      true,
    );
  }
  revalidatePath("/kunde", "layout");
  nachricht(pfad, "Danke — Ihre Zustimmung ist vermerkt. Sobald beide Seiten zugestimmt und unterschrieben haben, geben wir die Kontaktdaten frei.");
}

export async function ablehnenAktion(fd: FormData): Promise<void> {
  const { kunde, key, ctx } = await vorgangFuerKunde(fd);
  if (M.aktiveFreigabe(ctx.vorgang)) nachricht(`/kunde/vorgang/${key}?k=${kunde.id}`, "Der Kontakt ist bereits freigegeben.", true);
  await V.ablehnen(key, ctx.art, kunde.rolle, feld(fd, "grund", 500));
  revalidatePath("/kunde", "layout");
  nachricht("/kunde", "Danke für Ihre Rückmeldung — wir stellen Ihnen diesen Vorschlag nicht weiter vor.");
}

export async function meldungAktion(fd: FormData): Promise<void> {
  const { kunde, key, ctx } = await vorgangFuerKunde(fd);
  const pfad = `/kunde/vorgang/${key}?k=${kunde.id}`;
  const typ = feld(fd, "typ", 20) === "abschluss" ? "abschluss" : "rueckfrage";
  let text = feld(fd, "text", 3000);
  if (typ === "abschluss") {
    const teile = [
      `Art: ${feld(fd, "vertragsart", 20) === "kauf" ? "Kaufvertrag" : "Pachtvertrag"}`,
      `Datum: ${/^\d{4}-\d{2}-\d{2}$/.test(feld(fd, "datum", 10)) ? feld(fd, "datum", 10).split("-").reverse().join(".") : feld(fd, "datum", 10) || "—"}`,
      `Fläche: ${feld(fd, "flaeche", 40) || "—"} ha`,
      `Jahrespacht bzw. Kaufpreis: ${feld(fd, "betrag", 40) || "—"} €`,
      `Laufzeit: ${feld(fd, "laufzeit", 60) || "—"}`,
    ];
    text = [...teile, text ? `Anmerkung: ${text}` : ""].filter(Boolean).join("\n");
  }
  if (!text) nachricht(pfad, "Bitte schreiben Sie uns kurz, worum es geht.", true);
  await V.kundenMeldung(key, ctx.art, kunde.rolle, typ, text);
  revalidatePath("/kunde", "layout");
  nachricht(pfad, typ === "abschluss" ? "Danke für Ihre Mitteilung — wir melden uns, falls wir noch etwas brauchen." : "Danke — wir melden uns bei Ihnen.");
}

export async function pachtUnterschreibenAktion(_prev: UnterschriftState, fd: FormData): Promise<UnterschriftState> {
  const { kunde, key, sitzungKennung } = await vorgangFuerKunde(fd);
  const defs = erklaerungenPachtvertrag(kunde.rolle);
  const erkl = erklaerungenAus(fd, defs);
  if (!erkl.ok) return { status: "fehler", text: "Bitte bestätigen Sie beide Erklärungen.", fehlt: erkl.fehlt };
  const name = feld(fd, "name", 120);
  if (!kunde.stammdaten || normName(name) !== normName(kunde.stammdaten.name)) {
    return { status: "fehler", text: `Bitte geben Sie Ihren Namen genau so ein, wie in Ihren Angaben: „${kunde.stammdaten?.name ?? ""}“.` };
  }
  const herkunft = await anfrageHerkunft();
  const r = await V.pachtUnterschreiben({ key, rolle: kunde.rolle, kunde, name, textHash: feld(fd, "hash", 80), erklaerungen: erkl.liste, herkunft: { ...herkunft, sitzung: sitzungKennung } });
  if (!r.ok) return { status: "fehler", text: r.fehler };
  revalidatePath("/kunde", "layout");
  redirect(
    `/kunde/vorgang/${key}?k=${kunde.id}&m=${encodeURIComponent(r.abgeschlossen ? "Der Pachtvertrag ist geschlossen — beide Seiten haben unterschrieben. Ihr Exemplar ist per E-Mail unterwegs." : "Danke — Ihre Unterschrift ist gespeichert. Sobald die andere Seite unterschreibt, ist der Vertrag geschlossen.")}`,
  );
}

export async function kaufBestaetigenAktion(_prev: UnterschriftState, fd: FormData): Promise<UnterschriftState> {
  const { kunde, key, sitzungKennung } = await vorgangFuerKunde(fd);
  const erkl = erklaerungenAus(fd, erklaerungenKaufabsicht());
  if (!erkl.ok) return { status: "fehler", text: "Bitte bestätigen Sie beide Erklärungen.", fehlt: erkl.fehlt };
  const name = feld(fd, "name", 120);
  if (!kunde.stammdaten || normName(name) !== normName(kunde.stammdaten.name)) {
    return { status: "fehler", text: `Bitte geben Sie Ihren Namen genau so ein, wie in Ihren Angaben: „${kunde.stammdaten?.name ?? ""}“.` };
  }
  const herkunft = await anfrageHerkunft();
  const r = await V.kaufBestaetigen({ key, rolle: kunde.rolle, kunde, name, textHash: feld(fd, "hash", 80), erklaerungen: erkl.liste, herkunft: { ...herkunft, sitzung: sitzungKennung } });
  if (!r.ok) return { status: "fehler", text: r.fehler };
  revalidatePath("/kunde", "layout");
  redirect(`/kunde/vorgang/${key}?k=${kunde.id}&m=${encodeURIComponent("Danke — Ihre Bestätigung ist gespeichert.")}`);
}

export async function dankeGesehenAktion(fd: FormData): Promise<void> {
  const id = feld(fd, "k", 40);
  const key = feld(fd, "key", 80);
  await requireKundeId(id);
  if (!istPaarKey(key)) return;
  await aendereKunde(id, (k) => {
    if (k.dankeGesehen?.[key]) return false;
    k.dankeGesehen = { ...(k.dankeGesehen ?? {}), [key]: new Date().toISOString() };
  });
  revalidatePath("/kunde", "layout");
}

