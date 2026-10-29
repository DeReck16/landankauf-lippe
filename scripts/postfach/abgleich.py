#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Postfach-Abgleich Lippe Forst: Antworten von Interessenten aus dem Anfragenpostfach
(info@tr-immobilien.com) an die Verwaltung auf lippeforst.de melden.

Mac (Standard, unveraendert): Outlook per AppleScript.
    /usr/bin/python3 scripts/postfach/abgleich.py [--tage 14] [--trocken]

Linux ohne Outlook und ohne AppleScript: ein Assistent liest das Postfach ueber
Microsoft Graph und legt die Mails als Dateien ab. Dieses Skript hat keinen
Graph-Zugang.
    python3 scripts/postfach/abgleich.py --quelle json --export <ordner> [--tage 14] [--trocken]
Schema, Variablen und Exit-Codes: scripts/postfach/README.md

Laeuft taeglich ~07:40 als Claude-Routine lippeforst-postfach-abgleich (seit 26.09.2026;
der launchd-Job com.dennisreckling.lippeforst-postfach ist aus).

Ablauf:
  1. GET  /api/verwaltung/postfach  -> gehashte Absenderadressen aller Kunden (SHA-256).
  2. Mails lesen (Outlook: scan.applescript, sonst nachrichten.json im Export-Ordner).
     Nur Mails von Kunden-Adressen oder mit „Lippe Forst“/„LL-…“ im Betreff kommen
     weiter — alles andere bleibt unberuehrt und unversandt.
  3. Outlook: text.applescript liest Kopfzeilen (Message-ID) und Klartext.
     JSON: Klartext aus body (HTML wird in Text gewandelt); die Kennung ist
     internetMessageId.
  4. POST /api/verwaltung/postfach {mails: [...]} -> die Verwaltung ordnet zu und legt je Mail
     ein Ticket mit Vorschlag an. Geaendert wird dort erst per Klick; an Kunden geht nichts.

Per launchd gestartete Prozesse duerfen Outlook.sqlite nicht lesen (macOS-TCC) — Apple Events
an Outlook sind erlaubt (wie beim DHL-Rechnungsabgleich). Deshalb nur AppleScript.
HTTP ueber curl: die python.org-Installation auf diesem Mac hat keine CA-Zertifikate.

Konfiguration: ~/.config/lippeforst/postfach.env (chmod 600), optional.
Umgebungsvariablen LF_… gehen vor; sind sie gesetzt, ist die Datei nicht noetig.
    LF_POSTFACH_TOKEN=…                 (gleich wie in Vercel, Pflicht)
    LF_URL=https://lippeforst.de        (optional; fuer Tests http://localhost:3000)
    LF_POSTFACH_ZUSTAND_DIR=…           (Verzeichnis; darin zustand.json)
    LF_POSTFACH_ZUSTAND=…               (optionaler Dateipfad, Vorrang vor dem Verzeichnis)
    LF_POSTFACH_LOG=…                   (Logdatei; ohne sie nur stdout.
                                         Auf dem Mac lenkt launchd nach
                                         ~/Library/Logs/lippeforst-postfach.log um.)
    LF_POSTFACH_KONTO=info@tr-immobilien.com  (nur Outlook)
    LF_POSTFACH_TAGE=14                 (optional, Rueckblick je Lauf)

