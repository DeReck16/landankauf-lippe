# Prozess-Review Lippe Forst: vom Lead bis zur Provisionsrechnung

**Stand 03.11.2026, 08:20–09:30 Uhr · nur lesend · Betreiber TR Vertriebs GmbH · automatischer Lauf (Auftrag Dennis Reckling, 02.11.2026)**

Der Bericht enthält keine Kundennamen, Adressen, Telefonnummern oder Mailtexte, nur LL-IDs, Art und Ort. § 34c GewO und Geldwäsche (AML) wurden nicht geprüft; sie laufen im Backoffice und werden nur genannt, wo ein Prozessschritt von ihnen abhängt. Alle Vorschläge, die Verträge, Preise oder Zusagen berühren, sind als **Frage an Dennis** markiert und nicht entschieden.

## Kurzfassung

Der Weg bis zur Freigabe ist sauber gebaut. Jeder Schritt hat einen Auslöser, eine Sperre und einen sichtbaren Stand. Dahinter wird es dünn. Der Weg **nach der Freigabe** hängt fast vollständig an zwei Dingen:

1. **Dennis klickt** (Abschluss erfassen, Provision abrechnen, Zahlung vermerken).
2. **Eine Routine läuft** (Stand-Nachfrage, Mail-Abgleich, Radar-Bericht). Laut Routinenliste ist sie heute **ausgeschaltet**.

Die drei wichtigsten Lücken:

1. **Ein gemeldeter Abschluss kann als „kein Interesse“ enden** (G1). Eine Mail wie „Die Fläche ist verkauft, wir haben beim Notar unterschrieben“ wird vom Mail-Klassifikator als Absage eingestuft; das habe ich lokal ausgeführt. Der Vorgang fällt dann aus Radar und Stand-Nachfrage, obwohl der Nachweis noch 24 Monate gilt (G2).
2. **Die Strecke Provision → Rechnung → Zahlung hat keine Fristen, keine Eskalation und kein Mahnwesen** (G4). Die Rechnung entsteht außerhalb. Der Weg dorthin ist eine Info-Mail ohne Rechnungsdaten, und der Weg zurück ist ein manueller Klick. Der Ablauf wurde nie über „fällig“ hinaus durchgespielt, weil es noch keinen echten Abschluss gibt.
3. **Niemand führt heute die Routinen aus** (G3). `lippeforst-tagesbearbeitung` steht auf „aus“ und ist nie gelaufen. `lippeforst-postfach-abgleich` steht nicht mehr in der Liste, und das Log endet am 29.10. Die erste Stand-Nachfrage ist am **09.11.** fällig, und ohne Auslöser passiert nichts.

---

## 0. Was geprüft wurde und was nicht

| Geprüft | Wie |
|---|---|
| Code | `CLAUDE.md`, `docs/recht-onboarding.md`, `lib/portal/{schritte,assistent,aufgaben,radar,automatik-regeln,dashboard,nacharbeit,vorgang,nachfassen,postfach-text,rueckmeldung,model}.ts`, `lib/vertraege/vorlagen/*`, `app/api/cron/taeglich`, `app/api/lead`, `app/kunde/actions.ts` |
| Board heute | `lf_board.py ich`, `lesen`, `vorgaenge` (nur lesend, 49 Anfragen, 9 Paare/Vorgänge) |
| Routinen | `list_scheduled_tasks` (nur lesend) |
| Tests | `npm test` mit lokalem Testspeicher im Temp-Ordner: **161 von 161 bestanden** |
| Eigene Probe | Absage-Erkennung lokal an vier Beispielsätzen (siehe G1); Probe-Datei nur im Scratchpad, nicht im Repo |
| Zweitmeinung | Codex, anonymisierte Beschreibung ohne Code und ohne Kundendaten (Abschnitt 5) |

**Nicht geprüft:** Admin-Oberfläche (Login nur Dennis), echte Kundenakten im Blob, Resend-Zustellprotokoll, wie die Buchhaltung die Rechnung erstellt, Wirksamkeit der Vertragsklauseln (Anwaltssache), § 34c und AML. Die Dashboard-Optik habe ich nicht gesehen.

---

## 1. Prozesslandkarte

Legende: **S** = System, **R** = Claude-Routine/Skill, **D** = Dennis (Admin), **B** = Buchhaltung (außerhalb des Systems).

