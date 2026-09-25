import "server-only";
import { revalidatePath } from "next/cache";
import { LEAD_STATUS, ableitenAusAnliegen, type LeadStatus } from "@/lib/admin/model";
import { mutateZustand } from "@/lib/admin/store";
import { boerseNeuSchreiben } from "@/lib/boerse";
import * as A from "./ablauf";
import { adminInfo } from "./mail";
import { RUECKMELDUNG_NAME, antwortGruppe, antwortOptionen, istBeratungThema, istSuchAntwort, themaVorschlag, type RueckmeldungArt } from "./rueckmeldung-typen";
import { ladeKunde, ladeVorgang } from "./speicher";
import * as T from "./texte";

// Rückmeldung auf die Nachfass-Mail speichern — vom Kunden über den Antwort-Link
// (/kunde/antwort), von der Verwaltung erfasst (Anfrage → „Rückmeldung erfassen“)
// oder aus einer E-Mail im Anfragenpostfach übernommen (Postfach-Abgleich,
// lib/portal/postfach.ts). Aus jeder Antwort wird ein Ticket: Die
// Anfrage steht wieder auf „Neu“ und oben im Dashboard unter „Rückmeldungen“
// mit dem vorgeschlagenen Schritt, bis sie bearbeitet ist (Einladung gesendet,
// als beantwortet markiert …). „Kein Interesse“ setzt sie auf „Erledigt“ und
// nimmt ein Börsen-Angebot von der Website. Verkaufen/Verpachten ordnet die
// Anfrage als Angebot mit passender Art ein, Pachten/Kaufen („sucht selbst“) als
// Gesuch (beides nicht mehr nach einer Unterschrift).
// An den Kunden geht keine Mail; die Verwaltung bekommt bei Antworten über den
// Link eine Meldung.

export type RueckmeldungEingabe = { art: RueckmeldungArt; thema?: string; text?: string };

export type RueckmeldungQuelle = "link" | "verwaltung" | "email";

export type RueckmeldungErgebnis =
  | { ok: true; art: RueckmeldungArt; status: LeadStatus; doppelt?: boolean }
  | { ok: false; code: "anfrage" | "auswahl" | "zuviel"; fehler: string };

/** Gleiche Antwort innerhalb dieser Zeit (Doppelklick, Zurück-Taste) nicht erneut speichern und melden. */
const DOPPELT_MS = 10 * 60_000;
/** Mail an die Verwaltung: bei gleicher Antwort (nur Text geändert) höchstens stündlich. */
const MELDUNG_PAUSE_MS = 60 * 60_000;
/** Höchstens so viele Antworten über den Link je Anfrage und 24 Stunden. */
const MAX_JE_TAG = 20;
const TAG_MS = 86_400_000;

