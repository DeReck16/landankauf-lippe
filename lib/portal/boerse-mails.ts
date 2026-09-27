import "server-only";
import { leadView, type BoerseMeta, type LeadView } from "@/lib/admin/model";
import { listLeads, mutateZustand, readZustand } from "@/lib/admin/store";
import { anfrageBezug } from "./entwuerfe";
import { GRUSS } from "./gruss";
import { kundenMail } from "./mail";
import * as T from "./texte";
import { boerseToken } from "./token";

// Bestätigung einer Einwilligung in die Flächenbörse, die die Verwaltung telefonisch,
// per E-Mail oder schriftlich erfasst hat — damit der Eigentümer sie in Textform hat
// (Nachweis nach Art. 7 Abs. 1 DSGVO) und mit einem Klick widerrufen kann.

export function einwilligungsBestaetigung(l: LeadView, b: BoerseMeta, basis: string): { betreff: string; text: string } {
  const name = T.wert(l.name);
  const link = `${basis}/kunde/boerse?t=${encodeURIComponent(boerseToken(l.id))}`;
  return {
    betreff: "Bestätigung: Ihre Fläche anonym in der Flächenbörse von Lippe Forst",
    text: [
      name ? `Guten Tag ${name},` : "Guten Tag,",
      "",
      `wie besprochen bestätigen wir Ihre Einwilligung vom ${T.tagDe(b.einwilligung?.am ?? "")} (${b.einwilligung?.quelle ?? "—"}): Wir dürfen Ihre Fläche anonym in der Flächenbörse auf lippeforst.de zeigen — nur mit Flächentyp, gerundeter Größe, Gemeinde und kurzen Angaben wie Pachtstatus oder Zuwegung. Ihren Namen, das Flurstück und die genaue Lage nennen wir niemandem, bevor Sie dem konkreten Interessenten zugestimmt haben.`,
      "",
      "Sie können die Einwilligung jederzeit widerrufen — mit einem Klick über diesen Link oder per Antwort auf diese E-Mail. Dann nehmen wir das Angebot sofort von der Website:",
      link,
      "",
      ...anfrageBezug(l),
      "",
      GRUSS,
    ].join("\n"),
  };
}

/** Mitteilung „Ihre Fläche ist jetzt online“ (Automatik R1) — mit Ein-Klick-Widerruf. */
export function boerseOnlineText(l: LeadView, b: BoerseMeta, basis: string): { betreff: string; text: string } {
  const name = T.wert(l.name);
  const link = `${basis}/kunde/boerse?t=${encodeURIComponent(boerseToken(l.id))}`;
  const groesse = b.groesseHa ? `ca. ${String(b.groesseHa).replace(".", ",")} ha` : "";
  const eckdaten = [b.typ, groesse, b.lage].filter(Boolean).join(", ");
  return {
    betreff: `Ihre Fläche steht jetzt anonym in der Flächenbörse (${b.code})`,
    text: [
      name ? `Guten Tag ${name},` : "Guten Tag,",
      "",
      `wie von Ihnen gewünscht steht Ihre Fläche jetzt anonym in der Flächenbörse auf lippeforst.de (Kennung ${b.code}${eckdaten ? `: ${eckdaten}` : ""}). Ihren Namen, das Flurstück und die genaue Lage nennen wir dort nicht; Kontaktdaten geben wir erst weiter, wenn Sie dem konkreten Interessenten zugestimmt haben.`,
      "",
      "Möchten Sie das nicht mehr, entfernen Sie das Häkchen bei Ihren Angaben im Kundenbereich oder nutzen Sie diesen Link — dann nehmen wir die Fläche sofort offline:",
      link,
      "",
      ...anfrageBezug(l),
      "",
      GRUSS,
    ].join("\n"),
  };
}

/** Bestätigung senden (Klick der Verwaltung beim Erfassen) und im Verlauf vermerken. */
export async function einwilligungBestaetigen(leadId: string, von: string, basis: string): Promise<{ ok: boolean; text: string }> {
  const [leads, { zustand }] = await Promise.all([listLeads(), readZustand()]);
  const roh = leads.find((x) => x.id === leadId);
  const meta = zustand.anfragen[leadId];
  const b = meta?.boerse;
  if (!roh || !b?.einwilligung) return { ok: false, text: "Keine erfasste Einwilligung." };
  const l = leadView(roh, meta);
  const an = T.wert(l.email).toLowerCase();
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(an)) return { ok: false, text: "Die Anfrage hat keine gültige E-Mail-Adresse — Bestätigung bitte auf anderem Weg." };
  const m = einwilligungsBestaetigung(l, b, basis);
  const r = await kundenMail({ an, betreff: m.betreff, text: m.text, postausgang: { zweck: "boerse-einwilligung", bezug: { typ: "keiner" } } });
  const am = new Date().toISOString();
  await mutateZustand(von, (z) => {
    const x = z.anfragen[leadId];
    if (r.ok && x?.boerse?.einwilligung) z.anfragen[leadId] = { ...x, boerse: { ...x.boerse, einwilligung: { ...x.boerse.einwilligung, bestaetigtAm: am } } };
    return {
      was: r.ok
        ? `Bestätigung der Börsen-Einwilligung an ${an} gesendet${r.test ? " (Testmodus)" : ""}: „${m.betreff}“`
        : `Bestätigung der Börsen-Einwilligung NICHT gesendet: ${r.fehler ?? "Fehler"}${r.eingereiht ? " — liegt im Postausgang" : ""}`,
      ref: leadId,
    };
  });
  return { ok: r.ok, text: r.ok ? `Bestätigung an ${an} gesendet.` : `Bestätigung nicht gesendet: ${r.fehler ?? "Fehler"}.` };
}