| # | Schritt | Wer löst aus | Woran erkennt man Stillstand? | Absage / Widerruf / Schweigen | Frist oder Nachfassen |
|---|---|---|---|---|---|
| 1 | **Lead** (Formular oder Mail) | S: Formular schreibt in Blob, Resend und Formspree (drei Kanäle parallel). Mails ohne Formular kommen nur über den Postfach-Abgleich (R). | Dashboard „Zur Freigabe“; Aufgabe wird nach einem Werktag als überfällig markiert. | Spam und Tests: Archiv (D/R). | Zusage „in der Regel binnen eines Werktags“. |
| 2 | **Eingangsbestätigung** und inhaltliche Antwort | S: Bestätigung automatisch (höchstens 2 je Adresse und Tag, Postausgang mit Wiederholung). Antwort: D oder R (Entwurf, bei Bewertungen Versand). | Antwort-Frist im Dashboard (nur sichtbar, wenn jemand hinschaut). | Kein Interesse: Erledigt, nie wieder anschreiben. | Nachfassen nach 21 Tagen (einmal), danach 60 Tage Ruhe. |
| 3 | **Einladung, Vereinbarung/Nachweisvertrag unterschreiben** | D oder R („Einladen“); S nur über Automatik R3 (aus). | Vorgang wartet im Schritt 3/7; Chip „Link abgelaufen“. | Widerruf (Verbraucher 14 Tage) und Kündigung jederzeit; „Vorgang sperrt“. Schweigen: **nichts** (G8). | Link 30 Tage; Erinnerung frühestens nach 2 Tagen, keine Höchstzahl. |
| 4 | **Börse und Matching** | S: Matching-Vorschläge; R oder D: Vormerken (R2 aus). Börse: Einwilligung des Eigentümers, anonym. | Vorschläge in „Neue Vorschläge“. | Verwerfen (Notiz). Angebote ohne Paar bleiben online (G14). | keine |
| 5 | **Anonyme Hinweise** | D oder R (Knopf `hinweise`); S: R4 (aus). | Schritt 4/7; „Erinnerung frühestens ab …“. | „Kein Interesse“ am Paar: keine Hinweise und keine Erinnerungen mehr. | Erinnerung nach 2 Tagen möglich, keine Höchstzahl. |
| 6 | **Zustimmung beider Seiten** (und aller Miteigentümer) | Kunde im Kundenbereich; D erfasst Telefon-Zustimmungen. **Miteigentümer: kein Systemfeld** (G6). | Schritt 4/7 „Zustimmungen fehlen“. | Ablehnung wird als `ablehnung` am Paar vermerkt. | keine |
| 7 | **Freigabe und Mitteilung** | D oder R (`freigeben`, `freigabe-mitteilen`; bei Kauf nur mit Recht `board:vorgang-kauf` und `kauf:true`); S: R5 (aus). Prüfpunkte: zwei Unterschriften, zwei Zustimmungen, Paar aktiv. | Hinweis „Freigabe-Mitteilung noch nicht gesendet“. | Freigabe kann zurückgezogen werden, **nicht** mehr nach einem Abschluss. | keine |
| 8 | **Stand-Nachfrage und Radar** (neu seit 02.11.) | R oder D (Knopf `abschluss-nachfragen`); **kein serverseitiger Auslöser** (R6 gibt es nicht). | Dashboard „Auf dem Radar“ mit den Stufen gemeldet, Hinweis, ruhig, frisch. Kein Push. | **„Kein Interesse“ oder „beendet“ schaltet Radar und Nachfrage ab** (G1, G2). | Tag 7 nach Freigabe, dann +14 Tage, dann alle 60 Tage, bis 24 Monate. |
| 9 | **Abschluss**: Pacht online, Kauf beim Notar, außerhalb | Pacht: S (zweite Unterschrift). Kauf: **D** erfasst Beurkundung mit Kaufpreis, danach „Kauf ist wirksam“ bei GrdstVG-Genehmigung. Außerhalb: **D** („Außerhalb geschlossen erfassen“). Per API nicht möglich. | Kundenmeldung: Dashboard Prio 1 plus Info-Mail. Alle anderen Wege: nur Radar. | Kaufabbruch storniert Provision nur im Status aufschiebend oder fällig. | Pachtanzeige binnen 1 Monat (Dashboard-Hinweis). |
| 10 | **Provision**: Berechnung, Gutschein | S: legt `Provision` an (Status „fällig“ bzw. „aufschiebend“), berechnet nach den Konditionen im Vertrag des Suchenden, gibt den 100-€-Gutschein aus, schickt eine Info-Mail an die Verwaltung. | Dashboard Prio 2 (€) „Provision abrechnen“. | Widerruf des Suchenden: Provision nur „aufschiebend“ vorgemerkt, kein Gutschein. Eigene Fläche: keine Provision. | keine |
| 11 | **Provisionsrechnung** | **B** (extern, keine Rechnungsnummer im System). D trägt danach Rechnungsdatum und Zahlungsziel ein („Als abgerechnet markieren“). | „Fällig“ bleibt unbegrenzt stehen (G4). | Streit/Storno nur per Hand (`provisionStatusSetzen`). | keine Frist „Rechnung binnen X Tagen“. |
| 12 | **Zahlungseingang und Mahnung** | **D** („Als bezahlt markieren“), keine Bankanbindung. | Rote Zeile „Zahlung überfällig seit …“ im Dashboard; **keine Mail, kein Push**. | Kein Mahnwesen, keine Verzugslogik, keine Vorlage. | Zahlungsziel 14 Tage (Standard, änderbar 1–120). |
| 13 | **Bewertungsbitte** (und Pachtanzeige) | S oder D: Bitte 3 Tage nach Abschluss, nur mit Einwilligung (Automatikversand aus, also Knopf). | Knopf „Um Google-Bewertung bitten“. | „Keine Bewertungsbitte“ möglich. | einmalig |

---

## 2. Die Strecke Abschluss → Provision → Rechnung im Detail

**Wer erstellt die Rechnung?** Die Buchhaltung, außerhalb des Systems. Die Notizen und der Code sagen übereinstimmend „hier wird keine Rechnungsnummer vergeben“. Wer die Buchhaltung ist und in welchem System sie arbeitet, steht nirgends (Frage 2).

