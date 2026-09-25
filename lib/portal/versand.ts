import "server-only";
import { mutateZustand } from "@/lib/admin/store";
import * as A from "./ablauf";
import { MAIL_ZWECKE, type MailZweck } from "./entwuerfe";
import { kundenMail } from "./mail";
import * as M from "./model";
import { NACHFASS_PAUSE_TAGE } from "./nachfassen";
import { SPERRE_UNTERSCHRIFT, beideUnterschrieben } from "./schritte";
import { aendereKunde, aendereVorgang, istKundeId, istPaarKey, ladeKunde, ladeVorgang } from "./speicher";
import * as T from "./texte";
import * as V from "./vorgang";

// Eine Kunden-Mail aus der Verwaltung senden und protokollieren — gemeinsam genutzt
// vom einzelnen Entwurf (MailEntwurf → mailSendenAktion), vom Klick-Assistenten und
// vom Dashboard (Anfrage-Vorschläge, Nachfassen). Prüft die Sperren serverseitig,
// sendet über lippeforst.de (im Testmodus nur Log) und legt den Volltext in der
// Kundenakte und — mit Vorgang — im Vorgangsverlauf ab. Reine Auskünfte (kein
// Angebot/Gesuch mit Kauf oder Pacht) haben keine Kundenakte: Ihre Nachfass-Mail
// steht im Verlauf der Anfrage (Protokoll des Verwaltungszustands).
// Keine Server Action: Aufrufer prüfen vorher die Anmeldung (requireAdmin).

/** Zwecke, die auch ohne Kundenakte gesendet werden dürfen (Anfrage ist weder Angebot noch Gesuch). */
const OHNE_KUNDENAKTE: readonly string[] = ["nachfassen"];

export type VersandAuftrag = {
  zweck: string;
  kundeId: string;
  /** Vorgang (Angebot~Gesuch) — dann landet die Mail auch im Vorgangsverlauf. */
  key?: string;
  /** Ohne Vorgang die Rolle des Empfängers; mit Vorgang ergibt sie sich aus dem Schlüssel. */
  rolle?: M.Rolle;
  an: string;
  betreff: string;
  text: string;
};

export type VersandBericht = {
  ok: boolean;
  /** Versand wurde versucht und protokolliert (dann die Ansichten neu laden). */
  versucht: boolean;
  test: boolean;
  /** Meldung für die Oberfläche. */
  text: string;
  am?: string;
  an: string;
};

