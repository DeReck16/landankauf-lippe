import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin/session";
import { dateiAblegen } from "@/lib/portal/dokumente";
import * as M from "@/lib/portal/model";
import { aendereKunde, aendereVorgang, istKundeId, istPaarKey, ladeVorgang } from "@/lib/portal/speicher";

// Upload eines Dokuments in die Ablage eines Vorgangs oder einer Kundenakte
// (z. B. außerhalb geschlossener Pachtvertrag als Scan). Nur Verwaltung,
// nur PDF/JPG/PNG bis 4 MB, Herkunft muss die eigene Seite sein.

export const runtime = "nodejs";

const MAX = 4 * 1024 * 1024;

function art(bytes: Uint8Array): string | null {
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

function zurueck(request: NextRequest, pfad: string, meldung: string, fehler = false) {
  const url = new URL(pfad, request.url);
  url.searchParams.set("m", meldung);
  url.searchParams.set("mt", fehler ? "fehler" : "ok");
  url.hash = "dokumente";
  return NextResponse.redirect(url, 303);
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return new Response("Nicht angemeldet", { status: 401 });
  const herkunft = request.headers.get("origin");
  if (herkunft && new URL(herkunft).host !== request.nextUrl.host) return new Response("Fremde Herkunft", { status: 403 });

  const fd = await request.formData();
  const key = String(fd.get("key") ?? "");
  const kunde = String(fd.get("kunde") ?? "");
  const ziel = istPaarKey(key) ? `/admin/vorgang/${key}` : istKundeId(kunde) ? `/admin/anfrage/${kunde}` : null;
  if (!ziel) return new Response("Ungültiges Ziel", { status: 400 });

  const datei = fd.get("datei");
  if (!(datei instanceof File) || datei.size === 0) return zurueck(request, ziel, "Bitte eine Datei auswählen.", true);
  if (datei.size > MAX) return zurueck(request, ziel, "Die Datei ist größer als 4 MB.", true);
  const bytes = new Uint8Array(await datei.arrayBuffer());
  const typ = art(bytes);
  if (!typ) return zurueck(request, ziel, "Nur PDF, JPG oder PNG sind erlaubt.", true);

  const titel = String(fd.get("titel") ?? "").trim().slice(0, 120) || datei.name.slice(0, 120);
  const sichtbar = String(fd.get("sichtbar") ?? "");
  const sichtbarFuer: M.Rolle[] = sichtbar === "beide" ? ["anbieter", "suchender"] : sichtbar === "anbieter" ? ["anbieter"] : sichtbar === "suchender" ? ["suchender"] : [];

  if (istPaarKey(key)) {
    const v = await ladeVorgang(key);
    const meta = await dateiAblegen({ eigentuemer: { typ: "vorgang", key }, titel, dateiname: datei.name.slice(0, 120), inhalt: bytes, contentType: typ, sichtbarFuer, von: session.email });
    await aendereVorgang(key, v?.art ?? "pacht", (x) => {
      x.dokumente.unshift(meta);
      M.ereignis(x, session.email, "dokument", `Dokument hochgeladen: „${titel}“${sichtbarFuer.length ? ` (sichtbar für ${sichtbarFuer.map((r) => M.ROLLE_NAME[r]).join(" und ")})` : " (nur Verwaltung)"}`);
    });
  } else {
    const meta = await dateiAblegen({ eigentuemer: { typ: "kunde", id: kunde }, titel, dateiname: datei.name.slice(0, 120), inhalt: bytes, contentType: typ, sichtbarFuer, von: session.email });
    try {
      await aendereKunde(kunde, (k) => {
        meta.sichtbarFuer = sichtbarFuer.length ? [k.rolle] : [];
        k.dokumente.unshift(meta);
        M.ereignis(k, session.email, "dokument", `Dokument hochgeladen: „${titel}“`);
      });
    } catch {
      return zurueck(request, ziel, "Für diese Anfrage gibt es noch keine Kundenakte (erst Einladung erstellen).", true);
    }
  }
  revalidatePath("/admin", "layout");
  return zurueck(request, ziel, `„${titel}“ hochgeladen.`);
}
