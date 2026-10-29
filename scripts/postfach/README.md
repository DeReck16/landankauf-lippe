# Postfach-Abgleich

Antworten von Interessenten aus dem Anfragenpostfach `info@tr-immobilien.com` an
`/api/verwaltung/postfach` melden. Die Verwaltung ordnet zu und legt Tickets an;
geändert wird dort erst per Klick.

Zwei Quellen, dieselbe Schnittstelle und dieselbe Erkennung (Kundenadresse oder
„Lippe Forst“ / `LL-…` im Betreff):

- **Mac (Standard):** Outlook über `scan.applescript` und `text.applescript`.
  Ohne `--quelle` bleibt dieser Weg. Die launchd-plist ist nur die abgeschaltete
  Mac-Vorlage und läuft auf Linux nicht.
- **Linux:** ein Assistent liest das Postfach über Microsoft Graph (dort landen auch
  die Anfragen von `anfrage@lippeforst.de`) und legt die Mails als Dateien ab.
  Dieses Skript bekommt keinen Graph-Zugang und ruft kein AppleScript auf.

## Aufruf

Testlauf, nichts wird gemeldet, kein Zustand geschrieben. `ergebnis.json` enthält
`trocken: true` und die vorgesehenen Nachrichten:

```bash
LF_POSTFACH_TOKEN='…' \
LF_URL='http://localhost:3000' \
LF_POSTFACH_ZUSTAND_DIR='/tmp/lippeforst-postfach' \
LF_POSTFACH_LOG='/tmp/lippeforst-postfach.log' \
python3 scripts/postfach/abgleich.py --quelle json --export /pfad/zum/export --tage 14 --trocken
```

Echter Lauf:

```bash
LF_POSTFACH_TOKEN='…' \
LF_URL='https://lippeforst.de' \
LF_POSTFACH_ZUSTAND_DIR='/var/lib/lippeforst-postfach' \
LF_POSTFACH_LOG='/var/log/lippeforst-postfach.log' \
python3 scripts/postfach/abgleich.py --quelle json --export /pfad/zum/export --tage 14
```

Mac, unverändert:

```bash
/usr/bin/python3 scripts/postfach/abgleich.py [--tage 14] [--trocken]
```

`--tage` ist der Rückblick in Tagen (Standard 14, sonst `LF_POSTFACH_TAGE`).

## Umgebungsvariablen

Sind sie gesetzt, wird `~/.config/lippeforst/postfach.env` nicht gebraucht.
Die Datei gilt weiter für den Mac; gesetzte Variablen gewinnen.

| Variable | Bedeutung |
| --- | --- |
| `LF_POSTFACH_TOKEN` | Pflicht. Bearer-Schlüssel, derselbe Wert wie in Vercel, mindestens 32 Zeichen. |
| `LF_URL` | Basis-URL der Verwaltung. Standard `https://lippeforst.de`. |
| `LF_POSTFACH_ZUSTAND_DIR` | Verzeichnis für `zustand.json`. |
| `LF_POSTFACH_ZUSTAND` | Voller Dateipfad der Zustandsdatei. Hat Vorrang vor dem Verzeichnis (bisheriger Schlüssel, für Tests). |
| `LF_POSTFACH_LOG` | Logdatei, zusätzlich zu stdout. Ohne sie schreibt das Skript nur nach stdout. Auf dem Mac fängt launchd stdout in `~/Library/Logs/lippeforst-postfach.log` ab; diese Datei öffnet das Skript nicht von selbst. |
| `LF_POSTFACH_TAGE` | Rückblick, Standard `14`. |
| `LF_POSTFACH_KONTO` | Nur Outlook, Standard `info@tr-immobilien.com`. |

Ohne `LF_POSTFACH_ZUSTAND` und ohne `LF_POSTFACH_ZUSTAND_DIR` bleibt der Mac-Pfad
`~/Library/Application Support/lippeforst-postfach/zustand.json`.

## Exit-Codes

Wie bisher:

| Code | Bedeutung |
| --- | --- |
| 0 | Lauf fertig, auch wenn nichts zu melden war und auch im Trockenlauf. `unzugeordnet` ist kein Fehler. |
| 1 | Export nicht lesbar, Outlook nicht lesbar, Verwaltung nicht erreichbar oder Melden fehlgeschlagen. |
| 2 | `LF_POSTFACH_TOKEN` fehlt oder der Aufruf ist unvollständig (`--quelle json` ohne `--export`). |

## `nachrichten.json`

Im Export-Ordner liegt eine **JSON-Liste** (kein Graph-Umschlag `{"value":[…]}`).
Jedes Element ist eine Nachricht im Microsoft-Graph-Format plus zwei Felder, die Graph
so nicht liefert: der Ordnername und die schon abgelegten Anhänge. Weitere Graph-Felder
(`isRead`, `parentFolderId`, …) sind erlaubt und werden ignoriert. Das Graph-Feld
`attachments` wird nicht gelesen — Dateien stehen nur in `anhaenge`.

Vertrag, den der Assistent schreibt (Beispiel und Testfixture:
[`beispiel/nachrichten.json`](beispiel/nachrichten.json)):

