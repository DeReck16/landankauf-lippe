"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { automatikNachKunde, automatikNachPaar } from "@/lib/portal/automatik";
import * as A from "@/lib/portal/ablauf";
import { boerseEinwilligungKunde } from "@/lib/boerse";
import * as V from "@/lib/portal/vorgang";
import * as M from "@/lib/portal/model";
import { erklaerungenKaufabsicht, erklaerungenKundenvertrag, erklaerungenPachtvertrag, type ErklaerungDef } from "@/lib/portal/erklaerungen";
import { anfrageHerkunft, basisUrl, beendeKundenSitzung, ladeKundenSitzung, requireKundeId, starteKundenSitzung } from "@/lib/portal/sitzung";
import { drosseln, kurzwert, listLeads, readZustand } from "@/lib/admin/store";
import { aendereKunde, alleKunden, istKundeId, ladeEinstellungen, ladeKunde } from "@/lib/portal/speicher";
import { kennung, pruefeErklaerung, vorgangsKennung } from "@/lib/portal/token";
import { vorgangZuKennung } from "@/lib/portal/sicht";
import { anbieterAbgleichJetzt, vereinbarungErgaenzen, weitereFlaechenOhneVereinbarung } from "@/lib/portal/anbieter-gruppe";
import { leadView } from "@/lib/admin/model";

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
    const key = vorgangZuKennung(k, feld(fd, "v", 80), (await readZustand()).zustand.paare);
    if (key) redirect(`/kunde/vorgang/${vorgangsKennung(key)}?k=${k.id}`);
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
  // Freiwillige Angaben zur Fläche (Dennis 27.09.2026): Preis-/Pachtvorstellung, frei ab, Ackerzahl, Zuwegung —
  // fließen als Vorschlag in die Flächenbörse (veröffentlicht wird erst nach Prüfung durch die Verwaltung).
  const flaechenAngaben =
    kunde.rolle === "anbieter"
      ? { preis: feld(fd, "a_preis", 80), frei: feld(fd, "a_frei", 80), ackerzahl: feld(fd, "a_ackerzahl", 40), zuwegung: feld(fd, "a_zuwegung", 80) }
      : undefined;
  await A.angabenSpeichern(id, s, flaechen, flaechenAngaben);
  // Flächenbörse: Einwilligung per Häkchen (nur Anbieter; veröffentlicht wird erst per Klick in der Verwaltung).
  if (kunde.rolle === "anbieter" && feld(fd, "boerse_feld", 2) === "1") {
    const summeHa = flaechen?.reduce((sum, f) => sum + (f.groesseHa ?? 0), 0) || null;
    const a = flaechenAngaben;
    const details = a ? { preis: a.preis, frei: a.frei, ackerzahl: a.ackerzahl && /\d/.test(a.ackerzahl) && !/ackerzahl/i.test(a.ackerzahl) ? `Ackerzahl ca. ${a.ackerzahl}` : a.ackerzahl, zuwegung: a.zuwegung } : undefined;
    await boerseEinwilligungKunde(id, feld(fd, "boerse", 2) === "1", summeHa, details);
  }
  if (kunde.rolle === "anbieter") after(() => automatikNachKunde(id, "angaben"));
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
  // Anbieter mit mehreren Flächen: Die Vereinbarung gilt für die weiteren Flächen, die er bei der
  // Unterschrift ausdrücklich angehakt hat (nie automatisch, lib/portal/anbieter-gruppe.ts).
  let uebertragen = 0;
  if (kunde.rolle === "anbieter") {
    const gewaehlt = new Set(fd.getAll("weitere").map(String).filter((x) => istKundeId(x)));
    if (gewaehlt.size) {
      const frisch = await ladeKunde(kunde.id);
      const [roh, { zustand }, alle] = await Promise.all([listLeads(), readZustand(), alleKunden()]);
      const kandidaten = weitereFlaechenOhneVereinbarung(frisch ?? kunde, roh.map((l) => leadView(l, zustand.anfragen[l.id])), alle);
      for (const l of kandidaten.filter((x) => gewaehlt.has(x.id))) {
        if (frisch && (await vereinbarungErgaenzen(frisch, l, { wie: "unterschrift", ...herkunft, sitzung: kennung(`${sitzung.email}:${sitzung.seit}`) }))) uebertragen++;
      }
    }
    await anbieterAbgleichJetzt("kunde", kunde.email);
  }
  // Automatik (nur wenn eingeschaltet): Börse, Matching, Einladungen im Vorgang, anonyme Hinweise.
  after(() => automatikNachKunde(kunde.id, "unterschrift"));
  revalidatePath("/kunde", "layout");
  revalidatePath("/admin", "layout");
  redirect(
    `/kunde?m=${encodeURIComponent(
      `Vielen Dank — Ihr Vertrag ist unterschrieben. Die Bestätigung mit dem PDF ist per E-Mail unterwegs.${uebertragen ? ` Die Vereinbarung gilt außerdem für ${uebertragen === 1 ? "eine weitere Ihrer Flächen" : `${uebertragen} weitere Ihrer Flächen`}.` : ""}`,
    )}`,
  );
}

