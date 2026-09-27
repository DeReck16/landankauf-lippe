import type { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin/session";
import { ladeSperrakte } from "@/lib/admin/loeschen";
import { dokumentAntwort, dokumentBytes, findeDokument } from "@/lib/portal/dokumente";
import { istKundeId, istPaarKey, ladeKunde, ladeVorgang } from "@/lib/portal/speicher";

// Download eines Dokuments für die Verwaltung — nur mit gültiger Sitzung,
// nie über öffentliche Blob-URLs. ?k=<Anfrage> oder ?v=<Vorgang>, ?download=1.
// ?s=<Anfrage>: gesperrtes Vertragsdokument einer gelöschten Anfrage (Sperrakte,
// nur zur Aufbewahrung bzw. für Rechtsansprüche — Art. 18 Abs. 2 DSGVO).

export const runtime = "nodejs";

export async function GET(request: NextRequest, ctx: RouteContext<"/admin/dokument/[id]">) {
  if (!(await getAdminSession())) return new Response("Nicht angemeldet", { status: 401 });
  const { id } = await ctx.params;
  if (!/^DOK-[A-Z0-9]+$/.test(id)) return new Response("Ungültig", { status: 400 });
  const k = request.nextUrl.searchParams.get("k") ?? "";
  const v = request.nextUrl.searchParams.get("v") ?? "";
  const s = request.nextUrl.searchParams.get("s") ?? "";
  const quelle = istKundeId(k)
    ? await ladeKunde(k)
    : istPaarKey(v)
      ? await ladeVorgang(v)
      : istKundeId(s)
        ? ((await ladeSperrakte(s))?.kunde ?? null)
        : null;
  const meta = findeDokument(quelle, id);
  if (!meta) return new Response("Nicht gefunden", { status: 404 });
  const bytes = await dokumentBytes(meta);
  if (!bytes) return new Response("Datei fehlt im Speicher", { status: 404 });
  return dokumentAntwort(meta, bytes, request.nextUrl.searchParams.get("download") === "1");
}
