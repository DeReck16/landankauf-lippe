// Anzeige-Stände der Anfragen-Liste: Wie weit ist der Kunde im Kundenbereich (angemeldet / onboarded),
// und steht seine Fläche auf lippeforst.de? Reine Ableitungen aus vorhandenen Daten — nichts wird geschrieben,
// und es erscheinen nur Angaben, die die Verwaltung ohnehin sieht (Börsen-Kennung, keine Namen auf der Seite).

import { boerseLuecken } from "@/lib/boerse-regeln";
import { STUFE_INFO, stufe, type KundeRecord } from "@/lib/portal/model";
import { datum } from "./format";
import type { LeadView } from "./model";

export type Ton = "ok" | "warn" | "rot" | "leise";

export type Anzeige = {
  /** Stabiler Schlüssel für Filter und Zähler (Konto: nicht/eingeladen/angemeldet/onboarded/aus/keine — Seite: online/bereit/angaben/nicht/offline/unsichtbar/direkt/gesuch/keine). */
  schluessel: string;
  ton: Ton;
  label: string;
  detail?: string;
  tipp: string;
  /** Verwaltungs-Link (Anfrage, Abschnitt) oder – bei `oeffentlich` – die Seite auf lippeforst.de. */
  href?: string;
  oeffentlich?: boolean;
};

/** Stand im Kundenbereich: nicht eingeladen → eingeladen → angemeldet → onboarded (Vereinbarung unterschrieben). */
export function kontoStand(k: KundeRecord | null | undefined, kunden?: Map<string, KundeRecord>): Anzeige {
  const s = stufe(k);
  const tipp = STUFE_INFO[s].tipp;
  const ueber = k?.einladung?.ueber;
  switch (s) {
    case "neu":
      return { schluessel: "nicht", ton: "leise", label: "Nicht eingeladen", tipp };
    case "eingeladen": {
      // Weitere Fläche eines Anbieters: eingeladen über eine andere Anfrage — dort steht, wie weit er ist.
      const quelle = ueber ? stufe(kunden?.get(ueber)) : null;
      if (ueber && (quelle === "geoeffnet" || quelle === "angaben" || quelle === "unterschrieben")) {
        return { schluessel: "angemeldet", ton: "warn", label: "Angemeldet", detail: `über ${ueber} · Fläche noch nicht bestätigt`, tipp };
      }
      return { schluessel: "eingeladen", ton: "warn", label: "Eingeladen", detail: ueber ? `über ${ueber}` : "Link noch nicht geöffnet", tipp };
    }
    case "geoeffnet":
      return { schluessel: "angemeldet", ton: "warn", label: "Angemeldet", detail: "noch keine Angaben", tipp };
    case "angaben":
      return { schluessel: "angemeldet", ton: "warn", label: "Angemeldet", detail: "Unterschrift fehlt", tipp };
    case "unterschrieben":
      return { schluessel: "onboarded", ton: "ok", label: "Onboarded", detail: k?.vertrag ? `unterschrieben ${datum(k.vertrag.signatur.am)}` : undefined, tipp };
    case "widerrufen":
      return { schluessel: "aus", ton: "rot", label: "Widerrufen", tipp };
    case "gekuendigt":
      return { schluessel: "aus", ton: "rot", label: "Gekündigt", tipp };
    case "gesperrt":
      return { schluessel: "aus", ton: "rot", label: "Gesperrt", tipp };
  }
}

/** Wie `kontoStand`, aber Auskünfte (Bewertung, Beratung …) haben keinen Kundenbereich — dort steht „—“. */
export function kontoStandFuer(l: LeadView, k: KundeRecord | null | undefined, kunden?: Map<string, KundeRecord>): Anzeige {
  if (l.rolle === "keine" && !k) {
    return { schluessel: "keine", ton: "leise", label: "—", tipp: "Auskünfte (Bewertung, Beratung, Energiepacht …) bekommen keinen Kundenbereich." };
  }
  return kontoStand(k, kunden);
}

/**
 * Steht die Fläche bzw. das Gesuch auf der Website? Online ist nur, was die öffentliche Börsen-Datei enthält
 * (`boerseNeuSchreiben`): Angebot mit Einwilligung, ohne Lücken, nicht vergeben und nicht ausgestiegen.
 * `sperre` = Ergebnis von `sperrGrund` (lib/boerse.ts). Gesuche gibt es auf der Seite nicht — sie werden nur intern abgeglichen.
 */
