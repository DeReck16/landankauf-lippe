import { articlesSorted, CATEGORY_LABEL } from "@/lib/blog";
import { site } from "@/lib/site";

// Statisch beim Build generiert — neue Artikel landen mit dem nächsten Deploy im Feed.
export const dynamic = "force-static";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  const articles = articlesSorted();
  const lastBuildDate = new Date(articles[0]?.publishedAt ?? Date.now()).toUTCString();

  const items = articles
    .map((a) => {
      const url = `${site.url}/blog/${a.slug}`;
      return `    <item>
      <title>${esc(a.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>
      <category>${esc(CATEGORY_LABEL[a.category])}</category>
      <description>${esc(a.description)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(site.name)} — Blog</title>
    <link>${site.url}/blog</link>
    <atom:link href="${site.url}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>${esc(site.shortDescription)}</description>
    <language>de-DE</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