**Wie kommt „Abschluss“ dorthin?** Es gibt genau einen Kanal, die Info-Mail `adminInfo(...)` an `ADMIN_NOTIFY_EMAILS` (laut Notiz info@tr-vertrieb.de). Sie enthält Vorgangsnummer, maßgebliche Jahrespacht bzw. Kaufpreis, Provision netto und brutto, **den Namen** des Schuldners, den Hinweis „Rechnung bitte über die Buchhaltung stellen“ und einen Dashboard-Link, der einen Admin-Login braucht. **Nicht enthalten:** Rechnungsanschrift, Verbraucher/Unternehmer-Status, USt-ID/Steuernummer, Leistungsbeschreibung, Zahlungsziel und ein Hinweis auf einen angerechneten Gutschein. Diese Daten liegen in der Kundenakte (`stammdaten`), werden aber nicht übergeben. Beim Kauf geht die Mail bei Beurkundung (aufschiebend) und noch einmal bei „wirksam“. Die Abschluss-Mail an den Pächter nennt den Betrag und „zahlbar 14 Tage nach Zugang der Rechnung“. Bei Kauf und bei „außerhalb“ geht an den Suchenden **keine** automatische Betragsmail.

**Was löst die Status aus?**

| Status | Auslöser | Folge im System |
|---|---|---|
| `fällig` | Pacht: zweite Unterschrift (S). Kauf: Beurkundung ohne Genehmigungspflicht oder „Kauf ist wirksam“ (D). Außerhalb: Erfassung (D). | Dashboard Prio 2, Info-Mail. **Keine Frist, keine Eskalation.** |
| `aufschiebend` | Kauf beurkundet, Genehmigung offen; oder Widerruf des Suchenden | Aufgabe „Kauf ist wirksam“ erst bei Klick; Wiedervorlage nur über die Radar-Aufgabe. |
| `abgerechnet` | **D** trägt Rechnungsdatum und Zahlungsziel ein | Vorgang wandert nach „Warten“. Nach Fristablauf wieder nach „Jetzt dran“ mit der Zeile „überfällig“. |
| `bezahlt` | **D** klickt | Vorgang erledigt; Bewertungsbitte-Knopf wird frei. |
| `storniert` | D (Kaufabbruch oder per Hand) | Anspruch wird nicht geltend gemacht. |

**Wie sieht Dennis überfällige Rechnungen?** Nur im Dashboard (Aufgabenliste Prio 2 mit „€“ und Zeile „Zahlung überfällig seit …“) und in der Übersicht „Vorgänge“ (Summen und Tabelle der Provisionen). Es gibt keine Mail, keinen Push und keinen Wochenbericht für zeitbasierte Zustände, und die Routine meldet sie auch nicht. Ob sie je gemeldet wurde, ist unbekannt, weil es noch keine echte Provision gibt.

**Wie werden Abschlüsse erkannt, die niemand meldet?**

| Signal | Erkennt es das System? |
|---|---|
| Kunde meldet im Kundenbereich („Vertragsschluss melden“) | **Ja**, Dashboard Prio 1 plus Info-Mail. Das Formular fragt aber nur Art, Datum, Fläche, Betrag und Laufzeit. Der Vertrag (§ 4) verlangt zusätzlich den **Vertragspartner**. Flurstücke und Belege werden nicht abgefragt. |
| Kunde meldet per **Mail** | **Teilweise**: Der Klassifikator hat keine Kategorie „Abschluss“. „Der Pachtvertrag wurde unterschrieben“ ergibt „selbst einordnen“. „Die Fläche ist verkauft, wir haben beim Notar unterschrieben“ ergibt **kein Interesse** (G1). |
| Fläche aus Börse genommen oder Anfrage „Erledigt“ nach der Freigabe | **Ja**, Radar-Stufe „Hinweis“, aber nur im Dashboard (kein Push). |
| Stand-Nachfrage (Tag 7, +14, dann alle 60) | **Nur wenn jemand den Knopf drückt**. Heute kein Träger (G3). |
| Mitteilungspflicht 14 Tage (Anbieter-Vereinbarung § 4, Nachweisvertrag § 4) | Nur als Hinweis in der Nachfrage-Mail ab der zweiten Runde. Es gibt **keinen Zähler** „14 Tage seit Abschluss“, weil das Abschlussdatum nur der Kunde kennt. |
| Schutzfrist 24 Monate | Die Nachfrage endet 24 Monate nach Freigabe. Die gesetzliche Verjährung des Provisionsanspruchs läuft länger (G16). |
| Umgehung nach „kein Interesse“ oder „beendet“ | **Nein** (G2). |
| Kauf: Gegenprüfung über Notar oder Grundbuch | **Nein**. Die Vorlagen enthalten keine Maklerklausel und keine Bitte an den Notar, den Beurkundungstermin mitzuteilen. Eine Registerkontrolle ist nicht allgemein möglich (G5). |

**Wer erfasst den Abschluss, wenn er außerhalb geschlossen wurde?** Nur Dennis im Admin („Außerhalb geschlossen erfassen“). Das ist per API gesperrt. Die Routine kann es nur im Bericht melden („Zu tun im Admin“). Der Bericht löst nur einen Push aus, wenn Entwürfe oder ein Match auf Dennis warten, **nicht** bei Radar-Stufe „gemeldet“ oder „Hinweis“ (SKILL Schritt 6, G11).

