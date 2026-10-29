#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""JSON-Quelle des Postfach-Abgleichs, inklusive Dublettenschutz.

    python3 scripts/postfach/test_abgleich.py
    python3 -m unittest scripts/postfach/test_abgleich.py
"""
import hashlib, importlib.util, json, os, sys, tempfile, unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

HIER = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("postfach_abgleich", HIER / "abgleich.py")
abgleich = importlib.util.module_from_spec(spec)
spec.loader.exec_module(abgleich)

BEISPIEL = HIER / "beispiel"


def sha(adresse):
    return hashlib.sha256(adresse.encode("utf-8")).hexdigest()


class Api:
    def __init__(self):
        self.posts = []
        self.gets = 0
        self.urls = []
        self.tokens = []
        self.adressen = []
        self.bekannt = set()
        self.get_code = 200
        self.post_code = 200
        self.modus = "neu"

    def http(self, methode, url, token, daten=None):
        self.tokens.append(token)
        self.urls.append(url)
        if methode == "GET":
            self.gets += 1
            if self.get_code != 200:
                return self.get_code, {"ok": False, "fehler": "nein"}
            return 200, {"ok": True, "adressen": list(self.adressen)}
        self.posts.append(daten)
        if self.post_code != 200:
            return self.post_code, {"ok": False, "fehler": "kaputt"}
        ergebnisse = []
        for m in daten.get("mails", []):
            if self.modus == "unzugeordnet":
                ergebnisse.append({"id": m["id"], "ergebnis": "unzugeordnet"})
            elif m["id"] in self.bekannt:
                ergebnisse.append({"id": m["id"], "ergebnis": "bekannt", "anfrage": "LL-BEKANNT01"})
            else:
                self.bekannt.add(m["id"])
                ergebnisse.append({"id": m["id"], "ergebnis": "neu", "anfrage": "LL-NEUTEST01", "vorschlag": "kein-interesse"})
        return 200, {"ok": True, "ergebnisse": ergebnisse}


def verboten(*_a, **_k):
    raise AssertionError("Outlook/AppleScript wurde aufgerufen")


class AbgleichTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self._env = dict(os.environ)
        self._argv = sys.argv[:]
        self._konfig = abgleich.KONFIG
        self._http = abgleich.http
        self._scan = abgleich.scan
        self._volltext = abgleich.volltext
        self._osascript = abgleich.osascript
        self._log = abgleich._logdatei["pfad"]
        self.addCleanup(self._restore)
        for k in list(os.environ):
            if k.startswith("LF_"):
                del os.environ[k]
        abgleich.KONFIG = os.path.join(self.tmp.name, "keine-postfach.env")
        abgleich._logdatei["pfad"] = ""
        abgleich.osascript = verboten
        abgleich.scan = verboten
        abgleich.volltext = verboten
        self.api = Api()
        abgleich.http = self.api.http
        os.environ["LF_POSTFACH_TOKEN"] = "t" * 40
        os.environ["LF_URL"] = "http://127.0.0.1:9"
        os.environ["LF_POSTFACH_ZUSTAND"] = os.path.join(self.tmp.name, "zustand.json")
        os.environ["LF_POSTFACH_LOG"] = os.path.join(self.tmp.name, "lauf.log")

    def _restore(self):
        os.environ.clear()
        os.environ.update(self._env)
        sys.argv = self._argv
        abgleich.KONFIG = self._konfig
        abgleich.http = self._http
        abgleich.scan = self._scan
        abgleich.volltext = self._volltext
        abgleich.osascript = self._osascript
        abgleich._logdatei["pfad"] = self._log

    def run_abgleich(self, *args):
        sys.argv = ["abgleich.py", *args]
        return abgleich.main()

    def nachricht(self, **kw):
        basis = {
            "id": "AAMkAGTest1",
            "internetMessageId": "<kunde-1@example.com>",
            "receivedDateTime": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "from": {"emailAddress": {"name": "Erika Beispiel", "address": "erika@example.com"}},
            "toRecipients": [{"emailAddress": {"name": "TR Vertriebs GmbH", "address": "info@tr-immobilien.com"}}],
            "subject": "Re: Lippe Forst",
            "body": {"contentType": "text", "content": "kein Interesse"},
            "parentFolderName": "Posteingang",
            "anhaenge": [],
        }
        basis.update(kw)
        return basis

    def schreibe(self, nachrichten, name="export"):
        export = os.path.join(self.tmp.name, name)
        os.makedirs(export, exist_ok=True)
        with open(os.path.join(export, "nachrichten.json"), "w", encoding="utf-8") as f:
            json.dump(nachrichten, f, ensure_ascii=False)
        return export

    def lies(self, export):
        with open(os.path.join(export, "ergebnis.json"), encoding="utf-8") as f:
            return json.load(f)

    def test_konfig_pfad_und_zustand_aufloesung(self):
        self.assertTrue(self._konfig.endswith("/.config/lippeforst/postfach.env"))
        self.assertEqual(abgleich.zustand_pfad({}), abgleich.ZUSTAND)
        self.assertEqual(
            abgleich.zustand_pfad({"LF_POSTFACH_ZUSTAND": "/tmp/a.json", "LF_POSTFACH_ZUSTAND_DIR": "/var/lib/lf"}),
            "/tmp/a.json",
        )
        pfad = abgleich.zustand_pfad({"LF_POSTFACH_ZUSTAND_DIR": "~/lf-test-zustand"})
        self.assertTrue(pfad.endswith("/lf-test-zustand/zustand.json"))
        self.assertFalse(pfad.startswith("~"))
        self.assertEqual(abgleich.log_pfad({}), "")

    def test_parse_args(self):
        self.assertEqual(abgleich.parse_args(["abgleich.py"])[0], "outlook")
        self.assertEqual(abgleich.parse_args(["abgleich.py"])[2], "")
        self.assertIn("--export", abgleich.parse_args(["abgleich.py", "--export", "/tmp/x"])[2])
        self.assertIn("--export", abgleich.parse_args(["abgleich.py", "--quelle", "json"])[2])
        quelle, export, fehler = abgleich.parse_args(["abgleich.py", "--quelle", "JSON", "--export", "/tmp/x"])
        self.assertEqual((quelle, export, fehler), ("json", "/tmp/x", ""))

    def test_relevanz_unveraendert(self):
        self.assertTrue(abgleich.relevant({"von": "x@y.z", "betreff": "Nr. LL-BEISPIEL"}, set()))
        self.assertTrue(abgleich.relevant({"von": "x@y.z", "betreff": "Lippeforst"}, set()))
        self.assertFalse(abgleich.relevant({"von": "x@y.z", "betreff": "Hallo"}, set()))
        self.assertTrue(abgleich.relevant({"von": "erika@example.com", "betreff": "Hallo"}, {sha("erika@example.com")}))

    def test_html_und_zeit(self):
        text = abgleich.html_zu_text(
            '<html><script>alert(1)</script><p>kein Interesse</p>'
            '<p><a href="https://lippeforst.de/kunde/antwort?t=abcdefghij.klmnopqrst">Antwort</a></p></html>'
        )
        self.assertIn("kein Interesse", text)
        self.assertIn("https://lippeforst.de/kunde/antwort?t=abcdefghij.klmnopqrst", text)
        self.assertNotIn("<p>", text)
        self.assertNotIn("alert", text)
        self.assertIsNotNone(abgleich.zeit_utc("2026-10-28T07:40:00.1234567Z"))
        self.assertIsNone(abgleich.zeit_utc("gestern"))

    def test_beispiel_datei(self):
        daten = abgleich.lade_nachrichten(str(BEISPIEL))
        pflicht = {"id", "internetMessageId", "receivedDateTime", "from", "toRecipients", "subject", "body", "parentFolderName", "anhaenge"}
        self.assertGreaterEqual(len(daten), 2)
        for eintrag in daten:
            self.assertTrue(pflicht <= set(eintrag))
            self.assertIn(eintrag["parentFolderName"], ("Posteingang", "Junk-E-Mail"))
            self.assertIn(eintrag["body"]["contentType"], ("text", "html"))
            for anhang in eintrag["anhaenge"]:
                self.assertTrue({"name", "contentType", "size", "pfad"} <= set(anhang))
                datei = BEISPIEL / anhang["pfad"]
                self.assertTrue(datei.is_file(), anhang["pfad"])
                self.assertEqual(datei.stat().st_size, anhang["size"])
        seit = datetime(2020, 1, 1, tzinfo=timezone.utc)
        gesehen, mails, probleme = abgleich.nachrichten_filtern(str(BEISPIEL), daten, seit, set(), {})
        self.assertEqual(gesehen, 2)
        self.assertEqual(probleme, [])
        nach_id = {m["id"]: m for m in mails}
        self.assertEqual(set(nach_id), {"beispiel-1@example.com", "beispiel-2@example.com"})
        self.assertEqual(nach_id["beispiel-1@example.com"]["rid"], "AAMkAGBeispiel1")
        self.assertNotIn("<", nach_id["beispiel-2@example.com"]["id"])
        junk = nach_id["beispiel-2@example.com"]["text"]
        self.assertIn("kein Interesse", junk)
        self.assertIn("https://lippeforst.de/kunde/antwort?t=abcdefghij.klmnopqrst", junk)
        self.assertNotIn("<a", junk)

    def test_json_meldet_und_dedupe(self):
        export = self.schreibe([self.nachricht()])
        self.assertFalse(os.path.exists(abgleich.KONFIG))
        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", export), 0)
        self.assertEqual(len(self.api.posts), 1)
        self.assertEqual(self.api.posts[0]["mails"][0]["id"], "kunde-1@example.com")
        self.assertEqual(self.api.posts[0]["mails"][0]["von"], "erika@example.com")
        self.assertEqual(set(self.api.posts[0]["mails"][0]), {"id", "am", "von", "betreff", "text"})
        erg = self.lies(export)
        self.assertTrue(erg["ok"])
        self.assertEqual(erg["exit"], 0)
        self.assertFalse(erg["trocken"])
        self.assertEqual(erg["angelegt"], ["AAMkAGTest1"])
        self.assertEqual(erg["zugeordnet"][0]["ergebnis"], "neu")
        self.assertEqual(erg["zugeordnet"][0]["anfrage"], "LL-NEUTEST01")
        self.assertEqual(erg["zugeordnet"][0]["internetMessageId"], "kunde-1@example.com")
        with open(os.environ["LF_POSTFACH_ZUSTAND"], encoding="utf-8") as f:
            stand = json.load(f)
        self.assertIn("AAMkAGTest1", stand["gemeldet"])
        self.assertIn("kunde-1@example.com", stand["gemeldet"])
        with open(os.environ["LF_POSTFACH_LOG"], encoding="utf-8") as f:
            protokoll = f.read()
        self.assertIn("neu passend", protokoll)
        self.assertIn("neu: erika@example.com -> LL-NEUTEST01", protokoll)

        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", export), 0)
        self.assertEqual(len(self.api.posts), 1)
        erg2 = self.lies(export)
        self.assertEqual(erg2["gesehen"], 1)
        self.assertEqual(erg2["neuPassend"], 0)
        self.assertEqual(erg2["angelegt"], [])

        self.schreibe([self.nachricht(id="AAMkAGNachVerschieben")])
        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", export), 0)
        self.assertEqual(len(self.api.posts), 1)

    def test_umzug_outlook_zustand_legt_nicht_neu_an(self):
        with open(os.environ["LF_POSTFACH_ZUSTAND"], "w", encoding="utf-8") as f:
            json.dump({"gemeldet": {"424242": datetime.now().isoformat()}}, f)
        self.api.bekannt.add("kunde-1@example.com")
        export = self.schreibe([self.nachricht()])
        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", export), 0)
        self.assertEqual(len(self.api.posts), 1)
        self.assertEqual(self.api.posts[0]["mails"][0]["id"], "kunde-1@example.com")
        erg = self.lies(export)
        self.assertEqual(erg["angelegt"], [])
        self.assertEqual(erg["zugeordnet"][0]["ergebnis"], "bekannt")
        self.assertEqual(erg["zugeordnet"][0]["anfrage"], "LL-BEKANNT01")
        self.assertEqual(erg["zugeordnet"][0]["id"], "AAMkAGTest1")
        with open(os.environ["LF_POSTFACH_ZUSTAND"], encoding="utf-8") as f:
            stand = json.load(f)
        self.assertIn("424242", stand["gemeldet"])
        self.assertIn("AAMkAGTest1", stand["gemeldet"])
        self.assertIn("kunde-1@example.com", stand["gemeldet"])
        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", export), 0)
        self.assertEqual(len(self.api.posts), 1)

    def test_mac_merkt_nur_outlook_id_und_ruft_scan(self):
        def scan(seit, konto):
            self.assertEqual(konto, "info@tr-immobilien.com")
            return [{"rid": "42", "ordner": "Posteingang", "zeit": "2026-10-28 10:00:00", "von": "erika@example.com", "betreff": "Re: Lippe Forst"}]

        def volltext(rid):
            self.assertEqual(rid, "42")
            return ("abc@example.com", "Kein Interesse, danke.")

        abgleich.scan = scan
        abgleich.volltext = volltext
        self.assertEqual(self.run_abgleich(), 0)
        self.assertEqual(len(self.api.posts), 1)
        mail = self.api.posts[0]["mails"][0]
        self.assertEqual(mail["id"], "abc@example.com")
        self.assertEqual(set(mail), {"id", "am", "von", "betreff", "text"})
        self.assertIn("2026-10-28", mail["am"])
        with open(os.environ["LF_POSTFACH_ZUSTAND"], encoding="utf-8") as f:
            stand = json.load(f)
        self.assertEqual(set(stand["gemeldet"]), {"42"})

    def test_mac_trocken_schreibt_keinen_zustand(self):
        abgleich.scan = lambda seit, konto: [{"rid": "7", "ordner": "Posteingang", "zeit": "2026-10-28 10:00:00", "von": "erika@example.com", "betreff": "Lippe Forst"}]
        abgleich.volltext = lambda rid: ("mid@example.com", "Text")
        self.assertEqual(self.run_abgleich("--trocken"), 0)
        self.assertEqual(self.api.posts, [])
        self.assertFalse(os.path.exists(os.environ["LF_POSTFACH_ZUSTAND"]))

    def test_json_trocken_ohne_zustand(self):
        export = self.schreibe([self.nachricht()])
        self.assertEqual(self.run_abgleich("--quelle", "JSON", "--export", export, "--trocken"), 0)
        self.assertEqual(self.api.posts, [])
        self.assertEqual(self.api.gets, 1)
        erg = self.lies(export)
        self.assertTrue(erg["trocken"])
        self.assertEqual(erg["vorgesehen"][0]["id"], "AAMkAGTest1")
        self.assertEqual(erg["angelegt"], [])
        self.assertFalse(os.path.exists(os.environ["LF_POSTFACH_ZUSTAND"]))
        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", export, "--trocken"), 0)
        self.assertEqual(self.api.posts, [])
        self.assertEqual(self.lies(export)["vorgesehen"][0]["internetMessageId"], "kunde-1@example.com")

    def test_fenster_junk_html_und_hash(self):
        neu = (datetime.now(timezone.utc) - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
        alt = (datetime.now(timezone.utc) - timedelta(days=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
        self.api.adressen = [sha("erika@example.com")]
        export = self.schreibe([
            self.nachricht(id="alt", internetMessageId="<alt@example.com>", receivedDateTime=alt, subject="Lippe Forst alt"),
            self.nachricht(
                id="junk",
                internetMessageId="<junk@example.com>",
                receivedDateTime=neu,
                subject="nur Hash",
                parentFolderName="Junk-E-Mail",
                body={
                    "contentType": "HTML",
                    "content": '<p>Hallo</p><p><a href="https://lippeforst.de/kunde/antwort?t=abcdefghij.klmnopqrst">Link</a></p>',
                },
            ),
        ])
        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", export, "--tage", "1"), 0)
        self.assertEqual(len(self.api.posts), 1)
        self.assertEqual([m["id"] for m in self.api.posts[0]["mails"]], ["junk@example.com"])
        text = self.api.posts[0]["mails"][0]["text"]
        self.assertIn("https://lippeforst.de/kunde/antwort?t=abcdefghij.klmnopqrst", text)
        self.assertNotIn("<p>", text)
        self.assertEqual(self.api.posts[0]["mails"][0]["von"], "erika@example.com")

    def test_absender_in_klammern_wird_gehasht(self):
        self.api.adressen = [sha("erika@example.com")]
        export = self.schreibe([self.nachricht(
            subject="Hallo",
            **{"from": {"emailAddress": {"name": "Erika", "address": "Erika Beispiel <Erika@Example.com>"}}},
        )])
        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", export), 0)
        self.assertEqual(self.api.posts[0]["mails"][0]["von"], "erika@example.com")

    def test_irrelevant_alt_und_ohne_message_id(self):
        alt = (datetime.now(timezone.utc) - timedelta(days=40)).strftime("%Y-%m-%dT%H:%M:%SZ")
        ohne = self.nachricht(id="ohne", subject="Re: Lippe Forst")
        del ohne["internetMessageId"]
        export = self.schreibe([
            self.nachricht(id="fremd", internetMessageId="<fremd@example.com>", subject="Hallo", **{"from": {"emailAddress": {"name": "Fremd", "address": "fremd@example.com"}}}),
            self.nachricht(id="alt", internetMessageId="<alt@example.com>", receivedDateTime=alt),
            ohne,
        ])
        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", export), 0)
        self.assertEqual(self.api.posts, [])
        erg = self.lies(export)
        self.assertEqual(erg["neuPassend"], 0)
        self.assertEqual(erg["gesehen"], 1)
        self.assertTrue(any("internetMessageId" in p.get("text", "") for p in erg["abweichungen"]))
        self.assertFalse(any(p.get("id") == "alt" for p in erg["abweichungen"]))

    def test_unzugeordnet_wird_gemerkt(self):
        self.api.modus = "unzugeordnet"
        export = self.schreibe([self.nachricht()])
        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", export), 0)
        erg = self.lies(export)
        self.assertEqual(erg["angelegt"], [])
        self.assertEqual(erg["abweichungen"][0]["ergebnis"], "unzugeordnet")
        self.assertEqual(erg["abweichungen"][0]["id"], "AAMkAGTest1")
        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", export), 0)
        self.assertEqual(len(self.api.posts), 1)

    def test_anhang_fehlt_oder_bricht_aus_mail_geht_trotzdem(self):
        export = self.schreibe([self.nachricht(anhaenge=[
            {"name": "fehlt.txt", "contentType": "text/plain", "size": 1, "pfad": "anhaenge/fehlt.txt"},
            {"name": "ausbruch.txt", "contentType": "text/plain", "size": 1, "pfad": "../geheim.txt"},
        ])])
        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", export), 0)
        self.assertEqual(len(self.api.posts), 1)
        self.assertNotIn("anhaenge", self.api.posts[0]["mails"][0])
        texte = " ".join(p.get("text", "") for p in self.lies(export)["abweichungen"])
        self.assertIn("Datei fehlt", texte)
        self.assertIn("verlaesst", texte)

    def test_bom_und_zusaetzliche_graph_felder(self):
        export = self.schreibe([self.nachricht(isRead=True, parentFolderId="AAMkAGOrdner", attachments=[{"name": "nicht-verwenden"}])])
        pfad = os.path.join(export, "nachrichten.json")
        with open(pfad, "r", encoding="utf-8") as f:
            roh = f.read()
        with open(pfad, "w", encoding="utf-8-sig") as f:
            f.write(roh)
        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", export), 0)
        self.assertEqual(self.api.posts[0]["mails"][0]["id"], "kunde-1@example.com")

    def test_post_und_get_fehler(self):
        export = self.schreibe([self.nachricht()])
        self.api.post_code = 500
        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", export), 1)
        erg = self.lies(export)
        self.assertFalse(erg["ok"])
        self.assertEqual(erg["exit"], 1)
        self.assertTrue(any(p.get("ergebnis") == "fehler" for p in erg["abweichungen"]))
        self.assertFalse(os.path.exists(os.environ["LF_POSTFACH_ZUSTAND"]))

        self.api.post_code = 200
        self.api.get_code = 503
        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", export), 1)
        self.assertEqual(len(self.api.posts), 1)

    def test_schlechter_export(self):
        export = os.path.join(self.tmp.name, "leer")
        os.makedirs(export)
        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", export), 1)
        self.assertEqual(self.api.gets, 0)
        self.assertFalse(self.lies(export)["ok"])

        with open(os.path.join(export, "nachrichten.json"), "w", encoding="utf-8") as f:
            json.dump({"value": []}, f)
        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", export), 1)
        self.assertEqual(self.api.gets, 0)
        self.assertIn("Liste", self.lies(export)["abweichungen"][0]["text"])

        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", os.path.join(self.tmp.name, "weg")), 1)
        self.assertEqual(self.run_abgleich("--export", export), 2)
        self.assertEqual(self.run_abgleich("--quelle", "json"), 2)

    def test_token_fehlt_schreibt_ergebnis(self):
        del os.environ["LF_POSTFACH_TOKEN"]
        export = self.schreibe([self.nachricht()])
        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", export), 2)
        self.assertEqual(self.api.gets, 0)
        erg = self.lies(export)
        self.assertEqual(erg["exit"], 2)
        self.assertFalse(erg["ok"])
        self.assertIn("LF_POSTFACH_TOKEN", erg["abweichungen"][0]["text"])

    def test_umgebung_ersetzt_datei_und_zustandsverzeichnis(self):
        verzeichnis = os.path.join(self.tmp.name, "zustand-dir")
        konfig_pfad = os.path.join(self.tmp.name, "postfach.env")
        with open(konfig_pfad, "w", encoding="utf-8") as f:
            f.write("# nur falls keine Umgebung gesetzt ist\n")
            f.write('LF_POSTFACH_TOKEN="' + ("t" * 40) + '"\n')
            f.write("LF_URL=http://aus-datei.test\n")
            f.write(f"LF_POSTFACH_ZUSTAND_DIR={verzeichnis}\n")
        abgleich.KONFIG = konfig_pfad
        del os.environ["LF_POSTFACH_TOKEN"]
        del os.environ["LF_POSTFACH_ZUSTAND"]
        os.environ["LF_URL"] = "http://aus-env.test"
        mac_zustand = abgleich.ZUSTAND
        mac_vorher = os.path.exists(mac_zustand)
        export = self.schreibe([self.nachricht()])
        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", export), 0)
        self.assertEqual(self.api.urls[0], "http://aus-env.test/api/verwaltung/postfach")
        self.assertEqual(self.api.tokens[0], "t" * 40)
        self.assertTrue(os.path.isfile(os.path.join(verzeichnis, "zustand.json")))
        self.assertFalse(os.path.exists(os.path.join(self.tmp.name, "zustand.json")))
        if not mac_vorher:
            self.assertFalse(os.path.exists(mac_zustand))

    def test_log_nicht_gesetzt_oeffnet_keine_mac_logdatei(self):
        del os.environ["LF_POSTFACH_LOG"]
        mac_log = os.path.expanduser("~/Library/Logs/lippeforst-postfach.log")
        vorher = os.path.exists(mac_log)
        export = self.schreibe([self.nachricht()])
        self.assertEqual(self.run_abgleich("--quelle", "json", "--export", export, "--trocken"), 0)
        self.assertEqual(abgleich._logdatei["pfad"], "")
        self.assertFalse(os.path.exists(os.path.join(self.tmp.name, "lauf.log")))
        if not vorher:
            self.assertFalse(os.path.exists(mac_log))


if __name__ == "__main__":
    unittest.main()
