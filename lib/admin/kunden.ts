import { istEigeneFlaeche, type LeadView } from "./model";
import { stufe, type KundeRecord, type Stufe } from "@/lib/portal/model";

/**
 * Kunden = Personen hinter den Anfragen (Reiter „Kunden“ der Verwaltung): alle Anfragen derselben E-Mail-Adresse
 * (ohne Adresse: desselben Namens) werden zu einer Zeile. Nicht dabei: archivierte Anfragen (Tests, Spam, Dubletten,
 * Löschwünsche) und die eigenen Flächen der Geschäftsführung. Reine Ableitung aus Anfragen und Kundenakten — nichts
 * wird gespeichert oder doppelt gepflegt.
 */

export type Kunde = {
  /** E-Mail-Adresse (klein) bzw. „name:…“, wenn keine angegeben wurde. */
  key: string;
  name: string;
  /** Weitere Schreibweisen oder Namen zur selben Adresse (z. B. Eigentümer, für den jemand anfragt). */
  weitereNamen: string[];
  betrieb: string;
  email: string;
  telefon: string;
  /** Anschrift aus der Kundenakte, sonst leer. */
  anschrift: string;
  /** Neueste zuerst. */
  anfragen: LeadView[];
  akten: KundeRecord[];
  stufe: Stufe;
  /** Anfragen, die an TR Immobilien weitergegeben wurden (Vorgangsnummern dort). */
  triIds: string[];
  /** Letzter Eingang bzw. Kontakt (ISO). */
  letzte: string;
};

const leer = (v: string) => (v === "—" ? "" : v.trim());

/** Weiteste Stufe im Onboarding; ein Widerruf, eine Kündigung oder Sperre zählt nur, wenn nichts Gültiges vorliegt. */
export function besteStufe(akten: KundeRecord[]): Stufe {
  const rang: Partial<Record<Stufe, number>> = { neu: 0, eingeladen: 1, geoeffnet: 2, angaben: 3, unterschrieben: 4 };
  const stufen = akten.map((a) => stufe(a));
  const gueltig = stufen.filter((s) => s in rang);
  if (gueltig.length === 0) return stufen[0] ?? "neu";
  return gueltig.reduce((a, b) => ((rang[b] ?? 0) > (rang[a] ?? 0) ? b : a));
}

export function kundenAus(leads: LeadView[], akten: Map<string, KundeRecord>): Kunde[] {
  const gruppen = new Map<string, LeadView[]>();
  for (const l of leads) {
    if (l.status === "archiv" || istEigeneFlaeche(l, l.meta)) continue;
    const mail = leer(l.email).toLowerCase();
    const key = mail || `name:${leer(l.name).toLowerCase()}`;
    if (key === "name:") continue;
    gruppen.set(key, [...(gruppen.get(key) ?? []), l]);
  }
  return [...gruppen.entries()]
    .map(([key, ls]): Kunde => {
      const anfragen = [...ls].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
      const meine = anfragen.map((l) => akten.get(l.id)).filter((a): a is KundeRecord => Boolean(a));
      const stamm = meine.find((a) => a.stammdaten)?.stammdaten;
      const namen = [...new Set(anfragen.map((l) => leer(l.name)).filter(Boolean))];
      const name = stamm?.name || namen[0] || "—";
      return {
        key,
        name,
        weitereNamen: namen.filter((n) => n !== name),
        betrieb: stamm?.betrieb ?? "",
        email: leer(anfragen[0].email),
        telefon: stamm?.telefon || anfragen.map((l) => leer(l.phone)).find(Boolean) || "",
        anschrift: stamm ? [stamm.strasse, [stamm.plz, stamm.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "",
        anfragen,
        akten: meine,
        stufe: besteStufe(meine),
        triIds: anfragen.flatMap((l) => (l.meta.triUebergabe ? [l.meta.triUebergabe.triId] : [])),
        letzte: [anfragen[0].receivedAt, ...anfragen.map((l) => l.meta.letzterKontakt ?? ""), ...meine.map((a) => a.ereignisse[0]?.am ?? "")].sort().at(-1) ?? "",
      };
    })
    .sort((a, b) => b.letzte.localeCompare(a.letzte));
}

/** Suche über Name, Betrieb, Kontakt, Orte, Flurstücke und Vorgangsnummern; mehrere Wörter müssen alle vorkommen. */
export function passtZurKundenSuche(k: Kunde, q: string): boolean {
  const heu = [k.name, ...k.weitereNamen, k.betrieb, k.email, k.telefon, k.anschrift, ...k.triIds, ...k.anfragen.flatMap((l) => [l.id, l.ortText, l.flurstueck, l.typ])]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => heu.includes(w));
}