| Feld | Inhalt |
| --- | --- |
| `id` | Graph-Nachrichten-ID. |
| `internetMessageId` | RFC-Message-ID, in der Regel mit `<…>`. Dieselbe Kennung wie der Kopf `Message-ID` unter Outlook. |
| `receivedDateTime` | Eingang, UTC, ISO-8601 (`Z` oder Offset). Nachkommastellen sind erlaubt. |
| `from.emailAddress.name` | Anzeigename. |
| `from.emailAddress.address` | Absenderadresse. |
| `toRecipients` | Liste von `{emailAddress:{name,address}}`. Wird nicht an die Verwaltung geschickt. |
| `subject` | Betreff. |
| `body.contentType` | `text` oder `html`. |
| `body.content` | Körper. HTML wird in Klartext gewandelt, Links bleiben als URL erhalten. |
| `parentFolderName` | `Posteingang` oder `Junk-E-Mail`. Das Skript filtert den Ordner nicht noch einmal; was in der Liste steht und im Rückblick liegt, wird geprüft. Der Mac liest zusätzlich Archiv, Gelöschte Elemente und „Erneut erinnern“ — dieselben Namen können in der Liste stehen, ohne dass das Skript geändert werden muss. |
| `anhaenge` | Liste von `{name, contentType, size, pfad}`. `pfad` ist relativ zum Export-Ordner, die Datei liegt dort schon. `size` ist die Größe in Bytes. |

Gemeldet wird an die Verwaltung nur `{id, am, von, betreff, text}` — `id` ist die
Message-ID ohne `< >`, wie sie der Mac aus dem Kopf `Message-ID` schickt. Anhänge
gehen nicht mit (die Schnittstelle nimmt nur Text). Eine fehlende oder aus dem
Ordner ausbrechende Anhangsdatei steht in `ergebnis.json`, die Mail wird trotzdem gemeldet.

## `ergebnis.json`

Im JSON-Modus schreibt das Skript `ergebnis.json` in den Export-Ordner. Outlook wird
nicht verändert; das Skript hatte auch bisher keine Schreibaktion am Postfach
(die AppleScripts lesen nur). Der Assistent sieht hier, was angelegt oder zugeordnet
wurde und welche Abweichungen gemeldet wurden.

| Feld | Inhalt |
| --- | --- |
| `ok` | `true`, wenn der Lauf mit Exit 0 endet. |
| `exit` | Derselbe Code wie der Prozess. |
| `quelle` | `json`. |
| `trocken` | Trockenlauf. |
| `gesehen` | Nachrichten im Rückblick, die sich lesen ließen. |
| `neuPassend` | Davon noch nicht gemeldet und zur Verwaltung gehörend. |
| `angelegt` | Graph-IDs mit Ergebnis `neu` (Ticket neu angelegt). |
| `zugeordnet` | Objekte zu `neu` und `bekannt`: `id` (Graph), `internetMessageId`, `ergebnis`, `anfrage`, optional `vorschlag`. |
| `abweichungen` | Nicht zuordenbare oder unlesbare Nachrichten, Anhangsprobleme, Meldefehler. `unzugeordnet` landet hier und gilt lokal als erledigt. |
| `vorgesehen` | Nur im Trockenlauf: was gemeldet worden wäre. |

## Dublettenschutz

Drei Ebenen, damit ein Umzug vom Mac keine zweiten Tickets anlegt:

1. **Mac, lokal, unverändert.** `zustand.json` → `gemeldet` ist an der Outlook-ID
   (`rid`) aufgehängt. Ein Mac-Lauf merkt sich keine Message-ID.
2. **JSON, lokal.** Gemeldet wird unter der Graph-`id` und unter der normalisierten
   `internetMessageId` (ohne `< >`, höchstens 300 Zeichen). Steht einer der beiden
   Schlüssel schon in `gemeldet`, geht die Mail nicht erneut hinaus. Die Graph-ID
   kann sich beim Verschieben ändern, die Message-ID nicht — deshalb reicht die
   Message-ID, um dieselbe Mail nach einem Ordnerwechsel zu erkennen.
3. **Verwaltung.** `LeadMeta.postfach[].id` ist die Message-ID. Der Mac schickt
   genau den Kopf `Message-ID`, der JSON-Lauf dieselbe `internetMessageId`.
   Ist der Vorgang schon angelegt, antwortet die Schnittstelle `bekannt` und legt
   nichts Zweites an. Der JSON-Lauf merkt sich danach Graph-ID und Message-ID.

Ein vom Mac kopierter Zustand enthält nur Outlook-IDs. Der erste JSON-Lauf schickt
die Mails im Rückblick deshalb noch einmal; die Verwaltung antwortet `bekannt`.
Erst wenn damals gar keine Message-ID ankam (der Mac speichert dann `outlook-<rid>`),
kann die Verwaltung die Mail nicht wiedererkennen. Eingegangene Post hat die Kennung
bei Outlook und bei Graph praktisch immer.

Einträge in `gemeldet` fallen nach 90 Tagen aus dem lokalen Zustand. Die Verwaltung
behält die Message-ID; ein späterer Lauf erhält dann `bekannt`.

## Tests

Nur Python-Standardbibliothek, Python 3.10 oder neuer:

```bash
python3 scripts/postfach/test_abgleich.py
```
