@AGENTS.md

# Lippe Forst (Brand seit 2026-05-01, vormals "Landankauf Lippe")

**Geschäftsmodell:** TR Vertriebs GmbH — Flächenankauf/-pacht, VNS-Beratung, Lohnunternehmer-Vermittlung, Bauland-Beratung im Kreis Lippe und Umland.

## Stack & Deployment
- Next.js 16, TypeScript, Tailwind v4 | Lokal: `/Users/de/landankauf-lippe`
- GitHub: https://github.com/DeReck16/landankauf-lippe
- Vercel: `tr-72439f7a/landankauf-lippe` → `landankauf-lippe.vercel.app`
- Deploy: `VERCEL_TOKEN=<REDACTED> npx vercel deploy --prod --yes`

## Domain
- **In site.ts konfiguriert:** `lippeforst.de`
- Registrierung via Vercel CLI: `vercel domains buy lippeforst.de`

## Kontakt in Site
- TR Vertriebs GmbH, Bahnhofstr. 70 b, 32805 Horn-Bad Meinberg | HRB 11734 Amtsgericht Lemgo
- Tel: 0176 38803064 | E-Mail: noch offen (Fallback: dennisreckling@t-online.de)

## Lead-Versand
- Server Action `lib/lead.ts` → Resend API
- ENV: `RESEND_API_KEY`, `LEAD_TO_EMAIL`, `LEAD_FROM_EMAIL` (noch nicht in Vercel)
- Bei fehlendem Key: Logging only, Form zeigt Erfolg

## Offene To-Dos
- [ ] Domain `lippeforst.de` registrieren + Vercel DNS
- [ ] Geschäfts-E-Mail einrichten + in `lib/site.ts` setzen
- [ ] Resend API Key + Domain verifizieren, ENV in Vercel
- [ ] Google Search Console + Bing Webmaster Tools

## Inhalts-Änderungen
- Routes: `app/<route>/page.tsx` | Site-Config zentral: `lib/site.ts`