---

## 3. Lückenliste

Aufwand: **S** unter einem halben Tag · **M** 1–2 Tage · **L** mehr. Fragen sind als „→ Frage“ gekennzeichnet.

### Priorität hoch

| ID | Lücke und Beleg | Risiko | Vorschlag | Aufwand |
|---|---|---|---|---|
| **G1** | **Abschluss-Mail wird als Absage gewertet.** `KEIN_INTERESSE` in `lib/portal/postfach-text.ts` enthält „ist/sind/wurde verkauft/verpachtet/vergeben“. Lokal geprüft: „Wir haben den Kaufvertrag beim Notar unterschrieben, die Fläche ist verkauft.“ → `kein-interesse`; „Die Fläche ist inzwischen verkauft worden.“ → `kein-interesse`; „Der Pachtvertrag wurde gestern von beiden Seiten unterschrieben.“ → keine Kategorie; „Wir haben den Vertrag geschlossen.“ → keine Kategorie. Im laufenden Vorgang setzt „Übernehmen“ `meta.ablehnung`. Folgen: `radarFuer` gibt `null` (`abgelehnt`), und `nachfrageAktion` gibt `null` (Zeile `if (b.ctx.meta?.ablehnung) return null`). | Ein echter Abschluss verschwindet vom Radar; die Provision wird nicht erfasst. | Neue Kategorie „Abschluss gemeldet“ im Klassifikator, die vor „kein Interesse“ greift (Wörter: unterschrieben, geschlossen, beurkundet, Notar, Pachtvertrag, Kaufvertrag, verkauft **an** …). Übernahme erzeugt eine `KundenMeldung(art: "abschluss")` und damit Prio 1 und Info-Mail. „Verkauft/verpachtet“ nach einer aktiven Freigabe nie als Absage behandeln, sondern als Radar-Stufe „Hinweis“. Tests ergänzen. | S |
| **G2** | **Absage oder „Beenden“ nach der Freigabe löscht die Überwachung.** Der Nachweis gilt 24 Monate (Anbieter-Vereinbarung § 4, Nachweisvertrag § 4). `radarFuer` gibt `null` bei `v.beendet`, `meta.ablehnung`, `v.abschluss`. „Zur Kenntnis — Paar ruhen lassen“ und „Vorgang beenden“ haben keinen Nachlauf. Klassisches Umgehungsmuster: erst „kein Interesse“, später direkter Abschluss. | Provision geht über Umgehung verloren, ohne dass es jemand sieht. | **Spätkontrolle statt Stopp:** Für freigegebene Vorgänge ohne Abschluss, die abgelehnt oder beendet sind, einen stillen Prüftakt (z. B. nach 6, 12, 18 und 24 Monaten). Die Prüfung ist ein Dashboard-Hinweis plus Zeile im Routinenbericht: Ist die Fläche noch in der Börse? Wurde die Anfrage „Erledigt“? Optional eine Frage nur an den **Anbieter** („Ist die Fläche inzwischen vergeben?“). → **Frage 6** | M |
| **G3** | **Kein belegbarer Träger für die Routinen.** `list_scheduled_tasks` am 03.11.: `lippeforst-tagesbearbeitung` ist `enabled: false` und hat nie ein `lastRunAt` (Mo–Fr 14:30 eingetragen); `lippeforst-postfach-abgleich` steht **nicht mehr** in der Liste; `postfach-uebernahme-3-tage` ist aus (laut Notiz „Grok-Bot wieder aktiv“); das Log `~/Library/Logs/lippeforst-postfach.log` endet am 29.10. 09:07. Gleichzeitig kam am 02.11. 19:29 ein Postfach-Ticket ins Board, also füttert irgendetwas den Abgleich (vermutlich der Bot, nicht belegt). Die Stand-Nachfrage hat keinen serverseitigen Auslöser. Die erste ist am **09.11. um 16:30** fällig (Vorgang `LL-MTWPVRUJ~LL-MUWG4JYV`). | Absagen, Zustimmungen und Abschlussmeldungen per Mail erreichen das Board nur zufällig; Nachfragen unterbleiben; Leads bleiben liegen. | Entscheidung, wer täglich liest und nachfragt (Bot oder Routine). Dazu serverseitig **R6 „Stand-Nachfrage“** im bestehenden Tages-Cron (die Funktion `nachfrageAktion` und die Mail-Vorlage gibt es schon) und ein **Wächter**: Hat der Abgleich länger als 2 Werktage nichts gemeldet, erscheint eine Dashboard-Aufgabe. → **Frage 1** | S–M |
| **G4** | **Rechnungsübergabe, Frist, Zahlung, Mahnung.** (a) Info-Mail ohne Rechnungsdaten (Abschnitt 2). (b) Status `fällig` hat keine Frist und keine Eskalation. (c) Rückkanal nur durch Klick (`abgerechnet`, `bezahlt`). (d) Es gibt kein Mahnwesen (`grep` nach „mahn“ findet nichts), keine Verzugsregel, keine Mail oder Push bei „überfällig“, keine Bankanbindung. (e) Der Ende-zu-Ende-Test (E2E-Simulation 24.09.) endet bei „fällig“; `tests/provision.test.ts` prüft nur die Berechnung. | Provision wird nie in Rechnung gestellt oder nie gemahnt; Dennis erfährt es nur, wenn er das Dashboard öffnet. | (1) **Übergabepaket** in der Info-Mail: Name, Anschrift, Unternehmer/Verbraucher, Betrag netto/brutto, USt-Satz, Leistung („Nachweis Pachtvertrag über …“), Gutschein-Abzug, Zahlungsziel, Rechnungsempfänger-E-Mail. Die Rechnungsnummer darf extern bleiben. (2) Schwelle „fällig seit mehr als 7 Tagen ohne Rechnung“ → Dashboard Prio 1 und Zeile im Routinenbericht. (3) Eine Mail/Push an Dennis, sobald `abgerechnet` überfällig ist. (4) Mahnstufen nur, falls Mahnwesen nicht bei der Buchhaltung liegt. → **Frage 2** | M |
| **G5** | **Kauf: Abschluss nur per Selbstmeldung.** Die Vorlagen (`nachweis.ts`, `kaufabsicht.ts`) enthalten keine Maklerklausel für den Kaufvertrag und keine Bitte an den Notar, Beurkundung oder Abschrift mitzuteilen. Die Kaufabsicht erlaubt die Weitergabe der Eckdaten an den Notar, aber niemand sendet sie. 16 der 28 Angebote sind Kauf. | Bei Kauf (3,59 % des Kaufpreises) lässt sich ein Abschluss ohne Meldung nicht feststellen. Registerabfragen sind nicht allgemein möglich. | Vertragsthema, **keine Systemänderung allein**: Maklerklausel-Textbaustein und ein kurzer Notarhinweis in der Kaufabsicht ergänzen (jede Textänderung hebt die Freigabe auf, Anwaltsprüfung). Im System bleibt es bei Meldung plus Stand-Nachfrage. → **Frage 4** | M (Text) |
| **G6** | **Miteigentümer sind im Datenmodell nicht vorhanden.** `freigabePruefung` prüft zwei Unterschriften, zwei Zustimmungen und „Paar aktiv“. Die Zustimmung weiterer Eigentümer belegt nur die Routine anhand von Mails. Laut Notiz war bei der Freigabe am 02.11. das Einverständnis einer Miteigentümerin zur Weitergabe ihrer Daten noch offen (Freigabe durch Dennis selbst). | Weitergabe von Daten ohne Einwilligung; Kauf von nur einem Miteigentümer; Freigabe nicht technisch gestoppt. | Pflichtfeld „Weitere Eigentümer: nein / ja, alle haben zugestimmt am …“ je Angebot, als Prüfpunkt in `freigabePruefung` und als Bedingung der API-Freigabe (Kauf). → **Frage 5** | M |

