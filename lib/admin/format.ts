import type { Art, LeadView, Rolle } from "./model";

export function datumZeit(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}

export function datum(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
}

export const ROLLE_LABEL: Record<Rolle, string> = {
  angebot: "Angebot",
  gesuch: "Gesuch",
  keine: "Sonstiges",
};

export const ROLLE_TIPP: Record<Rolle, string> = {
  angebot: "Bietet eine Fläche an (verkaufen oder verpachten) — wird mit passenden Gesuchen abgeglichen.",
  gesuch: "Sucht eine Fläche (pachten oder kaufen) — wird mit passenden Angeboten abgeglichen.",
  keine: "Kein Flächenangebot und kein Gesuch (z. B. Bewertung, Energiepacht, Beratung) — nimmt nicht am Matching teil.",
};

export function artLabel(art: Art | null): string {
  return art === "kauf" ? "Kauf" : art === "pacht" ? "Pacht" : "";
}

export function kurzbeschreibung(l: LeadView): string {
  const teile = [l.typ];
  if (l.ortText) teile.push(l.ortText);
  return teile.join(" · ");
}
