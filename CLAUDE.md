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
- Kein Telefon auf der Website und in Kunden-Mails (Dennis 24.09.2026: nur E-Mail/Formular, WhatsApp über `/whatsapp`-Weiterleitung bleibt). Nummer nur serverseitig in `lib/telefon.ts` für Pflichtangaben in Verträgen (Art. 246a EGBGB, Widerrufsbelehrung) | E-Mail: info@tr-immobilien.com (Vertragspartner bleibt TR Vertriebs GmbH)

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
- Dashboard: je neuer Anfrage ohne Paar EIN vorgeschlagener Knopf (`lib/portal/anfrage-vorschlag.ts`: Angebot/Gesuch einladen, Auskunft als beantwortet markieren); „Nachfassen“ (`lib/portal/nachfassen.ts`): Eingang und letzter Kontakt älter als 21 Tage (für Tests `LF_NACHFASS_TAGE=0`), danach 60 Tage Ruhe (`nachgefasstAm` in LeadMeta). Versand immer als Einzelmail über `lib/portal/versand.ts`; reine Auskünfte ohne Kundenakte stehen im Verlauf der Anfrage.
- Rückmeldungen (Tickets): Die Nachfass-Mail enthält einen persönlichen Antwort-Link `/kunde/antwort?t=…` (Token-Zweck `kunde-antwort`, 120 Tage, mehrfach nutzbar, ohne Anmeldung; gespeichert wird erst per Knopf — Mail-Scanner). `lib/portal/rueckmeldung.ts` schreibt `LeadMeta.rueckmeldung` und setzt den Status „Neu“ = offenes Ticket im Dashboard „Rückmeldungen“ (Verkaufen/Verpachten/Suche: Vorschlag wie neue Anfrage, meist „Einladen“; Beratung mit Thema: „Antwort schreiben“ + „Als beantwortet markieren“). „Kein Interesse“ → Erledigt (Börse neu geschrieben). Verkaufen/Verpachten ordnet die Anfrage als Angebot mit passender Art ein (nicht nach Unterschrift). Verwaltung bekommt eine Meldung per Mail. Antworten per E-Mail: Anfrage → „Rückmeldung erfassen“. Schutz: interne Notiz getrennt (`notiz`), max. 20 Link-Antworten/Tag, Verwaltungsmail höchstens stündlich je Anfrage (außer neue Antwort); in laufenden Vorgängen keine Umsortierung, „kein Interesse“ wird dort als `ablehnung` am Paar vermerkt.
- Zur Freigabe (Dennis 25.09.2026: „nur freigeben müssen“): Kachel oben = neue Anfragen + Rückmeldungen. Reine Auskünfte (Bewertung, Solar/Wind, VNS, Bauland, Lohnunternehmer, Allgemein — bei „Allgemein“ zählt die Nachricht) bekommen ein fertiges Antwortschreiben aus `lib/portal/antwort.ts` (Bewertung mit Wertindikation über `lib/valuation.ts`, Bauland über `baulandMittlereLage` in `lib/cities.ts`; Aussagen zu Solar/Wind/VNS/Lohnunternehmer aus `lib/site.ts`). „Freigeben & senden“ bzw. „Text anpassen“ (`AntwortFreigabe.tsx` → `antwortSendenAktion`, Zweck „antwort“, nur bei Status „Neu“). Jede Mail an Interessenten enthält den Bezug auf die ursprüngliche Anfrage (`anfrageBezug` in `lib/portal/entwuerfe.ts`).
- Kataster (`lib/portal/kataster.ts`): Mit Flurstück fragt das System ALKIS NRW (OGC API, Fläche/Nutzung/Lage; `flur` teils ohne, teils mit Nullen) und BORIS NRW (WMS GetFeatureInfo, Bodenrichtwert) ab — beim Eingang (`after` in `/api/lead`) bzw. beim Laden des Dashboards, gemerkt in `LeadMeta.kataster` (Störungen nicht). ALKIS braucht ~5 s je Abfrage. Der Antwortentwurf nimmt dann den amtlichen Bodenrichtwert statt des Kreisdurchschnitts; außerhalb Lippe keine Lipper Werte und keine Vermittlungszusage; Altlasten-Hinweise und Flächentyp aus der Nachricht werden erkannt.
- Flächen einstellen (`/admin/flaechen-einstellen`, `lib/portal/eigene-flaechen.ts`): Flurstücke zeilenweise → Kataster-Vorschau → je Fläche eine Anfrage (Quelle „verwaltung“, Status „In Arbeit“) mit Einwilligung und sofort anonym online.