/** Weitere Fläche desselben Anbieters ausdrücklich zur bestehenden Vereinbarung hinzufügen (Kundenbereich). */
export async function flaecheErgaenzenAktion(fd: FormData): Promise<void> {
  const quelleId = feld(fd, "quelle", 40);
  const zielId = feld(fd, "ziel", 40);
  const { sitzung, kunde: quelle } = await requireKundeId(quelleId);
  if (!quelle.vertrag || quelle.widerruf || quelle.kuendigung || quelle.rolle !== "anbieter") nachricht("/kunde", "Dafür braucht es eine gültige Vereinbarung.", true);
  const [roh, { zustand }, alle] = await Promise.all([listLeads(), readZustand(), alleKunden()]);
  const l = weitereFlaechenOhneVereinbarung(quelle, roh.map((x) => leadView(x, zustand.anfragen[x.id])), alle).find((x) => x.id === zielId);
  if (!l) nachricht("/kunde", "Diese Fläche lässt sich nicht hinzufügen.", true);
  const herkunft = await anfrageHerkunft();
  const k = await vereinbarungErgaenzen(quelle, l, { wie: "kundenbereich", ...herkunft, sitzung: kennung(`${sitzung.email}:${sitzung.seit}`) });
  revalidatePath("/kunde", "layout");
  revalidatePath("/admin", "layout");
  nachricht("/kunde", k ? "Danke — Ihre Vereinbarung gilt jetzt auch für diese Fläche." : "Das hat nicht geklappt — bitte melden Sie sich kurz per E-Mail.", !k);
}

export async function beginnwunschAktion(fd: FormData): Promise<void> {
  const id = feld(fd, "k", 40);
  const { kunde } = await requireKundeId(id);
  if (fd.get("bestaetigt") !== "1") nachricht("/kunde", "Bitte bestätigen Sie den Hinweis zum Widerrufsrecht.", true);
  if (!M.widerrufMoeglich(kunde) || kunde.vertrag?.beginnwunschAm) nachricht("/kunde", "Nicht erforderlich.");
  await A.beginnwunschErklaeren(id);
  // Automatik R5: Mit dem Beginnwunsch kann eine wartende Freigabe jetzt möglich sein.
  after(() => automatikNachKunde(id, "zustimmung"));
  revalidatePath("/kunde", "layout");
  nachricht("/kunde", "Danke — wir dürfen jetzt schon vor Ablauf der Widerrufsfrist Kontakte freigeben.");
}

// ---------------------------------------------------------------------------
// Widerruf (§ 356a BGB) und Kündigung — auch ohne Anmeldung möglich
//
// Ohne Anmeldung genügen Vertragsnummer und E-Mail-Adresse (gesetzlich gewollt: der
// Widerrufs- bzw. Kündigungsknopf darf keine Anmeldung verlangen). Damit niemand
// fremde Verträge beendet: Die Erklärung gilt, wird aber als „ungeprüft“ markiert,
// die Bestätigung an die hinterlegte Adresse enthält „Das war nicht ich“, und die
// Verwaltung kann sie verwerfen. Versuche sind je Absender und je Vertrag gedrosselt.

async function kundeFuerErklaerung(fd: FormData): Promise<M.KundeRecord | null> {
  const id = feld(fd, "vertrag", 40).toUpperCase();
  const email = feld(fd, "email", 200).toLowerCase();
  if (!istKundeId(id)) return null;
  const k = await ladeKunde(id);
  return k && k.email === email ? k : null;
}