export async function verwaltungsMailSenden(von: string, auftrag: VersandAuftrag): Promise<VersandBericht> {
  const an = auftrag.an.trim().toLowerCase();
  const nein = (text: string): VersandBericht => ({ ok: false, versucht: false, test: false, text, an });

  const zweck = auftrag.zweck as MailZweck;
  if (!MAIL_ZWECKE.includes(zweck)) return nein("Unbekannter Zweck.");
  const id = auftrag.kundeId;
  if (!istKundeId(id)) return nein("Ungültige Anfrage.");
  const key = auftrag.key ?? "";
  if (key && (!istPaarKey(key) || !key.split("~").includes(id))) return nein("Ungültiger Vorgang.");
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(an)) return nein("Bitte genau eine gültige Empfängeradresse angeben.");
  const betreff = auftrag.betreff.trim();
  const text = auftrag.text.trim();
  if (!betreff || !text) return nein("Betreff und Text dürfen nicht leer sein.");
  if (/\[Link erscheint/.test(text)) return nein("Im Text fehlt noch der persönliche Link — erst „Einladung erstellen“.");
  // Im Vorgang steht der Anbieter vorn (Angebot~Gesuch) — so passt die Rolle immer zum Empfänger.
  const rolle: M.Rolle = key ? (key.split("~")[0] === id ? "anbieter" : "suchender") : (auftrag.rolle ?? "suchender");

  const geladen = await A.ladeLead(id);
  if (!geladen) return nein("Anfrage nicht gefunden.");
  let kunde = await ladeKunde(id);
  // Ohne Kundenakte nur, wo keine angelegt werden kann (reine Auskunft) und der Zweck das erlaubt.
  const ohneAkte = !kunde && !T.rolleVonLead(geladen.lead) && !key && OHNE_KUNDENAKTE.includes(zweck);
  if (!kunde && !ohneAkte) {
    try {
      kunde = await A.kundeSicherstellen(geladen.lead, von);
    } catch (err) {
      return nein(err instanceof Error ? err.message : "Kundenakte nicht anlegbar.");
    }
  }

  // Nachfassen nur bei offenen Anfragen: nicht nach der Unterschrift, nicht bei gesperrtem Zugang, nicht bei
  // Erledigt/Archiv — und nicht zweimal innerhalb der Ruhezeit (z. B. zwei Admins gleichzeitig).
  if (zweck === "nachfassen") {
    if (kunde?.vertrag || kunde?.gesperrt) return nein("Der Kunde hat bereits einen Vertrag mit Lippe Forst bzw. einen gesperrten Zugang — keine Nachfass-Mail.");
    if (geladen.lead.status === "erledigt" || geladen.lead.status === "archiv") return nein("Die Anfrage ist erledigt bzw. archiviert — keine Nachfass-Mail.");
    const zuletzt = geladen.lead.meta.nachgefasstAm;
    if (zuletzt && Date.now() - Date.parse(zuletzt) < NACHFASS_PAUSE_TAGE * 86_400_000) return nein(`Schon am ${T.datumDe(zuletzt)} nachgefasst — frühestens ${NACHFASS_PAUSE_TAGE} Tage danach erneut.`);
  }

  // Serverseitige Sperren (die Knöpfe sind in der Oberfläche schon gesperrt — hier noch einmal prüfen):
  // Anonyme Hinweise erst, wenn beide unterschrieben haben (Schritt 3 vor Schritt 4).
  if (zweck === "hinweis") {
    if (!key) return nein("Hinweise gehören zu einem Vorgang.");
    const [aId, gId] = key.split("~");
    const [ka, kg] = await Promise.all([ladeKunde(aId), ladeKunde(gId)]);
    if (!beideUnterschrieben(ka, kg)) return nein(SPERRE_UNTERSCHRIFT);
  }
  // Einladung und Erinnerung nie mit einem abgelaufenen Link verschicken.
  if ((zweck === "einladung" || zweck === "erinnerung") && kunde?.einladung && Date.parse(kunde.einladung.bis) < Date.now()) {
    return nein(`Der Einladungslink ist am ${T.datumDe(kunde.einladung.bis)} abgelaufen — erst einen neuen Link erstellen.`);
  }
  // Bewertungsbitte nur mit Einwilligung (§ 7 UWG), Vorgangs-Mitteilungen nicht nach einem Widerruf.
  if (zweck === "bewertung" && (!kunde || !M.bewertungsmailErlaubt(kunde))) {
    return nein("Keine Einwilligung in Bewertungs-E-Mails (oder Widerspruch) — nicht gesendet.");
  }
  if (key && (zweck === "freigabe" || zweck === "pachtvertrag" || zweck === "kaufabsicht")) {
    const [aId, gId] = key.split("~");
    const [ka, kg, vg] = await Promise.all([ladeKunde(aId), ladeKunde(gId), ladeVorgang(key)]);
    if ((ka?.widerruf || kg?.widerruf) && !vg?.abschluss) {
      return nein("Eine Seite hat ihren Vertrag widerrufen — diese Mitteilung wird nicht mehr gesendet.");
    }
  }

  const res = await kundenMail({ an, betreff, text });
  const jetzt = new Date().toISOString();
  const eintrag: M.GesendeteMail = { id: M.kurzId("M"), am: jetzt, von, an, betreff, text, zweck, test: res.test, ok: res.ok, fehler: res.fehler };

  if (kunde) {
    await aendereKunde(id, (k) => {
      k.mails.unshift(eintrag);
      // Eine Erinnerung trägt den aktuellen Link — war die Einladung selbst noch nicht vermerkt, gilt sie damit als gesendet.
      if (res.ok && k.einladung && (zweck === "einladung" || (zweck === "erinnerung" && !k.einladung.gesendetAm))) k.einladung.gesendetAm = jetzt;
      M.ereignis(k, von, "mail", `${res.ok ? "E-Mail gesendet" : "E-Mail NICHT gesendet"}: „${betreff}“ an ${an}${res.test ? " (Testmodus)" : ""}`);
    });
  }
  if (key) {
    const art: M.Art = geladen.lead.art === "kauf" ? "kauf" : "pacht";
    await aendereVorgang(key, art, (v) => {
      v.mails.unshift(eintrag);
    });
    if (res.ok && zweck === "hinweis") await V.hinweisVermerken(key, art, rolle, von);
    if (res.ok && zweck === "bewertung") await V.bewertungVermerken(key, art, rolle, von);
  }
  // Eine neue Anfrage gilt nach der ersten Antwort als beantwortet; eine Nachfass-Mail vermerkt
  // ihr Datum und setzt „Beantwortet“ (auch aus „In Arbeit“). Ohne Kundenakte steht die Mail
  // selbst im Verlauf der Anfrage — auch, wenn sie nicht rausging.
  const nachgefasst = res.ok && zweck === "nachfassen";
  if (ohneAkte || nachgefasst || (res.ok && geladen.lead.status === "neu")) {
    await mutateZustand(von, (z) => {
      const meta = { ...(z.anfragen[id] ?? {}) };
      const teile: string[] = [];
      if (ohneAkte) {
        const art = zweck === "nachfassen" ? "Nachfass-Mail" : "E-Mail";
        teile.push(`${art} ${res.ok ? "gesendet" : "NICHT gesendet"}: „${betreff}“ an ${an}${res.test ? " (Testmodus)" : ""}${res.ok ? "" : ` — ${res.fehler ?? "Fehler"}`}`);
      }
      let geaendert = false;
      if (nachgefasst) {
        meta.nachgefasstAm = jetzt;
        geaendert = true;
        if (!ohneAkte) teile.push(`Nachfass-Mail gesendet: „${betreff}“ an ${an}${res.test ? " (Testmodus)" : ""}`);
      }
      const status = meta.status ?? "neu";
      if (res.ok && (status === "neu" || (nachgefasst && status === "in_arbeit"))) {
        meta.status = "beantwortet";
        geaendert = true;
        teile.push(ohneAkte || nachgefasst ? "Status → Beantwortet" : "Status → Beantwortet (E-Mail gesendet)");
      }
      if (geaendert) {
        meta.geaendert = { am: jetzt, von };
        z.anfragen[id] = meta;
      }
      if (teile.length === 0) return;
      return { was: teile.join(" · "), ref: id };
    });
  }
  if (!res.ok) return { ok: false, versucht: true, test: res.test, text: `Nicht gesendet: ${res.fehler ?? "unbekannter Fehler"}`, am: jetzt, an };
  return { ok: true, versucht: true, test: res.test, text: res.test ? "Testmodus: nicht versendet, nur protokolliert." : `Gesendet an ${an}.`, am: jetzt, an };
}
