import "server-only";
import { createHash } from "node:crypto";
import { testModus } from "@/lib/admin/config";
import type { LeadView } from "@/lib/admin/model";
import { VORLAGEN, istFreigegeben, kundenVorlage } from "@/lib/vertraege/vorlagen";
import { einladungsLink } from "./ablauf";
import type { AssistentAktion, AssistentFeld, AssistentHinweis, AssistentMail, AssistentPlan, AssistentZustimmung } from "./assistent-typen";
import { entwuerfeKunde, entwuerfePaar, type Entwurf, type MailZweck } from "./entwuerfe";
import * as M from "./model";
import { SPERRE_FREIGABE, vertragGueltig, vorgangSchritte } from "./schritte";
import * as T from "./texte";
import { einladungBis } from "./token";
import { bewertungFaellig, freigabePruefung, kaufVorschlag, pachtLuecken, pachtVorschlag, type VorgangKontext } from "./vorgang";

export * from "./assistent-typen";

// Klick-Assistent je Vorgang: Aus dem Stand der sieben Schritte (schritte.ts)
// ergibt sich genau EINE nächste Aktion — mit allem, was dabei passiert, und den
// Mails (Empfänger, Betreff, Volltext aus entwuerfe.ts), die dabei rausgehen.
// Ausgeführt wird in app/admin/assistent-actions.ts: Der Plan wird dort frisch
// berechnet und nur ausgeführt, wenn er noch dem bestätigten entspricht
// (Signatur). Jede Teilaktion ruft die bestehenden Funktionen mit ihren Sperren
// auf. Ohne Klick passiert nichts — es gibt keinen automatischen Versand.

export type AssistentUmgebung = {
  einstellungen: M.Einstellungen;
  /** Basis-URL für die Links in den Mails. */
  basis: string;
  bewertungsUrl: string | null;
  jetzt?: Date;
};

type Seite = {
  rolle: M.Rolle;
  k: M.KundeRecord | null;
  l: LeadView;
  /** „Anbieter“ bzw. „Suchender“ */
  wer: string;
  /** Für Knöpfe: „Anbieter“ bzw. „Suchenden“ (… einladen) */
  akk: string;
  artikel: (typeof M.ROLLE_ARTIKEL)[M.Rolle];
  name: string;
  an: string;
};

type Bau = { ctx: VorgangKontext; u: AssistentUmgebung; jetzt: Date; seiten: Seite[] };

