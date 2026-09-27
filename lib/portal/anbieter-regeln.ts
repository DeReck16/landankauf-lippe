// Gleicher Eigentümer? Reine Namensregeln ohne Server-Abhängigkeit — genutzt von der
// Anbieter-Gruppe (lib/portal/anbieter-gruppe.ts), den Paketen der Flächenbörse und Tests.

const FUELLWOERTER = new Set(["herr", "frau", "dr", "prof", "familie", "fam", "eheleute", "und"]);

/** Namensteile ohne Klammerzusätze („(privat)“, „(vertreten durch …)“), Anrede und Titel; „Nachname, Vorname“ wird umgestellt. */
export function namensTeile(name: string | undefined): string[] {
  let s = (name ?? "").replace(/\([^)]*\)/g, " ");
  if (s.includes(",")) s = s.split(",").map((x) => x.trim()).reverse().join(" ");
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z]+/)
    .filter((t) => t && !FUELLWOERTER.has(t));
}

/**
 * Derselbe Eigentümer? Gleicher Nachname und — falls beide einen Vornamen nennen — ein gemeinsamer
 * Vorname bzw. passende Initiale. Fehlt ein Name, genügt die gleiche E-Mail-Adresse.
 */
export function gleichePerson(a: string | undefined, b: string | undefined): boolean {
  const x = namensTeile(a);
  const y = namensTeile(b);
  if (!x.length || !y.length) return true;
  if (x[x.length - 1] !== y[y.length - 1]) return false;
  const vx = x.slice(0, -1);
  const vy = y.slice(0, -1);
  if (!vx.length || !vy.length) return true;
  return vx.some((t) => vy.some((u) => t === u || (t.length === 1 && u.startsWith(t)) || (u.length === 1 && t.startsWith(u))));
}