/** Ist der Absender für diesen Kunden angemeldet? Dann gilt die Erklärung als geprüft. */
async function angemeldetFuer(kundeId: string): Promise<boolean> {
  const s = await ladeKundenSitzung();
  return Boolean(s?.kunden.some((k) => k.id === kundeId));
}

/** Drosselung für Erklärungen ohne Anmeldung: je Absender und je Vertragsnummer. */
async function erklaerungDrosseln(fd: FormData, art: "widerruf" | "kuendigung"): Promise<boolean> {
  const { ip } = await anfrageHerkunft();
  const proIp = await drosseln(`erklaerung-${art}`, kurzwert(ip, "erklaerung"), [
    { sekunden: 3600, max: 5 },
    { sekunden: 86_400, max: 20 },
  ]);
  if (!proIp) return false;
  const vertrag = feld(fd, "vertrag", 40).toUpperCase();
  return drosseln(`erklaerung-${art}-vertrag`, kurzwert(vertrag, "erklaerung-vertrag"), [{ sekunden: 86_400, max: 5 }]);
}

export async function widerrufAktion(fd: FormData): Promise<void> {
  const name = feld(fd, "name", 120);
  if (!name) redirect(`/kunde/widerruf?fehler=name`);
  const vertrag = feld(fd, "vertrag", 40).toUpperCase();
  const angemeldet = istKundeId(vertrag) && (await angemeldetFuer(vertrag));
  if (!angemeldet && !(await erklaerungDrosseln(fd, "widerruf"))) redirect(`/kunde/widerruf?fehler=zuviel`);
  const k = await kundeFuerErklaerung(fd);
  if (!k || !k.vertrag) redirect(`/kunde/widerruf?fehler=zuordnung`);
  if (!M.hatWiderrufsrecht(k)) redirect(`/kunde/widerruf?fehler=kein-widerrufsrecht`);
  if (k.widerruf) redirect(`/kunde/widerruf?ok=${k.id}`);
  const notiz = [`Name laut Erklärung: ${name}`, feld(fd, "nachricht", 1000)].filter(Boolean).join(" · ");
  await A.widerrufErfassen(k.id, "online", "kunde", notiz, { ohneAnmeldung: !angemeldet, basis: await basisUrl() });
  revalidatePath("/kunde", "layout");
  redirect(`/kunde/widerruf?ok=${k.id}`);
}

export async function kuendigungAktion(fd: FormData): Promise<void> {
  const name = feld(fd, "name", 120);
  if (!name) redirect(`/kunde/kuendigung?fehler=name`);
  const vertrag = feld(fd, "vertrag", 40).toUpperCase();
  const angemeldet = istKundeId(vertrag) && (await angemeldetFuer(vertrag));
  if (!angemeldet && !(await erklaerungDrosseln(fd, "kuendigung"))) redirect(`/kunde/kuendigung?fehler=zuviel`);
  const k = await kundeFuerErklaerung(fd);
  if (!k || !k.vertrag) redirect(`/kunde/kuendigung?fehler=zuordnung`);
  if (k.widerruf) redirect(`/kunde/kuendigung?fehler=widerrufen`);
  if (!k.kuendigung) {
    const notiz = [`Name laut Erklärung: ${name}`, `Art: ${feld(fd, "art", 40) || "ordentlich, sofort"}`, feld(fd, "nachricht", 1000)].filter(Boolean).join(" · ");
    await A.kuendigungErfassen(k.id, "online", "kunde", notiz, { ohneAnmeldung: !angemeldet, basis: await basisUrl() });
  }
  revalidatePath("/kunde", "layout");
  redirect(`/kunde/kuendigung?ok=${k.id}`);
}

/** „Das war nicht ich“: eine ohne Anmeldung abgegebene Erklärung zurückweisen (Link aus der Bestätigung). */
export async function erklaerungZurueckweisenAktion(fd: FormData): Promise<void> {
  const t = feld(fd, "t", 1500);
  const token = pruefeErklaerung(t);
  if (!token) redirect("/kunde/erklaerung?fehler=link");
  const k = await ladeKunde(token.k);
  const e = k?.[token.a];
  if (!k || !e || e.am !== token.am || !e.ungeprueft) redirect(`/kunde/erklaerung?t=${encodeURIComponent(t)}&fehler=stand`);
  const r = await A.erklaerungVerwerfen(k.id, token.a, token.am, "kunde", "vom Kunden über den Link „Das war nicht ich“ zurückgewiesen");
  revalidatePath("/kunde", "layout");
  revalidatePath("/admin", "layout");
  redirect(`/kunde/erklaerung?t=${encodeURIComponent(t)}&${r.ok ? "ok=1" : "fehler=stand"}`);
}

