#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Postfach-Abgleich Lippe Forst: Antworten von Interessenten aus dem Anfragenpostfach
(info@tr-immobilien.com, Outlook auf dem Mac) an die Verwaltung auf lippeforst.de melden.

Laeuft taeglich per launchd (com.dennisreckling.lippeforst-postfach, 07:40) — von Hand:
    /usr/bin/python3 scripts/postfach/abgleich.py [--tage 14] [--trocken]

Ablauf:
  1. GET  /api/verwaltung/postfach  -> gehashte Absenderadressen aller Kunden (SHA-256).
  2. scan.applescript: Kopfdaten der Mails im Konto (Posteingang, Archiv, Geloeschte, Junk)
     der letzten TAGE Tage. Nur Mails von Kunden-Adressen oder mit „Lippe Forst“/„LL-…“ im
     Betreff kommen weiter — alles andere im Postfach bleibt unberuehrt und unversandt.
  3. text.applescript: Kopfzeilen (Message-ID) und Klartext der passenden Mails.
  4. POST /api/verwaltung/postfach {mails: [...]} -> die Verwaltung ordnet zu und legt je Mail
     ein Ticket mit Vorschlag an. Geaendert wird dort erst per Klick; an Kunden geht nichts.

Per launchd gestartete Prozesse duerfen Outlook.sqlite nicht lesen (macOS-TCC) — Apple Events
an Outlook sind erlaubt (wie beim DHL-Rechnungsabgleich). Deshalb nur AppleScript.
HTTP ueber curl: die python.org-Installation auf diesem Mac hat keine CA-Zertifikate.

Konfiguration: ~/.config/lippeforst/postfach.env (chmod 600); Umgebungsvariablen LF_… gehen vor
    LF_POSTFACH_TOKEN=…            (gleich wie in Vercel, Pflicht)
    LF_URL=https://lippeforst.de   (optional; fuer Tests http://localhost:3000)
    LF_POSTFACH_KONTO=info@tr-immobilien.com  (optional)
    LF_POSTFACH_TAGE=14            (optional, Rueckblick je Lauf)
    LF_POSTFACH_ZUSTAND=…          (optional; fuer Tests eine eigene Datei, sonst gelten Mails als gemeldet)
Gemeldete Mails merkt sich ~/Library/Application Support/lippeforst-postfach/zustand.json
(die Verwaltung erkennt Dubletten zusaetzlich an der Message-ID).

Nach dem Wechsel auf das neue Outlook (Legacy-Outlook endet am 1.11.2026) gibt es kein
AppleScript mehr — dann dieselbe Schnittstelle aus einem Vercel-Cron ueber Microsoft Graph
fuettern (braucht eine App-Registrierung mit Mail.Read fuer das Postfach).
"""
import hashlib, json, os, re, subprocess, sys, tempfile
from datetime import datetime, timedelta

HIER = os.path.dirname(os.path.abspath(__file__))
KONFIG = os.path.expanduser("~/.config/lippeforst/postfach.env")
ZUSTAND = os.path.expanduser("~/Library/Application Support/lippeforst-postfach/zustand.json")
TRENNER = "=====LIPPEFORST-TEXT====="
MERKEN_TAGE = 90
STAPEL = 20


def log(msg):
    print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {msg}", flush=True)


def konfig():
    """Datei ~/.config/lippeforst/postfach.env; Umgebungsvariablen LF_… haben Vorrang (Tests gegen den lokalen Server)."""
    out = {"LF_URL": "https://lippeforst.de", "LF_POSTFACH_KONTO": "info@tr-immobilien.com", "LF_POSTFACH_TAGE": "14", "LF_POSTFACH_ZUSTAND": ZUSTAND}
    if os.path.exists(KONFIG):
        for zeile in open(KONFIG, encoding="utf-8"):
            zeile = zeile.strip()
            if "=" in zeile and not zeile.startswith("#"):
                k, v = zeile.split("=", 1)
                out[k.strip()] = v.strip().strip('"').strip("'")
    out.update({k: v for k, v in os.environ.items() if k.startswith("LF_") and v})
    return out


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
        zeilen = open(ziel, encoding="utf-8").read().splitlines()
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
        roh = open(ziel, encoding="utf-8").read()
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
        return json.load(open(pfad, encoding="utf-8"))
    except (OSError, ValueError):
        return {"gemeldet": {}}


def zustand_speichern(pfad, z):
    os.makedirs(os.path.dirname(pfad), exist_ok=True)
    grenze = (datetime.now() - timedelta(days=MERKEN_TAGE)).isoformat()
    z["gemeldet"] = {k: v for k, v in z.get("gemeldet", {}).items() if v >= grenze}
    tmp = pfad + ".neu"
    json.dump(z, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    os.replace(tmp, pfad)


def relevant(m, adressen):
    b = m["betreff"].lower()
    return hashlib.sha256(m["von"].encode("utf-8")).hexdigest() in adressen or "lippe forst" in b or "lippeforst" in b or re.search(r"\bll-[a-z0-9]{6,12}\b", b) is not None


def main():
    trocken = "--trocken" in sys.argv
    cfg = konfig()
    token = cfg.get("LF_POSTFACH_TOKEN", "")
    if len(token) < 32:
        log(f"FEHLER: LF_POSTFACH_TOKEN fehlt in {KONFIG}")
        return 2
    basis = cfg["LF_URL"].rstrip("/")
    tage = int(sys.argv[sys.argv.index("--tage") + 1]) if "--tage" in sys.argv else int(cfg["LF_POSTFACH_TAGE"])
    api = f"{basis}/api/verwaltung/postfach"

    code, antwort = http("GET", api, token)
    if code != 200 or not antwort.get("ok"):
        log(f"FEHLER: Adressen nicht abrufbar (HTTP {code}): {str(antwort)[:200]}")
        return 1
    adressen = set(antwort.get("adressen", []))

    zpfad = os.path.expanduser(cfg["LF_POSTFACH_ZUSTAND"])
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

    if trocken:
        for m in mails:
            log(f"  [trocken] {m['am']} {m['von']} — {m['betreff'][:70]}")
        return 0

    zaehler = {}
    for i in range(0, len(mails), STAPEL):
        stapel = mails[i:i + STAPEL]
        code, antwort = http("POST", api, token, {"mails": [{k: v for k, v in m.items() if k != "rid"} for m in stapel]})
        if code != 200 or not antwort.get("ok"):
            log(f"FEHLER beim Melden (HTTP {code}): {str(antwort)[:300]}")
            return 1
        nach_id = {e.get("id"): e for e in antwort.get("ergebnisse", [])}
        jetzt = datetime.now().isoformat()
        for m in stapel:
            e = nach_id.get(m["id"].strip("<>"), {})
            art = e.get("ergebnis", "?")
            zaehler[art] = zaehler.get(art, 0) + 1
            if art in ("neu", "bekannt", "unzugeordnet", "intern"):
                gemeldet[m["rid"]] = jetzt
            if art == "neu":
                log(f"  neu: {m['von']} -> {e.get('anfrage')} (Vorschlag: {e.get('vorschlag') or 'selbst einordnen'})")
        zustand_speichern(zpfad, z)
    log("gemeldet: " + ", ".join(f"{k} {v}" for k, v in sorted(zaehler.items())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
