import type { MatchMeta } from "@/lib/admin/model";
import * as M from "./model";

// Feste Reihenfolge eines Vorgangs — jeder Schritt erst nach dem vorigen:
//   1 Paar gebildet → 2 Eingeladen → 3 Unterschrieben (Suchender: Provisionsvereinbarung)
//   → 4 Anonym vorgestellt & Zustimmung beider → 5 Kontakt freigegeben (= Nachweis)
//   → 6 Vertrag geschlossen → 7 Provision.
// Die Serveraktionen prüfen dieselben Bedingungen (z. B. beideUnterschrieben), die
// Anzeige ist nur die sichtbare Seite davon.

export type SchrittId = "paar" | "einladung" | "unterschrift" | "zustimmung" | "freigabe" | "vertrag" | "provision";
export type SchrittStatus = "erledigt" | "aktuell" | "offen";

export type Schritt = {
  nr: number;
  id: SchrittId;
  titel: string;
  status: SchrittStatus;
  /** Stand in einem Satz (was erledigt ist bzw. was fehlt). */
  detail: string;
  /** Nur beim aktuellen Schritt: was jetzt zu tun ist. */
  naechstes?: string;
};

export type SchrittEingabe = {
  art: M.Art;
  meta: MatchMeta | null | undefined;
  vorgang: M.VorgangRecord | null | undefined;
  anbieter: M.KundeRecord | null | undefined;
  suchender: M.KundeRecord | null | undefined;
};

/** Gültiger Vertrag mit Lippe Forst: unterschrieben, nicht widerrufen, gekündigt oder gesperrt. */
export function vertragGueltig(k: M.KundeRecord | null | undefined): boolean {
  return M.stufe(k) === "unterschrieben";
}

/** Voraussetzung für alles ab Schritt 4: beide haben unterschrieben — der Suchende also die Provisionsvereinbarung. */
export function beideUnterschrieben(anbieter: M.KundeRecord | null | undefined, suchender: M.KundeRecord | null | undefined): boolean {
  return vertragGueltig(anbieter) && vertragGueltig(suchender);
}

export const SPERRE_UNTERSCHRIFT =
  "Erst möglich, wenn beide Seiten ihren Vertrag mit Lippe Forst unterschrieben haben (Schritt 3) — der Suchende also die Provisionsvereinbarung.";

export const SPERRE_FREIGABE =
  "Erst möglich nach der Freigabe (Schritt 5): Ohne Nachweis über Lippe Forst entsteht kein Provisionsanspruch.";

function tag(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : "";
}

function stufeText(rolle: M.Rolle, k: M.KundeRecord | null | undefined): string {
  return `${M.ROLLE_NAME[rolle]}: ${M.STUFE_INFO[M.stufe(k)].label}`;
}

function vertragText(art: M.Art, v: M.VorgangRecord | null | undefined): string {
  if (!v) return art === "kauf" ? "Kaufvertrag noch offen" : "Pachtvertrag noch nicht vorbereitet";
  if (v.abschluss) {
    const grund = { pachtvertrag: "Pachtvertrag online geschlossen", kaufvertrag: "Kaufvertrag beurkundet", extern: "außerhalb der Plattform geschlossen (erfasst)" }[v.abschluss.grundlage];
    return `${grund} am ${tag(v.abschluss.am)}`;
  }
  if (art === "pacht") {
    const pv = v.pachtvertrag;
    if (!pv || pv.status === "verworfen") return "Pachtvertrag noch nicht vorbereitet";
    if (pv.status === "entwurf") return "Pachtvertrag im Entwurf";
    if (pv.status === "zur_unterschrift") {
      const fehlt = [!pv.unterschriften.verpaechter && "Verpächter", !pv.unterschriften.paechter && "Pächter"].filter(Boolean).join(" und ");
      return `Pachtvertrag liegt zur Unterschrift vor — es fehlt: ${fehlt}`;
    }
    return "Pachtvertrag geschlossen";
  }
  const k = v.kauf;
  if (!k || k.status === "abgebrochen") return "Kauf-Eckdaten noch nicht vorbereitet";
  return (
    {
      entwurf: "Kauf-Eckdaten im Entwurf",
      zur_bestaetigung: "Eckdaten liegen beiden Seiten zur Bestätigung vor",
      bestaetigt: "Eckdaten bestätigt — Notartermin vorbereiten",
      beurkundet: "Kaufvertrag beurkundet",
      wirksam: "Kaufvertrag wirksam",
      abgebrochen: "Kauf abgebrochen",
    } as const
  )[k.status];
}