// ---------------------------------------------------------------------------
// Vorgänge: Zustimmung, Meldungen, Pachtvertrag, Kaufabsicht, Danke-Dialog

async function vorgangFuerKunde(fd: FormData): Promise<{ kunde: M.KundeRecord; key: string; kennung: string; ctx: V.VorgangKontext; sitzungKennung: string }> {
  const id = feld(fd, "k", 40);
  const { sitzung, kunde } = await requireKundeId(id);
  // Formulare tragen die undurchsichtige Kennung (V…) — nur eigene Vorgänge lassen sich auflösen.
  const key = vorgangZuKennung(kunde, feld(fd, "key", 80), (await readZustand()).zustand.paare);
  if (!key) redirect("/kunde");
  const ctx = await V.ladeVorgangKontext(key);
  if (!ctx || !ctx.meta || !V.SICHTBAR.includes(ctx.meta.status)) redirect("/kunde");
  return { kunde, key, kennung: vorgangsKennung(key), ctx, sitzungKennung: kennung(`${sitzung.email}:${sitzung.seit}`) };
}

export async function zustimmenAktion(fd: FormData): Promise<void> {
  const { kunde, key, kennung: vk, ctx } = await vorgangFuerKunde(fd);
  const pfad = `/kunde/vorgang/${vk}?k=${kunde.id}`;
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
  // Automatik R5 (nur wenn eingeschaltet): Freigabe, sobald beide zugestimmt haben und die Prüfung grün ist.
  after(() => automatikNachPaar(key));
  revalidatePath("/kunde", "layout");
  nachricht(pfad, "Danke — Ihre Zustimmung ist vermerkt. Sobald beide Seiten zugestimmt und unterschrieben haben, geben wir die Kontaktdaten frei.");
}

export async function ablehnenAktion(fd: FormData): Promise<void> {
  const { kunde, key, kennung: vk, ctx } = await vorgangFuerKunde(fd);
  if (M.aktiveFreigabe(ctx.vorgang)) nachricht(`/kunde/vorgang/${vk}?k=${kunde.id}`, "Der Kontakt ist bereits freigegeben.", true);
  await V.ablehnen(key, ctx.art, kunde.rolle, feld(fd, "grund", 500));
  revalidatePath("/kunde", "layout");
  nachricht("/kunde", "Danke für Ihre Rückmeldung — wir stellen Ihnen diesen Vorschlag nicht weiter vor.");
}

export async function meldungAktion(fd: FormData): Promise<void> {
  const { kunde, key, kennung: vk, ctx } = await vorgangFuerKunde(fd);
  const pfad = `/kunde/vorgang/${vk}?k=${kunde.id}`;
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
  const { kunde, key, kennung: vk, sitzungKennung } = await vorgangFuerKunde(fd);
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
    `/kunde/vorgang/${vk}?k=${kunde.id}&m=${encodeURIComponent(r.abgeschlossen ? "Der Pachtvertrag ist geschlossen — beide Seiten haben unterschrieben. Ihr Exemplar ist per E-Mail unterwegs." : "Danke — Ihre Unterschrift ist gespeichert. Sobald die andere Seite unterschreibt, ist der Vertrag geschlossen.")}`,
  );
}

export async function kaufBestaetigenAktion(_prev: UnterschriftState, fd: FormData): Promise<UnterschriftState> {
  const { kunde, key, kennung: vk, sitzungKennung } = await vorgangFuerKunde(fd);
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
  redirect(`/kunde/vorgang/${vk}?k=${kunde.id}&m=${encodeURIComponent("Danke — Ihre Bestätigung ist gespeichert.")}`);
}

export async function dankeGesehenAktion(fd: FormData): Promise<void> {
  const id = feld(fd, "k", 40);
  const { kunde } = await requireKundeId(id);
  const key = vorgangZuKennung(kunde, feld(fd, "key", 80), (await readZustand()).zustand.paare);
  if (!key) return;
  await aendereKunde(id, (k) => {
    if (k.dankeGesehen?.[key]) return false;
    k.dankeGesehen = { ...(k.dankeGesehen ?? {}), [key]: new Date().toISOString() };
  });
  revalidatePath("/kunde", "layout");
}

