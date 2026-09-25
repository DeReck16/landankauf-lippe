import "server-only";
import { revalidatePath } from "next/cache";
import { LEAD_STATUS, ableitenAusAnliegen, type LeadStatus, type Rueckmeldung } from "@/lib/admin/model";
import { mutateZustand } from "@/lib/admin/store";
import { boerseNeuSchreiben } from "@/lib/boerse";
import * as A from "./ablauf";
import { adminInfo } from "./mail";
import { RUECKMELDUNG_NAME, antwortGruppe, antwortOptionen, istBeratungThema, themaVorschlag, type RueckmeldungArt } from "./rueckmeldung-typen";
import { ladeKunde } from "./speicher";
import * as T from "./texte";

// Rückmeldung auf die Nachfass-Mail speichern — vom Kunden über den Antwort-Link
// (/kunde/antwort) oder von der Verwaltung aus einer E-Mail-Antwort erfasst
// (Anfrage → „Rückmeldung erfassen“). Aus jeder Antwort wird ein Ticket: Die
// Anfrage steht wieder auf „Neu“ und oben im Dashboard unter „Rückmeldungen“
// mit dem vorgeschlagenen Schritt, bis sie bearbeitet ist (Einladung gesendet,
// als beantwortet markiert …). „Kein Interesse“ setzt sie auf „Erledigt“ und
// nimmt ein Börsen-Angebot von der Website. Verkaufen/Verpachten ordnet die
// Anfrage als Angebot mit passender Art ein (nicht mehr nach einer Unterschrift).
// An den Kunden geht keine Mail; die Verwaltung bekommt bei Antworten über den
// Link eine Meldung.

export type RueckmeldungEingabe = { art: RueckmeldungArt; thema?: string; text?: string };

export type RueckmeldungErgebnis =
  | { ok: true; art: RueckmeldungArt; status: LeadStatus; doppelt?: boolean }
  | { ok: false; code: "anfrage" | "auswahl"; fehler: string };

