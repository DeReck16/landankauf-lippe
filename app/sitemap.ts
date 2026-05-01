import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
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
    "ueber-uns",
    "kontakt",
    "impressum",
    "datenschutz",
  ];
  return routes.map((path) => ({
    url: `${site.url}${path ? `/${path}` : ""}`,
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1.0 : path.startsWith("ratgeber") || path === "impressum" || path === "datenschutz" ? 0.4 : 0.8,
  }));
}