## Kundenbereich `/kunde` und Vorgänge (Onboarding bis Provision)
- Recht und Begründungen: `docs/recht-onboarding.md`. Vorlagen `lib/vertraege/vorlagen/*` sind versioniert; unterschreibbar nur nach „Vorlage freigeben“ in `/admin/vorlagen` (Freigabe gilt für Version + SHA-256 aller Textvarianten — jede Textänderung hebt sie auf).
- Daten im privaten Blob: `portal/kunden/<LL-ID>.json` (Kundenakte: Einladung, Angaben, Vertrag+Signatur, Widerruf/Kündigung, Mails, Verlauf), `portal/vorgaenge/<angebot>~<gesuch>.json` (Zustimmungen, Freigabe, Pacht/Kauf, Provisionen, Gutschein), `portal/einstellungen.json` (Freigaben, Konditionen mit Versionen, Bewertung, Gutschein), PDFs unter `portal/dokumente/…`. Schreiben immer über `jsonAendern` (ETag), Einmal-Marker mit `allowOverwrite:false`.
- Tokens `lib/portal/token.ts`: eigener Schlüssel aus `ADMIN_SESSION_SECRET` + Zweck-Tag (einladung 30 Tage/widerrufbar, login 20 Min/einmalig, zugang 14 Tage/einmalig, sitzung 14 Tage). Cookie `lf_kunde`, Pfad `/kunde`. Öffentlich ohne Anmeldung: `/kunde/einladung`, `/kunde/anmelden`, `/kunde/widerruf` (§ 356a BGB), `/kunde/kuendigung` (§ 312k BGB), `/kunde/antwort` (Antwort-Link der Nachfass-Mail). Der Kundenbereich setzt `referrer: origin`, damit Token-Adressen nie als Referrer in GA landen.
- Kundenbereich: noindex, kein GA/Ads/WhatsApp (`components/TrackingOnly.tsx`), CSS-Präfix `lfk-`; Verwaltung `lfa-`; Vertragstexte `lfd-`.
- Links zwischen Website und `/kunde` bzw. `/admin` laden immer die ganze Seite neu (`components/BereichsGrenze.tsx`) — sonst bliebe GA aus der Website im Dokument und zählte den Kundenbereich über die History-Erkennung mit (auch nach „Zurück“).
- Anbieter mit mehreren Flächen (`lib/portal/anbieter-gruppe.ts`, Dennis 25.09.2026: „nur 1× einladen“): gleiche E-Mail + Rolle Anbieter + gleiche Art + derselbe Eigentümer laut Anfrage = ein Anbieter (`gleichePerson`: gleicher Nachname, passender Vorname bzw. Initiale, Klammerzusätze wie „(vertreten durch …)“ zählen nicht; die Kundenakte führt dafür `name`). Verschiedene Eigentümer über eine Adresse (z. B. Dennis für Hope) brauchen je eine eigene Vereinbarung. Nur eine Einladung — weitere Anfragen bekommen `einladung.ueber` (als Kopie `kopie: true`, keine Mail; ein früher schon verschickter eigener Link bleibt gültig, Erinnerungen laufen nur über die Quelle). Die Unterschrift gilt für alle (`vertrag.uebernommenVon`, gleiche `dokumentId`), Kündigung/Widerruf ebenso (`aufGleicheVereinbarung` in `ablauf.ts`). Abgleich `anbieterAbgleich` beim Laden des Dashboards, vor Vorgang/Assistent, nach der Unterschrift und nach „Flächen einstellen“; Sperre zusätzlich im Versand (`einladungGesperrt`). Läuft die Quell-Einladung ab, werden die übrigen gelöst bzw. umgehängt; archivierte Anfragen zählen nur als Quelle.
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
