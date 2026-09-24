import type { NextRequest } from "next/server";
import * as M from "@/lib/portal/model";
import { dokumentAntwort, dokumentBytes, findeDokument } from "@/lib/portal/dokumente";
import { ladeKundenSitzung } from "@/lib/portal/sitzung";
import { istPaarKey, ladeVorgang } from "@/lib/portal/speicher";

// Download im Kundenbereich: nur mit gültiger Kunden-Sitzung, nur eigene
// Dokumente bzw. Dokumente eines freigegebenen Vorgangs, in dem der Kunde
// Partei ist und für dessen Rolle das Dokument sichtbar ist.

export const runtime = "nodejs";

export async function GET(request: NextRequest, ctx: RouteContext<"/kunde/dokument/[id]">) {
  const sitzung = await ladeKundenSitzung();
  if (!sitzung) return new Response("Nicht angemeldet", { status: 401 });
  const { id } = await ctx.params;
  if (!/^DOK-[A-Z0-9]+$/.test(id)) return new Response("Ungültig", { status: 400 });
  const kunde = sitzung.kunden.find((k) => k.id === request.nextUrl.searchParams.get("k"));
  if (!kunde) return new Response("Nicht gefunden", { status: 404 });

  const key = request.nextUrl.searchParams.get("v") ?? "";
  let meta: M.DokumentMeta | null = null;
  if (key) {
    if (!istPaarKey(key)) return new Response("Ungültig", { status: 400 });
    const [a, g] = key.split("~");
    const partei = kunde.rolle === "anbieter" ? a === kunde.id : g === kunde.id;
    const v = partei ? await ladeVorgang(key) : null;
    if (!v || !M.aktiveFreigabe(v)) return new Response("Nicht gefunden", { status: 404 });
    // Nach einem Widerruf ohne geschlossenen Vertrag keine Vorgangsdokumente mehr (wie in der Übersicht).
    if (kunde.widerruf && !v.abschluss) return new Response("Nicht gefunden", { status: 404 });
    meta = findeDokument(v, id);
  } else {
    meta = findeDokument(kunde, id);
  }
  if (!meta || !meta.sichtbarFuer.includes(kunde.rolle)) return new Response("Nicht gefunden", { status: 404 });
  const bytes = await dokumentBytes(meta);
  if (!bytes) return new Response("Datei fehlt", { status: 404 });
  return dokumentAntwort(meta, bytes, request.nextUrl.searchParams.get("download") === "1");
}
