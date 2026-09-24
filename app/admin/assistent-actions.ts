"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { requireAdmin } from "@/lib/admin/session";
import * as A from "@/lib/portal/ablauf";
import { ASSISTENT_AKTIONEN, assistentEntwurf, assistentPlan, type AssistentAktionId, type AssistentMail, type AssistentUmgebung } from "@/lib/portal/assistent";
import * as M from "@/lib/portal/model";
import { SPERRE_FREIGABE } from "@/lib/portal/schritte";
import { basisUrl } from "@/lib/portal/sitzung";
import { istPaarKey, ladeEinstellungen, ladeVorgang } from "@/lib/portal/speicher";
import { rolleVonLead, tagDe } from "@/lib/portal/texte";
import { verwaltungsMailSenden } from "@/lib/portal/versand";
import * as V from "@/lib/portal/vorgang";
import { VORLAGEN, istFreigegeben, kundenVorlage } from "@/lib/vertraege/vorlagen";
import { paarAktion } from "./actions";

// Klick-Assistent (app/admin/(intern)/Assistent.tsx): führt genau die Aktion aus,
// die der Admin in der Sicherheitsabfrage bestätigt hat. Der Plan wird hier frisch
// berechnet — weicht er vom bestätigten ab (Signatur), passiert nichts. Jede
// Teilaktion ruft die bestehenden Funktionen mit ihren Sperren auf; Mails gehen
// über verwaltungsMailSenden (Sperren, Versand, Volltext im Verlauf).

export type AssistentZeile = { art: "ok" | "fehler" | "info"; text: string };
export type AssistentState = { status: "idle" | "ok" | "teil" | "fehler"; titel?: string; zeilen?: AssistentZeile[]; am?: string };

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

async function umgebung(): Promise<AssistentUmgebung> {
  const einstellungen = await ladeEinstellungen();
  return { einstellungen, basis: await basisUrl(), bewertungsUrl: M.bewertungsUrl(einstellungen, process.env.GOOGLE_REVIEW_URL) };
}

