import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { cityTypeRoutes } from "@/lib/cities";
import { ARTICLES } from "@/lib/blog";

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
    "ratgeber/ackerland-preis-nrw",
    "ratgeber/pachtpreise-ackerland-nrw",
    "ratgeber/wald-preis-nrw",
    "blog",
    "ueber-uns",
    "kontakt",
    "impressum",
    "datenschutz",
  ];

  const cityRoutes = cityTypeRoutes().map((r) => `${r.type}-verkaufen-${r.city}`);
  const blogRoutes = ARTICLES.map((a) => `blog/${a.slug}`);

  const all = [...coreRoutes, ...cityRoutes, ...blogRoutes];

  return all.map((path) => {
    const isLegal = path === "impressum" || path === "datenschutz";
    const isCity = cityRoutes.includes(path);
    const isBlog = path === "blog" || path.startsWith("blog/");
    const article = ARTICLES.find((a) => `blog/${a.slug}` === path);
    const lastModified = article
      ? new Date(article.updatedAt ?? article.publishedAt)
      : now;
    const priority =
      path === ""
        ? 1.0
        : isLegal
          ? 0.4
          : isCity
            ? 0.6
            : isBlog
              ? 0.7
              : 0.8;
    const changeFrequency: "weekly" | "monthly" =
      path === "" ? "weekly" : isBlog && path !== "blog" ? "monthly" : "monthly";
    return {
      url: `${site.url}${path ? `/${path}` : ""}`,
      lastModified,
      changeFrequency,
      priority,
    };
  });
}
