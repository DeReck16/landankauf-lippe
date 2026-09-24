// Umzug der Lippe-Forst-Anfragen (LL-…) aus dem öffentlichen Blob-Speicher
// „lippe-forst-leads“ (iad1, geteilt mit gewerbe-immobilien-lippe.de) in den
// privaten Speicher „lippe-forst-privat“ (fra1). Pfade bleiben gleich.
//
//   node --env-file=.env.local scripts/leads-migrieren.mjs                  # kopieren + prüfen
//   node --env-file=.env.local scripts/leads-migrieren.mjs --prefix=dev/    # Testkopie für lokal
//   node --env-file=.env.local scripts/leads-migrieren.mjs --alte-loeschen  # zusätzlich alt löschen
//
// Gelöscht wird nur, wenn JEDE Kopie inhaltsgleich im privaten Speicher liegt.
// GIL-Anfragen der Gewerbe-Seite bleiben unangetastet.

import { del, get, list, put } from "@vercel/blob";

const ALT = process.env.BLOB_READ_WRITE_TOKEN;
const NEU = process.env.LF_BLOB_READ_WRITE_TOKEN;
const prefix = process.argv.find((a) => a.startsWith("--prefix="))?.split("=")[1] ?? "";
const altLoeschen = process.argv.includes("--alte-loeschen");

if (!ALT || !NEU) {
  console.error("BLOB_READ_WRITE_TOKEN (alt, öffentlich) und LF_BLOB_READ_WRITE_TOKEN (neu, privat) werden gebraucht.");
  process.exit(1);
}
if (altLoeschen && prefix) {
  console.error("--alte-loeschen nur beim echten Umzug (ohne --prefix).");
  process.exit(1);
}

async function alleBlobs(token, pfad) {
  const out = [];
  let cursor;
  do {
    const page = await list({ prefix: pfad, token, cursor, limit: 1000 });
    out.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

const alt = (await alleBlobs(ALT, "leads/")).filter((b) => /\/LL-[A-Z0-9]+\.json$/.test(b.pathname));
console.log(`${alt.length} LL-Anfragen im öffentlichen Speicher.`);

let kopiert = 0;
let vorhanden = 0;
const fehler = [];
for (const b of alt) {
  const inhalt = await (await fetch(b.url, { cache: "no-store" })).text();
  const ziel = `${prefix}${b.pathname}`;
  const existiert = await get(ziel, { access: "private", token: NEU, useCache: false });
  if (existiert?.statusCode === 200) {
    const neu = await new Response(existiert.stream).text();
    if (neu === inhalt) vorhanden++;
    else fehler.push(`${ziel}: abweichender Inhalt im privaten Speicher`);
    continue;
  }
  await put(ziel, inhalt, { access: "private", token: NEU, contentType: "application/json", addRandomSuffix: false });
  const probe = await get(ziel, { access: "private", token: NEU, useCache: false });
  const text = probe?.statusCode === 200 ? await new Response(probe.stream).text() : null;
  if (text === inhalt) kopiert++;
  else fehler.push(`${ziel}: Kopie nicht inhaltsgleich`);
}
console.log(`kopiert: ${kopiert}, schon vorhanden (gleich): ${vorhanden}, Fehler: ${fehler.length}`);
for (const f of fehler) console.error("  ✗", f);

if (altLoeschen) {
  if (fehler.length > 0) {
    console.error("Nicht gelöscht — erst die Fehler klären.");
    process.exit(1);
  }
  await del(alt.map((b) => b.url), { token: ALT });
  const rest = (await alleBlobs(ALT, "leads/")).filter((b) => /\/LL-/.test(b.pathname));
  console.log(`Im öffentlichen Speicher gelöscht: ${alt.length}. Verbleibende LL-Dateien dort: ${rest.length}.`);
}
