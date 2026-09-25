"use server";

import { revalidatePath } from "next/cache";
import { testModus } from "@/lib/admin/config";
import { unstable_rethrow } from "next/navigation";
import { LEAD_STATUS, leadView } from "@/lib/admin/model";
import { requireAdmin } from "@/lib/admin/session";
import { listLeads, readZustand } from "@/lib/admin/store";
import * as A from "@/lib/portal/ablauf";
import { anbieterAbgleichFuer } from "@/lib/portal/anbieter-gruppe";
import { anfrageVorschlag } from "@/lib/portal/anfrage-vorschlag";
import { ASSISTENT_AKTIONEN, alleAktionen, assistentEntwurf, assistentPlan, type AssistentAktionId, type AssistentMail, type AssistentUmgebung } from "@/lib/portal/assistent";
import { entwuerfeKunde } from "@/lib/portal/entwuerfe";
import * as M from "@/lib/portal/model";
import * as N from "@/lib/portal/nacharbeit";
import { NACHFASS_PAUSE_TAGE, nachfassKandidaten } from "@/lib/portal/nachfassen";
import { SPERRE_FREIGABE } from "@/lib/portal/schritte";
import { basisUrl } from "@/lib/portal/sitzung";
import { alleKunden, alleVorgaenge, istKundeId, istPaarKey, ladeEinstellungen, ladeKunde, ladeVorgang } from "@/lib/portal/speicher";
import { datumDe, rolleVonLead, tagDe, wert } from "@/lib/portal/texte";
import { verwaltungsMailSenden } from "@/lib/portal/versand";
import * as V from "@/lib/portal/vorgang";
import { VORLAGEN, istFreigegeben, kundenVorlage } from "@/lib/vertraege/vorlagen";
import { anfrageSpeichern, paarAktion } from "./actions";

// Klick-Assistent (app/admin/(intern)/Assistent.tsx, Dashboard): führt genau die
// Aktion aus, die der Admin in der Sicherheitsabfrage bestätigt hat. Der Plan wird
// hier frisch berechnet — weicht er vom bestätigten ab (Signatur), passiert nichts.
// Jede Teilaktion ruft die bestehenden Funktionen mit ihren Sperren auf; Mails gehen
// über verwaltungsMailSenden (Sperren, Versand, Volltext im Verlauf). Das Ergebnis
// geht an die Karte zurück (kein Redirect, keine Meldung in der Adresse).

export type AssistentZeile = { art: "ok" | "fehler" | "info"; text: string };
/** `weg`: Die Karte verschwindet aus dem Dashboard (Paar verworfen) — die Rückmeldung erscheint dann oben. */
export type AssistentState = { status: "ok" | "teil" | "fehler"; titel: string; zeilen: AssistentZeile[]; am: string; weg?: boolean };

function feld(fd: FormData, key: string, max = 400): string {
  return String(fd.get(key) ?? "").trim().slice(0, max);
}