export function seitenStand(l: LeadView, sperre: string | null): Anzeige {
  if (l.rolle === "gesuch") {
    const aktiv = l.status !== "erledigt" && l.status !== "archiv";
    return {
      schluessel: "gesuch",
      ton: "leise",
      label: "Nicht öffentlich",
      detail: aktiv ? "im Abgleich" : "nicht im Abgleich",
      tipp: "Gesuche stehen nicht auf der Website. Sie werden nur intern mit den Angeboten abgeglichen (Matching) — nach Einladung und Zustimmung bekommen beide Seiten einen anonymen Hinweis.",
    };
  }
  if (l.rolle !== "angebot") {
    return { schluessel: "keine", ton: "leise", label: "—", tipp: "Kein Flächenangebot und kein Gesuch — erscheint nicht auf der Website." };
  }
  const intern = `/admin/anfrage/${l.id}#boerse`;
  if (l.meta.weg === "ankauf") {
    return { schluessel: "direkt", ton: "leise", label: "Direktankauf", detail: "nicht in der Börse", tipp: "Die TR Vertriebs GmbH kauft diese Fläche selbst — sie wird nicht vermittelt und nicht veröffentlicht.", href: intern };
  }
  const b = l.meta.boerse;
  const luecken = boerseLuecken(b, l);
  if (sperre && (b?.online || b?.einwilligung)) {
    return { schluessel: "offline", ton: "warn", label: "Offline", detail: sperre, tipp: "Das Angebot wird nicht gezeigt, weil es vergeben ist oder der Eigentümer ausgestiegen ist.", href: intern };
  }
  if (b?.online && luecken.length === 0) {
    return {
      schluessel: "online",
      ton: "ok",
      label: "Online",
      detail: b.seit ? `${b.code} · seit ${datum(b.seit)}` : b.code,
      tipp: "Steht anonym in der Flächenbörse auf lippeforst.de (nur Flächentyp, gerundete Größe, Gemeinde). Klick öffnet die öffentliche Seite.",
      href: `/flaechenboerse/${b.code}`,
      oeffentlich: true,
    };
  }
  if (b?.online) {
    return { schluessel: "unsichtbar", ton: "rot", label: "Nicht sichtbar", detail: luecken[0], tipp: "In der Verwaltung als online geführt, wird aber wegen dieser Lücke nicht auf der Seite gezeigt. Klick öffnet die Börsen-Angaben.", href: intern };
  }
  if (l.status === "erledigt" || l.status === "archiv") {
    return { schluessel: "nicht", ton: "leise", label: "Nicht online", detail: "Anfrage erledigt", tipp: "Erledigte und archivierte Anfragen kommen nicht in die Flächenbörse." };
  }
  if (b?.offline) {
    return { schluessel: "offline", ton: "warn", label: "Offline", detail: b.offline.grund, tipp: "Wurde offline genommen und bleibt es, bis die Verwaltung neu veröffentlicht.", href: intern };
  }
  if (b?.einwilligung && luecken.length === 0) {
    return { schluessel: "bereit", ton: "warn", label: "Bereit", detail: "noch nicht veröffentlicht", tipp: "Einwilligung des Eigentümers liegt vor, Angaben sind vollständig — fehlt nur noch „Veröffentlichen“ (Dashboard oder Anfrage).", href: intern };
  }
  if (b?.einwilligung) {
    return { schluessel: "angaben", ton: "warn", label: "Angaben fehlen", detail: luecken[0], tipp: "Einwilligung liegt vor, aber die Börsen-Angaben sind noch nicht vollständig.", href: intern };
  }
  return {
    schluessel: "nicht",
    ton: "leise",
    label: "Nicht online",
    detail: b ? "Einwilligung fehlt" : "noch keine Börsen-Angaben",
    tipp: "Ohne Einwilligung des Eigentümers bleibt die Fläche unveröffentlicht. Sie kann im Kundenbereich oder in der Anfrage erteilt werden.",
    href: intern,
  };
}

export const TON_KLASSE: Record<Ton, string> = {
  ok: "lfa-badge-ok",
  warn: "lfa-badge-warn",
  rot: "lfa-badge-rot",
  leise: "lfa-badge-keine",
};