/** Teilergebnis eines Schritts; `extra` fließt nur in die Signatur ein. */
type Teil = {
  stand: string;
  warten?: string[];
  hinweise?: AssistentHinweis[];
  aktion?: Omit<AssistentAktion, "signatur"> | null;
  zustimmungen?: AssistentZustimmung[];
  /** Es wird auf Kunden, Notar oder Behörde gewartet (sonst ist die Verwaltung am Zug). */
  wartet?: boolean;
  extra?: unknown;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NEUER_LINK = "[persönlicher Link — wird beim Klick neu erstellt]";

// ---------------------------------------------------------------------------
// Hilfen

function seitenVon(ctx: VorgangKontext): Seite[] {
  const roh: [M.Rolle, M.KundeRecord | null, LeadView][] = [
    ["anbieter", ctx.anbieter, ctx.angebot],
    ["suchender", ctx.suchender, ctx.gesuch],
  ];
  return roh.map(([rolle, k, l]) => ({
    rolle,
    k,
    l,
    wer: M.ROLLE_NAME[rolle],
    akk: M.ROLLE_ARTIKEL[rolle].akk.replace(/^den /, ""),
    artikel: M.ROLLE_ARTIKEL[rolle],
    name: k?.stammdaten?.name || T.wert(l.name) || l.id,
    an: (k?.email || T.wert(l.email)).toLowerCase(),
  }));
}

function seite(b: Bau, rolle: M.Rolle): Seite {
  return b.seiten.find((s) => s.rolle === rolle)!;
}

function datum(iso: string | null | undefined): string {
  return T.datumDe(iso);
}

function zahlText(n: number): string {
  return String(n).replace(".", ",");
}

function heute(jetzt: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(jetzt);
}

function flaechenKurz(f: M.Flaeche[]): string {
  const ha = M.summeHa(f);
  return `${f.length} ${f.length === 1 ? "Fläche" : "Flächen"}${ha != null ? ` mit ${T.haText(ha)}` : ""}`;
}

function mailAus(e: Entwurf, s: Seite, extra: Partial<AssistentMail> = {}): AssistentMail {
  return {
    zweck: e.zweck,
    rolle: s.rolle,
    kundeId: s.l.id,
    wer: `${s.wer} (${s.name})`,
    werAkk: `${s.artikel.akk} (${s.name})`,
    an: e.an,
    betreff: e.betreff,
    text: e.text,
    zuletzt: e.gesendetAm,
    ...extra,
  };
}

function paarEntwuerfe(b: Bau, vorgang: M.VorgangRecord | null = b.ctx.vorgang): Entwurf[] {
  const { ctx, u } = b;
  return entwuerfePaar({
    key: ctx.key,
    angebot: ctx.angebot,
    gesuch: ctx.gesuch,
    anbieter: ctx.anbieter,
    suchender: ctx.suchender,
    vorgang,
    meta: ctx.meta,
    zustand: ctx.zustand,
    einstellungen: u.einstellungen,
    basis: u.basis,
    bewertungsUrl: u.bewertungsUrl,
  });
}

/** Der echte, aktuelle Entwurf für eine Seite — zum Senden (mit gültigen Links). */
export function assistentEntwurf(ctx: VorgangKontext, u: AssistentUmgebung, zweck: MailZweck, rolle: M.Rolle): Entwurf | null {
  if (zweck === "einladung" || zweck === "erinnerung") {
    const lead = rolle === "anbieter" ? ctx.angebot : ctx.gesuch;
    const kunde = rolle === "anbieter" ? ctx.anbieter : ctx.suchender;
    return entwuerfeKunde({ lead, kunde, einstellungen: u.einstellungen, basis: u.basis }).find((e) => e.zweck === zweck) ?? null;
  }
  const b: Bau = { ctx, u, jetzt: u.jetzt ?? new Date(), seiten: seitenVon(ctx) };
  return paarEntwuerfe(b).find((e) => e.zweck === zweck && e.rolle === rolle) ?? null;
}

/** Vertrag nicht (mehr) möglich: Widerruf, Kündigung, Sperre. */
function sperrGrund(s: Seite): string | null {
  const k = s.k;
  if (!k) return null;
  if (k.widerruf) return `${s.wer} hat den Vertrag am ${datum(k.widerruf.am)} widerrufen — mit diesem Paar geht es über die Plattform nicht weiter (im Vorgang unter „Weitere Aktionen“ verwerfen).`;
  if (k.kuendigung) return `${s.wer} hat am ${datum(k.kuendigung.am)} gekündigt — keine neuen Vorstellungen mehr (im Vorgang unter „Weitere Aktionen“ verwerfen).`;
  if (k.gesperrt) return `${s.wer}: Der Zugang zum Kundenbereich ist gesperrt — in der Anfrage entsperren, sonst kann ${s.artikel.nom} nicht unterschreiben.`;
  return null;
}

// ---------------------------------------------------------------------------
// Einladung (Schritte 2 und 3)

type EinladungsStand = {
  /** Irgendeine Einladungs- oder Erinnerungs-Mail ist erfolgreich rausgegangen. */
  geschickt: boolean;
  /** Die Einladung hat den Kunden erreicht (Mail, geöffnet, Angaben, Vertrag). */
  erreicht: boolean;
  abgelaufen: boolean;
  /** Vor dem Senden ist ein neuer Link nötig (keiner da oder abgelaufen). */
  neuerLink: boolean;
  /** Kurzbeschreibung für „Worauf gewartet wird“. */
  text: string;
};

function einladungsStand(s: Seite, jetzt: Date): EinladungsStand {
  const k = s.k;
  const e = k?.einladung;
  const abgelaufen = Boolean(e && Date.parse(e.bis) < jetzt.getTime());
  const letzte = k?.mails.find((m) => (m.zweck === "einladung" || m.zweck === "erinnerung") && m.ok);
  const geschickt = Boolean(letzte);
  const erreicht = geschickt || Boolean(e?.angenommenAm || k?.stammdaten || k?.vertrag);
  const teile = [
    !e ? "kein gültiger Einladungslink (zurückgezogen)" : geschickt ? `Einladung gesendet am ${datum(e.gesendetAm ?? letzte?.am)}` : "Einladungslink erstellt, aber noch nicht per E-Mail gesendet",
    abgelaufen && e ? `Link abgelaufen am ${datum(e.bis)}` : "",
  ];
  return { geschickt, erreicht, abgelaufen, neuerLink: !e || abgelaufen, text: teile.filter(Boolean).join(" · ") };
}

/** Warum eine Seite (jetzt) nicht eingeladen werden kann — oder null. */
function einladungsProblem(b: Bau, s: Seite): { text: string; vorlage?: boolean } | null {
  const rr = T.rolleVonLead(s.l);
  if (!rr) return { text: `${s.wer}: Die Anfrage ist nicht als Angebot bzw. Gesuch mit Kauf oder Pacht eingeordnet — in der Anfrage unter „Angaben fürs Matching“ korrigieren.` };
  if (!EMAIL.test(s.an)) return { text: `${s.wer}: In der Anfrage steht keine gültige E-Mail-Adresse — ohne Adresse ist keine Online-Einladung möglich (bitte telefonisch klären).` };
  const vorlage = kundenVorlage(rr.rolle, rr.art);
  if (!istFreigegeben(b.u.einstellungen, vorlage)) {
    return { text: `Die Vorlage „${VORLAGEN[vorlage].titel}“ ist noch nicht freigegeben (Verwaltung → Vorlagen) — ohne Freigabe kann niemand unterschreiben.`, vorlage: true };
  }
  return null;
}

/**
 * Einladungs- bzw. Erinnerungs-Mail für die Anzeige. Entsteht der Link erst beim
 * Klick, wird der Text mit einem Probe-Link erzeugt und dieser durch einen
 * Platzhalter ersetzt — gesendet wird später der echte Entwurf.
 */
function einladungVorschau(b: Bau, s: Seite, zweck: "einladung" | "erinnerung", neuerLink: boolean): AssistentMail | null {
  let kunde = s.k;
  let probeLink: string | null = null;
  if (neuerLink) {
    const rr = T.rolleVonLead(s.l);
    const basis = s.k ?? M.neuerKunde(s.l.id, rr?.rolle ?? s.rolle, rr?.art ?? b.ctx.art, s.an, "vorschau");
    kunde = {
      ...basis,
      einladung: { nonce: "vorschau-nur-zur-anzeige", bis: einladungBis().toISOString(), erstelltAm: b.jetzt.toISOString(), von: "vorschau", gesendetAm: s.k?.einladung?.gesendetAm },
    };
    probeLink = einladungsLink(kunde, b.u.basis);
  }
  const e = entwuerfeKunde({ lead: s.l, kunde, einstellungen: b.u.einstellungen, basis: b.u.basis }).find((x) => x.zweck === zweck);
  if (!e) return null;
  return mailAus(e, s, {
    text: probeLink ? e.text.split(probeLink).join(NEUER_LINK) : e.text,
    neuerLink,
    hinweis: neuerLink
      ? `Der persönliche Link (30 Tage gültig) wird beim Klick neu erstellt und in den Text eingesetzt${s.k?.einladung ? "; der bisherige Link wird damit ungültig" : ""}.`
      : undefined,
  });
}

function schrittPaar(): Teil {
  return {
    stand: "Vorschlag aus dem Matching — Angebot und Gesuch passen zusammen.",
    aktion: {
      id: "vormerken",
      knopf: "Paar vormerken",
      tipp: "Merkt dieses Paar vor. Danach lädt der Assistent beide Seiten zum Kundenbereich ein. Es geht noch keine E-Mail raus.",
      frage: "Dieses Paar vormerken?",
      passiert: [
        "Das Paar wird vorgemerkt und erscheint unter „In Arbeit“ und in den Vorgängen.",
        "Als Nächstes lädt der Assistent beide Seiten zum Kundenbereich ein (eigener Klick mit Rückfrage).",
      ],
      mails: [],
      dran: true,
    },
  };
}

function schrittEinladung(b: Bau): Teil {
  const hinweise: AssistentHinweis[] = [];
  const probleme: { text: string; vorlage?: boolean }[] = [];
  const passiert: string[] = [];
  const uebersprungen: string[] = [];
  const mails: AssistentMail[] = [];
  for (const s of b.seiten) {
    const sperre = sperrGrund(s);
    if (sperre) {
      hinweise.push({ text: sperre, warn: true });
      continue;
    }
    if (s.k?.vertrag) {
      uebersprungen.push(`${s.wer} hat bereits unterschrieben — wird übersprungen.`);
      continue;
    }
    const neu = M.stufe(s.k) === "neu";
    const es = einladungsStand(s, b.jetzt);
    if (!neu && es.erreicht) {
      uebersprungen.push(`${s.wer} ist schon eingeladen (${es.text}) — wird übersprungen.`);
      continue;
    }
    const problem = einladungsProblem(b, s);
    if (problem) {
      probleme.push(problem);
      continue;
    }
    const neuerLink = neu || es.neuerLink;
    const m = einladungVorschau(b, s, "einladung", neuerLink);
    if (!m) {
      probleme.push({ text: `${s.wer}: Für diese Anfrage ist keine Einladung möglich.` });
      continue;
    }
    if (neuerLink) passiert.push(`Persönlichen Einladungslink für ${s.artikel.akk} erstellen (30 Tage gültig)${s.k ? "" : " und die Kundenakte anlegen"}.`);
    mails.push(m);
  }
  const vorlagenLink = probleme.some((p) => p.vorlage)
    ? { href: "/admin/vorlagen", text: "Zu den Vorlagen", tipp: "Öffnet die Vertragsvorlagen — dort „Alle freigeben“" }
    : undefined;
  const stand = b.seiten.map((s) => `${s.wer}: ${M.STUFE_INFO[M.stufe(s.k)].label}`).join(" · ");
  if (mails.length === 0) {
    // Ist der Knopf gesperrt, stehen die Gründe dort („Warum gesperrt“) — nicht doppelt als Hinweis.
    return {
      stand,
      hinweise,
      aktion: probleme.length
        ? { id: "einladen", knopf: "Beide einladen", tipp: probleme.map((p) => p.text).join(" "), frage: "", passiert: [], mails: [], gesperrt: probleme.map((p) => p.text).join(" "), link: vorlagenLink, dran: false }
        : null,
    };
  }
  const beide = mails.length === 2;
  const erste = seite(b, mails[0].rolle);
  return {
    stand,
    hinweise: [...hinweise, ...probleme.map((p) => ({ text: p.text, warn: true }))],
    aktion: {
      id: "einladen",
      knopf: beide ? "Beide einladen" : `${erste.akk} einladen`,
      tipp: beide
        ? "Erstellt die persönlichen Einladungslinks und sendet beiden die Einladungs-Mail (vorher wird nachgefragt)"
        : `Erstellt ggf. den persönlichen Einladungslink und sendet ${erste.artikel.dat} die Einladungs-Mail (vorher wird nachgefragt)`,
      frage: beide ? "Beide Seiten jetzt einladen?" : `${erste.akk} jetzt einladen?`,
      passiert: [
        ...passiert,
        `${beide ? "Beide Einladungs-Mails senden" : `Einladungs-Mail an ${erste.artikel.akk} senden`}: persönlicher Link in den Kundenbereich — Angaben machen, Vertrag lesen und online unterschreiben.`,
        ...uebersprungen,
        "Danach wartet der Vorgang auf die Unterschriften; der Assistent zeigt, wer noch fehlt.",
      ],
      mails,
      link: vorlagenLink,
      dran: true,
    },
  };
}

function schrittUnterschrift(b: Bau): Teil {
  const hinweise: AssistentHinweis[] = [];
  const probleme: { text: string; vorlage?: boolean }[] = [];
  const warten: string[] = [];
  const erledigt: string[] = [];
  const passiert: string[] = [];
  const mails: AssistentMail[] = [];
  for (const s of b.seiten) {
    if (vertragGueltig(s.k)) {
      erledigt.push(`${s.wer} hat am ${datum(s.k?.vertrag?.signatur.am)} unterschrieben`);
      continue;
    }
    const sperre = sperrGrund(s);
    if (sperre) {
      hinweise.push({ text: sperre, warn: true });
      continue;
    }
    const es = einladungsStand(s, b.jetzt);
    const erinnert = s.k?.mails.find((m) => m.zweck === "erinnerung" && m.ok)?.am;
    warten.push(`Unterschrift ${s.artikel.gen} ${s.name} — ${M.STUFE_INFO[M.stufe(s.k)].label}; ${es.text}${erinnert ? `; zuletzt erinnert am ${datum(erinnert)}` : ""}`);
    const problem = einladungsProblem(b, s);
    if (problem) {
      probleme.push(problem);
      continue;
    }
    const zweck = es.geschickt ? "erinnerung" : "einladung";
    const m = einladungVorschau(b, s, zweck, es.neuerLink);
    if (!m) {
      probleme.push({ text: `${s.wer}: Für diese Anfrage ist keine Einladung möglich.` });
      continue;
    }
    if (es.neuerLink) {
      passiert.push(`Neuen Einladungslink für ${s.artikel.akk} erstellen (${s.k?.einladung ? `der bisherige ist am ${datum(s.k.einladung.bis)} abgelaufen` : "der bisherige wurde zurückgezogen"}).`);
    }
    mails.push(m);
  }
  const stand = erledigt.length ? `Warten auf die Unterschrift — ${erledigt.join(" · ")}.` : "Beide sind eingeladen — jetzt warten auf die Unterschriften.";
  const alleHinweise = [...hinweise, ...probleme.map((p) => ({ text: p.text, warn: true }))];
  const vorlagenLink = probleme.some((p) => p.vorlage)
    ? { href: "/admin/vorlagen", text: "Zu den Vorlagen", tipp: "Öffnet die Vertragsvorlagen — dort „Alle freigeben“" }
    : undefined;
  if (mails.length === 0) {
    // Ist der Knopf gesperrt, stehen die Gründe dort („Warum gesperrt“) — nicht doppelt als Hinweis.
    return {
      stand,
      warten,
      hinweise,
      aktion: probleme.length
        ? { id: "erinnern", knopf: "Erinnerung senden", tipp: probleme.map((p) => p.text).join(" "), frage: "", passiert: [], mails: [], gesperrt: probleme.map((p) => p.text).join(" "), link: vorlagenLink, dran: false }
        : null,
    };
  }
  const nurErinnerung = mails.every((m) => m.zweck === "erinnerung");
  const nurEinladung = mails.every((m) => m.zweck === "einladung");
  const knopf = nurErinnerung ? "Erinnerung senden" : nurEinladung ? "Einladung senden" : "Einladung bzw. Erinnerung senden";
  return {
    stand,
    warten,
    hinweise: alleHinweise,
    // Ist jede Einladung schon raus, liegt der Ball bei den Kunden (Erinnern ist nur ein Angebot).
    wartet: !mails.some((m) => m.zweck === "einladung") && probleme.length === 0,
    aktion: {
      id: "erinnern",
      knopf,
      tipp: `${nurErinnerung ? "Schickt eine freundliche Erinnerung" : "Schickt die Einladung"} mit dem persönlichen Link an ${mails.length === 2 ? "beide" : seite(b, mails[0].rolle).artikel.akk} (vorher wird nachgefragt). Unterschreiben kann nur der Kunde selbst.`,
      frage: `${knopf}?`,
      passiert: [
        ...passiert,
        ...mails.map((m) => `${m.zweck === "erinnerung" ? "Erinnerung" : "Einladungs-Mail"} an ${m.werAkk} senden — mit dem persönlichen Link in den Kundenbereich.`),
        "Unterschreiben kann nur der Kunde selbst, online im Kundenbereich mit seinem Namen.",
      ],
      mails,
      link: vorlagenLink,
      // Eine noch nie gesendete Einladung ist fällig — eine bloße Erinnerung nicht.
      dran: mails.some((m) => m.zweck === "einladung"),
    },
  };
}

// ---------------------------------------------------------------------------
// Anonym vorstellen, Zustimmung (Schritt 4), Freigabe (Schritt 5)

function schrittZustimmung(b: Bau): Teil {
  const { meta, vorgang: v } = b.ctx;
  const entw = paarEntwuerfe(b);
  const warten: string[] = [];
  const hinweise: AssistentHinweis[] = [];
  const erledigt: string[] = [];
  const neu: AssistentMail[] = [];
  const nochmal: AssistentMail[] = [];
  const zustimmungen: AssistentZustimmung[] = [];
  for (const s of b.seiten) {
    const am = s.rolle === "anbieter" ? meta?.zustimmungAnbieter : meta?.zustimmungSuchender;
    if (am) {
      const q = meta?.zustimmungQuelle?.[s.rolle];
      erledigt.push(`${s.wer} stimmt zu (${datum(am)}${q === "kunde" ? ", selbst im Kundenbereich" : q ? `, erfasst von ${q}` : ""})`);
      continue;
    }
    zustimmungen.push({
      rolle: s.rolle,
      text: `${s.wer} hat telefonisch zugestimmt`,
      tipp: `Erfasst die Zustimmung ${s.artikel.gen} zu genau diesem Kontakt (z. B. am Telefon erteilt) — mit Ihrem Namen und Zeitpunkt im Verlauf`,
      frage: `Hat ${s.artikel.nom} (${s.name}) diesem Kontakt ausdrücklich zugestimmt? Das wird mit Ihrem Namen und dem Zeitpunkt vermerkt.`,
    });
    const abl = meta?.ablehnung?.rolle === s.rolle ? meta.ablehnung : null;
    if (abl) {
      hinweise.push({
        warn: true,
        text: `${s.wer} hat am ${datum(abl.am)} „kein Interesse“ gemeldet${abl.grund ? `: ${abl.grund}` : ""} — telefonisch klären (dann „${s.wer} hat telefonisch zugestimmt“) oder das Paar im Vorgang unter „Weitere Aktionen“ verwerfen.`,
      });
      continue;
    }
    const e = entw.find((x) => x.zweck === "hinweis" && x.rolle === s.rolle);
    if (!e) {
      hinweise.push({ warn: true, text: `${s.wer}: Kein Hinweis per E-Mail möglich (keine Adresse) — telefonisch anfragen und die Zustimmung erfassen.` });
      continue;
    }
    const gesendet = v?.hinweise?.[s.rolle];
    if (gesendet) {
      warten.push(`Zustimmung ${s.artikel.gen} ${s.name} — anonymer Hinweis gesendet am ${datum(gesendet)}; ${s.artikel.nom} kann über den Link in der Mail im Kundenbereich zustimmen`);
      nochmal.push(mailAus(e, s));
    } else {
      neu.push(mailAus(e, s));
    }
  }
  const angefragt = Boolean(v?.hinweise?.anbieter || v?.hinweise?.suchender);
  const stand = erledigt.length
    ? `${erledigt.join(" · ")}.`
    : angefragt
      ? "Anonym angefragt — die Zustimmungen fehlen noch."
      : "Beide haben unterschrieben — jetzt stellt der Assistent das Paar beiden anonym vor.";
  let aktion: Omit<AssistentAktion, "signatur"> | null = null;
  if (neu.length) {
    const beide = neu.length === 2;
    const erste = seite(b, neu[0].rolle);
    aktion = {
      id: "hinweise",
      knopf: beide ? "Beide anonym anfragen" : `${erste.akk} anonym anfragen`,
      tipp: "Sendet den anonymen Hinweis (nur Gemeinde, Flächentyp, Größe, Art — kein Name) mit Link zum Zustimmen (vorher wird nachgefragt)",
      frage: beide ? "Beide jetzt anonym anfragen?" : `${erste.akk} jetzt anonym anfragen?`,
      passiert: [
        "Anonymer Hinweis: nur Gemeinde, Flächentyp, Größe und Art — kein Name, keine Kontaktdaten, keine Flurstücke.",
        "Mit Link in den Kundenbereich — dort kann die Seite dem Kontakt zustimmen oder „kein Interesse“ melden.",
        "Sind beide Hinweise gesendet, steht das Paar auf „Angefragt“ und beide sehen den Vorschlag im Kundenbereich.",
      ],
      mails: neu,
      dran: true,
    };
  } else if (nochmal.length) {
    aktion = {
      id: "hinweise",
      knopf: "Erinnerung senden",
      tipp: `Sendet den anonymen Hinweis noch einmal an ${nochmal.length === 2 ? "beide" : seite(b, nochmal[0].rolle).artikel.akk} (Betreff „Erinnerung: …“) — vorher wird nachgefragt`,
      frage: "Anonymen Hinweis noch einmal senden?",
      passiert: ["Den anonymen Hinweis erneut senden (Betreff „Erinnerung: …“) — mit frischem Link in den Kundenbereich zum Zustimmen."],
      mails: nochmal,
      dran: false,
    };
  }
  return { stand, warten, hinweise, aktion, zustimmungen, wartet: neu.length === 0 && nochmal.length > 0 };
}

function schrittFreigabe(b: Bau): Teil {
  const { ctx } = b;
  const pr = freigabePruefung(ctx, b.jetzt);
  const fehlt = pr.punkte.filter((p) => !p.ok).map((p) => p.text);
  const hinweise: AssistentHinweis[] = [];
  const zurueck = ctx.vorgang?.freigabe?.zurueckgezogen;
  if (zurueck) hinweise.push({ text: `Die Freigabe wurde am ${datum(zurueck.am)} zurückgezogen${zurueck.grund ? ` (${zurueck.grund})` : ""}. Eine erneute Freigabe informiert beide wieder.` });
  if (fehlt.some((t) => t.includes("Widerrufsfrist"))) {
    hinweise.push({ text: "Der Suchende kann in seinem Kundenbereich ausdrücklich verlangen, dass schon vor Ablauf der Widerrufsfrist begonnen wird („Kontakte schon vor Ablauf der Widerrufsfrist erhalten?“) — dann ist die Freigabe sofort möglich." });
  }
  // Die Freigabe-Mitteilungen entstehen erst mit der Freigabe — für die Anzeige mit einer angenommenen Freigabe erzeugen.
  const sim: M.VorgangRecord = { ...(ctx.vorgang ?? M.neuerVorgang(ctx.key, ctx.art)), freigabe: { am: b.jetzt.toISOString(), von: "vorschau" } };
  const mails = paarEntwuerfe(b, sim)
    .filter((e) => e.zweck === "freigabe")
    .map((e) => mailAus(e, seite(b, e.rolle!), { zuletzt: undefined }));
  const bestaetigungFehlt = fehlt.some((t) => t.includes("Vertragsbestätigung"));
  // Widerrufsfrist: warten. Fehlende Bestätigung, Widerruf, Kündigung, Sperre: die Verwaltung muss handeln.
  const verwaltung = bestaetigungFehlt || fehlt.some((t) => /: (widerrufen|gekündigt|zugang gesperrt)/i.test(t));
  return {
    stand: pr.bereit ? "Beide haben unterschrieben und zugestimmt — die Kontaktdaten können freigegeben werden." : "Die Freigabe ist noch nicht möglich.",
    warten: pr.bereit ? [] : fehlt,
    hinweise,
    wartet: !pr.bereit && !verwaltung,
    aktion: {
      id: "freigeben",
      knopf: "Kontakt freigeben & beide informieren",
      tipp: pr.bereit ? "Gibt die Kontaktdaten beider Seiten im Kundenbereich frei und sendet beiden die Freigabe-Mitteilung (vorher wird nachgefragt)" : `Noch nicht möglich: ${fehlt.join(" · ")}`,
      frage: "Kontakt jetzt freigeben und beide informieren?",
      passiert: [
        `${ctx.angebot.name} und ${ctx.gesuch.name} sehen im Kundenbereich Namen, Anschrift, Telefon, E-Mail und Flurstücke des Gegenübers — das ist der Nachweis (Grundlage der Provision).`,
        "Beide erhalten eine Freigabe-Mitteilung mit Direktlink in den Kundenbereich (die Kontaktdaten selbst stehen nicht in der Mail).",
        "Rückgängig nur über „Freigabe zurückziehen“ — bereits gesehene Daten bleiben bekannt.",
      ],
      mails,
      gesperrt: pr.bereit ? undefined : `Noch nicht möglich: ${fehlt.join(" · ")}.`,
      link: bestaetigungFehlt
        ? { href: `/admin/anfrage/${ctx.gesuch.id}#kundenbereich`, text: "Zur Kundenakte des Suchenden", tipp: "Dort „Bestätigung erneut senden“ — die Vertragsbestätigung mit PDF ist Voraussetzung der Freigabe" }
        : undefined,
      dran: pr.bereit,
    },
    extra: [ctx.vorgang?.freigabe?.am ?? "", zurueck?.am ?? ""],
  };
}

// ---------------------------------------------------------------------------
// Vertrag (Schritt 6)

function nachAbschlussHinweise(b: Bau): AssistentHinweis[] {
  const v = b.ctx.vorgang;
  if (!v?.abschluss) return [];
  const out: AssistentHinweis[] = [];
  if (v.pachtvertrag?.status === "abgeschlossen" && !v.pachtvertrag.anzeigeErledigtAm) {
    out.push({ text: "Pachtanzeige (§ 2 LPachtVG, Pflicht des Verpächters binnen eines Monats) ist noch nicht als erledigt vermerkt — Erinnerungs-Mail und Vermerk im Vorgang („Weitere Aktionen“ bzw. Bereich „Landpachtvertrag“)." });
  }
  if (b.u.bewertungsUrl) {
    const faellig = bewertungFaellig(v, b.u.einstellungen, b.jetzt).filter((r) => M.bewertungsmailErlaubt(seite(b, r).k));
    if (faellig.length) out.push({ text: `Die Bitte um eine Google-Bewertung ist fällig (${faellig.map((r) => M.ROLLE_NAME[r]).join(", ")}) — im Vorgang unter „Weitere Aktionen → Einzelne E-Mails“.` });
  }
  return out;
}

function schrittVertrag(b: Bau): Teil {
  const { ctx } = b;
  const v = ctx.vorgang;
  if (!v) return { stand: "Vorgangsakte fehlt.", aktion: null };
  // Nach einem Widerruf wird über die Plattform nichts mehr vorgelegt (die Funktionen sperren das auch).
  const widerrufen = b.seiten.find((s) => s.k?.widerruf);
  if (widerrufen) {
    return {
      stand: "Nach einem Widerruf wird über die Plattform nichts mehr vorgelegt.",
      hinweise: [
        {
          warn: true,
          text: `${widerrufen.wer} hat am ${datum(widerrufen.k?.widerruf?.am)} widerrufen. Der Kundenbereich zeigt die Kontaktdaten nicht mehr an — bitte im Vorgang unter „Weitere Aktionen“ die Freigabe zurückziehen und, falls nötig, die Gegenseite informieren.`,
        },
      ],
      aktion: null,
    };
  }
  const hinweise: AssistentHinweis[] = [];
  const freiAm = datum(v.freigabe?.am);
  // Freigabe-Mitteilungen nachholen, solange am Vertrag noch nichts begonnen hat.
  const offen = paarEntwuerfe(b).filter((e) => e.zweck === "freigabe" && !e.gesendetAm && !e.gesperrt);
  const begonnen = ctx.art === "pacht" ? Boolean(v.pachtvertrag && v.pachtvertrag.status !== "verworfen") : Boolean(v.kauf && v.kauf.status !== "abgebrochen");
  if (offen.length && !begonnen) {
    const beide = offen.length === 2;
    const erste = seite(b, offen[0].rolle!);
    return {
      stand: `Die Kontaktdaten sind seit dem ${freiAm} freigegeben — die Freigabe-Mitteilung ist aber noch nicht gesendet.`,
      aktion: {
        id: "freigabe-mitteilen",
        knopf: beide ? "Beide informieren" : `${erste.akk} informieren`,
        tipp: "Sendet die Freigabe-Mitteilung mit Direktlink in den Kundenbereich (vorher wird nachgefragt)",
        frage: beide ? "Beide jetzt über die Freigabe informieren?" : `${erste.akk} jetzt über die Freigabe informieren?`,
        passiert: ["Freigabe-Mitteilung senden: Die Kontaktdaten stehen im Kundenbereich (sie selbst stehen nicht in der Mail)."],
        mails: offen.map((e) => mailAus(e, seite(b, e.rolle!))),
        dran: true,
      },
      extra: [v.freigabe?.am ?? ""],
    };
  }
  if (offen.length) {
    hinweise.push({ text: `Die Freigabe-Mitteilung an ${offen.map((e) => M.ROLLE_ARTIKEL[e.rolle!].akk).join(" und ")} ist noch nicht gesendet — im Vorgang unter „Weitere Aktionen → Einzelne E-Mails“.` });
  }
  return ctx.art === "pacht" ? schrittPacht(b, v, hinweise, freiAm) : schrittKauf(b, v, hinweise, freiAm);
}

function schrittPacht(b: Bau, v: M.VorgangRecord, hinweise: AssistentHinweis[], freiAm: string): Teil {
  const { ctx, u } = b;
  const pv = v.pachtvertrag;
  const vorlageFrei = istFreigegeben(u.einstellungen, "pachtvertrag");
  const konditionen = ctx.suchender?.vertrag?.konditionen ?? null;
  if (ctx.anbieter?.stammdaten?.eigenschaft === "unternehmer" && ctx.suchender?.stammdaten?.eigenschaft === "verbraucher") {
    hinweise.push({ warn: true, text: "Achtung: Verpächter handelt als Unternehmer, Pächter als Verbraucher — der Pächter kann einen online geschlossenen Pachtvertrag ggf. widerrufen (Fernabsatz). Vor der Unterschrift klären oder den Vertrag außerhalb der Plattform schließen." });
  }
  const zinsFelder = (d?: M.PachtDaten): AssistentFeld[] => [
    {
      name: "zins",
      typ: "zahl",
      label: "Pachtzins (€, netto)",
      pflicht: true,
      wert: d?.pachtzinsJahr ? zahlText(d.pachtzinsJahr) : d?.pachtzinsJeHa ? zahlText(d.pachtzinsJeHa) : "",
      platzhalter: "z. B. 450",
      tipp: "Pachtzins netto — je Hektar und Pachtjahr oder als fester Betrag je Pachtjahr (daneben wählen)",
    },
    {
      name: "einheit",
      typ: "auswahl",
      label: "bezogen auf",
      wert: d?.pachtzinsJahr ? "jahr" : "ha",
      optionen: [
        { wert: "ha", label: "je Hektar und Pachtjahr" },
        { wert: "jahr", label: "je Pachtjahr (fester Betrag)" },
      ],
      tipp: "Worauf sich der Betrag bezieht: je Hektar (die Jahrespacht wird mit der Fläche berechnet) oder fester Betrag für ein ganzes Pachtjahr",
    },
  ];
  const vorlageHinweis = !vorlageFrei
    ? { warn: true, text: "Die Vorlage „Landpachtvertrag“ ist noch nicht freigegeben (Verwaltung → Vorlagen) — vorbereiten geht, zur Unterschrift erst nach der Freigabe." }
    : null;
  const formularLink = { href: `/admin/vorgang/${ctx.key}#pachtvertrag`, text: "Zum Formular „Landpachtvertrag“", tipp: "Öffnet das ausführliche Formular — dort lassen sich alle Angaben ändern; danach „Entwurf speichern“" };

  if (!pv || pv.status === "verworfen") {
    const d = pachtVorschlag(ctx);
    const rest = pachtLuecken({ ...d, pachtzinsJeHa: 1 });
    return {
      stand: `Die Kontaktdaten sind seit dem ${freiAm} freigegeben. Sind sich beide einig, bereitet der Assistent den Pachtvertrag vor — im Kern fehlt nur der Pachtzins.`,
      hinweise: [...hinweise, ...(vorlageHinweis ? [vorlageHinweis] : [])],
      aktion: {
        id: "pacht-vorbereiten",
        knopf: "Pachtvertrag vorbereiten",
        tipp: "Legt den Pachtvertrag-Entwurf aus den Angaben beider Seiten an — Sie tragen nur den Pachtzins ein. Es geht noch nichts raus.",
        frage: "Pachtvertrag mit diesem Pachtzins vorbereiten?",
        passiert: [
          `Entwurf aus den Angaben beider Seiten: Verpächter ${d.verpaechter.name || "—"}, Pächter ${d.paechter.name || "—"}, ${flaechenKurz(d.flaechen)}, Beginn ${T.tagDe(d.pachtBeginn)}, ${d.laufzeitJahre ? `${d.laufzeitJahre} Pachtjahre` : "unbestimmte Zeit"} — alles im Formular „Landpachtvertrag“ änderbar.`,
          "Den eingegebenen Pachtzins eintragen.",
          ...(rest.length ? [`Danach im Formular noch zu ergänzen: ${rest.join(", ")}.`] : []),
          "Die Parteien sehen den Vertrag erst nach „Zur Unterschrift geben“.",
        ],
        mails: [],
        felder: zinsFelder(),
        flaecheHa: M.summeHa(d.flaechen),
        link: formularLink,
        dran: true,
      },
      extra: [pv?.status ?? "", pv?.geaendertAm ?? ""],
    };
  }

  if (pv.status === "entwurf") {
    const luecken = pachtLuecken(pv.daten);
    const rest = luecken.filter((l) => !l.startsWith("Pachtzins"));
    if (M.jahrespacht(pv.daten) == null) {
      return {
        stand: "Der Pachtvertrag ist im Entwurf — es fehlt noch der Pachtzins.",
        hinweise: [...hinweise, ...(vorlageHinweis ? [vorlageHinweis] : [])],
        aktion: {
          id: "pacht-vorbereiten",
          knopf: "Pachtzins eintragen",
          tipp: "Trägt den Pachtzins in den vorhandenen Entwurf ein. Es geht noch nichts raus.",
          frage: "Diesen Pachtzins in den Entwurf eintragen?",
          passiert: ["Den eingegebenen Pachtzins in den Entwurf eintragen — die übrigen Angaben bleiben, wie sie sind.", ...(rest.length ? [`Danach im Formular noch zu ergänzen: ${rest.join(", ")}.`] : [])],
          mails: [],
          felder: zinsFelder(pv.daten),
          flaecheHa: M.summeHa(pv.daten.flaechen),
          link: formularLink,
          dran: true,
        },
        extra: [pv.status, pv.geaendertAm],
      };
    }
    const jp = M.jahrespacht(pv.daten);
    const mp = M.massgeblicheJahrespacht(pv.daten);
    const prov = M.provisionBerechnen("pacht", mp, konditionen ?? M.aktuelleKonditionen(u.einstellungen));
    // Die Mitteilungen entstehen erst mit „zur Unterschrift“ — für die Anzeige mit diesem Stand erzeugen.
    const sim: M.VorgangRecord = { ...v, pachtvertrag: { ...pv, status: "zur_unterschrift", unterschriften: {} } };
    const mails = paarEntwuerfe(b, sim)
      .filter((e) => e.zweck === "pachtvertrag")
      .map((e) => mailAus(e, seite(b, e.rolle!)));
    const gesperrt = rest.length
      ? `Im Entwurf fehlt noch: ${rest.join(", ")} — bitte im Formular „Landpachtvertrag“ ergänzen und „Entwurf speichern“.`
      : !vorlageFrei
        ? "Die Vorlage „Landpachtvertrag“ ist noch nicht freigegeben (Verwaltung → Vorlagen)."
        : undefined;
    return {
      stand: `Pachtvertrag im Entwurf: Jahrespacht ${M.euro(jp)}${mp !== jp ? ` (maßgeblich für die Provision: ${M.euro(mp)})` : ""} · Provision ${M.euro(prov.netto)} netto / ${M.euro(prov.brutto)} brutto${konditionen ? ` (Konditionen Nr. ${konditionen.version})` : ""}.`,
      hinweise,
      aktion: {
        id: "pacht-unterschrift",
        knopf: "Zur Unterschrift geben & beide informieren",
        tipp: gesperrt ?? "Schreibt den Vertragstext fest, zeigt ihn beiden im Kundenbereich zur Online-Unterschrift und sendet beiden die Mitteilung (vorher wird nachgefragt)",
        frage: "Pachtvertrag jetzt beiden zur Unterschrift geben und beide informieren?",
        passiert: [
          `Vertragstext festschreiben (Jahrespacht ${M.euro(jp)}, ${flaechenKurz(pv.daten.flaechen)}, Beginn ${T.tagDe(pv.daten.pachtBeginn)}) — ändern danach nur über „Zurück zum Entwurf“; geleistete Unterschriften verfallen dann.`,
          "Verpächter und Pächter sehen den Vertrag im Kundenbereich und unterschreiben online (Textform, § 585a BGB).",
          "Mit der zweiten Unterschrift ist der Vertrag geschlossen: Beide erhalten automatisch das PDF, die Provision wird fällig.",
        ],
        mails,
        gesperrt,
        link: rest.length ? formularLink : !vorlageFrei ? { href: "/admin/vorlagen", text: "Zu den Vorlagen", tipp: "Öffnet die Vertragsvorlagen — dort „Landpachtvertrag“ freigeben" } : undefined,
        dran: !gesperrt,
      },
      extra: [pv.status, pv.geaendertAm],
    };
  }

  if (pv.status === "zur_unterschrift") {
    const felder = [
      { rolle: "anbieter" as const, feld: "verpaechter" as const, gen: "des Verpächters", wer: "Verpächter" },
      { rolle: "suchender" as const, feld: "paechter" as const, gen: "des Pächters", wer: "Pächter" },
    ];
    const entw = paarEntwuerfe(b).filter((e) => e.zweck === "pachtvertrag");
    const unterschrieben = felder.filter((f) => pv.unterschriften[f.feld]).map((f) => `${f.wer} hat am ${datum(pv.unterschriften[f.feld]!.am)} unterschrieben`);
    const warten = felder
      .filter((f) => !pv.unterschriften[f.feld])
      .map((f) => {
        const e = entw.find((x) => x.rolle === f.rolle);
        return `Unterschrift ${f.gen} ${seite(b, f.rolle).name} — ${e?.gesendetAm ? `Mitteilung gesendet am ${datum(e.gesendetAm)}` : "Mitteilung noch nicht gesendet"}`;
      });
    const mails = entw.filter((e) => !e.gesperrt).map((e) => mailAus(e, seite(b, e.rolle!)));
    const neu = mails.filter((m) => !m.zuletzt);
    return {
      stand: `Der Pachtvertrag liegt beiden zur Unterschrift vor${unterschrieben.length ? ` — ${unterschrieben.join(" · ")}` : ""}.`,
      warten,
      hinweise,
      aktion: mails.length
        ? {
            id: "pacht-erinnern",
            knopf: neu.length === mails.length ? (mails.length === 2 ? "Beide informieren" : `${seite(b, mails[0].rolle).akk} informieren`) : "Erinnerung senden",
            tipp: "Sendet die Mitteilung „Pachtvertrag zur Unterschrift“ mit Direktlink an alle, die noch nicht unterschrieben haben (vorher wird nachgefragt)",
            frage: neu.length === mails.length ? "Mitteilung „Pachtvertrag zur Unterschrift“ jetzt senden?" : "Erinnerung an die Unterschrift senden?",
            passiert: ["Mitteilung mit Direktlink in den Kundenbereich an alle, die noch nicht unterschrieben haben.", "Unterschreiben können nur Verpächter und Pächter selbst, online im Kundenbereich."],
            mails,
            dran: neu.length > 0,
          }
        : null,
      wartet: mails.length > 0 && neu.length === 0,
      extra: [pv.status, pv.geaendertAm, Object.keys(pv.unterschriften)],
    };
  }
  return { stand: "Der Pachtvertrag ist geschlossen.", hinweise, aktion: null };
}

function schrittKauf(b: Bau, v: M.VorgangRecord, hinweise: AssistentHinweis[], freiAm: string): Teil {
  const { ctx, u } = b;
  const k = v.kauf;
  const vorlageFrei = istFreigegeben(u.einstellungen, "kaufabsicht");
  const konditionen = ctx.suchender?.vertrag?.konditionen ?? null;
  const preisFeld = (wert?: number | null): AssistentFeld => ({
    name: "kaufpreis",
    typ: "zahl",
    label: "Kaufpreis (Vorstellung, €)",
    pflicht: true,
    wert: wert != null ? zahlText(wert) : "",
    platzhalter: "z. B. 120000",
    tipp: "Angestrebter Kaufpreis — verbindlich wird er erst beim Notar",
  });
  const vorlageHinweis = !vorlageFrei ? { warn: true, text: "Die Vorlage „Kaufabsicht“ ist noch nicht freigegeben (Verwaltung → Vorlagen) — vorbereiten geht, zur Bestätigung erst nach der Freigabe." } : null;
  const formularLink = { href: `/admin/vorgang/${ctx.key}#kauf`, text: "Zum Bereich „Kauf“", tipp: "Öffnet das ausführliche Formular für die Eckdaten (Übergabe, bestehende Pacht, Notar)" };

  if (!k || k.status === "abgebrochen" || (k.status === "entwurf" && k.daten.kaufpreis == null)) {
    const d = k && k.status === "entwurf" ? k.daten : kaufVorschlag(ctx);
    const vorhanden = Boolean(k && k.status === "entwurf");
    return {
      stand: vorhanden
        ? "Die Eckdaten für den Notar sind im Entwurf — es fehlt noch der Kaufpreis."
        : `Die Kontaktdaten sind seit dem ${freiAm} freigegeben. Sind sich beide einig, bereitet der Assistent die Eckdaten für den Notar vor — im Kern fehlt nur der Kaufpreis.`,
      hinweise: [...hinweise, ...(vorlageHinweis ? [vorlageHinweis] : [])],
      aktion: {
        id: "kauf-vorbereiten",
        knopf: vorhanden ? "Kaufpreis eintragen" : "Eckdaten vorbereiten",
        tipp: "Legt die Eckdaten aus den Angaben beider Seiten an — Sie tragen nur den Kaufpreis (Vorstellung) ein. Es geht noch nichts raus.",
        frage: vorhanden ? "Diesen Kaufpreis eintragen?" : "Eckdaten mit diesem Kaufpreis vorbereiten?",
        passiert: [
          `Eckdaten aus den Angaben beider Seiten: Verkäufer ${d.verkaeufer.name || "—"}, Käufer ${d.kaeufer.name || "—"}, ${flaechenKurz(d.flaechen)} — alles im Bereich „Kauf“ änderbar.`,
          "Den eingegebenen Kaufpreis eintragen — verbindlich wird er erst beim Notar.",
        ],
        mails: [],
        felder: [preisFeld(d.kaufpreis)],
        link: formularLink,
        dran: true,
      },
      extra: [k?.status ?? "", k?.geaendertAm ?? ""],
    };
  }

  if (k.status === "entwurf") {
    const sim: M.VorgangRecord = { ...v, kauf: { ...k, status: "zur_bestaetigung", bestaetigungen: {} } };
    const mails = paarEntwuerfe(b, sim)
      .filter((e) => e.zweck === "kaufabsicht")
      .map((e) => mailAus(e, seite(b, e.rolle!)));
    const gesperrt = !vorlageFrei ? "Die Vorlage „Kaufabsicht“ ist noch nicht freigegeben (Verwaltung → Vorlagen)." : undefined;
    return {
      stand: `Eckdaten im Entwurf: Kaufpreis-Vorstellung ${M.euro(k.daten.kaufpreis)}, ${flaechenKurz(k.daten.flaechen)}.`,
      hinweise,
      aktion: {
        id: "kauf-bestaetigung",
        knopf: "Zur Bestätigung geben & beide informieren",
        tipp: gesperrt ?? "Schreibt die Eckdaten fest, zeigt sie beiden im Kundenbereich zur unverbindlichen Bestätigung und sendet beiden die Mitteilung (vorher wird nachgefragt)",
        frage: "Eckdaten jetzt beiden zur (unverbindlichen) Bestätigung geben und beide informieren?",
        passiert: [
          `Eckdaten festschreiben (Kaufpreis-Vorstellung ${M.euro(k.daten.kaufpreis)}) — ändern danach nur über „Zurück zum Entwurf“.`,
          "Verkäufer und Käufer sehen die Eckdaten im Kundenbereich und bestätigen sie unverbindlich — der Kaufvertrag entsteht erst beim Notar.",
          "Haben beide bestätigt, liegt das PDF für den Notar in den Dokumenten.",
        ],
        mails,
        gesperrt,
        link: gesperrt ? { href: "/admin/vorlagen", text: "Zu den Vorlagen", tipp: "Öffnet die Vertragsvorlagen — dort „Kaufabsicht“ freigeben" } : undefined,
        dran: !gesperrt,
      },
      extra: [k.status, k.geaendertAm],
    };
  }

  if (k.status === "zur_bestaetigung") {
    const felder = [
      { rolle: "anbieter" as const, feld: "verkaeufer" as const, gen: "des Verkäufers", wer: "Verkäufer" },
      { rolle: "suchender" as const, feld: "kaeufer" as const, gen: "des Käufers", wer: "Käufer" },
    ];
    const entw = paarEntwuerfe(b).filter((e) => e.zweck === "kaufabsicht");
    const bestaetigt = felder.filter((f) => k.bestaetigungen[f.feld]).map((f) => `${f.wer} hat am ${datum(k.bestaetigungen[f.feld]!.am)} bestätigt`);
    const warten = felder
      .filter((f) => !k.bestaetigungen[f.feld])
      .map((f) => {
        const e = entw.find((x) => x.rolle === f.rolle);
        return `Bestätigung ${f.gen} ${seite(b, f.rolle).name} — ${e?.gesendetAm ? `Mitteilung gesendet am ${datum(e.gesendetAm)}` : "Mitteilung noch nicht gesendet"}`;
      });
    const mails = entw.filter((e) => !e.gesperrt).map((e) => mailAus(e, seite(b, e.rolle!)));
    const neu = mails.filter((m) => !m.zuletzt);
    return {
      stand: `Die Eckdaten liegen beiden zur Bestätigung vor${bestaetigt.length ? ` — ${bestaetigt.join(" · ")}` : ""}.`,
      warten,
      hinweise,
      aktion: mails.length
        ? {
            id: "kauf-erinnern",
            knopf: neu.length === mails.length ? (mails.length === 2 ? "Beide informieren" : `${seite(b, mails[0].rolle).akk} informieren`) : "Erinnerung senden",
            tipp: "Sendet die Bitte um Bestätigung der Eckdaten mit Direktlink an alle, die noch nicht bestätigt haben (vorher wird nachgefragt)",
            frage: neu.length === mails.length ? "Bitte um Bestätigung jetzt senden?" : "Erinnerung an die Bestätigung senden?",
            passiert: ["Bitte um Bestätigung der Eckdaten mit Direktlink in den Kundenbereich an alle, die noch nicht bestätigt haben."],
            mails,
            dran: neu.length > 0,
          }
        : null,
      wartet: mails.length > 0 && neu.length === 0,
      extra: [k.status, k.geaendertAm, Object.keys(k.bestaetigungen)],
    };
  }

  if (k.status === "bestaetigt") {
    const g = u.einstellungen.gutschein;
    const kaeufer = seite(b, "suchender");
    return {
      stand: "Beide haben die Eckdaten bestätigt — das PDF für den Notar liegt in den Dokumenten.",
      warten: [`Notarielle Beurkundung${k.notar.name ? ` bei ${k.notar.name}` : ""}${k.notar.termin ? ` am ${T.tagDe(k.notar.termin)}` : " (noch kein Termin eingetragen)"} — danach hier erfassen`],
      hinweise,
      aktion: {
        id: "kauf-beurkundet",
        knopf: "Beurkundung erfassen",
        tipp: v.freigabe ? "Erfasst die notarielle Beurkundung und legt die Provision an (vorher wird nachgefragt)" : SPERRE_FREIGABE,
        frage: "Beurkundung erfassen?",
        passiert: [
          "Beurkundung mit Datum und Kaufpreis laut Urkunde erfassen — der Vorgang gilt damit als abgeschlossen.",
          `Provision anlegen: ${konditionen ? `${M.konditionenText("kauf", konditionen)} (Konditionen Nr. ${konditionen.version})` : "kein unterschriebener Nachweisvertrag des Käufers gefunden — Anspruch prüfen"}; fällig erst mit Wirksamkeit (Genehmigung nach GrdstVG), bei „nicht nötig“ oder „bereits erteilt“ sofort.`,
        ],
        mails: [],
        folgeMails:
          g?.aktiv && g.betrag > 0 && ctx.suchender
            ? [`Treue-Gutschein über ${M.euro(g.betrag)} an den Käufer ${kaeufer.name} (${kaeufer.an}) — Mail mit Code und Bedingungen; der Text steht danach im Verlauf.`]
            : undefined,
        felder: [
          { name: "datum", typ: "datum", label: "Beurkundet am", pflicht: true, wert: k.notar.termin ?? "", tipp: "Datum der notariellen Beurkundung" },
          { name: "kaufpreis", typ: "zahl", label: "Kaufpreis laut Urkunde (€)", pflicht: true, wert: k.daten.kaufpreis != null ? zahlText(k.daten.kaufpreis) : "", tipp: "Beurkundeter Kaufpreis — Grundlage der Provision" },
          {
            name: "genehmigung",
            typ: "auswahl",
            label: "Genehmigung (GrdstVG)",
            wert: "beantragt",
            optionen: [
              { wert: "beantragt", label: "beantragt / ausstehend" },
              { wert: "nicht_noetig", label: "nicht nötig (bis 1 ha)" },
              { wert: "erteilt", label: "bereits erteilt" },
            ],
            tipp: "Ohne erforderliche Genehmigung ist der Kaufvertrag schwebend unwirksam — die Provision wird erst mit der Genehmigung fällig",
          },
        ],
        link: formularLink,
        gesperrt: v.freigabe ? undefined : SPERRE_FREIGABE,
        // Die Beurkundung macht der Notar — erfasst wird sie, wenn sie stattgefunden hat.
        dran: false,
      },
      wartet: true,
      extra: [k.status, k.geaendertAm],
    };
  }
  return { stand: `Kauf: ${k.status}.`, hinweise, aktion: null };
}

// ---------------------------------------------------------------------------
// Provision (Schritt 7)

function schrittProvision(b: Bau): Teil {
  const v = b.ctx.vorgang;
  if (!v) return { stand: "Vorgangsakte fehlt.", aktion: null };
  const hinweise = nachAbschlussHinweise(b);
  const provs = v.provisionen.filter((p) => p.status !== "storniert");
  const offen = provs.filter((p) => p.status !== "bezahlt");
  if (provs.length === 0) {
    const pv = v.pachtvertrag;
    const reparatur = pv?.status === "abgeschlossen" && !v.dokumente.some((d) => d.id === pv.dokumentId);
    return {
      stand: "Der Vertrag ist geschlossen, aber es ist keine Provision erfasst.",
      hinweise: [
        ...hinweise,
        { warn: true, text: reparatur ? "Beim Abschluss fehlen PDF bzw. Provision — im Bereich „Landpachtvertrag“ „PDF und Provision nachholen“ klicken." : "Bitte unten unter „Provision“ prüfen." },
      ],
      aktion: null,
    };
  }
  const p = offen[0];
  const nach = M.provisionNachGutschein(p);
  const betrag = `${M.euro(nach.netto)} netto / ${M.euro(nach.brutto)} brutto`;
  const suchender = seite(b, "suchender");
  if (offen.length > 1) {
    hinweise.push({ text: `Weitere offene Provision${offen.length > 2 ? "en" : ""}: ${offen.slice(1).map((q) => `${q.id} (${M.PROVISION_STATUS[q.status].label})`).join(", ")} — unten unter „Provision“.` });
  }
  const stand = `Provision ${betrag} — ${M.PROVISION_STATUS[p.status].label}. Schuldner: Suchender ${suchender.name}.`;
  const notizFeld = (platzhalter: string, tipp: string): AssistentFeld => ({ name: "notiz", typ: "text", label: "Notiz (freiwillig)", platzhalter, tipp });
  const extra = [p.id, p.status];
  if (p.status === "aufschiebend") {
    if (v.kauf?.status === "beurkundet") {
      return {
        stand,
        warten: ["Genehmigung nach dem Grundstückverkehrsgesetz (Landwirtschaftskammer) — erst dann ist der Kaufvertrag wirksam und die Provision fällig"],
        hinweise,
        aktion: {
          id: "kauf-wirksam",
          knopf: "Kauf ist wirksam",
          tipp: "Vermerkt, dass die Genehmigung erteilt ist — die Provision wird fällig (vorher wird nachgefragt)",
          frage: "Kaufvertrag als wirksam erfassen?",
          passiert: ["Die Genehmigung ist erteilt: Kaufvertrag als wirksam vermerken.", `Die Provision (${betrag}) wird fällig — die Rechnung stellt die Buchhaltung.`],
          mails: [],
          felder: [{ name: "datum", typ: "datum", label: "Wirksam seit (Genehmigung erteilt am)", pflicht: true, wert: heute(b.jetzt), tipp: "Datum, an dem die Genehmigung erteilt wurde" }],
          ziel: p.id,
          dran: false,
        },
        wartet: true,
        extra,
      };
    }
    return {
      stand,
      hinweise: [...hinweise, { warn: true, text: `Die Provision ist nur vorgemerkt${p.notiz ? `: ${p.notiz}` : ""} — bitte unten unter „Provision“ prüfen und den Status setzen.` }],
      aktion: null,
    };
  }
  if (p.status === "faellig") {
    return {
      stand,
      warten: ["Rechnung durch die Buchhaltung (hier wird keine Rechnungsnummer vergeben)"],
      hinweise,
      aktion: {
        id: "provision-abgerechnet",
        knopf: "Als abgerechnet markieren",
        tipp: "Vermerkt, dass die Buchhaltung die Rechnung gestellt hat (vorher wird nachgefragt)",
        frage: "Provision als abgerechnet markieren?",
        passiert: [`Die Provision (${betrag}) wird als „Abgerechnet“ vermerkt — mit Ihrer Notiz im Verlauf der Provision.`],
        mails: [],
        felder: [notizFeld("z. B. Rechnung vom 01.10.2026", "z. B. Datum der Rechnung der Buchhaltung — erscheint im Verlauf der Provision")],
        ziel: p.id,
        dran: true,
      },
      extra,
    };
  }
  return {
    stand,
    warten: ["Zahlungseingang"],
    hinweise,
    aktion: {
      id: "provision-bezahlt",
      knopf: "Als bezahlt markieren",
      tipp: "Vermerkt den Zahlungseingang — danach ist der Vorgang vollständig erledigt (vorher wird nachgefragt)",
      frage: "Provision als bezahlt markieren?",
      passiert: [`Die Provision (${betrag}) wird als „Bezahlt“ vermerkt — mit Ihrer Notiz im Verlauf der Provision.`],
      mails: [],
      felder: [notizFeld("z. B. Zahlungseingang am 15.10.2026", "z. B. Datum des Zahlungseingangs — erscheint im Verlauf der Provision")],
      ziel: p.id,
      dran: false,
    },
    wartet: true,
    extra,
  };
}

// ---------------------------------------------------------------------------

function signatur(key: string, nr: number | null, teil: Teil, a: Omit<AssistentAktion, "signatur">): string {
  const kanon = JSON.stringify({
    k: key,
    n: nr,
    a: a.id,
    s: teil.stand,
    w: teil.warten ?? [],
    g: a.gesperrt ?? "",
    z: a.ziel ?? "",
    m: a.mails.map((m) => [m.zweck, m.rolle, m.an, m.zuletzt ?? "", m.neuerLink ? 1 : 0]),
    x: teil.extra ?? null,
  });
  return createHash("sha256").update(kanon).digest("hex").slice(0, 24);
}

/** Der Plan des Assistenten für einen Vorgang: Stand, Wartepunkte und genau eine nächste Aktion. */
export function assistentPlan(ctx: VorgangKontext, u: AssistentUmgebung): AssistentPlan {
  const jetzt = u.jetzt ?? new Date();
  const sch = vorgangSchritte({ art: ctx.art, meta: ctx.meta, vorgang: ctx.vorgang, anbieter: ctx.anbieter, suchender: ctx.suchender }, jetzt);
  const b: Bau = { ctx, u, jetzt, seiten: seitenVon(ctx) };
  let titel = sch.aktuell?.titel ?? "";
  let teil: Teil;
  if (sch.verworfen) {
    titel = "Paar verworfen";
    teil = { stand: "Dieses Paar ist verworfen — der Assistent ruht. Wieder aufnehmen: im Vorgang unter „Weitere Aktionen“ bzw. im Matching „Wieder vorschlagen“.", aktion: null };
  } else if (!sch.aktuell) {
    titel = "Alles erledigt";
    teil = { stand: `Alle ${sch.schritte.length} Schritte erledigt — Vertrag geschlossen und Provision bezahlt.`, hinweise: nachAbschlussHinweise(b), aktion: null };
  } else {
    switch (sch.aktuell.id) {
      case "paar":
        teil = schrittPaar();
        break;
      case "einladung":
        teil = schrittEinladung(b);
        break;
      case "unterschrift":
        teil = schrittUnterschrift(b);
        break;
      case "zustimmung":
        teil = schrittZustimmung(b);
        break;
      case "freigabe":
        teil = schrittFreigabe(b);
        break;
      case "vertrag":
        teil = schrittVertrag(b);
        break;
      case "provision":
        teil = schrittProvision(b);
        break;
    }
  }
  const nr = sch.aktuell?.nr ?? null;
  const aktion = teil.aktion ? { ...teil.aktion, signatur: signatur(ctx.key, nr, teil, teil.aktion) } : null;
  return {
    key: ctx.key,
    art: ctx.art,
    nr,
    gesamt: sch.schritte.length,
    titel,
    stand: teil.stand,
    warten: teil.warten ?? [],
    hinweise: teil.hinweise ?? [],
    aktion,
    zustimmungen: teil.zustimmungen ?? [],
    amZug: sch.verworfen || !sch.aktuell ? null : teil.wartet ? "kunde" : "admin",
    fertig: !sch.verworfen && !sch.aktuell,
    verworfen: sch.verworfen,
    test: testModus(),
  };
}
