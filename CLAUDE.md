@AGENTS.md

# Lippe Forst (Brand seit 2026-05-01, vormals "Landankauf Lippe")

**Geschäftsmodell:** TR Vertriebs GmbH — Flächenankauf/-pacht, VNS-Beratung, Lohnunternehmer-Vermittlung, Bauland-Beratung im Kreis Lippe und Umland.

## Stack & Deployment
- Next.js 16, TypeScript, Tailwind v4 | Lokal: `/Users/de/landankauf-lippe`
- GitHub: https://github.com/DeReck16/landankauf-lippe
- Vercel: `tr-72439f7a/landankauf-lippe` → `landankauf-lippe.vercel.app`
- Deploy: `VERCEL_TOKEN=<aus 1Password> npx vercel deploy --prod --yes`

## Domain
- **In site.ts konfiguriert:** `lippeforst.de`
- Registrierung via Vercel CLI: `vercel domains buy lippeforst.de`

## Kontakt in Site
- TR Vertriebs GmbH, Bahnhofstr. 70 b, 32805 Horn-Bad Meinberg | HRB 11734 Amtsgericht Lemgo
- Tel: 0176 38803064 | E-Mail: noch offen (Fallback: dennisreckling@t-online.de)

## Lead-Versand
- `components/LeadForm.tsx` → `lib/lead.ts` → Route `app/api/lead/route.ts`: Resend (an `LEAD_TO_EMAIL`) + Formspree + privater Blob
- Jede Anfrage liegt als `leads/<datum>/<LL-ID>.json` im **privaten** Blob-Speicher `lippe-forst-privat` (fra1, Token `LF_BLOB_READ_WRITE_TOKEN`). Der alte öffentliche Speicher `lippe-forst-leads` (`BLOB_READ_WRITE_TOKEN`) gehört nur noch der Gewerbe-Seite (GIL-…).

## Verwaltung `/admin`
- Anmeldung per Einmal-Link an `ADMIN_EMAILS` (HMAC mit `ADMIN_SESSION_SECRET`, Cookie `lf_verwaltung` Pfad /admin, 30 Tage). Link-Seite meldet erst per Knopf an (Mail-Scanner verbrauchen sonst den Link).
- `proxy.ts` = Vorab-Weiche; jede Seite/Action prüft selbst (`lib/admin/session.ts`).
- Zustand (Status, Notizen, Matching-Übersteuerungen, Paare, Orts-Cache, Protokoll) = eine Datei `admin/zustand.json`, geschrieben mit ETag-`ifMatch` (`lib/admin/store.ts`). Veränderliches immer über `frischLesen` holen (Next cached SDK-`get`, und gzip liefert schwache ETags).
- Matching `lib/admin/matching.ts`: gleiche Art (Kauf/Pacht) Pflicht, Flächentyp, Entfernung (Nominatim, gecacht), Größe. Anonyme Hinweistexte `lib/admin/texte.ts` — werden nur kopiert, nie verschickt.
- Lokal: `vercel env pull .env.local --environment=development` + `LF_DATA_PREFIX="dev/"`, Anmeldelink steht dann im Server-Log.
- Jedes Bedienelement bekommt einen `title`-Tooltip.

## Offene To-Dos
- [ ] Domain `lippeforst.de` registrieren + Vercel DNS
- [ ] Geschäfts-E-Mail einrichten + in `lib/site.ts` setzen
- [ ] Resend API Key + Domain verifizieren, ENV in Vercel
- [ ] Google Search Console + Bing Webmaster Tools

## Inhalts-Änderungen
- Routes: `app/<route>/page.tsx` | Site-Config zentral: `lib/site.ts`
- Erklärfilm (iframe `/video/index.html`): Quellen in `video-quelle/*.jsx`, bauen mit `node scripts/erklaerfilm-bauen.mjs` → `public/video/film.js`. React (Produktion) und Schriften liegen selbst gehostet unter `public/video/` — keine CDNs, kein localStorage.
- Marktzahlen (Landingpages, `lib/valuation.ts`, Ortsseiten): Grundstücksmarktbericht Kreis Lippe 2026 (Berichtsjahr 2025); Acker-Mittel im Tool = flächengewichtet 2024/2025.