Dublettenschutz: lokal die Outlook-ID (Mac) bzw. Graph-id und internetMessageId (JSON).
Die Verwaltung erkennt dieselbe Mail zusaetzlich an der Message-ID — deshalb schickt der
JSON-Lauf exakt diese Kennung und legt keinen zweiten Vorgang an.
"""
import hashlib, json, os, re, subprocess, sys, tempfile
from datetime import datetime, timedelta, timezone
from html import unescape
from html.parser import HTMLParser

HIER = os.path.dirname(os.path.abspath(__file__))
KONFIG = os.path.expanduser("~/.config/lippeforst/postfach.env")
ZUSTAND = os.path.expanduser("~/Library/Application Support/lippeforst-postfach/zustand.json")
TRENNER = "=====LIPPEFORST-TEXT====="
MERKEN_TAGE = 90
STAPEL = 20
_logdatei = {"pfad": ""}


def log(msg):
    zeile = f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {msg}"
    print(zeile, flush=True)
    pfad = _logdatei.get("pfad") or ""
    if not pfad:
        return
    try:
        verzeichnis = os.path.dirname(pfad)
        if verzeichnis:
            os.makedirs(verzeichnis, exist_ok=True)
        with open(pfad, "a", encoding="utf-8") as f:
            f.write(zeile + "\n")
    except OSError as e:
        print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] FEHLER: Logdatei nicht schreibbar ({e})", flush=True)


def konfig():
    """Datei ~/.config/lippeforst/postfach.env; Umgebungsvariablen LF_… haben Vorrang (Tests gegen den lokalen Server)."""
    out = {"LF_URL": "https://lippeforst.de", "LF_POSTFACH_KONTO": "info@tr-immobilien.com", "LF_POSTFACH_TAGE": "14"}
    if os.path.exists(KONFIG):
        with open(KONFIG, encoding="utf-8") as f:
            for zeile in f:
                zeile = zeile.strip()
                if "=" in zeile and not zeile.startswith("#"):
                    k, v = zeile.split("=", 1)
                    out[k.strip()] = v.strip().strip('"').strip("'")
    out.update({k: v for k, v in os.environ.items() if k.startswith("LF_") and v})
    return out


def log_pfad(cfg):
    """LF_POSTFACH_LOG, sonst leer (nur stdout; der Mac-launchd-Job faengt stdout selbst ab)."""
    pfad = cfg.get("LF_POSTFACH_LOG") or ""
    return os.path.expanduser(pfad) if pfad else ""


def zustand_pfad(cfg):
    """LF_POSTFACH_ZUSTAND = Datei (Vorrang, bisheriger Schluessel).
    LF_POSTFACH_ZUSTAND_DIR = Verzeichnis mit zustand.json. Sonst der Mac-Pfad."""
    if cfg.get("LF_POSTFACH_ZUSTAND"):
        return os.path.expanduser(cfg["LF_POSTFACH_ZUSTAND"])
    if cfg.get("LF_POSTFACH_ZUSTAND_DIR"):
        return os.path.join(os.path.expanduser(cfg["LF_POSTFACH_ZUSTAND_DIR"]), "zustand.json")
    return ZUSTAND


def http(methode, url, token, daten=None):
    """curl mit Bearer-Schluessel; der Schluessel geht ueber eine Header-Datei (nicht sichtbar in `ps`)."""
    kopf = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False)
    kopf.write(f"Authorization: Bearer {token}\nContent-Type: application/json\n")
    kopf.close()
    os.chmod(kopf.name, 0o600)
    koerper = None
    cmd = ["curl", "-s", "--max-time", "90", "-w", "\n%{http_code}", "-X", methode, "-H", f"@{kopf.name}", url]
    try:
        if daten is not None:
            koerper = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8")
            json.dump(daten, koerper, ensure_ascii=False)
            koerper.close()
            cmd += ["--data-binary", f"@{koerper.name}"]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    finally:
        os.remove(kopf.name)
        if koerper:
            os.remove(koerper.name)
    text, _, code = r.stdout.rpartition("\n")
    try:
        return int(code), json.loads(text) if text.strip() else {}
    except ValueError:
        return int(code or 0), {"roh": text[:300]}


def osascript(skript, *args, timeout=300):
    r = subprocess.run(["osascript", os.path.join(HIER, skript), *args], capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError(f"{skript}: {r.stderr.strip()[:400]}")
    return r.stdout.strip()


def scan(seit, konto):
    with tempfile.TemporaryDirectory() as tmp:
        ziel = os.path.join(tmp, "scan.tsv")
        osascript("scan.applescript", seit.strftime("%Y-%m-%d %H:%M"), konto, ziel, timeout=300)
        with open(ziel, encoding="utf-8") as f:
            zeilen = f.read().splitlines()
    out = []
    for z in zeilen:
        teile = z.split("\t")
        if len(teile) < 5 or not teile[0].strip().isdigit():
            continue
        out.append({"rid": teile[0].strip(), "ordner": teile[1], "zeit": teile[2], "von": teile[3].strip().lower(), "betreff": "\t".join(teile[4:]).strip()})
    return out


def volltext(rid):
    with tempfile.TemporaryDirectory() as tmp:
        ziel = os.path.join(tmp, "mail.txt")
        osascript("text.applescript", rid, ziel, timeout=150)
        with open(ziel, encoding="utf-8") as f:
            roh = f.read()
    kopf, _, text = roh.partition(TRENNER)
    # Outlook liefert die Kopfzeilen mit CR getrennt; Message-ID kann umbrochen sein.
    kopf = kopf.replace("\r", "\n")
    m = re.search(r"^Message-ID:\s*(?:\n[ \t]+)?<?([^>\s]+)>?", kopf, re.I | re.M)
    return (m.group(1) if m else ""), text.strip()


def iso_lokal(zeit):
    """„2026-09-25 18:09:35“ (Ortszeit des Mac) -> ISO mit Zeitzone."""
    return datetime.strptime(zeit, "%Y-%m-%d %H:%M:%S").astimezone().isoformat()


def zustand_laden(pfad):
    try:
        with open(pfad, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {"gemeldet": {}}


def zustand_speichern(pfad, z):
    os.makedirs(os.path.dirname(pfad), exist_ok=True)
    grenze = (datetime.now() - timedelta(days=MERKEN_TAGE)).isoformat()
    z["gemeldet"] = {k: v for k, v in z.get("gemeldet", {}).items() if v >= grenze}
    tmp = pfad + ".neu"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(z, f, ensure_ascii=False, indent=1)
    os.replace(tmp, pfad)


def relevant(m, adressen):
    b = m["betreff"].lower()
    return hashlib.sha256(m["von"].encode("utf-8")).hexdigest() in adressen or "lippe forst" in b or "lippeforst" in b or re.search(r"\bll-[a-z0-9]{6,12}\b", b) is not None


def message_id_norm(wert):
    """Message-ID wie die Verwaltung sie speichert: ohne umschliessende <>, hoechstens 300 Zeichen.

    Dieselbe Form schickt der Mac-Lauf aus dem Kopf Message-ID. Nur so erkennt
    /api/verwaltung/postfach eine schon aus Outlook gemeldete Mail (Ergebnis „bekannt“).
    """
    s = wert.strip() if isinstance(wert, str) else ""
    if s.startswith("<"):
        s = s[1:]
    if s.endswith(">"):
        s = s[:-1]
    return s.strip()[:300]


def zeit_utc(wert):
    """Graph receivedDateTime (UTC, ISO). Python 3.10 versteht kein Z und hoechstens 6 Nachkommastellen."""
    if not isinstance(wert, str):
        return None
    s = wert.strip()
    if not s:
        return None
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    if "T" not in s and " " in s:
        s = s.replace(" ", "T", 1)
    s = re.sub(r"(\.\d{6})\d+", r"\1", s)
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def graph_id(roh):
    wert = roh.get("id") if isinstance(roh, dict) else None
    if isinstance(wert, str):
        return wert.strip()
    if isinstance(wert, int) and not isinstance(wert, bool):
        return str(wert)
    return ""


def absender_adresse(roh):
    frm = roh.get("from") if isinstance(roh, dict) else None
    ea = frm.get("emailAddress") if isinstance(frm, dict) else None
    adr = ea.get("address") if isinstance(ea, dict) else None
    if not isinstance(adr, str):
        return ""
    adr = adr.strip().lower()
    m = re.search(r"<([^>]+)>", adr)
    return (m.group(1) if m else adr).strip().lower()


def betreff_text(roh):
    if not isinstance(roh, dict) or "subject" not in roh or roh.get("subject") is None:
        return ""
    if not isinstance(roh.get("subject"), str):
        return None
    return re.sub(r"\s+", " ", roh["subject"]).strip()


class _HtmlZuText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.teile = []
        self._aus = 0

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in ("script", "style"):
            self._aus += 1
            return
        if tag in ("br", "p", "div", "tr", "li", "h1", "h2", "h3", "blockquote", "table"):
            self.teile.append("\n")
        if tag == "a":
            href = ""
            for k, v in attrs:
                if k.lower() == "href" and v:
                    href = unescape(v.strip())
            if href:
                self.teile.append(" " + href + " ")

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag.lower() in ("script", "style") and self._aus:
            self._aus -= 1

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in ("script", "style") and self._aus:
            self._aus -= 1
            return
        if tag in ("p", "div", "tr", "li", "h1", "h2", "h3", "blockquote", "table"):
            self.teile.append("\n")

    def handle_data(self, data):
        if not self._aus:
            self.teile.append(data)


def html_zu_text(html):
    """HTML-Body in Klartext. Links bleiben als URL stehen (persoenliche /kunde/…-Links)."""
    parser = _HtmlZuText()
    try:
        parser.feed(html or "")
        parser.close()
    except Exception:
        text = re.sub(r"<[^>]+>", " ", html or "")
    else:
        text = "".join(parser.teile)
    text = text.replace("\xa0", " ").replace("\r", "")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def body_text(body):
    """Klartext wie Outlooks plain text content, gekuerzt auf 60000 Zeichen."""
    if body is None:
        return "", None
    if not isinstance(body, dict):
        return None, "body ist kein Objekt"
    inhalt = body.get("content")
    if inhalt is None:
        inhalt = ""
    if not isinstance(inhalt, str):
        return None, "body.content ist kein Text"
    art = body.get("contentType")
    if art is None or art == "":
        art = "text"
    elif not isinstance(art, str):
        return None, "body.contentType ist kein Text"
    else:
        art = art.strip().lower()
    if art == "html":
        return html_zu_text(inhalt)[:60000], None
    if art not in ("text", "plaintext", "plain"):
        return None, f"body.contentType unbekannt: {art}"
    return inhalt.strip()[:60000], None


def nachricht_lesen(roh, seit):
    """Eine Graph-Nachricht. ('alt', None) ausserhalb des Fensters, ('fehler', dict), ('ok', mail)."""
    gid = graph_id(roh)
    dt = zeit_utc(roh.get("receivedDateTime") if isinstance(roh, dict) else None)
    if dt is None:
        return "fehler", {"id": gid, "ergebnis": "ungueltig", "text": "receivedDateTime fehlt oder ist kein ISO-Zeitpunkt"}
    if dt < seit:
        return "alt", None
    mid_roh = roh.get("internetMessageId") if isinstance(roh, dict) else None
    mid = message_id_norm(mid_roh if isinstance(mid_roh, str) else "")
    if not gid:
        return "fehler", {"id": "", "ergebnis": "ungueltig", "text": "Graph-id fehlt"}
    if not mid:
        return "fehler", {"id": gid, "ergebnis": "ungueltig", "text": "internetMessageId fehlt"}
    von = absender_adresse(roh)
    if "@" not in von:
        return "fehler", {"id": gid, "internetMessageId": mid, "ergebnis": "ungueltig", "text": "Absender fehlt"}
    betreff = betreff_text(roh)
    if betreff is None:
        return "fehler", {"id": gid, "internetMessageId": mid, "ergebnis": "ungueltig", "text": "subject ist kein Text"}
    text, text_fehler = body_text(roh.get("body"))
    if text_fehler:
        return "fehler", {"id": gid, "internetMessageId": mid, "ergebnis": "ungueltig", "text": text_fehler}
    mail = {
        "rid": gid,
        "id": mid,
        "am": dt.astimezone(timezone.utc).isoformat(),
        "von": von,
        "betreff": betreff,
        "text": text,
    }
    return "ok", mail


def anhang_datei(export_dir, rel):
    """Absoluter Pfad der Anhangsdatei oder (None, Grund). Bleibt im Export-Ordner."""
    if not isinstance(rel, str) or not rel.strip():
        return None, "Pfad fehlt"
    rel = rel.strip()
    if os.path.isabs(rel) or rel.startswith("~") or "\x00" in rel:
        return None, "Pfad muss relativ zum Export-Ordner sein"
    root = os.path.realpath(export_dir)
    ziel = os.path.realpath(os.path.join(root, rel))
    try:
        if os.path.commonpath([root, ziel]) != root:
            return None, "Pfad verlaesst den Export-Ordner"
    except ValueError:
        return None, "Pfad verlaesst den Export-Ordner"
    if not os.path.isfile(ziel):
        return None, "Datei fehlt"
    return ziel, ""


def pruefe_anhaenge(export_dir, roh, mail):
    """Abweichungen zu anhaenge. Die Mail wird trotzdem gemeldet — die Schnittstelle nimmt nur Text."""
    roh_liste = roh.get("anhaenge", []) if isinstance(roh, dict) else []
    basis = {"id": mail["rid"], "internetMessageId": mail["id"], "ergebnis": "anhang"}
    if roh_liste is None:
        return []
    if not isinstance(roh_liste, list):
        return [{**basis, "text": "anhaenge ist keine Liste"}]
    out = []
    for eintrag in roh_liste:
        if not isinstance(eintrag, dict):
            out.append({**basis, "text": "Anhang ist kein Objekt"})
            continue
        rel = eintrag.get("pfad")
        name = eintrag.get("name") if isinstance(eintrag.get("name"), str) and eintrag.get("name").strip() else (rel if isinstance(rel, str) else "Anhang")
        ziel, grund = anhang_datei(export_dir, rel)
        if not ziel:
            out.append({**basis, "text": f"{name}: {grund}"})
            continue
        size = eintrag.get("size")
        if isinstance(size, int) and not isinstance(size, bool) and os.path.getsize(ziel) != size:
            out.append({**basis, "text": f"{name}: Groesse weicht ab ({os.path.getsize(ziel)} statt {size})"})
    return out


def lade_nachrichten(export_dir):
    """nachrichten.json: eine JSON-Liste, kein Graph-Umschlag {value: [...]}."""
    pfad = os.path.join(export_dir, "nachrichten.json")
    with open(pfad, encoding="utf-8-sig") as f:
        daten = json.load(f)
    if not isinstance(daten, list):
        raise ValueError("nachrichten.json muss eine Liste sein")
    return daten


def nachrichten_filtern(export_dir, daten, seit, adressen, gemeldet):
    gesehen = 0
    mails = []
    probleme = []
    for roh in daten:
        if not isinstance(roh, dict):
            probleme.append({"ergebnis": "ungueltig", "text": "Eintrag ist kein Objekt"})
            continue
        art, wert = nachricht_lesen(roh, seit)
        if art == "alt":
            continue
        if art == "fehler":
            probleme.append(wert)
            continue
        gesehen += 1
        mail = wert
        if not relevant(mail, adressen):
            continue
        # Graph-id aendert sich beim Verschieben, die Message-ID nicht. Beides gilt als schon gemeldet.
        if mail["rid"] in gemeldet or mail["id"] in gemeldet:
            continue
        probleme.extend(pruefe_anhaenge(export_dir, roh, mail))
        mails.append(mail)
    return gesehen, mails, probleme


def leeres_ergebnis(trocken):
    return {
        "ok": True,
        "exit": 0,
        "quelle": "json",
        "trocken": bool(trocken),
        "gesehen": 0,
        "neuPassend": 0,
        "angelegt": [],
        "zugeordnet": [],
        "abweichungen": [],
        "vorgesehen": [],
    }


def ergebnis_schreiben(export_dir, ergebnis):
    pfad = os.path.join(export_dir, "ergebnis.json")
    tmp = pfad + ".neu"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(ergebnis, f, ensure_ascii=False, indent=1)
        f.write("\n")
    os.replace(tmp, pfad)


def json_fertig(export_dir, ergebnis, code):
    ergebnis["exit"] = code
    if code != 0:
        ergebnis["ok"] = False
    try:
        ergebnis_schreiben(export_dir, ergebnis)
    except OSError as e:
        log(f"FEHLER: ergebnis.json nicht schreibbar: {e}")
        return 1
    return code


def melden(mails, api, token, gemeldet, z, zpfad, trocken, ergebnis=None):
    """POST an die Verwaltung. ergebnis nur im JSON-Modus — der Mac-Lauf schreibt keine ergebnis.json.

    Im JSON-Modus werden zusaetzlich Graph-id (rid) und Message-ID gemerkt. Der Mac-Lauf
    merkt sich nur die Outlook-ID, wie bisher.
    """
    if trocken:
        for m in mails:
            log(f"  [trocken] {m['am']} {m['von']} — {m['betreff'][:70]}")
            if ergebnis is not None:
                ergebnis["vorgesehen"].append({
                    "id": m["rid"],
                    "internetMessageId": message_id_norm(m["id"]),
                    "am": m["am"],
                    "von": m["von"],
                    "betreff": m["betreff"],
                })
        return 0

    zaehler = {}
    for i in range(0, len(mails), STAPEL):
        stapel = mails[i:i + STAPEL]
        code, antwort = http("POST", api, token, {"mails": [{k: v for k, v in m.items() if k != "rid"} for m in stapel]})
        if code != 200 or not antwort.get("ok"):
            log(f"FEHLER beim Melden (HTTP {code}): {str(antwort)[:300]}")
            if ergebnis is not None:
                ergebnis["ok"] = False
                ergebnis["abweichungen"].append({"ergebnis": "fehler", "text": f"Melden fehlgeschlagen (HTTP {code})"})
            return 1
        nach_id = {e.get("id"): e for e in antwort.get("ergebnisse", [])}
        jetzt = datetime.now().isoformat()
        for m in stapel:
            e = nach_id.get(m["id"].strip("<>"), {})
            art = e.get("ergebnis", "?")
            zaehler[art] = zaehler.get(art, 0) + 1
            if art in ("neu", "bekannt", "unzugeordnet", "intern"):
                gemeldet[m["rid"]] = jetzt
                if ergebnis is not None:
                    mid = message_id_norm(m["id"])
                    if mid and mid != m["rid"]:
                        gemeldet[mid] = jetzt
            if art == "neu":
                log(f"  neu: {m['von']} -> {e.get('anfrage')} (Vorschlag: {e.get('vorschlag') or 'selbst einordnen'})")
            if ergebnis is not None:
                eintrag = {"id": m["rid"], "internetMessageId": message_id_norm(m["id"]), "ergebnis": art}
                if e.get("anfrage"):
                    eintrag["anfrage"] = e.get("anfrage")
                if "vorschlag" in e:
                    eintrag["vorschlag"] = e.get("vorschlag")
                if art == "neu":
                    ergebnis["angelegt"].append(m["rid"])
                    ergebnis["zugeordnet"].append(eintrag)
                elif art == "bekannt":
                    ergebnis["zugeordnet"].append(eintrag)
                else:
                    eintrag["text"] = {
                        "unzugeordnet": "keiner Anfrage zugeordnet",
                        "ungueltig": "von der Verwaltung abgelehnt",
                        "intern": "interner Absender",
                    }.get(art, "keine verwertbare Antwort der Verwaltung")
                    ergebnis["abweichungen"].append(eintrag)
        zustand_speichern(zpfad, z)
    log("gemeldet: " + ", ".join(f"{k} {v}" for k, v in sorted(zaehler.items())))
    return 0


def tage_aus(cfg):
    if "--tage" in sys.argv:
        return int(sys.argv[sys.argv.index("--tage") + 1])
    return int(cfg["LF_POSTFACH_TAGE"])


def lauf_outlook(cfg, token, trocken):
    basis = cfg["LF_URL"].rstrip("/")
    tage = tage_aus(cfg)
    api = f"{basis}/api/verwaltung/postfach"

    code, antwort = http("GET", api, token)
    if code != 200 or not antwort.get("ok"):
        log(f"FEHLER: Adressen nicht abrufbar (HTTP {code}): {str(antwort)[:200]}")
        return 1
    adressen = set(antwort.get("adressen", []))

    zpfad = zustand_pfad(cfg)
    z = zustand_laden(zpfad)
    gemeldet = z.setdefault("gemeldet", {})
    seit = datetime.now() - timedelta(days=tage)
    try:
        alle = scan(seit, cfg["LF_POSTFACH_KONTO"])
    except (RuntimeError, subprocess.TimeoutExpired) as e:
        log(f"FEHLER: Outlook nicht lesbar: {e}")
        return 1
    kandidaten = [m for m in alle if relevant(m, adressen) and m["rid"] not in gemeldet]
    log(f"{len(alle)} Mails seit {seit:%d.%m.%Y %H:%M} gesehen, {len(kandidaten)} neu passend")
    if not kandidaten:
        return 0

    mails = []
    for m in kandidaten:
        try:
            mid, text = volltext(m["rid"])
        except (RuntimeError, subprocess.TimeoutExpired) as e:
            log(f"  Outlook-ID {m['rid']}: Text nicht lesbar ({e}) — naechster Lauf")
            continue
        mails.append({"rid": m["rid"], "id": mid or f"outlook-{m['rid']}", "am": iso_lokal(m["zeit"]), "von": m["von"], "betreff": m["betreff"], "text": text[:60000]})

    return melden(mails, api, token, gemeldet, z, zpfad, trocken)


def lauf_json(cfg, token, trocken, export):
    export = os.path.abspath(os.path.expanduser(export))
    erg = leeres_ergebnis(trocken)
    if not os.path.isdir(export):
        log(f"FEHLER: Export-Ordner fehlt: {export}")
        return 1
    try:
        roh = lade_nachrichten(export)
    except (OSError, ValueError, UnicodeError) as e:
        log(f"FEHLER: Export nicht lesbar: {e}")
        erg["abweichungen"].append({"ergebnis": "fehler", "text": str(e)[:300]})
        return json_fertig(export, erg, 1)

    basis = cfg["LF_URL"].rstrip("/")
    tage = tage_aus(cfg)
    api = f"{basis}/api/verwaltung/postfach"
    code, antwort = http("GET", api, token)
    if code != 200 or not antwort.get("ok"):
        log(f"FEHLER: Adressen nicht abrufbar (HTTP {code}): {str(antwort)[:200]}")
        erg["abweichungen"].append({"ergebnis": "fehler", "text": f"Adressen nicht abrufbar (HTTP {code})"})
        return json_fertig(export, erg, 1)
    adressen = set(antwort.get("adressen", []))

    zpfad = zustand_pfad(cfg)
    z = zustand_laden(zpfad)
    gemeldet = z.setdefault("gemeldet", {})
    seit = datetime.now(timezone.utc) - timedelta(days=tage)
    gesehen, mails, probleme = nachrichten_filtern(export, roh, seit, adressen, gemeldet)
    erg["gesehen"] = gesehen
    erg["neuPassend"] = len(mails)
    erg["abweichungen"].extend(probleme)
    for p in probleme:
        log(f"  {p.get('id') or '?'}: {p.get('text') or p.get('ergebnis')}")
    log(f"{gesehen} Mails seit {seit.astimezone():%d.%m.%Y %H:%M} gesehen, {len(mails)} neu passend")
    if not mails:
        return json_fertig(export, erg, 0)
    code = melden(mails, api, token, gemeldet, z, zpfad, trocken, erg)
    return json_fertig(export, erg, code)


def parse_args(argv):
    """(quelle, export, fehler). quelle ist 'outlook' (Standard) oder 'json'."""
    def wert(name):
        if name not in argv:
            return None
        i = argv.index(name)
        if i + 1 >= len(argv) or argv[i + 1].startswith("-"):
            return ""
        return argv[i + 1]

    quelle = wert("--quelle")
    export = wert("--export")
    if quelle is None:
        quelle = "outlook"
    elif quelle == "":
        return "outlook", export, "--quelle braucht outlook oder json"
    else:
        quelle = quelle.strip().lower()
    if quelle not in ("outlook", "json"):
        return quelle, export, f"unbekannte --quelle {quelle} (outlook oder json)"
    if export == "":
        return quelle, "", "--export braucht einen Ordner"
    if quelle != "json" and export is not None:
        return quelle, export, "--export gilt nur zusammen mit --quelle json"
    if quelle == "json" and not export:
        return quelle, "", "--quelle json braucht --export <ordner>"
    return quelle, export, ""


def main():
    trocken = "--trocken" in sys.argv
    quelle, export, args_fehler = parse_args(sys.argv)
    cfg = konfig()
    _logdatei["pfad"] = log_pfad(cfg)
    if args_fehler:
        log(f"FEHLER: {args_fehler}")
        return 2
    token = cfg.get("LF_POSTFACH_TOKEN", "")
    if len(token) < 32:
        log(f"FEHLER: LF_POSTFACH_TOKEN fehlt (Umgebungsvariable oder {KONFIG})")
        if quelle == "json" and export and os.path.isdir(os.path.expanduser(export)):
            erg = leeres_ergebnis(trocken)
            erg["abweichungen"].append({"ergebnis": "fehler", "text": "LF_POSTFACH_TOKEN fehlt"})
            return json_fertig(os.path.abspath(os.path.expanduser(export)), erg, 2)
        return 2
    if quelle == "json":
        return lauf_json(cfg, token, trocken, export)
    return lauf_outlook(cfg, token, trocken)


if __name__ == "__main__":
    sys.exit(main())
