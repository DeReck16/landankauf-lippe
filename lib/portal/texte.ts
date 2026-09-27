import { formatGroesse, type LeadRecord, type LeadView } from "@/lib/admin/model";
import type { FlaecheText, ParteiText } from "@/lib/vertraege/vorlagen/typen";
import { summeHa, zahlDe, type Art, type Flaeche, type KundeRecord, type Rolle, type Stammdaten } from "./model";

// Textbausteine für Vorlagen, Mails und Kundenbereich (ohne Server-Abhängigkeit).

export function wert(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  return t === "—" ? "" : t;
}

export function datumDe(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
}

export function datumZeitDe(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Berlin" })} Uhr`;
}

/** „2026-10-01“ → „01.10.2026“ (Datumsfelder ohne Zeitzone). */
export function tagDe(ymd: string | null | undefined): string {
  const m = (ymd ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : wert(ymd) || "—";
}

export function anschrift(s: Stammdaten | undefined): string {
  if (!s) return "";
  return [s.strasse, [s.plz, s.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

export function rolleVonLead(l: LeadView): { rolle: Rolle; art: Art } | null {
  if (!l.art) return null;
  if (l.rolle === "angebot") return { rolle: "anbieter", art: l.art };
  if (l.rolle === "gesuch") return { rolle: "suchender", art: l.art };
  return null;
}

export function parteiText(k: KundeRecord, l: LeadRecord): ParteiText {
  const s = k.stammdaten;
  return {
    name: s?.name || wert(l.name),
    betrieb: s?.betrieb || "",
    anschrift: anschrift(s),
    email: k.email,
    telefon: s?.telefon || wert(l.phone),
  };
}

function typText(typ: string): string {
  if (typ === "Wiese / Grünland") return "Grünland";
  if (typ === "Wald / Forst") return "Wald";
  if (typ === "Sonstiges") return "Fläche";
  return typ;
}

export function suchprofilText(l: LeadView): string {
  const g = formatGroesse(l.groesseWert);
  const teile = [typText(l.typ), g !== "Größe offen" ? g : "", l.ortText ? `Raum ${l.ortText}` : "", l.rolle === "gesuch" ? `Suchradius ${l.radiusKm} km` : ""];
  return `${teile.filter(Boolean).join(", ")} (${l.art === "kauf" ? "Kauf" : "Pacht"})`;
}

export function angebotText(l: LeadView): string {
  const g = formatGroesse(l.groesseWert);
  return [typText(l.typ), g !== "Größe offen" ? `ca. ${g}` : "", l.ortText].filter(Boolean).join(", ");
}

export function flaecheBezeichnung(f: Flaeche): string {
  return [f.gemarkung && `Gemarkung ${f.gemarkung}`, f.flur && `Flur ${f.flur}`, f.flurstueck && `Flurstück ${f.flurstueck}`].filter(Boolean).join(", ") || "ohne Katasterangabe";
}

export function haText(ha: number | null | undefined): string {
  return ha == null ? "Größe offen" : `${zahlDe(ha, 4)} ha`;
}

export function flaecheZeile(f: Flaeche): string {
  return [flaecheBezeichnung(f), f.groesseHa != null ? haText(f.groesseHa) : "", f.nutzung].filter(Boolean).join(" · ");
}

export function flaecheText(f: Flaeche): FlaecheText {
  return { bezeichnung: flaecheBezeichnung(f), groesse: haText(f.groesseHa), nutzung: f.nutzung };
}

export function flaechenSumme(flaechen: Flaeche[]): string {
  return haText(summeHa(flaechen));
}

/**
 * Größe für anonyme Texte, gerundet — die genaue Zahl würde zusammen mit dem Ort das
 * Flurstück verraten (und damit den Nachweis vorwegnehmen): unter 0,25 ha „unter 0,5 ha“,
 * bis 5 ha auf halbe Hektar, bis 20 ha auf ganze, darüber auf 5 ha.
 */
function gerundet(ha: number): number {
  return ha <= 5 ? Math.max(0.5, Math.round(ha * 2) / 2) : ha <= 20 ? Math.round(ha) : Math.round(ha / 5) * 5;
}

const haZahl = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });

export function grobeHa(ha: number | null | undefined): string | null {
  if (ha == null || !Number.isFinite(ha) || ha <= 0) return null;
  if (ha < 0.25) return "unter 0,5 ha";
  return `ca. ${haZahl(gerundet(ha))} ha`;
}

/** Gerundete Größe bzw. Spanne eines Angebots für anonyme Texte ("" = unbekannt). */
export function grobeGroesse(g: { minHa: number | null; maxHa: number | null }): string {
  const { minHa, maxHa } = g;
  const ok = (x: number | null): x is number => x != null && Number.isFinite(x) && x > 0;
  if (ok(minHa) && ok(maxHa) && minHa !== maxHa) {
    const a = gerundet(Math.min(minHa, maxHa));
    const b = gerundet(Math.max(minHa, maxHa));
    return a === b ? `ca. ${haZahl(a)} ha` : `ca. ${haZahl(a)}–${haZahl(b)} ha`;
  }
  return grobeHa(ok(minHa) ? minHa : ok(maxHa) ? maxHa : null) ?? "";
}

/** Anonyme Eckdaten der Gegenseite (vor der Freigabe) — Angebote mit gerundeter Größe. */
export function anonymeEckdaten(l: LeadView, lage: string): { typ: string; groesse: string; lage: string; art: string } {
  return {
    typ: typText(l.typ),
    groesse: l.rolle === "angebot" ? grobeGroesse(l.groesseWert) || "Größe offen" : formatGroesse(l.groesseWert),
    lage: lage || "Kreis Lippe und Umgebung",
    art: l.art === "kauf" ? (l.rolle === "angebot" ? "zum Verkauf" : "Kaufgesuch") : l.rolle === "angebot" ? "zur Verpachtung" : "Pachtgesuch",
  };
}

export function emailMaskiert(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(6, name.length - 2)))}@${domain}`;
}
