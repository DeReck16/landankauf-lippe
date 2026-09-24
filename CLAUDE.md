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
- Matching `lib/admin/matching.ts`: gleiche Art (Kauf/Pacht) Pflicht, Flächentyp, Entfernung (Nominatim, gecacht), Größe. Anonyme Hinweistexte `lib/admin/texte.ts` sind die Grundlage der Mail-Entwürfe (`lib/portal/entwuerfe.ts`): Senden nur per Klick mit Sicherheitsabfrage (From lippeforst.de, Reply-To `LEAD_TO_EMAIL`, Bcc `ADMIN_NOTIFY_EMAILS`), sonst Mailprogramm/Kopieren. Nie automatisch — außer der Bewertungs-Cron, wenn in Vorlagen eingeschaltet (Standard aus).
- Lokal: `vercel env pull .env.local --environment=development` + `LF_DATA_PREFIX="dev/"`, Anmeldelink steht dann im Server-Log. Mit Präfix oder `NODE_ENV≠production` gilt der Testmodus (`testModus()`): Kunden- und Verwaltungsmails werden nur ins Log geschrieben; mit gesetztem Präfix schickt auch `/api/lead` nichts an Resend/Formspree.
- Jedes Bedienelement bekommt einen `title`-Tooltip. Neues pulsiert je Admin, bis es gesehen ist (`admin/gesehen/<hash>.json`).

## Kundenbereich `/kunde` und Vorgänge (Onboarding bis Provision)
- Recht und Begründungen: `docs/recht-onboarding.md`. Vorlagen `lib/vertraege/vorlagen/*` sind versioniert; unterschreibbar nur nach „Vorlage freigeben“ in `/admin/vorlagen` (Freigabe gilt für Version + SHA-256 aller Textvarianten — jede Textänderung hebt sie auf).
- Daten im privaten Blob: `portal/kunden/<LL-ID>.json` (Kundenakte: Einladung, Angaben, Vertrag+Signatur, Widerruf/Kündigung, Mails, Verlauf), `portal/vorgaenge/<angebot>~<gesuch>.json` (Zustimmungen, Freigabe, Pacht/Kauf, Provisionen, Gutschein), `portal/einstellungen.json` (Freigaben, Konditionen mit Versionen, Bewertung, Gutschein), PDFs unter `portal/dokumente/…`. Schreiben immer über `jsonAendern` (ETag), Einmal-Marker mit `allowOverwrite:false`.
- Tokens `lib/portal/token.ts`: eigener Schlüssel aus `ADMIN_SESSION_SECRET` + Zweck-Tag (einladung 30 Tage/widerrufbar, login 20 Min/einmalig, zugang 14 Tage/einmalig, sitzung 14 Tage). Cookie `lf_kunde`, Pfad `/kunde`. Öffentlich ohne Anmeldung: `/kunde/einladung`, `/kunde/anmelden`, `/kunde/widerruf` (§ 356a BGB), `/kunde/kuendigung` (§ 312k BGB).
- Kundenbereich: noindex, kein GA/Ads/WhatsApp (`components/TrackingOnly.tsx`), CSS-Präfix `lfk-`; Verwaltung `lfa-`; Vertragstexte `lfd-`.
- Links zwischen Website und `/kunde` bzw. `/admin` laden immer die ganze Seite neu (`components/BereichsGrenze.tsx`) — sonst bliebe GA aus der Website im Dokument und zählte den Kundenbereich über die History-Erkennung mit (auch nach „Zurück“).
- Freigabe (= Nachweis) erst, wenn beide unterschrieben und zugestimmt haben; Verbraucher-Suchende zusätzlich Widerrufsfrist + 4 Tage abgelaufen oder ausdrücklicher Beginnwunsch. Nach Widerruf verbirgt der Kundenbereich den Vorgang/die Kontaktdaten wieder.
- Pachtvertrag online (Textform § 585a BGB) → zweite Unterschrift schließt ab: PDF mit beiden Protokollen, Mails, Provision „fällig“ (Konditionen aus dem Vertrag des Suchenden), Treue-Gutschein. Keine Rechnungsnummern im System.
- Cron `vercel.json` → `/api/cron/bewertungen` (Bearer `CRON_SECRET`), sendet nur bei eingeschaltetem Automatikversand und vorhandener Einwilligung.

## Offene To-Dos
- [ ] Domain `lippeforst.de` registrieren + Vercel DNS
- [ ] Geschäfts-E-Mail einrichten + in `lib/site.ts` setzen
- [ ] Resend API Key + Domain verifizieren, ENV in Vercel
- [ ] Google Search Console + Bing Webmaster Tools

## Inhalts-Änderungen
- Routes: `app/<route>/page.tsx` | Site-Config zentral: `lib/site.ts`
- Erklärfilm (iframe `/video/index.html`): Quellen in `video-quelle/*.jsx`, bauen mit `node scripts/erklaerfilm-bauen.mjs` → `public/video/film.js`. React (Produktion) und Schriften liegen selbst gehostet unter `public/video/` — keine CDNs, kein localStorage.
- Marktzahlen (Landingpages, `lib/valuation.ts`, Ortsseiten): Grundstücksmarktbericht Kreis Lippe 2026 (Berichtsjahr 2025); Acker-Mittel im Tool = flächengewichtet 2024/2025.