### Priorität mittel

| ID | Lücke und Beleg | Vorschlag | Aufwand |
|---|---|---|---|
| **G7** | **Mehrere Paare je Angebot laufen nach der Freigabe weiter.** Im Code gibt es dazu nur den Hinweis in der Matching-Ansicht („bereits vergeben“, `matching.ts`); Assistent, Automatik und API sperren nichts. Praxis: `LL-MTWPVRUJ` hat 4 Paare, eines ist **freigegeben** (`…~LL-MUWG4JYV`), bei `…~LL-MVE593TU` sind die anonymen Hinweise schon bei beiden raus, zwei weitere sind vorgemerkt. Einigt sich auch dieses Paar, entstehen zwei Nachweise für dieselbe Fläche. Codex stufte das „hoch“ ein; ich lasse es bei **mittel (hoch ab dem ersten Abschluss)**, weil kein Provisionsverlust droht, wohl aber ein Käufer schlecht behandelt würde. | Beim Freigeben oder Abschluss eines Paars die übrigen Paare derselben Fläche als Aufgabe „Konkurrenz: ruhen lassen? Andere Seite informieren?“ anzeigen; Hinweise und Freigabe für diese Paare sperren (per API wie im Admin). → **Frage 3** | S–M |
| **G8** | **Wartende Vorgänge ohne Ablauf.** Erinnerungen haben nur 2 Tage Mindestabstand, keine Höchstzahl, keine Eskalation. R7 (höchstens 2 Erinnerungen) ist aus. Einladungslinks verfallen nach 30 Tagen. Praxis: zwei Pacht-Paare warten seit 24.09. (40 Tage, Link am 24.10. abgelaufen), zwei Kauf-Paare seit 25.09. und 29.09. | Aufgabe „Wartet seit mehr als 21 Tagen“: Rückfrage „weiter interessiert?“ oder „Paar ruhen lassen“; abgelaufene Links per Knopf erneuern (geht schon, API `erinnern`); Höchstzahl und danach Ruhe. | S |
| **G9** | **Beweis- und Meldedaten dünn.** Das Meldeformular fragt Art, Datum, Fläche, Betrag, Laufzeit, aber nicht Vertragspartner, Flurstücke oder Beleg (der Vertrag § 4 verlangt den Vertragspartner). Das Ereignisprotokoll je Vorgang ist auf 300 Einträge gekappt (`EREIGNIS_MAX`), es gibt keinen Export als Nachweispaket. Vorhanden und gut: Zeitstempel der Freigabe, SHA-256 der Vertragstexte, Unterschriftsprotokolle, alle gesendeten Mails im Vorgang. | Meldeformular um Vertragspartner und optionalen Beleg ergänzen; „Nachweispaket“ je Vorgang (Freigabe, Zustimmungen, Vertragsfassung, Mails) als PDF/ZIP exportierbar machen. | M |
| **G10** | **Rückabwicklung und Storno nach der Rechnung.** `kaufAbbrechen` storniert nur `aufschiebend` und `fällig`; für `abgerechnet` und `bezahlt` gibt es nur die manuelle Statusänderung, keinen Gutschrift-/Storno-Pfad. | Status „zu erstatten/Gutschrift“ oder Notizpflicht beim Storno einer abgerechneten Provision. | S |
| **G11** | **Zeitbasierte Zustände lösen keine Benachrichtigung aus.** Info-Mails gibt es nur zu Ereignissen (Abschluss gemeldet, Provision fällig, Freigabe …). Radar-Stufen „gemeldet/Hinweis“, „fällig seit …“, „überfällig“ und „Pachtanzeige überfällig“ stehen nur im Dashboard; der Routinenbericht pusht nur bei Entwürfen oder Match der Stufe A. | Ein **Wochen-Digest** (Mail oder Push) „Offene Geldposten und Radar“ aus dem bestehenden Cron; Routinenbericht: Push auch bei Radar „gemeldet/Hinweis“. | S |
| **G12** | **Keine Zustellkontrolle.** `sendeMitPostausgang` meldet nur die Annahme beim Mail-Dienst; ein Webhook für Bounces oder Zustellung existiert nicht. Einladung, Freigabe oder Rechnungsmail können unbemerkt nicht ankommen. | Resend-Webhook (bounced, complained) → Kundenakte „unzustellbar“ und Dashboard-Aufgabe. | M |
| **G13** | **Antwortzusage und Routinen-Takt.** Die Website sagt „in der Regel innerhalb eines Werktags“; die Tagesbearbeitung läuft (wenn aktiv) Mo–Fr einmal um 14:30 und nur bei offener App. Ein Lead am Freitagnachmittag wartet bis Montag 14:30. Die Eingangsbestätigung ist automatisch, die inhaltliche Antwort nicht. | Zweiter Lauf am Vormittag oder die Zusage anpassen (→ **Frage 8**, Websitetext ist Dennis' Entscheidung). | S |
| **G14** | **Angebote und Gesuche ohne Paar haben keinen Aktualitätscheck.** Von 28 Angeboten stehen 27 online, 22 haben kein Paar und 19 keinen Weg („Selbst kaufen“/„Vermitteln“); zwei Gesuche ohne Paar warten seit 36 und 66 Tagen. Nachfassen gilt nur für nicht unterschriebene Anfragen. | „Noch aktuell?“-Abfrage alle 6 Monate für online stehende Angebote und Gesuche (Antwort-Link gibt es schon). → **Frage 10** (Weg-Entscheidung) | S–M |

### Priorität niedrig

| ID | Lücke | Vorschlag | Aufwand |
|---|---|---|---|
| **G15** | Bewertungsbitte kommt 3 Tage nach Abschluss, also vor Rechnung und Zahlung (`bewertungFaellig`); der Gutschein wird sofort ausgegeben. Reputationsrisiko, falls die Rechnung Streit auslöst. | Bitte erst nach „bezahlt“ (→ **Frage 7**) | S |
| **G16** | Die Nachfrage endet 24 Monate nach der Freigabe. Die gesetzliche Verjährung ist ein anderer Zeitraum (`docs/recht-onboarding.md` Abschnitt 2 sagt das selbst: „allgemeine Regeln“). Das System kennt kein Verjährungsdatum. | Wiedervorlage je Freigabe mit dem Datum „Ende Verjährung“ (Rechtsfrage, → **Frage 9**) | S |
| **G17** | Pachtanzeige: Überfälligkeit nur im Dashboard (Prio 1), keine Mail an Dennis. | Gehört zum Digest (G11). | S |

---

## 4. Stand der Praxisprobe (nur lesend, 03.11.2026 ~09:20)

**Bestand:** 49 Anfragen (28 Angebote, 8 Gesuche, 11 Bewertungen, 2 Auskünfte); Status 41 beantwortet, 8 in Arbeit, **keine „neu“**. Kundenbereich: 20 ohne Einladung, 16 eingeladen, 3 geöffnet, 10 unterschrieben. 9 Paare, 9 Vorgänge. Dashboard: **1 offene Aufgabe** (Postfach-Text „nur in der Verwaltung“, seit 02.11. 19:29). Matching-Vorschläge 0. Automatik: Probelauf an, alle Regeln aus, Rechtsschalter gesetzt. Zugang „Claude ALL“ hat `board:vorgang-kauf`.

**Jeder Vorgang hängt irgendwo im Ablauf, einen belastbaren Auslöser haben aber nur die frischen:**

| Vorgang | Schritt | wartet seit | Radar / nächster Auslöser | Befund |
|---|---|---|---|---|
| `LL-MTWPVRUJ~LL-MUWG4JYV` (Kauf) | 6/7 | Freigabe 02.11. | **frisch**, Nachfrage fällig ab 09.11. 16:30; API-Knopf `abschluss-nachfragen` möglich | Auslöser fehlt (G3); Miteigentümer-Beleg nur außerhalb des Systems (G6) |
| `LL-MTWPVRUJ~LL-MVE593TU` (Kauf) | 4/7 | 01.11. | kein Radar | Hinweise bei beiden raus, **obwohl die Fläche schon freigegeben ist** (G7) |
| `LL-MTWPVRUJ~LL-MVMLXX5U` (Kauf) | 3/7 | 01.11. | keiner | Erinnerung frühestens 03.11. 13:55; Konkurrenz (G7) |
| `LL-MTWPVRUJ~LL-MVEQL1HJ` (Kauf) | 3/7 | 01.11. | keiner | wie oben |
| `LL-MRCA71FZ~LL-MVEQL1HJ` (Kauf) | 3/7 | 01.11. | keiner | beide eingeladen; Erinnerung frühestens 03.11. 14:57 |
| `LL-MSLH3AOJ~LL-MUMERDD9` (Kauf) | 3/7 | 29.09. (35 Tage) | keiner | Erinnerung per API nicht möglich (`nurMitKauf`), kein Ablauf (G8) |
| `LL-MTVDXWUY~LL-MUMERDD9` (Kauf) | 3/7 | 25.09. (39 Tage) | keiner | Angebot ohne Weg-Entscheidung; Link abgelaufen (G8, G14) |
| `LL-MUAZVDBM~LL-MU4LFXV7` (Pacht) | 3/7 | 24.09. (40 Tage) | keiner | Link am 24.10. abgelaufen; `erinnern` API-fähig, aber nicht „dran“ (G8) |
| `LL-MSEVEJ2M~LL-MU4LFXV7` (Pacht) | 3/7 | 24.09. (40 Tage) | keiner | wie oben |

**Weitere Beobachtungen:**

- **Radar:** 1 von 9 Vorgängen ist freigegeben und damit auf dem Radar (Stufe „frisch“, Tag 1). Die anderen 8 sind noch nicht dort, was korrekt ist.
- **Wartende Unterschriften:** alle 8 Vorgänge im Schritt 3 oder 4 sind erfasst; die vier ältesten (35–40 Tage) haben keine Eskalation.
- **Gesuche ohne Paar:** `LL-MUK5PAEB` (Kauf, 36 Tage) und `LL-MTDE7SYW` (Pacht, 66 Tage): kein Suchauftrags-Check.
- **Angebote ohne Paar und ohne Weg:** zwei Kauf-Angebote sind unterschrieben und online (`LL-MUDXG0QO`, `LL-MUDWPZYV`); ihr Weg ist offen. 6 Angebote „in Arbeit“ sind laut Notiz eigene Flächen der Verwaltung und brauchen keine Antwort.
- **Bewertungsanfragen:** alle 11 sind beantwortet; kein Nachlauf nötig.
- **Tests:** `npm test` 161/161 grün (u. a. `radar`, `stand-nachfrage`, `provision`, `aufgaben`). Die Tests prüfen aber nicht den Pfad „Mail-Antwort → Ablehnung → Radar“ (G1) und nicht den Pfad „abgerechnet → überfällig → bezahlt“ über Zeit.
- **Eigene Probe (G1):** vier Beispielsätze gegen `postfachVorschlag` lokal ausgeführt, siehe G1. Sie nutzt nur Funktionen ohne Speicher und keine Produktionsdaten.

---

## 5. Zweitmeinung Codex (anonymisiert)

Gesendet wurde die anonymisierte Prozessbeschreibung samt Lückenliste A–L (ohne Code, ohne Kundendaten, ohne Zugangsdaten, kein Repo-Zugriff). Die Antwort habe ich gegen den Code geprüft.

**Was Codex meldete und ich bestätigt habe**

| Codex | Prüfung |
|---|---|
| A „verkauft“ darf nicht als Ablehnung enden | **Bestätigt, lokal reproduziert** (G1). |
| B „beendet“ darf die Schutzfristüberwachung nicht löschen | **Bestätigt** (`radarFuer`, `nachfrageAktion`, G2). |
| D Rechnungsdaten und Frist bis zum Geldeingang | **Bestätigt** (Info-Mail ohne Anschrift, Unternehmerstatus, Zahlungsziel; keine Frist für `fällig`, G4). **Einschränkung:** Die Daten liegen in der Kundenakte; die Info-Mail muss nicht alles enthalten, wenn die Buchhaltung anderweitig Zugriff hat. Ob sie das hat, ist offen. |
| G Miteigentümer nur per Mail-Beleg | **Bestätigt** (`freigabePruefung`, G6). |
| H Routine-Ausfall | **Bestätigt, sogar schärfer** (Routine ist aus, G3). |
| Kein belastbares Beweispaket | **Teilweise bestätigt**: Zeitstempel, SHA-256 und Mails sind da, aber das Ereignisprotokoll ist auf 300 gekappt und es gibt keinen Export (G9). |
| Abschlussformular mit Parteien, Fläche, Beleg | **Bestätigt** (Formular fragt keinen Vertragspartner, G9). |
| Rückabwicklung/Bedingung getrennt abbilden | **Teilweise bestätigt** (Kaufabbruch storniert nur aufschiebend/fällig, G10). |
| Verjährung ≠ Schutzfrist | **Bestätigt als Lücke im System** (G16); die rechtliche Bewertung bleibt beim Anwalt. |
| C Notar/Grundbuch sind keine allgemeine Kontrollquelle | **Übernommen**: G5 setzt auf Klausel und Erinnerung, nicht auf Registerkontrolle. |

**Abweichende Gewichtung:** Codex stuft E (konkurrierende Paare) als „hoch“ ein; ich lasse es bei „mittel“ (G7), mit der Begründung oben. Codex' L („Frist ab Lead-Eingang messen und eskalieren“) existiert im Dashboard schon als „überfällig nach einem Werktag“, nur ohne Benachrichtigung (G11, G13).

**Nicht übernommen / nicht neu:** Verbraucher-Widerruf, Textform und Notarform (Codex Nr. 7 und 8) sind in `docs/recht-onboarding.md` schon umgesetzt und begründet; das ist keine neue Lücke.

**Offen:** Wirksamkeit der Provisionsklauseln, der Schutzfrist und der Verbraucherfälle im Einzelfall (Codex selbst: „aus der anonymisierten Beschreibung nicht feststellbar“) → Anwalt. Codex hat den Code nicht gesehen, die Befunde stützen sich auf meine Beschreibung.

---

## 6. Fragen an Dennis

1. **Wer trägt täglich das Lesen der Kundenmails und die Nachfrage?** Die Routine `lippeforst-tagesbearbeitung` steht auf „aus“, `lippeforst-postfach-abgleich` ist nicht mehr gelistet, und die Grok-Bots sind laut Notiz wieder aktiv. Soll ich die Tagesbearbeitung wieder einschalten lassen (nur du kannst das), oder übernimmt der Bot auch die Stand-Nachfrage? Die erste ist am 09.11. fällig.
2. **Rechnung:** Wer stellt die Provisionsrechnung (Person, System)? Welche Daten soll die Übergabe enthalten? Soll das System eine Frist „Rechnung binnen X Tagen“ überwachen und dich bei Überfälligkeit per Mail/Push informieren? Wer mahnt, und brauchst du Vorlagen? (Neue Zusagen und Texte entscheidest du.)
3. **Konkurrierende Paare:** Darf ein Angebot zwei Freigaben haben? Sollen weitere Paare derselben Fläche automatisch auf „ruhen“ gehen, sobald eines freigegeben ist? Konkret betrifft das heute `LL-MTWPVRUJ`.
4. **Kauf:** Soll in Nachweisvertrag/Kaufabsicht eine Maklerklausel mit Notarhinweis ergänzt werden? Das hebt die Vorlagenfreigabe auf und braucht Anwaltsprüfung.
5. **Miteigentümer:** Pflichtfeld „weitere Eigentümer und deren Zustimmung“ als Sperre vor der Freigabe, oder bleibt es bei der Prüfung durch die Routine?
6. **Spätkontrolle nach Absage oder Beenden:** gewünscht? Takt (z. B. 6/12/18/24 Monate)? Nur Dashboard-Hinweis oder auch eine Frage an den Anbieter?
7. **Bewertungsbitte und Gutschein:** erst nach „bezahlt“ statt 3 Tage nach Abschluss?
8. **Antwortzusage „innerhalb eines Werktags“:** zweiter Lauf am Vormittag, oder den Text der Website anpassen?
9. **Verjährung:** Wiedervorlage über die 24 Monate hinaus bis zum Ende der gesetzlichen Frist? (Fristlänge klärt der Anwalt.)
10. **Weg bei Angeboten ohne Paar:** Zwei unterschriebene Kauf-Angebote stehen online ohne Weg-Entscheidung (`LL-MUDXG0QO`, `LL-MUDWPZYV`). Soll der Weg bei jeder Unterschrift gesetzt werden müssen?

---

## 7. Empfohlene Reihenfolge

| Schritt | Was | Aufwand | Warum zuerst |
|---|---|---|---|
| 1 | G3: Träger klären (Frage 1), Routine ein- oder Bot-Zuständigkeit festlegen | Entscheidung | Ohne Träger wirken alle anderen Maßnahmen nicht; Stichtag 09.11. |
| 2 | G1: Klassifikator „Abschluss gemeldet“ plus Test | S | Kleinster Eingriff, schließt den gefährlichsten stillen Fehler |
| 3 | G4(1)+(2)+(3): Übergabepaket, „fällig seit 7 Tagen“, Push bei „überfällig“ | M | Bevor die erste echte Provision entsteht |
| 4 | G2: Spätkontrolle | M | Schützt die 24-Monats-Frist |
| 5 | G6 und G7 | M | Vor der nächsten Kauf-Freigabe |
| 6 | G11 Digest, G8 Ablauf, G12 Bounces | S–M | Betriebssicherheit |
| 7 | G5, G9, G15, G16 | Text/Recht | Nach Rücksprache mit Anwalt und Buchhaltung |

*Alle Änderungen gehören in eigene Sitzungen mit Tests und Codex-Prüfung (Geld-/Freigabelogik). Dieser Bericht ändert nichts am Code, an Verträgen, Preisen oder Daten.*
