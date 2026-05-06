import { NextResponse } from "next/server";
import { site } from "@/lib/site";
import { cityTypeRoutes } from "@/lib/cities";
import { ARTICLES } from "@/lib/blog";

const KEY = "54906b8ca0d49faffac7059dec0de837";

const CORE_ROUTES = [
  "",
  "flaeche-verkaufen",
  "flaeche-verpachten",
  "flaeche-bewerten",
  "ackerland-verkaufen",
  "wiese-verkaufen",
  "wald-verkaufen",
  "services/vns-oekopunkte",
  "services/lohnunternehmer",
  "ratgeber/bodenrichtwerte-lippe",
  "ratgeber/grundstuecksverkehrsgesetz",
  "blog",
  "ueber-uns",
  "kontakt",
];

const ROUTES = [
  ...CORE_ROUTES,
  ...cityTypeRoutes().map((r) => `${r.type}-verkaufen-${r.city}`),
  ...ARTICLES.map((a) => `blog/${a.slug}`),
];

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? "no-secret"}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const urls = ROUTES.map((r) => `${site.url}${r ? `/${r}` : ""}`);

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
    info: "POST mit Bearer-Auth, um Sitemap-URLs an IndexNow (Bing/Yandex) zu pingen.",
    keyFile: `${site.url}/${KEY}.txt`,
    routes: ROUTES.length,
  });
}
