import "server-only";
import { leadView, type LeadView, type Zustand } from "@/lib/admin/model";
import { listLeads, readZustand } from "@/lib/admin/store";
import * as A from "./ablauf";
import * as M from "./model";
import { vertragGueltig } from "./schritte";
import { aendereKunde, alleKunden, ladeKunde } from "./speicher";
import * as T from "./texte";

// Anbieter mit mehreren Flächen (Dennis 25.09.2026: „Anbieter, die mehrere Flächen haben,
// nur 1× einladen“). Jede Fläche ist eine eigene Anfrage mit eigener Kundenakte — die
// Vereinbarung für Anbieter deckt aber ausdrücklich mehrere Flächen ab („folgende
// Fläche(n) … weitere Flächen kann er jederzeit ergänzen“, lib/vertraege/vorlagen/anbieter.ts).
// Gleicher Anbieter = gleiche E-Mail-Adresse, Rolle Anbieter, gleiche Art (Verkauf bzw.
// Verpachtung haben je eine eigene Vereinbarung) und derselbe Eigentümer laut Anfrage — wer
// Flächen verschiedener Eigentümer über eine Adresse betreut (z. B. „Hope Reckling (vertreten
// durch Dennis Reckling)“), braucht je Eigentümer eine eigene Vereinbarung. Deshalb:
// - Einladen nur einmal: Läuft schon eine Einladung über eine andere Anfrage, bekommt diese
//   Anfrage den Vermerk „eingeladen über …“ (einladung.ueber) statt einer eigenen Mail.
// - Unterschreiben nur einmal: Die Vereinbarung wird auf alle Anfragen desselben Anbieters
//   übertragen (vertrag.uebernommenVon, gleiche dokumentId); Kündigung/Widerruf gilt für alle.

type Mitglied = { id: string; rolle: M.Rolle | string; art: M.Art | string | null; email: string; name?: string };

const FUELLWOERTER = new Set(["herr", "frau", "dr", "prof", "familie", "fam", "eheleute", "und"]);

/** Namensteile ohne Klammerzusätze („(privat)“, „(vertreten durch …)“), Anrede und Titel; „Nachname, Vorname“ wird umgestellt. */
function namensTeile(name: string | undefined): string[] {
  let s = (name ?? "").replace(/\([^)]*\)/g, " ");
  if (s.includes(",")) s = s.split(",").map((x) => x.trim()).reverse().join(" ");
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z]+/)
    .filter((t) => t && !FUELLWOERTER.has(t));
}

/**
 * Derselbe Eigentümer? Gleicher Nachname und — falls beide einen Vornamen nennen — ein gemeinsamer
 * Vorname bzw. passende Initiale. Fehlt ein Name, genügt die gleiche E-Mail-Adresse.
 */
export function gleichePerson(a: string | undefined, b: string | undefined): boolean {
  const x = namensTeile(a);
  const y = namensTeile(b);
  if (!x.length || !y.length) return true;
  if (x[x.length - 1] !== y[y.length - 1]) return false;
  const vx = x.slice(0, -1);
  const vy = y.slice(0, -1);
  if (!vx.length || !vy.length) return true;
  return vx.some((t) => vy.some((u) => t === u || (t.length === 1 && u.startsWith(t)) || (u.length === 1 && t.startsWith(u))));
}

/** Name einer Kundenakte für den Vergleich (laut Anfrage, sonst aus den Angaben). */
function kundenName(k: M.KundeRecord): string | undefined {
  return k.name ?? k.stammdaten?.name;
}