/** Mails nach dem aktuellen Stand erzeugen (echte Links) und einzeln senden. */
async function mailsSenden(von: string, key: string, u: AssistentUmgebung, geplant: AssistentMail[], zeilen: AssistentZeile[]): Promise<void> {
  if (geplant.length === 0) return;
  const ctx = await V.ladeVorgangKontext(key);
  if (!ctx) {
    zeilen.push({ art: "fehler", text: "Vorgang nicht gefunden — keine E-Mail gesendet." });
    return;
  }
  for (const m of geplant) {
    const e = assistentEntwurf(ctx, u, m.zweck, m.rolle);
    if (!e) {
      zeilen.push({ art: "fehler", text: `${m.wer}: Die E-Mail ist nicht mehr vorgesehen — nichts gesendet.` });
      continue;
    }
    if (e.gesperrt) {
      zeilen.push({ art: "fehler", text: `${m.wer}: nicht gesendet — ${e.gesperrt}` });
      continue;
    }
    const r = await verwaltungsMailSenden(von, { zweck: e.zweck, kundeId: e.kundeId, key, rolle: m.rolle, an: e.an, betreff: e.betreff, text: e.text });
    zeilen.push(
      r.ok
        ? { art: "ok", text: `E-Mail „${e.betreff}“ an ${e.an} ${r.test ? "protokolliert (Testmodus — nicht verschickt)" : "gesendet"}` }
        : { art: "fehler", text: `E-Mail an ${e.an} (${m.wer}) nicht gesendet: ${r.text}` },
    );
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
    zeilen.push({ art: "fehler", text: `Die Vorlage „${VORLAGEN[vorlage].titel}“ ist noch nicht freigegeben (Verwaltung → Vorlagen) — kein Link für ${m.wer}.` });
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

/** Nur Ziele innerhalb der Verwaltung (kein offener Redirect). */
function zurueckZiel(fd: FormData): string | null {
  const s = feld(fd, "zurueck", 200);
  return /^\/admin(\/[A-Za-z0-9_~%-]+)*$/.test(s) ? s : null;
}

/** Zurück zur Liste (Dashboard, Matching): Rückmeldung oben (?m=…), `k` und Anker auf die Karte. */
function meldungsZiel(ziel: string, st: AssistentState, key: string): string {
  const text = [st.titel, ...(st.zeilen ?? []).map((z) => (z.art === "fehler" ? `✗ ${z.text}` : z.text))]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 390);
  const karte = istPaarKey(key) ? `&k=${encodeURIComponent(key)}#${key}` : "";
  return `${ziel}?m=${encodeURIComponent(text)}&mt=${st.status === "ok" ? "ok" : "fehler"}${karte}`;
}

export async function assistentAktion(_prev: AssistentState, fd: FormData): Promise<AssistentState> {
  const { email } = await requireAdmin();
  const key = feld(fd, "key", 80);
  const ergebnis = await ausfuehren(email, key, fd);
  // Aus Listen (Dashboard, Matching) zurück zur Liste — die Karte kann dort den Abschnitt wechseln.
  const ziel = zurueckZiel(fd);
  if (ziel) redirect(meldungsZiel(ziel, ergebnis, key));
  return ergebnis;
}

/** „Vormerken“ bzw. „Passt nicht“ für neue Vorschläge im Dashboard — ein Klick, ohne Mail, jederzeit umkehrbar. */
export async function dashboardPaarAktion(fd: FormData): Promise<void> {
  await requireAdmin();
  const key = feld(fd, "key", 80);
  const aktion = feld(fd, "aktion", 20);
  if (!istPaarKey(key) || (aktion !== "vormerken" && aktion !== "verwerfen")) {
    redirect(`/admin/dashboard?m=${encodeURIComponent("Ungültige Anfrage.")}&mt=fehler`);
  }
  const f = new FormData();
  f.set("key", key);
  f.set("aktion", aktion);
  await paarAktion(f);
  const text =
    aktion === "vormerken"
      ? "Paar vorgemerkt — steht jetzt unter „Jetzt dran“; nächster Schritt: „Beide einladen“."
      : "Paar verworfen — es wird nicht mehr vorgeschlagen (im Matching unter „Verworfen“ zurückholbar).";
  redirect(`/admin/dashboard?m=${encodeURIComponent(text)}&mt=ok${aktion === "vormerken" ? `&k=${encodeURIComponent(key)}#${key}` : "#vorschlaege"}`);
}

async function ausfuehren(email: string, key: string, fd: FormData): Promise<AssistentState> {
  const am = new Date().toISOString();
  const aktion = feld(fd, "aktion", 40) as AssistentAktionId;
  const signatur = feld(fd, "signatur", 64);
  if (!istPaarKey(key) || !ASSISTENT_AKTIONEN.includes(aktion)) return { status: "fehler", titel: "Ungültige Anfrage.", am };

  const ctx = await V.ladeVorgangKontext(key);
  if (!ctx) return { status: "fehler", titel: "Vorgang nicht gefunden.", am };
  const u = await umgebung();
  const a = assistentPlan(ctx, u).aktion;
  // Nur ausführen, was bestätigt wurde: Hat sich der Stand inzwischen geändert (z. B. hat ein
  // Kunde unterschrieben oder jemand anderes schon geklickt), nichts tun und neu anzeigen.
  if (!a || a.id !== aktion || a.signatur !== signatur) {
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
  const abbruch = (text: string): AssistentState => {
    revalidatePath("/admin", "layout");
    return { status: zeilen.some((z) => z.art === "ok") ? "teil" : "fehler", titel: `Nicht erledigt: ${a.knopf}`, zeilen: [...zeilen, { art: "fehler", text }], am };
  };

  try {
    switch (a.id) {
      case "vormerken": {
        const f = new FormData();
        f.set("key", key);
        f.set("aktion", "vormerken");
        await paarAktion(f);
        zeilen.push({ art: "ok", text: "Paar vorgemerkt — als Nächstes lädt der Assistent beide Seiten ein." });
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
        await mailsSenden(email, key, u, a.mails, zeilen);
        break;
      case "freigeben": {
        const r = await V.freigeben(key, email);
        if (!r.ok) return abbruch(`Freigabe nicht möglich: ${r.fehler}`);
        zeilen.push({ art: "ok", text: "Kontakt freigegeben — beide sehen die Kontaktdaten jetzt im Kundenbereich" });
        await mailsSenden(email, key, u, a.mails, zeilen);
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
        zeilen.push({ art: "ok", text: `Pachtvertrag-Entwurf gespeichert — Jahrespacht ${M.euro(M.jahrespacht(daten))}` });
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
      case "kauf-vorbereiten": {
        const preis = zahl(feld(fd, "kaufpreis", 20));
        if (preis == null || preis <= 0) return abbruch("Bitte einen Kaufpreis größer als 0 eingeben.");
        const k = ctx.vorgang?.kauf;
        const basis = k && k.status === "entwurf" ? k.daten : V.kaufVorschlag(ctx);
        const r = await V.kaufSpeichern(key, { ...basis, kaufpreis: preis }, email);
        if (!r.ok) return abbruch(r.fehler ?? "Speichern nicht möglich.");
        zeilen.push({ art: "ok", text: `Eckdaten gespeichert — Kaufpreis-Vorstellung ${M.euro(preis)}` });
        zeilen.push({ art: "info", text: "Weitere Angaben (Übergabe, bestehende Pacht, Notar) im Bereich „Kauf“ — als Nächstes „Zur Bestätigung geben & beide informieren“." });
        break;
      }
      case "kauf-bestaetigung": {
        const r = await V.kaufZurBestaetigung(key, email);
        if (!r.ok) return abbruch(r.fehler ?? "Nicht möglich.");
        zeilen.push({ art: "ok", text: "Eckdaten liegen beiden zur (unverbindlichen) Bestätigung vor" });
        await mailsSenden(email, key, u, a.mails, zeilen);
        break;
      }
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
        // Den automatisch verschickten Treue-Gutschein offen ausweisen.
        const gm = (await ladeVorgang(key))?.mails.find((x) => x.zweck === "gutschein" && x.am >= am);
        if (gm) zeilen.push({ art: gm.ok ? "ok" : "fehler", text: `Treue-Gutschein-Mail „${gm.betreff}“ an ${gm.an} ${gm.ok ? (gm.test ? "protokolliert (Testmodus — nicht verschickt)" : "gesendet") : `nicht gesendet: ${gm.fehler ?? "Fehler"}`}` });
        break;
      }
      case "kauf-wirksam": {
        const datum = datumFeld(fd, "datum");
        if (!datum) return abbruch("Bitte das Datum angeben, seit dem der Kaufvertrag wirksam ist.");
        await V.kaufWirksam(key, email, datum);
        zeilen.push({ art: "ok", text: `Kaufvertrag wirksam seit ${tagDe(datum)} — Provision fällig (Rechnung durch die Buchhaltung)` });
        break;
      }
      case "provision-abgerechnet":
      case "provision-bezahlt": {
        const status: M.ProvisionStatus = a.id === "provision-bezahlt" ? "bezahlt" : "abgerechnet";
        if (!a.ziel) return abbruch("Keine offene Provision gefunden.");
        await V.provisionStatusSetzen(key, a.ziel, status, feld(fd, "notiz", 500), email);
        zeilen.push({ art: "ok", text: `Provision als „${M.PROVISION_STATUS[status].label}“ vermerkt` });
        break;
      }
    }
  } catch (err) {
    unstable_rethrow(err);
    zeilen.push({ art: "fehler", text: err instanceof Error ? err.message : "Unbekannter Fehler." });
  }

  revalidatePath("/admin", "layout");
  const fehler = zeilen.filter((z) => z.art === "fehler").length;
  const ok = zeilen.filter((z) => z.art === "ok").length;
  const status: AssistentState["status"] = fehler === 0 ? "ok" : ok > 0 ? "teil" : "fehler";
  return {
    status,
    titel: status === "ok" ? `Erledigt: ${a.knopf}` : status === "teil" ? `Teilweise erledigt: ${a.knopf}` : `Nicht erledigt: ${a.knopf}`,
    zeilen,
    am,
  };
}
