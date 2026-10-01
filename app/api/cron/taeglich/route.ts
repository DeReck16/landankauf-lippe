import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { hasBlobToken } from "@/lib/admin/config";
import { leadView } from "@/lib/admin/model";
import { listLeads, readZustand } from "@/lib/admin/store";
import { boerseNeuSchreiben } from "@/lib/boerse";
import { automatikTaeglich } from "@/lib/portal/automatik";
import { katasterKandidaten, katasterNachholen } from "@/lib/portal/kataster";
import { postausgangAbarbeiten } from "@/lib/portal/postausgang";
import { bewertungenAutomatisch } from "@/lib/portal/vorgang";

// Täglicher Lauf (vercel.json, einmal am Morgen — mit dem Hobby-Tarif geht nur täglich):
// 1. Postausgang: fehlgeschlagene Systemmails erneut versuchen.
// 2. Automatik (lib/portal/automatik.ts): nur eingeschaltete Regeln, sonst passiert nichts;
//    danach die Zusammenfassung des Vortags an die Verwaltung.
// 3. Bitte um Google-Bewertung — nur mit eingeschaltetem Automatikversand und Einwilligung.
// 4. Kataster-Daten für neue Anfragen nachholen (früher beim Anzeigen des Dashboards) und Bodenrichtwerte
//    neu abfragen, die vor der Wahl der Nutzungsart (Acker/Grünland) gespeichert wurden — ändert nur
//    LeadMeta.kataster, schickt nichts.
// 5. Flächenbörse neu schreiben (z. B. inzwischen vergebene Flächen).
// Jeder Teil läuft für sich; ein Fehler hält die anderen nicht auf.

export const runtime = "nodejs";
export const maxDuration = 60;

function berechtigt(request: Request): boolean {
  const soll = process.env.CRON_SECRET;
  const ist = request.headers.get("authorization") ?? "";
  if (!soll) return false;
  const a = Buffer.from(ist);
  const b = Buffer.from(`Bearer ${soll}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function teil<T>(name: string, f: () => Promise<T>): Promise<T | { fehler: string }> {
  try {
    return await f();
  } catch (err) {
    console.error(`[cron/taeglich] ${name}`, err);
    return { fehler: err instanceof Error ? err.message : "Fehler" };
  }
}

export async function GET(request: Request) {
  if (!berechtigt(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!hasBlobToken()) return NextResponse.json({ aus: "Kein Speicher verbunden." });
  const postausgang = await teil("postausgang", () => postausgangAbarbeiten({ max: 20, von: "cron" }));
  const automatik = await teil("automatik", () => automatikTaeglich());
  const bewertungen = await teil("bewertungen", () => bewertungenAutomatisch(process.env.GOOGLE_REVIEW_URL));
  const kataster = await teil("kataster", async () => {
    const [roh, { zustand }] = await Promise.all([listLeads(), readZustand()]);
    const leads = roh.map((l) => leadView(l, zustand.anfragen[l.id]));
    return Object.keys(await katasterNachholen(katasterKandidaten(leads), 14_000)).length;
  });
  const boerse = await teil("boerse", () => boerseNeuSchreiben());
  return NextResponse.json({ postausgang, automatik, bewertungen, kataster, boerse });
}