function bereinigen(s: string | undefined, max: number): string {
  return (s ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function kuerzen(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export async function rueckmeldungSpeichern(
  id: string,
  e: RueckmeldungEingabe,
  opts: { quelle: RueckmeldungQuelle; von: string; basis: string; /** E-Mail aus dem Postfach, aus der die Antwort stammt. */ mail?: string },
): Promise<RueckmeldungErgebnis> {
  const geladen = await A.ladeLead(id);
  if (!geladen || geladen.lead.status === "archiv") return { ok: false, code: "anfrage", fehler: "Anfrage nicht gefunden." };
  const l = geladen.lead;
  // Die Verwaltung (auch beim Übernehmen einer E-Mail) darf jede Einordnung wählen, der Antwort-Link nur die angebotenen.
  if (!antwortOptionen(antwortGruppe(l.rolle), undefined, opts.quelle !== "link").includes(e.art)) return { ok: false, code: "auswahl", fehler: "Diese Antwort passt nicht zur Anfrage." };
  const kunde = await ladeKunde(id);
  // Gesperrter Zugang: auch der Antwort-Link gilt nicht mehr.
  if (opts.quelle === "link" && kunde?.gesperrt) return { ok: false, code: "anfrage", fehler: "Zugang gesperrt." };
  const thema = e.art === "beratung" ? (istBeratungThema(e.thema ?? "") ? e.thema! : (themaVorschlag(T.wert(l.intent), T.wert(l.flaechentyp)) ?? "Etwas anderes")) : undefined;
  const text = bereinigen(e.text, 1500) || undefined;
  // Worte des Kunden (Antwort-Link, E-Mail) stehen als `text`, Eingaben der Verwaltung als interne `notiz`.
  const feld = opts.quelle === "verwaltung" ? "notiz" : "text";

  // Laufende Vorgänge (vorgemerkt bis Abschluss, nicht ohne Abschluss beendet): dort wird entschieden, nicht hier.
  const vorgaenge: string[] = [];
  for (const [key, pm] of Object.entries(geladen.zustand.paare)) {
    if (!key.split("~").includes(id) || pm.status === "vorschlag" || pm.status === "verworfen") continue;
    const v = await ladeVorgang(key);
    if (v?.beendet && !v.abschluss) continue;
    vorgaenge.push(key);
  }
  const imVorgang = vorgaenge.length > 0;

  const am = new Date().toISOString();
  const jetzt = Date.parse(am);
  // Wird im Callback gesetzt (bei Konflikten ggf. mehrfach ausgeführt) — daher nicht auf „false“ verengen.
  let artGeaendert = false as boolean;
  let boerseAendern = false as boolean;
  let melden = false as boolean;
  let ergebnis: RueckmeldungErgebnis = { ok: true, art: e.art, status: l.status };
  await mutateZustand(opts.von, (z) => {
    artGeaendert = false;
    boerseAendern = false;
    melden = false;
    const meta = { ...(z.anfragen[id] ?? {}) };
    const vorher = meta.rueckmeldung;
    const statusVorher = meta.status ?? "neu";
    // Doppelt abgeschickt (Zurück-Taste, Doppelklick) — frisch gelesen, damit auch zwei schnelle Klicks nur einmal zählen.
    if (vorher && vorher.quelle === opts.quelle && vorher.art === e.art && vorher.thema === thema && vorher[feld] === text && jetzt - Date.parse(vorher.am) < DOPPELT_MS) {
      ergebnis = { ok: true, art: e.art, status: statusVorher, doppelt: true };
      return;
    }
    let zaehler = vorher?.zaehler;
    if (opts.quelle === "link") {
      zaehler = zaehler && jetzt - Date.parse(zaehler.seit) < TAG_MS ? { seit: zaehler.seit, n: zaehler.n + 1 } : { seit: am, n: 1 };
      if (zaehler.n > MAX_JE_TAG) {
        ergebnis = { ok: false, code: "zuviel", fehler: "Zu viele Antworten über diesen Link — bitte später erneut oder per E-Mail." };
        return;
      }
    }
    // Mail an die Verwaltung: bei neuer Antwort sofort, bei gleicher Antwort (nur Text geändert) höchstens stündlich.
    const neueAntwort = !vorher || vorher.art !== e.art || vorher.thema !== thema;
    melden = opts.quelle === "link" && (neueAntwort || !vorher?.gemeldetAm || jetzt - Date.parse(vorher.gemeldetAm) > MELDUNG_PAUSE_MS);

    meta.rueckmeldung = {
      am,
      art: e.art,
      quelle: opts.quelle,
      ...(thema ? { thema } : {}),
      ...(text ? { [feld]: text } : {}),
      ...(opts.quelle !== "link" ? { von: opts.von } : {}),
      ...(opts.mail ? { mail: opts.mail } : {}),
      ...(imVorgang ? { vorgaenge } : {}),
      ...(melden ? { gemeldetAm: am } : vorher?.gemeldetAm ? { gemeldetAm: vorher.gemeldetAm } : {}),
      ...(zaehler ? { zaehler } : {}),
    };
    const woher = { link: "über den Antwort-Link", verwaltung: "erfasst (Antwort per E-Mail o. Ä.)", email: "aus der E-Mail des Kunden übernommen" }[opts.quelle];
    const teile = [
      `Rückmeldung ${woher}: ${RUECKMELDUNG_NAME[e.art]}${thema ? ` – ${thema}` : ""}${text ? ` · ${feld === "notiz" ? "Notiz: " : ""}„${kuerzen(text, 240)}“` : ""}`,
    ];

    // Verkaufen/Verpachten: als Angebot, Pachten/Kaufen („sucht selbst“): als Gesuch mit passender Art einordnen —
    // nicht nach einer Unterschrift und nicht mitten in einem Vorgang.
    const suchAntwort = istSuchAntwort(e.art);
    if ((e.art === "verkaufen" || e.art === "verpachten" || suchAntwort) && !kunde?.vertrag && !imVorgang) {
      const zielRolle = suchAntwort ? "gesuch" : "angebot";
      const ziel = e.art === "verkaufen" || e.art === "kaufen" ? "kauf" : "pacht";
      const abgeleitet = ableitenAusAnliegen(l.intent);
      const rolle = meta.rolle ?? abgeleitet.rolle;
      const art = meta.art !== undefined ? meta.art : abgeleitet.art;
      if (rolle !== zielRolle || art !== ziel) {
        meta.rolle = zielRolle;
        meta.art = ziel;
        artGeaendert = true;
        teile.push(`Einordnung → ${zielRolle === "gesuch" ? "Gesuch" : "Angebot"} · ${ziel === "kauf" ? "Kauf" : "Pacht"}`);
      }
      // Wer selbst sucht, bietet nichts an: ein Börsen-Angebot geht sofort offline.
      if (suchAntwort && meta.boerse?.online) {
        meta.boerse = { ...meta.boerse, online: false, geaendert: { am, von: opts.von } };
        boerseAendern = true;
        teile.push("Flächenbörse: offline (jetzt Gesuch)");
      }
    }

    let status: LeadStatus = statusVorher;
    if (e.art === "kein-interesse") {
      if (imVorgang) {
        // Im laufenden Vorgang: „kein Interesse“ wie im Kundenbereich am Paar vermerken — der Assistent stoppt Erinnerungen, die Verwaltung entscheidet.
        for (const key of vorgaenge) {
          const pm = z.paare[key];
          if (!pm || pm.status === "abschluss" || pm.ablehnung) continue;
          z.paare[key] = { ...pm, ablehnung: { rolle: key.split("~")[0] === id ? "anbieter" : "suchender", am, grund: "Antwort-Link der Nachfass-Mail: kein Interesse" }, geaendert: { am, von: opts.von } };
          teile.push(`Vorgang ${key}: „kein Interesse“ vermerkt`);
        }
      } else {
        status = "erledigt";
      }
    } else {
      // Antwort = Ticket (Status „Neu“). Eine erledigte Anfrage lebt wieder auf — ein Börsen-Angebot bleibt dabei offline, bis es neu veröffentlicht wird.
      status = "neu";
      if (statusVorher === "erledigt" && meta.boerse?.online) {
        meta.boerse = { ...meta.boerse, online: false, geaendert: { am, von: opts.von } };
        boerseAendern = true;
        teile.push("Flächenbörse bleibt offline (Anfrage war erledigt) — bei Bedarf neu veröffentlichen");
      }
    }
    if (status === "erledigt" && meta.boerse?.online) {
      meta.boerse = { ...meta.boerse, online: false, geaendert: { am, von: opts.von } };
      boerseAendern = true;
      teile.push("Flächenbörse: offline");
    }
    if (artGeaendert && meta.boerse?.online) boerseAendern = true;
    if (statusVorher !== status) {
      meta.status = status;
      teile.push(`Status → ${LEAD_STATUS[status].label}`);
    }
    meta.geaendert = { am, von: opts.von };
    z.anfragen[id] = meta;
    ergebnis = { ok: true, art: e.art, status };

    // Verlauf nicht fluten: eine frühere Link-Antwort derselben Anfrage aus der letzten Stunde wird ersetzt.
    if (opts.quelle === "link") {
      const i = z.protokoll.findIndex((p) => p.ref === id);
      const p = i >= 0 ? z.protokoll[i] : null;
      if (p && p.von === opts.von && p.was.startsWith("Rückmeldung über den Antwort-Link") && jetzt - Date.parse(p.am) < MELDUNG_PAUSE_MS) z.protokoll.splice(i, 1);
    }
    return { was: teile.join(" · "), ref: id };
  });
  if (!ergebnis.ok || ergebnis.doppelt) return ergebnis;

  // Die Kundenakte (noch ohne Unterschrift) folgt der neuen Einordnung — eine spätere Einladung passt dann zur Art.
  if (artGeaendert && kunde && !kunde.vertrag) {
    const frisch = await A.ladeLead(id);
    if (frisch) await A.kundeSicherstellen(frisch.lead, opts.von).catch((err) => console.error("[rueckmeldung] Kundenakte nicht angepasst", id, err));
  }
  // Börse sofort neu schreiben, wenn ein Angebot offline geht oder seine Art („Zum Kauf/Zur Pacht“) wechselt.
  let boerseFehler = false;
  if (boerseAendern) {
    try {
      await boerseNeuSchreiben();
    } catch (err) {
      boerseFehler = true;
      console.error("[rueckmeldung] Flächenbörse nicht neu geschrieben", id, err);
    }
  }

  if (melden) {
    const name = kunde?.stammdaten?.name || T.wert(l.name) || id;
    const ort = T.wert(l.ort);
    await adminInfo(
      `Rückmeldung: ${name} – ${RUECKMELDUNG_NAME[e.art]}`,
      [
        `${name} hat über den Antwort-Link der Nachfass-Mail geantwortet: ${RUECKMELDUNG_NAME[e.art]}${thema ? ` (Thema: ${thema})` : ""}.`,
        ...(text ? ["", "Nachricht:", text] : []),
        "",
        `Anfrage ${id} vom ${T.datumDe(l.receivedAt)}: ${T.wert(l.intent) || "—"}${ort ? `, ${ort}` : ""}`,
        ...(artGeaendert
          ? [`Die Anfrage ist jetzt als ${istSuchAntwort(e.art) ? "Gesuch" : "Angebot"} ${e.art === "verkaufen" || e.art === "kaufen" ? "zum Kauf" : "zur Pacht"} eingeordnet.`]
          : []),
        imVorgang
          ? `Achtung: Die Anfrage steckt in einem laufenden Vorgang (${vorgaenge.join(", ")}) — ${e.art === "kein-interesse" ? "„kein Interesse“ ist dort vermerkt, bitte im Vorgang entscheiden" : "bitte im Vorgang prüfen; die Einordnung wurde nicht geändert"}.`
          : e.art === "kein-interesse"
            ? "Die Anfrage steht jetzt auf „Erledigt“. An den Kunden geht keine weitere E-Mail."
            : "Die Anfrage steht wieder auf „Neu“ und oben im Dashboard unter „Rückmeldungen“ – mit dem vorgeschlagenen nächsten Schritt.",
        ...(boerseFehler ? ["ACHTUNG: Die Flächenbörse konnte nicht aktualisiert werden – bitte im Dashboard prüfen."] : []),
      ],
      `${opts.basis}/admin/dashboard#rueckmeldungen`,
    );
  }
  revalidatePath("/admin", "layout");
  return ergebnis;
}