function zahl(raw: string): number | null {
  const s = raw.replace(/\s/g, "").replace(/€/g, "");
  if (!s) return null;
  const n = Number(/,/.test(s) ? s.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function datumFeld(fd: FormData, key: string): string {
  const s = feld(fd, key, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function plusTage(ymd: string, tage: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + tage)).toISOString().slice(0, 10);
}

async function umgebung(): Promise<AssistentUmgebung> {
  const einstellungen = await ladeEinstellungen();
  return { einstellungen, basis: await basisUrl(), bewertungsUrl: M.bewertungsUrl(einstellungen, process.env.GOOGLE_REVIEW_URL) };
}

function ergebnis(knopf: string, zeilen: AssistentZeile[]): AssistentState {
  // Im Testmodus einmal am Ende sagen, dass keine E-Mail wirklich rausging.
  if (testModus() && zeilen.some((z) => z.art === "ok" && z.text.startsWith("E-Mail an"))) {
    zeilen = [...zeilen, { art: "info", text: "Testmodus: Die E-Mails wurden nicht verschickt, nur protokolliert." }];
  }
  const fehler = zeilen.filter((z) => z.art === "fehler").length;
  const ok = zeilen.filter((z) => z.art === "ok").length;
  const status: AssistentState["status"] = fehler === 0 ? "ok" : ok > 0 ? "teil" : "fehler";
  return {
    status,
    // „Erledigt: Erledigt (beantwortet)“ vermeiden — Knöpfe mit „erledigt“ sprechen für sich.
    titel: status === "ok" ? (/erledigt/i.test(knopf) ? knopf : `Erledigt: ${knopf}`) : status === "teil" ? `Teilweise erledigt: ${knopf}` : `Nicht erledigt: ${knopf}`,
    zeilen,
    am: new Date().toISOString(),
  };
}

/** Mails nach dem aktuellen Stand erzeugen (echte Links) und einzeln senden — je Mail eine Zeile ✓/✗. */
async function mailsSenden(von: string, key: string, u: AssistentUmgebung, geplant: AssistentMail[], zeilen: AssistentZeile[]): Promise<void> {
  if (geplant.length === 0) return;
  const ctx = await V.ladeVorgangKontext(key);
  if (!ctx) {
    zeilen.push({ art: "fehler", text: "Vorgang nicht gefunden — keine E-Mail gesendet." });
    return;
  }
  for (const m of geplant) {
    const e = assistentEntwurf(ctx, u, m.zweck, m.rolle);
    if (!e || e.gesperrt) {
      zeilen.push({ art: "fehler", text: `E-Mail an ${m.wer}: nicht gesendet — ${e?.gesperrt ?? "nicht mehr vorgesehen"}` });
      continue;
    }
    const r = await verwaltungsMailSenden(von, { zweck: e.zweck, kundeId: e.kundeId, key, rolle: m.rolle, an: e.an, betreff: e.betreff, text: e.text });
    zeilen.push(r.ok ? { art: "ok", text: `E-Mail an ${m.wer} (${e.an}): „${e.betreff}“` } : { art: "fehler", text: `E-Mail an ${m.wer} (${e.an}) nicht gesendet: ${r.text}` });
  }
}

/** Neuen persönlichen Einladungslink erstellen — mit denselben Prüfungen wie „Einladung erstellen“. */
async function linkErstellen(von: string, m: AssistentMail, u: AssistentUmgebung, zeilen: AssistentZeile[]): Promise<boolean> {
  const geladen = await A.ladeLead(m.kundeId);
  if (!geladen) {
    zeilen.push({ art: "fehler", text: `${m.wer}: Anfrage nicht gefunden.` });
    return false;
  }
  const rr = rolleVonLead(geladen.lead);
  if (!rr) {
    zeilen.push({ art: "fehler", text: `${m.wer}: Die Anfrage ist nicht als Angebot oder Gesuch mit Kauf/Pacht eingeordnet.` });
    return false;
  }
  const vorlage = kundenVorlage(rr.rolle, rr.art);
  if (!istFreigegeben(u.einstellungen, vorlage)) {
    zeilen.push({ art: "fehler", text: `Die Vorlage „${VORLAGEN[vorlage].titel}“ ist noch nicht freigegeben (Verwaltung → Vorlagen) — kein Link für ${m.werAkk}.` });
    return false;
  }
  try {
    await A.einladungErstellen(geladen.lead, von);
  } catch (err) {
    unstable_rethrow(err);
    zeilen.push({ art: "fehler", text: `${m.wer}: ${err instanceof Error ? err.message : "Einladung nicht möglich."}` });
    return false;
  }
  zeilen.push({ art: "ok", text: `Persönlicher Einladungslink für ${m.werAkk} erstellt (30 Tage gültig)` });
  return true;
}

/** Den automatisch verschickten Treue-Gutschein offen ausweisen (Beurkundung, externer Abschluss). */
async function gutscheinZeile(key: string, seit: string, zeilen: AssistentZeile[]): Promise<void> {
  const gm = (await ladeVorgang(key))?.mails.find((x) => x.zweck === "gutschein" && x.am >= seit);
  if (gm) zeilen.push({ art: gm.ok ? "ok" : "fehler", text: `E-Mail an ${gm.an}: „${gm.betreff}“${gm.ok ? "" : ` — nicht gesendet: ${gm.fehler ?? "Fehler"}`}` });
}

export async function assistentAktion(fd: FormData): Promise<AssistentState> {
  const { email } = await requireAdmin();
  const am = new Date().toISOString();
  const key = feld(fd, "key", 80);
  const id = feld(fd, "aktion", 40) as AssistentAktionId;
  const ziel = feld(fd, "ziel", 80);
  const signatur = feld(fd, "signatur", 64);
  if (!istPaarKey(key) || !ASSISTENT_AKTIONEN.includes(id)) return { status: "fehler", titel: "Ungültige Anfrage.", zeilen: [], am };

  // Anbieter mit mehreren Flächen: vorher abgleichen, damit keine zweite Einladung entsteht.
  await anbieterAbgleichFuer(key.split("~")[0], email);
  const ctx = await V.ladeVorgangKontext(key);
  if (!ctx) return { status: "fehler", titel: "Vorgang nicht gefunden.", zeilen: [], am };
  const u = await umgebung();
  const a = alleAktionen(assistentPlan(ctx, u)).find((x) => x.id === id && (x.ziel ?? "") === ziel);
  // Nur ausführen, was bestätigt wurde: Hat sich der Stand inzwischen geändert (z. B. hat ein
  // Kunde unterschrieben oder jemand anderes schon geklickt), nichts tun und neu anzeigen.
  if (!a || a.signatur !== signatur) {
    revalidatePath("/admin", "layout");
    return {
      status: "fehler",
      titel: "Nichts ausgeführt — der Stand hat sich inzwischen geändert.",
      zeilen: [{ art: "info", text: "Die Ansicht ist jetzt aktualisiert. Bitte prüfen und dann erneut klicken." }],
      am,
    };
  }
  if (a.gesperrt) return { status: "fehler", titel: `Nicht möglich: ${a.knopf}`, zeilen: [{ art: "fehler", text: a.gesperrt }], am };

  const zeilen: AssistentZeile[] = [];
  let weg = false;
  const abbruch = (text: string): AssistentState => {
    revalidatePath("/admin", "layout");
    return ergebnis(a.knopf, [...zeilen, { art: "fehler", text }]);
  };

  try {
    switch (a.id) {
      case "vormerken": {
        const f = new FormData();
        f.set("key", key);
        f.set("aktion", "vormerken");
        await paarAktion(f);
        zeilen.push({ art: "ok", text: "Paar vorgemerkt — als Nächstes „Beide einladen“." });
        break;
      }
      case "einladen":
      case "erinnern": {
        for (const m of a.mails) {
          if (m.neuerLink && !(await linkErstellen(email, m, u, zeilen))) continue;
          await mailsSenden(email, key, u, [m], zeilen);
        }
        break;
      }
      case "hinweise":
      case "freigabe-mitteilen":
      case "pacht-erinnern":
      case "kauf-erinnern":
      case "anzeige-erinnern":
      case "bewertung-bitten":
        await mailsSenden(email, key, u, a.mails, zeilen);
        break;
      case "bewertung-verzicht":
        await N.bewertungVerzichten(key, ctx.art, email);
        zeilen.push({ art: "ok", text: "Vermerkt: bei diesem Vorgang keine Bitte um eine Bewertung" });
        break;
      case "zustimmung": {
        const rolle: M.Rolle = ziel === "anbieter" ? "anbieter" : "suchender";
        const r = await V.zustimmungSetzen(key, ctx.art, rolle, email, true);
        if (!r.ok) return abbruch(r.fehler ?? "Nicht möglich.");
        zeilen.push({ art: "ok", text: `Zustimmung ${M.ROLLE_ARTIKEL[rolle].gen} erfasst` });
        break;
      }
      case "freigeben": {
        const r = await V.freigeben(key, email);
        if (!r.ok) return abbruch(`Freigabe nicht möglich: ${r.fehler}`);
        zeilen.push({ art: "ok", text: "Kontakt freigegeben — beide sehen die Kontaktdaten jetzt im Kundenbereich" });
        await mailsSenden(email, key, u, a.mails, zeilen);
        break;
      }
      case "freigabe-zurueckziehen": {
        const grund = feld(fd, "grund", 300);
        if (!grund) return abbruch("Bitte einen Grund angeben.");
        const r = await V.freigabeZurueckziehen(key, email, grund);
        if (!r.ok) return abbruch(r.fehler ?? "Nicht möglich.");
        zeilen.push({ art: "ok", text: "Freigabe zurückgezogen — die Kontaktdaten sind im Kundenbereich wieder verborgen" });
        break;
      }
      case "pacht-vorbereiten": {
        const zins = zahl(feld(fd, "zins", 20));
        if (zins == null || zins <= 0) return abbruch("Bitte einen Pachtzins größer als 0 eingeben.");
        const jeJahr = feld(fd, "einheit", 10) === "jahr";
        const pv = ctx.vorgang?.pachtvertrag;
        const basis = pv && pv.status === "entwurf" ? pv.daten : V.pachtVorschlag(ctx);
        const daten: M.PachtDaten = { ...basis, pachtzinsJeHa: jeJahr ? null : zins, pachtzinsJahr: jeJahr ? zins : null };
        const r = await V.pachtSpeichern(key, ctx.art, daten, email);
        if (!r.ok) return abbruch(r.fehler ?? "Speichern nicht möglich.");
        zeilen.push({ art: "ok", text: `Pachtvertrag-Entwurf gespeichert — Jahrespacht ${M.euro(M.jahrespacht(daten))} (netto)` });
        const luecken = V.pachtLuecken(daten);
        zeilen.push(
          luecken.length
            ? { art: "info", text: `Noch offen: ${luecken.join(", ")} — im Formular „Landpachtvertrag“ ergänzen und „Entwurf speichern“.` }
            : { art: "info", text: "Der Entwurf ist vollständig — als Nächstes „Zur Unterschrift geben & beide informieren“." },
        );
        break;
      }
      case "pacht-unterschrift": {
        const r = await V.pachtZurUnterschrift(key, email);
        if (!r.ok) return abbruch(r.fehler ?? "Nicht möglich.");
        zeilen.push({ art: "ok", text: "Pachtvertrag liegt beiden zur Unterschrift vor — der Text ist festgeschrieben" });
        await mailsSenden(email, key, u, a.mails, zeilen);
        break;
      }
      case "pacht-zurueck":
        await V.pachtZurueck(key, email, false);
        zeilen.push({ art: "ok", text: "Pachtvertrag zurück zum Entwurf — jetzt im Formular ändern und erneut zur Unterschrift geben" });
        break;
      case "kauf-vorbereiten": {
        const preis = zahl(feld(fd, "kaufpreis", 20));
        if (preis == null || preis <= 0) return abbruch("Bitte einen Kaufpreis größer als 0 eingeben.");
        const k = ctx.vorgang?.kauf;
        const basis = k && k.status === "entwurf" ? k.daten : V.kaufVorschlag(ctx);
        const r = await V.kaufSpeichern(key, { ...basis, kaufpreis: preis }, email);
        if (!r.ok) return abbruch(r.fehler ?? "Speichern nicht möglich.");
        zeilen.push({ art: "ok", text: `Eckdaten gespeichert — Kaufpreis-Vorstellung ${M.euro(preis)}` });
        zeilen.push({ art: "info", text: "Weitere Angaben (Übergabe, bestehende Pacht, Notar) im Formular — als Nächstes „Zur Bestätigung geben & beide informieren“." });
        break;
      }
      case "kauf-bestaetigung": {
        const r = await V.kaufZurBestaetigung(key, email);
        if (!r.ok) return abbruch(r.fehler ?? "Nicht möglich.");
        zeilen.push({ art: "ok", text: "Eckdaten liegen beiden zur (unverbindlichen) Bestätigung vor" });
        await mailsSenden(email, key, u, a.mails, zeilen);
        break;
      }
      case "kauf-zurueck":
        await V.kaufZurueck(key, email);
        zeilen.push({ art: "ok", text: "Eckdaten zurück zum Entwurf — Bestätigungen sind verfallen" });
        break;
      case "kauf-beurkundet": {
        const datum = datumFeld(fd, "datum");
        const kaufpreis = zahl(feld(fd, "kaufpreis", 20));
        const g = feld(fd, "genehmigung", 20);
        const genehmigung = (["offen", "nicht_noetig", "beantragt", "erteilt"] as const).find((x) => x === g) ?? "offen";
        if (!datum || kaufpreis == null || kaufpreis <= 0) return abbruch("Bitte Datum der Beurkundung und Kaufpreis angeben.");
        if (!ctx.vorgang?.freigabe) return abbruch(SPERRE_FREIGABE);
        const r = await V.kaufBeurkundet(key, email, { datum, kaufpreis, genehmigung });
        if (!r.ok) return abbruch(r.fehler ?? "Nicht möglich.");
        const wirksam = genehmigung === "nicht_noetig" || genehmigung === "erteilt";
        zeilen.push({ art: "ok", text: `Beurkundung vom ${tagDe(datum)} erfasst, Kaufpreis ${M.euro(kaufpreis)} — Provision angelegt (${wirksam ? "fällig" : "aufschiebend bis zur Genehmigung"})` });
        await gutscheinZeile(key, am, zeilen);
        break;
      }
      case "kauf-wirksam": {
        const datum = datumFeld(fd, "datum");
        if (!datum) return abbruch("Bitte das Datum angeben, seit dem der Kaufvertrag wirksam ist.");
        await V.kaufWirksam(key, email, datum);
        zeilen.push({ art: "ok", text: `Kaufvertrag wirksam seit ${tagDe(datum)} — Provision fällig (Rechnung durch die Buchhaltung)` });
        break;
      }
      case "extern": {
        const datum = datumFeld(fd, "datum");
        const betrag = zahl(feld(fd, "betrag", 20));
        if (!datum || betrag == null || betrag <= 0) return abbruch("Bitte Datum und Jahrespacht bzw. Kaufpreis angeben.");
        const art: M.Art = feld(fd, "art", 10) === "kauf" ? "kauf" : "pacht";
        const r = await V.externErfassen(key, art, email, { datum, flaecheHa: zahl(feld(fd, "flaeche", 20)), betrag, quelle: feld(fd, "quelle", 200), notiz: "" });
        if (!r.ok) return abbruch(r.fehler ?? "Nicht möglich.");
        zeilen.push({
          art: r.widerrufen ? "fehler" : "ok",
          text: r.widerrufen
            ? "Vertrag erfasst — der Suchende hat widerrufen, die Provision ist nur vorgemerkt (bitte prüfen)"
            : `${art === "kauf" ? "Kaufvertrag" : "Pachtvertrag"} vom ${tagDe(datum)} erfasst — Provision fällig`,
        });
        if (ziel && (await N.meldungErledigen(key, ziel, email, "als außerhalb geschlossener Vertrag erfasst"))) zeilen.push({ art: "ok", text: "Die Meldung des Kunden ist als erledigt markiert" });
        await gutscheinZeile(key, am, zeilen);
        break;
      }
      case "provision-abgerechnet": {
        const datum = datumFeld(fd, "rechnungsdatum");
        const tage = zahl(feld(fd, "zahlungsziel", 4));
        if (!datum || tage == null || tage < 1 || tage > 120) return abbruch("Bitte Rechnungsdatum und ein Zahlungsziel zwischen 1 und 120 Tagen angeben.");
        const faelligAm = plusTage(datum, Math.round(tage));
        if (!a.ziel || !(await N.provisionAbrechnen(key, a.ziel, { datum, faelligAm }, feld(fd, "notiz", 300), email))) return abbruch("Keine fällige Provision gefunden.");
        zeilen.push({ art: "ok", text: `Provision als abgerechnet vermerkt — Rechnung vom ${tagDe(datum)}, zahlbar bis ${tagDe(faelligAm)}` });
        break;
      }
      case "provision-bezahlt":
        if (!a.ziel) return abbruch("Keine offene Provision gefunden.");
        await V.provisionStatusSetzen(key, a.ziel, "bezahlt", feld(fd, "notiz", 300), email);
        zeilen.push({ art: "ok", text: "Provision als bezahlt vermerkt" });
        break;
      case "anzeige-vermerken":
        await N.pachtAnzeigeVermerken(key, email);
        zeilen.push({ art: "ok", text: "Pachtanzeige als erledigt vermerkt" });
        break;
      case "meldung-erledigt":
        if (!a.ziel || !(await N.meldungErledigen(key, a.ziel, email))) return abbruch("Meldung nicht gefunden oder schon erledigt.");
        zeilen.push({ art: "ok", text: "Meldung als erledigt markiert" });
        break;
      case "ablehnung-erledigt": {
        const abl = ctx.meta?.ablehnung;
        if (!abl) return abbruch("Keine Meldung „kein Interesse“ gefunden.");
        await N.ablehnungErledigen(key, ctx.art, email, abl.am, abl.rolle);
        zeilen.push({ art: "ok", text: "Zur Kenntnis genommen — das Paar ruht (keine Erinnerungen an die Gegenseite)" });
        break;
      }
      case "paar-beenden": {
        const status = ctx.meta?.status ?? "vorschlag";
        // Wie im Plan: nach der Freigabe nur aus den Listen nehmen (Nachweis bleibt), vorher verwerfen.
        if (status === "kontakt" || M.aktiveFreigabe(ctx.vorgang)) {
          await N.vorgangBeenden(key, ctx.art, email, feld(fd, "grund", 300));
          zeilen.push({ art: "ok", text: "Vorgang ohne Abschluss beendet — steht jetzt unter „Abgeschlossen & beendet“ (Freigabe und Nachweis bleiben)" });
        } else {
          const f = new FormData();
          f.set("key", key);
          f.set("aktion", "verwerfen");
          await paarAktion(f);
          weg = true;
          zeilen.push({ art: "ok", text: `Paar ${wert(ctx.angebot.name) || ctx.angebot.id} ↔ ${wert(ctx.gesuch.name) || ctx.gesuch.id} verworfen — es steht nicht mehr im Dashboard; im Matching unter „Verworfen“ zurückholbar` });
        }
        break;
      }
      case "wieder-aufnehmen": {
        if ((ctx.meta?.status ?? "vorschlag") === "verworfen") {
          const f = new FormData();
          f.set("key", key);
          f.set("aktion", "zuruecksetzen");
          await paarAktion(f);
          zeilen.push({ art: "ok", text: "Paar wieder als Vorschlag geführt" });
        } else {
          await N.vorgangWiederAufnehmen(key, ctx.art, email);
          zeilen.push({ art: "ok", text: "Vorgang wieder aufgenommen" });
        }
        break;
      }
    }
  } catch (err) {
    unstable_rethrow(err);
    zeilen.push({ art: "fehler", text: err instanceof Error ? err.message : "Unbekannter Fehler." });
  }

  revalidatePath("/admin", "layout");
  const r = ergebnis(a.knopf, zeilen);
  return weg ? { ...r, weg } : r;
}

/** Neue Vorschläge im Dashboard: „Vormerken“ bzw. „Passt nicht“ — ein Klick, ohne Mail, jederzeit umkehrbar. */
export async function vorschlagAktion(fd: FormData): Promise<AssistentState> {
  await requireAdmin();
  const key = feld(fd, "key", 80);
  const aktion = feld(fd, "aktion", 20);
  if (!istPaarKey(key) || (aktion !== "vormerken" && aktion !== "verwerfen")) {
    return { status: "fehler", titel: "Ungültige Anfrage.", zeilen: [], am: new Date().toISOString() };
  }
  const ids = key.split("~");
  const namen = await Promise.all(ids.map(async (id) => wert((await A.ladeLead(id))?.lead.name) || id));
  const f = new FormData();
  f.set("key", key);
  f.set("aktion", aktion);
  await paarAktion(f);
  revalidatePath("/admin", "layout");
  return ergebnis(aktion === "vormerken" ? "Vormerken" : "Passt nicht", [
    aktion === "vormerken"
      ? { art: "ok", text: `Paar ${namen.join(" ↔ ")} vorgemerkt — nächster Schritt: „Beide einladen“` }
      : { art: "ok", text: `Paar ${namen.join(" ↔ ")} verworfen — es wird nicht mehr vorgeschlagen (im Matching unter „Verworfen“ zurückholbar)` },
  ]);
}

/** Neue Anfragen ohne Paar: Status mit einem Klick auf „In Arbeit“ oder „Archiv“. */
export async function anfrageStatusAktion(fd: FormData): Promise<AssistentState> {
  await requireAdmin();
  const id = feld(fd, "id", 40);
  const status = feld(fd, "status", 20);
  if (!istKundeId(id) || (status !== "in_arbeit" && status !== "archiv" && status !== "beantwortet")) {
    return { status: "fehler", titel: "Ungültige Anfrage.", zeilen: [], am: new Date().toISOString() };
  }
  const geladen = await A.ladeLead(id);
  const name = wert(geladen?.lead.name) || id;
  // „Als beantwortet markieren“ gilt nur für Neues — eine veraltete Ansicht darf z. B. „kein Interesse“ (Erledigt) nicht überschreiben.
  if (status === "beantwortet" && geladen?.lead.status !== "neu") {
    revalidatePath("/admin", "layout");
    return {
      status: "fehler",
      titel: "Nichts geändert — die Anfrage ist schon bearbeitet.",
      zeilen: [{ art: "info", text: `Anfrage von ${name} steht inzwischen auf „${geladen ? LEAD_STATUS[geladen.lead.status].label : "—"}“. Die Ansicht ist aktualisiert.` }],
      am: new Date().toISOString(),
    };
  }
  const f = new FormData();
  f.set("id", id);
  f.set("bereich", "status");
  f.set("status", status);
  await anfrageSpeichern(f);
  revalidatePath("/admin", "layout");
  const text = {
    archiv: `Anfrage von ${name} archiviert — sie erscheint nicht mehr im Dashboard und nicht im Matching`,
    in_arbeit: `Anfrage von ${name} auf „In Arbeit“ gesetzt — weiter unter „Anfragen“`,
    beantwortet: `Anfrage von ${name} als beantwortet markiert — das Ticket ist erledigt`,
  }[status];
  return ergebnis(status === "archiv" ? "Archiv" : status === "beantwortet" ? "Als beantwortet markieren" : "In Arbeit", [{ art: "ok", text }]);
}

/**
 * Neue Anfrage ohne Paar: den vorgeschlagenen Schritt ausführen (lib/portal/anfrage-vorschlag.ts) —
 * einladen (Link bei Bedarf erstellen, Einladungs-Mail senden, Status „Beantwortet“) bzw. als
 * beantwortet markieren. Der Vorschlag wird frisch berechnet; weicht er vom bestätigten ab
 * (Signatur), passiert nichts.
 */
export async function anfrageVorschlagAktion(fd: FormData): Promise<AssistentState> {
  const { email } = await requireAdmin();
  const am = new Date().toISOString();
  const id = feld(fd, "id", 40);
  const aktion = feld(fd, "aktion", 20);
  const signatur = feld(fd, "signatur", 64);
  if (!istKundeId(id) || (aktion !== "einladen" && aktion !== "beantwortet")) return { status: "fehler", titel: "Ungültige Anfrage.", zeilen: [], am };
  const geladen = await A.ladeLead(id);
  if (!geladen) return { status: "fehler", titel: "Anfrage nicht gefunden.", zeilen: [], am };
  const { lead } = geladen;
  const u = await umgebung();
  const kunden = new Map((await alleKunden()).map((k) => [k.id, k]));
  const a = anfrageVorschlag(lead, await ladeKunde(id), { ...u, kunden }).aktion;
  // Nur ausführen, was bestätigt wurde — sonst neu anzeigen (z. B. schon beantwortet oder neuer Link erstellt).
  if (lead.status !== "neu" || a.id !== aktion || a.signatur !== signatur) {
    revalidatePath("/admin", "layout");
    return {
      status: "fehler",
      titel: "Nichts ausgeführt — der Stand hat sich inzwischen geändert.",
      zeilen: [{ art: "info", text: "Die Ansicht ist jetzt aktualisiert. Bitte prüfen und dann erneut klicken." }],
      am,
    };
  }
  if (a.gesperrt) return { status: "fehler", titel: `Nicht möglich: ${a.knopf}`, zeilen: [{ art: "fehler", text: a.gesperrt }], am };

  const name = wert(lead.name) || id;
  const zeilen: AssistentZeile[] = [];
  try {
    if (a.id === "beantwortet") {
      const f = new FormData();
      f.set("id", id);
      f.set("bereich", "status");
      f.set("status", "beantwortet");
      await anfrageSpeichern(f);
      zeilen.push({ art: "ok", text: `Anfrage von ${name} als beantwortet markiert — sie steht nicht mehr unter „Neue Anfragen“` });
    } else {
      const rr = rolleVonLead(lead);
      const m = a.mails[0];
      if (!rr || !m) throw new Error("Für diese Anfrage ist keine Einladung möglich.");
      let kunde = await ladeKunde(id);
      if (!kunde?.einladung || Date.parse(kunde.einladung.bis) < Date.now()) {
        // Vorlage ist freigegeben (sonst wäre der Vorschlag gesperrt) — Link und ggf. Kundenakte anlegen.
        await A.einladungErstellen(lead, email);
        zeilen.push({ art: "ok", text: `Persönlicher Einladungslink für ${name} erstellt (30 Tage gültig)` });
        kunde = await ladeKunde(id);
      }
      const e = entwuerfeKunde({ lead, kunde, einstellungen: u.einstellungen, basis: u.basis }).find((x) => x.zweck === "einladung");
      if (!e || e.gesperrt) {
        zeilen.push({ art: "fehler", text: `E-Mail an ${m.wer}: nicht gesendet — ${e?.gesperrt ?? "keine Einladung möglich"}` });
      } else {
        const r = await verwaltungsMailSenden(email, { zweck: "einladung", kundeId: id, rolle: rr.rolle, an: e.an, betreff: e.betreff, text: e.text });
        zeilen.push(r.ok ? { art: "ok", text: `E-Mail an ${m.wer} (${e.an}): „${e.betreff}“` } : { art: "fehler", text: `E-Mail an ${m.wer} (${e.an}) nicht gesendet: ${r.text}` });
        if (r.ok) zeilen.push({ art: "ok", text: "Status → „Beantwortet“ — die Anfrage steht nicht mehr unter „Neue Anfragen“" });
      }
    }
  } catch (err) {
    unstable_rethrow(err);
    zeilen.push({ art: "fehler", text: err instanceof Error ? err.message : "Unbekannter Fehler." });
  }
  revalidatePath("/admin", "layout");
  return ergebnis(a.knopf, zeilen);
}

/**
 * Antwortentwurf freigeben (Dashboard „Zur Freigabe“, lib/portal/antwort.ts): sendet Betreff und Text
 * so, wie die Verwaltung sie bestätigt (ggf. angepasst) hat — an die Adresse aus der Anfrage, nie an eine
 * übergebene. Nur für Anfragen auf „Neu“ (neue Anfrage oder offenes Ticket), damit nichts doppelt rausgeht.
 * Versand, Verlauf und Status „Beantwortet“ über lib/portal/versand.ts.
 */
export async function antwortSendenAktion(fd: FormData): Promise<AssistentState> {
  const { email } = await requireAdmin();
  const am = new Date().toISOString();
  const id = feld(fd, "id", 40);
  const betreff = feld(fd, "betreff", 200);
  const text = String(fd.get("text") ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 12_000);
  if (!istKundeId(id)) return { status: "fehler", titel: "Ungültige Anfrage.", zeilen: [], am };
  if (!betreff || !text) return { status: "fehler", titel: "Nicht gesendet — Betreff und Text dürfen nicht leer sein.", zeilen: [], am };
  const geladen = await A.ladeLead(id);
  if (!geladen) return { status: "fehler", titel: "Anfrage nicht gefunden.", zeilen: [], am };
  const { lead } = geladen;
  const name = wert(lead.name) || id;
  if (lead.status !== "neu") {
    revalidatePath("/admin", "layout");
    return {
      status: "fehler",
      titel: "Nichts gesendet — die Anfrage ist schon bearbeitet.",
      zeilen: [{ art: "info", text: `Anfrage von ${name} steht inzwischen auf „${LEAD_STATUS[lead.status].label}“ (z. B. schon beantwortet). Die Ansicht ist aktualisiert.` }],
      am,
    };
  }
  const kunde = await ladeKunde(id);
  const an = (kunde?.email || wert(lead.email)).toLowerCase();
  const zeilen: AssistentZeile[] = [];
  try {
    const r = await verwaltungsMailSenden(email, { zweck: "antwort", kundeId: id, an, betreff, text });
    if (r.ok) {
      zeilen.push({ art: "ok", text: `E-Mail an ${name} (${an}): „${betreff}“` });
      zeilen.push({ art: "ok", text: "Status → „Beantwortet“ — die Anfrage steht nicht mehr unter „Zur Freigabe“; der Text steht im Verlauf der Anfrage" });
    } else {
      zeilen.push({ art: "fehler", text: `E-Mail an ${name} (${an}) nicht gesendet: ${r.text}` });
    }
  } catch (err) {
    unstable_rethrow(err);
    zeilen.push({ art: "fehler", text: err instanceof Error ? err.message : "Unbekannter Fehler." });
  }
  revalidatePath("/admin", "layout");
  return ergebnis("Antwort senden", zeilen);
}

/** Höchstens so lange je Klick senden (Seite: maxDuration 60 s) — der Rest folgt mit dem nächsten Klick. */
const NACHFASS_BUDGET_MS = 45_000;
/** Mindestabstand zwischen zwei echten Sendungen (Resend erlaubt wenige Mails je Sekunde). */
const NACHFASS_ABSTAND_MS = 600;

/**
 * Nachfassen (Dashboard): den ausgewählten Kunden je eine eigene Nachfass-Mail senden — nur an
 * Anfragen, die jetzt noch Kandidaten sind (frisch berechnet). Versand, Protokoll, „nachgefasst am“
 * und Status „Beantwortet“ über lib/portal/versand.ts; Rückmeldung ✓/✗ je Empfänger.
 */
export async function nachfassenAktion(fd: FormData): Promise<AssistentState> {
  const { email } = await requireAdmin();
  const start = Date.now();
  const am = new Date(start).toISOString();
  const ids = [...new Set(fd.getAll("id").map((x) => String(x).trim()))].filter(istKundeId).slice(0, 500);
  if (ids.length === 0) return { status: "fehler", titel: "Keine Empfänger ausgewählt.", zeilen: [{ art: "info", text: "Bitte mindestens ein Häkchen setzen." }], am };

  const [roh, { zustand }, kunden, vorgaenge, basis] = await Promise.all([listLeads(), readZustand(), alleKunden(), alleVorgaenge(), basisUrl()]);
  const leads = roh.map((l) => leadView(l, zustand.anfragen[l.id]));
  const kandidaten = new Map(
    nachfassKandidaten({
      leads,
      zustand,
      kunden: new Map(kunden.map((k) => [k.id, k])),
      vorgaenge: new Map(vorgaenge.map((v) => [v.key, v])),
      jetzt: new Date(start),
      basis,
    }).map((k) => [k.id, k]),
  );

  const zeilen: AssistentZeile[] = [];
  const spaeter: string[] = [];
  let gesendet = 0;
  let letzterVersand = 0;
  for (const id of ids) {
    const k = kandidaten.get(id);
    if (!k) {
      const l = leads.find((x) => x.id === id);
      const zuletzt = l?.meta.nachgefasstAm && Date.parse(l.meta.nachgefasstAm) > start - NACHFASS_PAUSE_TAGE * 86_400_000 ? l.meta.nachgefasstAm : null;
      const grund = !l
        ? "Anfrage nicht gefunden"
        : zuletzt
          ? `schon am ${datumDe(zuletzt)} nachgefasst`
          : "kommt fürs Nachfassen nicht mehr in Frage (Status, Vorgang, Vertrag oder letzter Kontakt hat sich geändert)";
      zeilen.push({ art: "fehler", text: `${wert(l?.name) || id}: nicht gesendet — ${grund}` });
      continue;
    }
    if (Date.now() - start > NACHFASS_BUDGET_MS) {
      spaeter.push(k.name);
      continue;
    }
    if (!testModus()) {
      const warten = letzterVersand + NACHFASS_ABSTAND_MS - Date.now();
      if (warten > 0) await new Promise((r) => setTimeout(r, warten));
    }
    letzterVersand = Date.now();
    try {
      const r = await verwaltungsMailSenden(email, { zweck: "nachfassen", kundeId: id, an: k.an, betreff: k.betreff, text: k.text });
      if (r.ok) gesendet++;
      zeilen.push(r.ok ? { art: "ok", text: `E-Mail an ${k.name} (${k.an}): „${k.betreff}“` } : { art: "fehler", text: `E-Mail an ${k.name} (${k.an}) nicht gesendet: ${r.text}` });
    } catch (err) {
      unstable_rethrow(err);
      zeilen.push({ art: "fehler", text: `E-Mail an ${k.name} (${k.an}) nicht gesendet: ${err instanceof Error ? err.message : "unbekannter Fehler"}` });
    }
  }
  if (spaeter.length) {
    zeilen.push({
      art: "fehler",
      text: `Noch nicht gesendet, weil die Zeit für einen Klick nicht reicht: ${spaeter.join(", ")} — bitte gleich noch einmal auf „Nachfass-Mail … senden“ klicken (wer schon angeschrieben ist, steht nicht mehr in der Liste).`,
    });
  }
  zeilen.unshift({ art: "info", text: `${gesendet} von ${ids.length} Nachfass-Mails ${testModus() ? "protokolliert" : "gesendet"} — je Empfänger eine eigene E-Mail.` });
  revalidatePath("/admin", "layout");
  return ergebnis("Nachfass-Mail senden", zeilen);
}
