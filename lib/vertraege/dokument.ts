// Strukturierte Vertragsdokumente: eine Vorlage erzeugt aus Daten ein
// `Dokument` (Überschriften, Absätze, Listen, Kästen, Feldtabellen). Daraus
// werden die Bildschirmansicht (components/vertrag/VertragsText.tsx) und das
// PDF (lib/vertraege/pdf.ts) erzeugt — beide zeigen exakt denselben Text.
// Der SHA-256 über das Dokument belegt, welcher Text unterschrieben wurde.

export type Block =
  | { t: "h2"; text: string }
  | { t: "h3"; text: string }
  | { t: "p"; text: string }
  | { t: "liste"; items: string[]; nummeriert?: boolean }
  | { t: "kasten"; titel?: string; absaetze: string[] }
  | { t: "felder"; zeilen: [string, string][] }
  | { t: "trenner" };

export type Dokument = { titel: string; untertitel?: string; bloecke: Block[] };

/** Kanonische Textform eines Dokuments (Grundlage des Hashes, siehe lib/vertraege/hash.ts). */
export function kanonisch(dok: Dokument): string {
  return JSON.stringify(dok);
}

/** Hilfen zum Schreiben von Vorlagen. */
export const h2 = (text: string): Block => ({ t: "h2", text });
export const h3 = (text: string): Block => ({ t: "h3", text });
export const p = (text: string): Block => ({ t: "p", text });
export const liste = (items: string[], nummeriert = false): Block => ({ t: "liste", items, nummeriert });
export const kasten = (titel: string | undefined, absaetze: string[]): Block => ({ t: "kasten", titel, absaetze });
export const felder = (zeilen: [string, string][]): Block => ({ t: "felder", zeilen: zeilen.filter(([, w]) => w !== "") });
export const trenner = (): Block => ({ t: "trenner" });

/** Paragraphen-Zähler für „§ 1 …“-Überschriften. */
export function paragraphen() {
  let n = 0;
  return (titel: string): Block => h2(`§ ${++n} ${titel}`);
}

/** Leere Zeichenkette statt „—“/undefined. */
export function wert(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  return t === "—" ? "" : t;
}
