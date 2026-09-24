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
  /** Anzeige je nach Stand: erledigt im Perfekt („Kontakt freigegeben“), sonst als Aufgabe („Kontakt freigeben“). */
  titel: string;
  /** Die Aufgabe, solange der Schritt nicht erledigt ist. */
  aufgabe: string;
  /** Der erledigte Schritt im Perfekt. */
  erledigtTitel: string;
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

  const roh: Omit<Schritt, "status" | "titel">[] = [];
  const fertig: boolean[] = [];

  const add = (s: Omit<Schritt, "status" | "titel">, ok: boolean) => {
    roh.push(s);
    fertig.push(ok);
  };

  add(
    {
      nr: 1,
      id: "paar",
      aufgabe: "Paar vormerken",
      erledigtTitel: "Paar vorgemerkt",
      detail: verworfen ? "Paar verworfen" : status === "vorschlag" ? "Vorschlag aus dem Matching" : "Angebot und Gesuch sind vorgemerkt",
      naechstes: "Im Assistenten „Paar vormerken“ klicken.",
    },
    !verworfen && status !== "vorschlag",
  );
  add(
    {
      nr: 2,
      id: "einladung",
      aufgabe: "Beide einladen",
      erledigtTitel: "Beide eingeladen",
      detail: `${stufeText("anbieter", x.anbieter)} · ${stufeText("suchender", x.suchender)}`,
      naechstes: "Im Assistenten „Beide einladen“ klicken — er erstellt die persönlichen Links und sendet beide Einladungs-Mails.",
    },
    M.stufe(x.anbieter) !== "neu" && M.stufe(x.suchender) !== "neu",
  );
  add(
    {
      nr: 3,
      id: "unterschrift",
      aufgabe: "Unterschriften einholen",
      erledigtTitel: "Verträge unterschrieben",
      detail: [
        vertragGueltig(x.suchender) ? `Provisionsvereinbarung (Suchender) unterschrieben am ${tag(x.suchender?.vertrag?.signatur.am)}` : `Provisionsvereinbarung (Suchender): ${M.STUFE_INFO[M.stufe(x.suchender)].label.toLowerCase()}`,
        vertragGueltig(x.anbieter) ? `Vereinbarung (Anbieter) unterschrieben am ${tag(x.anbieter?.vertrag?.signatur.am)}` : `Vereinbarung (Anbieter): ${M.STUFE_INFO[M.stufe(x.anbieter)].label.toLowerCase()}`,
      ].join(" · "),
      naechstes: "Auf die Unterschriften warten — bei Bedarf im Assistenten „Erinnerung senden“.",
    },
    beideUnterschrieben(x.anbieter, x.suchender),
  );
  add(
    {
      nr: 4,
      id: "zustimmung",
      aufgabe: "Anonym anfragen & Zustimmung einholen",
      erledigtTitel: "Beide stimmen dem Kontakt zu",
      detail: [
        zA ? `Anbieter stimmt zu (${tag(zA)})` : v?.hinweise?.anbieter ? `Hinweis an Anbieter gesendet (${tag(v.hinweise.anbieter)}), Zustimmung fehlt` : "Anbieter noch nicht angefragt",
        zS ? `Suchender stimmt zu (${tag(zS)})` : v?.hinweise?.suchender ? `Hinweis an Suchenden gesendet (${tag(v.hinweise.suchender)}), Zustimmung fehlt` : "Suchender noch nicht angefragt",
      ].join(" · "),
      naechstes: "Im Assistenten „Beide anonym anfragen“ (Hinweise mit Link zum Zustimmen) oder eine telefonische Zustimmung erfassen.",
    },
    Boolean(zA && zS),
  );
  const freigegeben = Boolean(v?.abschluss) || M.aktiveFreigabe(v);
  const wartenAuf = [!bereitA.bereit && `Anbieter: ${bereitA.grund}`, !bereitS.bereit && `Suchender: ${bereitS.grund}`].filter(Boolean).join(" · ");
  add(
    {
      nr: 5,
      id: "freigabe",
      aufgabe: "Kontakt freigeben",
      erledigtTitel: "Kontakt freigegeben",
      detail: freigegeben
        ? `Freigegeben am ${tag(v?.freigabe?.am)} — beide sehen Namen, Kontaktdaten und Flurstücke (= Nachweis)`
        : v?.freigabe?.zurueckgezogen
          ? `Freigabe zurückgezogen am ${tag(v.freigabe.zurueckgezogen.am)}`
          : wartenAuf || "Bereit zur Freigabe",
      naechstes: wartenAuf ? `Noch warten — ${wartenAuf}.` : "Im Assistenten „Kontakt freigeben & beide informieren“ klicken.",
    },
    freigegeben,
  );
  add(
    {
      nr: 6,
      id: "vertrag",
      aufgabe: x.art === "kauf" ? "Kaufvertrag beurkunden lassen" : "Pachtvertrag schließen",
      erledigtTitel: x.art === "kauf" ? "Kaufvertrag beurkundet" : "Pachtvertrag geschlossen",
      detail: vertragText(x.art, v),
      naechstes:
        x.art === "kauf"
          ? "Im Assistenten: „Eckdaten vorbereiten“ (Kaufpreis) → „Zur Bestätigung geben & beide informieren“ → nach dem Notar „Beurkundung erfassen“. Außerhalb geschlossen? Unter „Weitere Aktionen“."
          : "Im Assistenten: „Pachtvertrag vorbereiten“ (Pachtzins) → „Zur Unterschrift geben & beide informieren“. Außerhalb geschlossen? Unter „Weitere Aktionen“.",
    },
    Boolean(v?.abschluss),
  );
  const offeneProv = provisionen.filter((p) => p.status !== "bezahlt");
  const heuteDe = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(jetzt);
  const ueberfaellig = offeneProv.some((p) => p.status === "abgerechnet" && (M.provisionZahlungBis(p) ?? "9999-12-31") < heuteDe);
  add(
    {
      nr: 7,
      id: "provision",
      // Was gerade offen ist: abrechnen (fällig), auf die Zahlung warten (abgerechnet) oder auf die Wirksamkeit.
      aufgabe: offeneProv.some((p) => p.status === "faellig")
        ? "Provision abrechnen"
        : ueberfaellig
          ? "Provision überfällig — nachhaken"
          : offeneProv.some((p) => p.status === "abgerechnet")
            ? "Zahlung der Provision abwarten"
            : offeneProv.some((p) => p.status === "aufschiebend")
              ? "Wirksamkeit abwarten, dann abrechnen"
              : "Provision abrechnen",
      erledigtTitel: "Provision bezahlt",
      detail: provisionen.length
        ? provisionen.map((p) => `${M.PROVISION_STATUS[p.status].label}: ${M.euro(p.brutto)} brutto`).join(" · ")
        : "Entsteht mit dem Vertragsschluss",
      naechstes: offeneProv.some((p) => p.status === "aufschiebend")
        ? "Wirksamkeit abwarten (z. B. Genehmigung nach GrdstVG) — dann im Assistenten „Kauf ist wirksam“."
        : "Rechnung durch die Buchhaltung; dann „Als abgerechnet markieren“ und nach Zahlungseingang „Als bezahlt markieren“.",
    },
    provisionen.length > 0 && offeneProv.length === 0,
  );

  const idx = verworfen ? -1 : fertig.findIndex((f) => !f);
  const schritte: Schritt[] = roh.map((s, i) => {
    const st: SchrittStatus = fertig[i] ? "erledigt" : i === idx ? "aktuell" : "offen";
    return { ...s, titel: fertig[i] ? s.erledigtTitel : s.aufgabe, status: st, naechstes: st === "aktuell" ? s.naechstes : undefined };
  });
  return { schritte, aktuell: idx >= 0 ? schritte[idx] : null, erledigt: fertig.filter(Boolean).length, verworfen };
}