/** Die sieben Schritte eines Vorgangs mit Stand; genau ein Schritt ist „aktuell“ (bis alles erledigt ist). */
export function vorgangSchritte(x: SchrittEingabe, jetzt = new Date()): { schritte: Schritt[]; aktuell: Schritt | null; erledigt: number; verworfen: boolean } {
  const status = x.meta?.status ?? "vorschlag";
  const verworfen = status === "verworfen";
  const v = x.vorgang ?? null;
  const zA = x.meta?.zustimmungAnbieter;
  const zS = x.meta?.zustimmungSuchender;
  const provisionen = v?.provisionen.filter((p) => p.status !== "storniert") ?? [];
  const bereitA = M.freigabeBereit(x.anbieter, jetzt);
  const bereitS = M.freigabeBereit(x.suchender, jetzt);

  const roh: Omit<Schritt, "status">[] = [];
  const fertig: boolean[] = [];

  const add = (s: Omit<Schritt, "status">, ok: boolean) => {
    roh.push(s);
    fertig.push(ok);
  };

  add(
    {
      nr: 1,
      id: "paar",
      titel: "Paar gebildet",
      detail: verworfen ? "Paar verworfen" : status === "vorschlag" ? "Vorschlag aus dem Matching" : "Angebot und Gesuch sind vorgemerkt",
      naechstes: "Im Matching „Vormerken“ klicken.",
    },
    !verworfen && status !== "vorschlag",
  );
  add(
    {
      nr: 2,
      id: "einladung",
      titel: "Eingeladen",
      detail: `${stufeText("anbieter", x.anbieter)} · ${stufeText("suchender", x.suchender)}`,
      naechstes: "Bei beiden Seiten „Einladung erstellen“ und die Einladungs-Mail senden (Anbieter- bzw. Anfrage-Seite).",
    },
    M.stufe(x.anbieter) !== "neu" && M.stufe(x.suchender) !== "neu",
  );
  add(
    {
      nr: 3,
      id: "unterschrift",
      titel: "Verträge unterschrieben",
      detail: [
        vertragGueltig(x.suchender) ? `Provisionsvereinbarung (Suchender) unterschrieben am ${tag(x.suchender?.vertrag?.signatur.am)}` : `Provisionsvereinbarung (Suchender): ${M.STUFE_INFO[M.stufe(x.suchender)].label.toLowerCase()}`,
        vertragGueltig(x.anbieter) ? `Vereinbarung (Anbieter) unterschrieben am ${tag(x.anbieter?.vertrag?.signatur.am)}` : `Vereinbarung (Anbieter): ${M.STUFE_INFO[M.stufe(x.anbieter)].label.toLowerCase()}`,
      ].join(" · "),
      naechstes: "Auf die Unterschriften warten — bei Bedarf die Erinnerungs-Mail senden.",
    },
    beideUnterschrieben(x.anbieter, x.suchender),
  );
  add(
    {
      nr: 4,
      id: "zustimmung",
      titel: "Anonym vorgestellt & Zustimmung",
      detail: [
        zA ? `Anbieter stimmt zu (${tag(zA)})` : v?.hinweise?.anbieter ? `Hinweis an Anbieter gesendet (${tag(v.hinweise.anbieter)}), Zustimmung fehlt` : "Anbieter noch nicht angefragt",
        zS ? `Suchender stimmt zu (${tag(zS)})` : v?.hinweise?.suchender ? `Hinweis an Suchenden gesendet (${tag(v.hinweise.suchender)}), Zustimmung fehlt` : "Suchender noch nicht angefragt",
      ].join(" · "),
      naechstes: "Die beiden anonymen Hinweise senden (mit Link zum Zustimmen) oder eine telefonische Zustimmung erfassen.",
    },
    Boolean(zA && zS),
  );
  const freigegeben = Boolean(v?.abschluss) || M.aktiveFreigabe(v);
  const wartenAuf = [!bereitA.bereit && `Anbieter: ${bereitA.grund}`, !bereitS.bereit && `Suchender: ${bereitS.grund}`].filter(Boolean).join(" · ");
  add(
    {
      nr: 5,
      id: "freigabe",
      titel: "Kontakt freigegeben",
      detail: freigegeben
        ? `Freigegeben am ${tag(v?.freigabe?.am)} — beide sehen Namen, Kontaktdaten und Flurstücke (= Nachweis)`
        : v?.freigabe?.zurueckgezogen
          ? `Freigabe zurückgezogen am ${tag(v.freigabe.zurueckgezogen.am)}`
          : wartenAuf || "Bereit zur Freigabe",
      naechstes: wartenAuf ? `Noch warten — ${wartenAuf}.` : "„Kontakt freigeben“ klicken, danach die beiden Freigabe-Mitteilungen senden.",
    },
    freigegeben,
  );
  add(
    {
      nr: 6,
      id: "vertrag",
      titel: x.art === "kauf" ? "Kaufvertrag" : "Pachtvertrag",
      detail: vertragText(x.art, v),
      naechstes:
        x.art === "kauf"
          ? "Eckdaten für den Notar vorbereiten und bestätigen lassen; Beurkundung erfassen. Außerhalb geschlossen? Unten „Außerhalb geschlossener Vertrag“."
          : "Pachtvertrag vorbereiten → „Zur Unterschrift freigeben“ → Mitteilungen senden. Außerhalb geschlossen? Unten „Außerhalb geschlossener Vertrag“.",
    },
    Boolean(v?.abschluss),
  );
  const offeneProv = provisionen.filter((p) => p.status !== "bezahlt");
  add(
    {
      nr: 7,
      id: "provision",
      titel: "Provision",
      detail: provisionen.length
        ? provisionen.map((p) => `${M.PROVISION_STATUS[p.status].label}: ${M.euro(p.brutto)} brutto`).join(" · ")
        : "Entsteht mit dem Vertragsschluss",
      naechstes: offeneProv.some((p) => p.status === "aufschiebend")
        ? "Wirksamkeit abwarten (z. B. Genehmigung nach GrdstVG) — dann auf „Fällig“ setzen."
        : "Rechnung durch die Buchhaltung; Status auf „Abgerechnet“ und nach Zahlungseingang auf „Bezahlt“ setzen.",
    },
    provisionen.length > 0 && offeneProv.length === 0,
  );

  const idx = verworfen ? -1 : fertig.findIndex((f) => !f);
  const schritte: Schritt[] = roh.map((s, i) => {
    const st: SchrittStatus = fertig[i] ? "erledigt" : i === idx ? "aktuell" : "offen";
    return { ...s, status: st, naechstes: st === "aktuell" ? s.naechstes : undefined };
  });
  return { schritte, aktuell: idx >= 0 ? schritte[idx] : null, erledigt: fertig.filter(Boolean).length, verworfen };
}