function schluessel(m: Mitglied): string | null {
  const email = m.email.trim().toLowerCase();
  if (m.rolle !== "anbieter" || (m.art !== "kauf" && m.art !== "pacht") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return `${email}|${m.art}`;
}

/** Anfrage als Anbieter-Mitglied (Rolle aus der Einordnung, E-Mail aus Kundenakte bzw. Anfrage). */
function ausLead(l: LeadView, k: M.KundeRecord | null): Mitglied | null {
  const rr = T.rolleVonLead(l);
  if (!rr) return null;
  return { id: l.id, rolle: rr.rolle, art: rr.art, email: (k?.email || T.wert(l.email)).toLowerCase(), name: T.wert(l.name) };
}

/** Eine eigene (nicht über eine andere Anfrage laufende) Einladung, gesendet und noch gültig, ohne Unterschrift. */
export function aktiveEinladung(k: M.KundeRecord | null | undefined, jetzt = Date.now()): boolean {
  const e = k?.einladung;
  return Boolean(k && e && !e.ueber && e.gesendetAm && Date.parse(e.bis) > jetzt && !k.vertrag && !k.gesperrt);
}

/** Andere Kundenakten desselben Anbieters (gleiche E-Mail, Rolle Anbieter, gleiche Art, derselbe Eigentümer). */
export function geschwister(m: Mitglied, kunden: Iterable<M.KundeRecord>): M.KundeRecord[] {
  const key = schluessel(m);
  if (!key) return [];
  return [...kunden].filter((k) => k.id !== m.id && schluessel(k) === key && gleichePerson(m.name, kundenName(k)));
}

/** Über welche andere Anfrage desselben Anbieters schon eine gültige Vereinbarung vorliegt (Original bevorzugt). */
export function vertragUeber(m: Mitglied, kunden: Iterable<M.KundeRecord>): M.KundeRecord | null {
  const liste = geschwister(m, kunden).filter((k) => vertragGueltig(k));
  return liste.find((k) => !k.vertrag?.uebernommenVon) ?? liste[0] ?? null;
}

/** Über welche andere Anfrage desselben Anbieters gerade eine Einladung läuft. */
export function einladungUeber(m: Mitglied, kunden: Iterable<M.KundeRecord>, jetzt = Date.now()): M.KundeRecord | null {
  return geschwister(m, kunden).find((k) => aktiveEinladung(k, jetzt)) ?? null;
}

/** Warum an diese Anfrage keine (zweite) Einladungs- bzw. Erinnerungs-Mail gehen soll — oder null. */
export function einladungGesperrt(m: Mitglied, eigene: M.KundeRecord | null, kunden: Iterable<M.KundeRecord>, jetzt = Date.now()): string | null {
  const alle = [...kunden];
  // Nur solange die Einladung, über die diese Anfrage läuft, selbst noch gilt (sonst wieder frei).
  const ueber = eigene?.einladung?.ueber ? alle.find((k) => k.id === eigene.einladung!.ueber) : undefined;
  if (ueber && aktiveEinladung(ueber, jetzt) && gleichePerson(m.name, kundenName(ueber))) return `Die Einladung läuft über Anfrage ${ueber.id} (gleicher Anbieter) — eine Vereinbarung gilt für alle seine Flächen, keine zweite Mail.`;
  const v = vertragUeber(m, alle);
  if (v) return `Der Anbieter hat die Vereinbarung schon über Anfrage ${v.id} unterschrieben — sie gilt auch für diese Fläche, keine Einladung nötig.`;
  const e = einladungUeber(m, alle, jetzt);
  if (e && !aktiveEinladung(eigene, jetzt)) return `Die Einladung läuft schon über Anfrage ${e.id} (gleicher Anbieter) — nach der Unterschrift gilt die Vereinbarung automatisch auch für diese Fläche.`;
  return null;
}

/** Eigener, noch gültiger Link dieser Anfrage (keine bloße Kopie) — der darf nie ungültig werden. */
function eigenerLink(k: M.KundeRecord, jetzt = Date.now()): boolean {
  return Boolean(k.einladung && !k.einladung.kopie && Date.parse(k.einladung.bis) > jetzt);
}

/** Vereinbarung einer Kundenakte auf eine andere Anfrage desselben Anbieters übertragen (legt die Kundenakte bei Bedarf an). */
async function uebertragen(quelle: M.KundeRecord, l: LeadView, von: string): Promise<M.KundeRecord | null> {
  if (!quelle.vertrag) return null;
  try {
    await A.kundeSicherstellen(l, von);
  } catch (err) {
    console.error("[anbieter] Kundenakte nicht anlegbar", l.id, err);
    return null;
  }
  const doc = quelle.dokumente.find((d) => d.id === quelle.vertrag!.dokumentId);
  let geaendert = false;
  const k = await aendereKunde(l.id, (x) => {
    if (x.vertrag || x.gesperrt || x.widerruf || x.kuendigung) return false;
    x.vertrag = { ...quelle.vertrag!, uebernommenVon: quelle.vertrag!.uebernommenVon ?? quelle.id };
    if (!x.stammdaten && quelle.stammdaten) x.stammdaten = { ...quelle.stammdaten };
    if (doc && !x.dokumente.some((d) => d.id === doc.id)) x.dokumente.unshift(doc);
    M.ereignis(
      x,
      von,
      "vertrag-unterschrieben",
      `Vereinbarung für Anbieter gilt auch für diese Fläche — unterschrieben über Anfrage ${x.vertrag.uebernommenVon} am ${T.datumDe(quelle.vertrag!.signatur.am)} von „${quelle.vertrag!.signatur.name}“`,
    );
    geaendert = true;
  });
  return geaendert ? k : null;
}

/**
 * Einladung einer anderen Anfrage desselben Anbieters vermerken (keine Mail). Hatte diese Anfrage schon
 * eine eigene Einladung (z. B. von vor der Zusammenführung), bleibt deren Link gültig — Erinnerungen laufen
 * aber nur noch über die Quelle.
 */
async function einladungVermerken(quelle: M.KundeRecord, l: LeadView, von: string): Promise<M.KundeRecord | null> {
  const e = quelle.einladung;
  if (!e) return null;
  try {
    await A.kundeSicherstellen(l, von);
  } catch (err) {
    console.error("[anbieter] Kundenakte nicht anlegbar", l.id, err);
    return null;
  }
  let geaendert = false;
  const k = await aendereKunde(l.id, (x) => {
    if (x.vertrag || x.gesperrt || x.einladung?.ueber === quelle.id) return false;
    const eigene = eigenerLink(x) ? x.einladung! : null;
    x.einladung = eigene
      ? { ...eigene, ueber: quelle.id }
      : { nonce: e.nonce, bis: e.bis, erstelltAm: e.erstelltAm, von, gesendetAm: e.gesendetAm, ueber: quelle.id, kopie: true };
    M.ereignis(
      x,
      von,
      "einladung-erstellt",
      eigene
        ? `Weitere Erinnerungen laufen über Anfrage ${quelle.id} (gleicher Anbieter) — der bisherige Link dieser Anfrage bleibt gültig, eine Unterschrift gilt für alle Flächen`
        : `Eingeladen über Anfrage ${quelle.id} (gleicher Anbieter) — eine Vereinbarung für alle seine Flächen, keine eigene Mail`,
    );
    geaendert = true;
  });
  return geaendert ? k : null;
}

/** Die Einladung, über die diese Anfrage lief, gilt nicht mehr — Vermerk lösen, damit sie wieder selbst eingeladen werden kann. */
async function einladungLoesen(k: M.KundeRecord, von: string): Promise<M.KundeRecord | null> {
  let geaendert = false;
  const neu = await aendereKunde(k.id, (x) => {
    if (!x.einladung?.ueber || x.vertrag) return false;
    const ueber = x.einladung.ueber;
    // Ein eigener, noch gültiger Link bleibt als solcher bestehen; eine bloße Kopie entfällt.
    if (eigenerLink(x)) delete x.einladung.ueber;
    else delete x.einladung;
    M.ereignis(x, von, "einladung-zurueckgezogen", `Einladung über Anfrage ${ueber} gilt nicht mehr — diese Anfrage kann wieder selbst eingeladen werden`);
    geaendert = true;
  });
  return geaendert ? neu : null;
}

/**
 * Abgleich für alle Anbieter mit mehreren Anfragen: Vereinbarung übertragen, wo einer schon
 * unterschrieben hat; laufende Einladung vermerken, wo eine Anfrage in einem Vorgang steckt und
 * sonst eingeladen würde. Gibt die geänderten Kundenakten zurück (für die aktuelle Ansicht).
 * Idempotent — beim Laden des Dashboards, nach der Unterschrift und beim Anlegen neuer Flächen.
 */
export async function anbieterAbgleich(opts: {
  leads: LeadView[];
  kunden: Map<string, M.KundeRecord>;
  zustand: Zustand;
  von: string;
  jetzt?: number;
  /** Nur diesen Anbieter abgleichen (nach einer Unterschrift oder neuen Flächen). */
  email?: string;
}): Promise<M.KundeRecord[]> {
  const { leads, kunden, zustand, von } = opts;
  const jetzt = opts.jetzt ?? Date.now();
  const nurEmail = opts.email?.trim().toLowerCase();
  const imVorgang = new Set<string>();
  for (const [key, pm] of Object.entries(zustand.paare)) if (pm.status !== "vorschlag" && pm.status !== "verworfen") imVorgang.add(key.split("~")[0]);

  // Archivierte Anfragen zählen als Quelle (eine dort unterschriebene Vereinbarung gilt weiter), werden aber nicht mehr geändert.
  // Gruppe = gleiche E-Mail und Art, darin je Eigentümer getrennt (jedes Mitglied passt zu allen anderen der Gruppe).
  const gruppen: { l: LeadView; m: Mitglied }[][] = [];
  const nachSchluessel = new Map<string, { l: LeadView; m: Mitglied }[][]>();
  const ohneName: M.KundeRecord[] = [];
  for (const l of leads) {
    const k = kunden.get(l.id) ?? null;
    const m = ausLead(l, k);
    const key = m ? schluessel(m) : null;
    if (!m || !key || (nurEmail && m.email !== nurEmail)) continue;
    if (k && !k.name && m.name) ohneName.push(k);
    const liste = nachSchluessel.get(key) ?? [];
    const passend = liste.find((g) => g.every((x) => gleichePerson(x.m.name, m.name)));
    if (passend) passend.push({ l, m });
    else {
      const neu = [{ l, m }];
      liste.push(neu);
      gruppen.push(neu);
    }
    nachSchluessel.set(key, liste);
  }
  // Ältere Kundenakten kennen den Namen laut Anfrage noch nicht — einmalig nachtragen (für die Sperre im Versand).
  await Promise.all(
    ohneName.map(async (k) => {
      const name = leads.find((l) => l.id === k.id)?.name;
      const wert = name ? T.wert(name).trim().slice(0, 200) : "";
      if (!wert) return;
      try {
        kunden.set(k.id, await aendereKunde(k.id, (x) => (x.name ? false : void (x.name = wert))));
      } catch (err) {
        console.error("[anbieter] Name nicht nachgetragen", k.id, err);
      }
    }),
  );

  const geaendert = new Map<string, M.KundeRecord>();
  // Mehrere Durchgänge: Lösen einer abgelaufenen Einladung kann eine neue Quelle ergeben — so steht alles
  // sofort richtig statt erst beim nächsten Laden (jeder Schritt ist idempotent, kein Hin und Her).
  for (let durchgang = 0; durchgang < 3; durchgang++) {
    let neuInDurchgang = 0;
    for (const liste of gruppen) {
      const ids = new Set(liste.map((x) => x.l.id));
      const akten = liste.map((x) => kunden.get(x.l.id)).filter((k): k is M.KundeRecord => Boolean(k));
      const quelleVertrag = akten.filter((k) => vertragGueltig(k)).sort((a, b) => Number(Boolean(a.vertrag?.uebernommenVon)) - Number(Boolean(b.vertrag?.uebernommenVon)))[0];
      // Quelle der Einladung: die älteste eigene, gesendete und noch gültige Einladung dieses Anbieters.
      const quelleEinladung = quelleVertrag
        ? null
        : (akten.filter((k) => aktiveEinladung(k, jetzt)).sort((a, b) => (a.einladung!.gesendetAm ?? "").localeCompare(b.einladung!.gesendetAm ?? ""))[0] ?? null);
      for (const { l } of liste) {
        const k = kunden.get(l.id) ?? null;
        if (l.status === "archiv" || k?.vertrag || k?.gesperrt) continue;
        let neu: M.KundeRecord | null = null;
        if (quelleVertrag) {
          if (l.status !== "erledigt") neu = await uebertragen(quelleVertrag, l, von);
        } else if (k?.einladung?.ueber) {
          // Gilt die Einladung, über die diese Anfrage lief, nicht mehr (oder gehört sie zu einem anderen Eigentümer):
          // auf die aktuelle Quelle umhängen oder lösen.
          const quelle = kunden.get(k.einladung.ueber);
          if (!quelle || !ids.has(quelle.id) || !aktiveEinladung(quelle, jetzt)) neu = quelleEinladung && quelleEinladung.id !== k.id ? await einladungVermerken(quelleEinladung, l, von) : await einladungLoesen(k, von);
        } else if (quelleEinladung && quelleEinladung.id !== l.id && (imVorgang.has(l.id) || aktiveEinladung(k, jetzt))) {
          // In einem Vorgang würde sonst eingeladen — oder es läuft schon eine zweite Einladung: zusammenführen.
          neu = await einladungVermerken(quelleEinladung, l, von);
        }
        if (neu) {
          kunden.set(neu.id, neu);
          geaendert.set(neu.id, neu);
          neuInDurchgang++;
        }
      }
    }
    if (!neuInDurchgang) break;
  }
  return [...geaendert.values()];
}

/** Abgleich mit frisch geladenen Daten — nach einer Unterschrift oder nach dem Anlegen neuer Flächen (mit `email` nur dieser Anbieter). */
export async function anbieterAbgleichJetzt(von: string, email?: string): Promise<M.KundeRecord[]> {
  try {
    const [roh, { zustand }, kunden] = await Promise.all([listLeads(), readZustand(), alleKunden()]);
    const leads = roh.map((l) => leadView(l, zustand.anfragen[l.id]));
    return await anbieterAbgleich({ leads, kunden: new Map(kunden.map((k) => [k.id, k])), zustand, von, email });
  } catch (err) {
    console.error("[anbieter] Abgleich fehlgeschlagen", err);
    return [];
  }
}

/**
 * Vor einem Vorgang (Seite oder Assistent): Hat der Anbieter dieser Anfrage weder Vereinbarung noch
 * eigene Einladung, erst abgleichen — so schlägt der Assistent keine zweite Einladung vor.
 */
export async function anbieterAbgleichFuer(angebotId: string, von: string): Promise<void> {
  const k = await ladeKunde(angebotId);
  if (k?.vertrag || aktiveEinladung(k)) return;
  // Läuft über eine andere Anfrage desselben Eigentümers, deren Einladung noch gilt: nichts zu tun.
  if (k?.einladung?.ueber) {
    const quelle = await ladeKunde(k.einladung.ueber);
    if (quelle && aktiveEinladung(quelle) && gleichePerson(kundenName(k), kundenName(quelle))) return;
  }
  await anbieterAbgleichJetzt(von, k?.email);
}
