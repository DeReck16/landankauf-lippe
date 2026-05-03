import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { cityTypeRoutes } from "@/lib/cities";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const coreRoutes = [
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

  const cityRoutes = cityTypeRoutes().map((r) => `${r.type}-verkaufen-${r.city}`);

  const all = [...coreRoutes, ...cityRoutes];

  return all.map((path) => {
    const isLegal = path === "impressum" || path === "datenschutz";
    const isCity = cityRoutes.includes(path);
    const priority = path === "" ? 1.0 : isLegal ? 0.4 : isCity ? 0.6 : 0.8;
    return {
      url: `${site.url}${path ? `/${path}` : ""}`,
      lastModified: now,
      changeFrequency: path === "" ? "weekly" : "monthly",
      priority,
    };
  });
}
