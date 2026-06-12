import { NextResponse } from "next/server";
import { site } from "@/lib/site";
import sitemap from "@/app/sitemap";

// IndexNow-Key für lippeforst.de — Verifizierungsdatei liegt in /public/<KEY>.txt
const KEY = "54906b8ca0d49faffac7059dec0de837";

// Single Source of Truth: exakt dieselben URLs wie die Sitemap (inkl. Blog).
// Keine zweite Routen-Liste pflegen — neue Inhalte laufen automatisch mit.
function indexNowUrls(): string[] {
  return sitemap().map((entry) => entry.url);
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? "no-secret"}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const urls = indexNowUrls();

  const body = {
    host: new URL(site.url).host,
    key: KEY,
    keyLocation: `${site.url}/${KEY}.txt`,
    urlList: urls,
  };

  const res = await fetch("https://api.indexnow.org/IndexNow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return NextResponse.json({
    submitted: urls.length,
    indexnowStatus: res.status,
    indexnowOk: res.ok,
  });
}

export async function GET() {
  return NextResponse.json({
    info: "POST mit Bearer-Auth, um alle Sitemap-URLs an IndexNow (Bing/Yandex) zu pingen.",
    keyFile: `${site.url}/${KEY}.txt`,
    routes: indexNowUrls().length,
  });
}