/** Gleiche Antwort innerhalb dieser Zeit (Doppelklick, Zurück-Taste) nicht erneut speichern und melden. */
const DOPPELT_MS = 10 * 60_000;

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
  opts: { quelle: "link" | "verwaltung"; von: string; basis: string },
): Promise<RueckmeldungErgebnis> {
  const geladen = await A.ladeLead(id);
  if (!geladen || geladen.lead.status === "archiv") return { ok: false, code: "anfrage", fehler: "Anfrage nicht gefunden." };
  const l = geladen.lead;
  if (!antwortOptionen(antwortGruppe(l.rolle)).includes(e.art)) return { ok: false, code: "auswahl", fehler: "Diese Antwort passt nicht zur Anfrage." };
  const thema = e.art === "beratung" ? (istBeratungThema(e.thema ?? "") ? e.thema! : (themaVorschlag(T.wert(l.intent), T.wert(l.flaechentyp)) ?? "Etwas anderes")) : undefined;
  const text = bereinigen(e.text, 1500) || undefined;
  const feld = opts.quelle === "link" ? "text" : "notiz";

  const vorher = l.meta.rueckmeldung;
  if (vorher && vorher.quelle === opts.quelle && vorher.art === e.art && vorher.thema === thema && vorher[feld] === text && Date.now() - Date.parse(vorher.am) < DOPPELT_MS) {
    return { ok: true, art: e.art, status: l.status, doppelt: true };
  }

  const kunde = await ladeKunde(id);
  const am = new Date().toISOString();
  const status: LeadStatus = e.art === "kein-interesse" ? "erledigt" : "neu";
  // Wird im Callback gesetzt (bei Konflikten ggf. mehrfach ausgeführt) — daher nicht auf „false“ verengen.
  let artGeaendert = false as boolean;
  await mutateZustand(opts.von, (z) => {
    artGeaendert = false;
    const meta = { ...(z.anfragen[id] ?? {}) };
    const r: Rueckmeldung = {
      am,
      art: e.art,
      quelle: opts.quelle,
      ...(thema ? { thema } : {}),
      ...(text ? { [feld]: text } : {}),
      ...(opts.quelle === "verwaltung" ? { von: opts.von } : {}),
    };
    meta.rueckmeldung = r;
    const teile = [
      `Rückmeldung ${opts.quelle === "link" ? "über den Antwort-Link" : "erfasst (Antwort per E-Mail o. Ä.)"}: ${RUECKMELDUNG_NAME[e.art]}${thema ? ` – ${thema}` : ""}${text ? ` · ${feld === "notiz" ? "Notiz: " : ""}„${kuerzen(text, 240)}“` : ""}`,
    ];
    // Verkaufen/Verpachten: als Angebot mit passender Art einordnen — so schlägt das Dashboard die richtige Einladung vor.
    if ((e.art === "verkaufen" || e.art === "verpachten") && !kunde?.vertrag) {
      const ziel = e.art === "verkaufen" ? "kauf" : "pacht";
      const abgeleitet = ableitenAusAnliegen(l.intent);
      const rolle = meta.rolle ?? abgeleitet.rolle;
      const art = meta.art !== undefined ? meta.art : abgeleitet.art;
      if (rolle !== "angebot" || art !== ziel) {
        meta.rolle = "angebot";
        meta.art = ziel;
        artGeaendert = true;
        teile.push(`Einordnung → Angebot · ${ziel === "kauf" ? "Kauf" : "Pacht"}`);
      }
    }
    if ((meta.status ?? "neu") !== status) {
      meta.status = status;
      teile.push(`Status → ${LEAD_STATUS[status].label}`);
    }
    meta.geaendert = { am, von: opts.von };
    z.anfragen[id] = meta;
    return { was: teile.join(" · "), ref: id };
  });

  // Die Kundenakte (noch ohne Unterschrift) folgt der neuen Einordnung — eine spätere Einladung passt dann zur Art.
  if (artGeaendert && kunde && !kunde.vertrag) {
    const frisch = await A.ladeLead(id);
    if (frisch) await A.kundeSicherstellen(frisch.lead, opts.von).catch((err) => console.error("[rueckmeldung] Kundenakte nicht angepasst", id, err));
  }
  // Börse: „kein Interesse“ nimmt das Angebot sofort von der Website, eine neue Art ändert „Zum Kauf/Zur Pacht“.
  let boerseFehler = false;
  if (l.meta.boerse?.online && (status === "erledigt" || artGeaendert)) {
    try {
      await boerseNeuSchreiben();
    } catch (err) {
      boerseFehler = true;
      console.error("[rueckmeldung] Flächenbörse nicht neu geschrieben", id, err);
    }
  }

  if (opts.quelle === "link") {
    const name = kunde?.stammdaten?.name || T.wert(l.name) || id;
    const ort = T.wert(l.ort);
    await adminInfo(
      `Rückmeldung: ${name} – ${RUECKMELDUNG_NAME[e.art]}`,
      [
        `${name} hat über den Antwort-Link der Nachfass-Mail geantwortet: ${RUECKMELDUNG_NAME[e.art]}${thema ? ` (Thema: ${thema})` : ""}.`,
        ...(text ? ["", "Nachricht:", text] : []),
        "",
        `Anfrage ${id} vom ${T.datumDe(l.receivedAt)}: ${T.wert(l.intent) || "—"}${ort ? `, ${ort}` : ""}`,
        ...(artGeaendert ? [`Die Anfrage ist jetzt als Angebot ${e.art === "verkaufen" ? "zum Kauf" : "zur Pacht"} eingeordnet.`] : []),
        e.art === "kein-interesse"
          ? "Die Anfrage steht jetzt auf „Erledigt“. An den Kunden geht keine weitere E-Mail."
          : "Die Anfrage steht wieder auf „Neu“ und oben im Dashboard unter „Rückmeldungen“ – mit dem vorgeschlagenen nächsten Schritt.",
        ...(boerseFehler ? ["ACHTUNG: Die Flächenbörse konnte nicht aktualisiert werden – bitte im Dashboard prüfen."] : []),
      ],
      `${opts.basis}/admin/dashboard#rueckmeldungen`,
    );
  }
  revalidatePath("/admin", "layout");
  return { ok: true, art: e.art, status };
}
