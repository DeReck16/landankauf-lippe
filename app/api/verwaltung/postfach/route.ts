import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { hasBlobToken } from "@/lib/admin/config";
import { site } from "@/lib/site";
import * as A from "@/lib/portal/ablauf";
import { MAX_JE_AUFRUF, istOffen, postfachAdressen, postfachEingang, postfachUebernehmen, type PostfachEingabe } from "@/lib/portal/postfach";
import { istRueckmeldungArt } from "@/lib/portal/rueckmeldung-typen";

// Postfach-Abgleich (lib/portal/postfach.ts) — nur mit Schlüssel (Bearer LF_POSTFACH_TOKEN):
//   GET  → gehashte Absenderadressen der Kunden (das Skript auf dem Mac meldet nur deren Mails)
//   POST { mails: [...] } → Mails zuordnen, Tickets anlegen (nichts wird von selbst eingeordnet)
//   POST { uebernehmen: [{ anfrage, art, mail?, thema?, von? }] } → Vorschlag übernehmen wie der
//        Knopf im Dashboard (für Aufträge, die Dennis ausdrücklich erteilt hat)

export const runtime = "nodejs";
export const maxDuration = 60;

function erlaubt(request: Request): boolean {
  const soll = process.env.LF_POSTFACH_TOKEN ?? "";
  const ist = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (soll.length < 32 || ist.length !== soll.length) return false;
  return timingSafeEqual(Buffer.from(ist), Buffer.from(soll));
}

function verweigert() {
  return NextResponse.json({ ok: false, fehler: "unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  if (!erlaubt(request)) return verweigert();
  if (!hasBlobToken()) return NextResponse.json({ ok: false, fehler: "Kein Speicher verbunden." }, { status: 503 });
  return NextResponse.json({ ok: true, adressen: await postfachAdressen() });
}

type Uebernahme = { anfrage?: unknown; mail?: unknown; art?: unknown; thema?: unknown; von?: unknown };

export async function POST(request: Request) {
  if (!erlaubt(request)) return verweigert();
  if (!hasBlobToken()) return NextResponse.json({ ok: false, fehler: "Kein Speicher verbunden." }, { status: 503 });
  let body: { mails?: unknown; uebernehmen?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, fehler: "Kein gültiges JSON." }, { status: 400 });
  }

  const mails = Array.isArray(body.mails) ? (body.mails as PostfachEingabe[]) : [];
  if (mails.length > MAX_JE_AUFRUF) return NextResponse.json({ ok: false, fehler: `Höchstens ${MAX_JE_AUFRUF} Mails je Aufruf.` }, { status: 413 });
  const ergebnisse = mails.length ? await postfachEingang(mails, { basis: site.url }) : [];

  const uebernommen: { anfrage: string; ok: boolean; text: string }[] = [];
  for (const u of (Array.isArray(body.uebernehmen) ? (body.uebernehmen as Uebernahme[]) : []).slice(0, 10)) {
    const anfrage = typeof u.anfrage === "string" ? u.anfrage : "";
    const art = typeof u.art === "string" ? u.art : "";
    const von = typeof u.von === "string" && u.von.trim() ? u.von.trim().slice(0, 60) : "postfach";
    if (!/^LL-[A-Z0-9]+$/.test(anfrage) || !istRueckmeldungArt(art)) {
      uebernommen.push({ anfrage: anfrage || "?", ok: false, text: "Anfrage oder Antwort ungültig." });
      continue;
    }
    // Ohne Angabe: die neueste offene Mail der Anfrage.
    let mail = typeof u.mail === "string" ? u.mail : "";
    if (!mail) {
      const geladen = await A.ladeLead(anfrage);
      mail = geladen?.lead.meta.postfach?.find(istOffen)?.id ?? "";
    }
    if (!mail) {
      uebernommen.push({ anfrage, ok: false, text: "Keine offene E-Mail zu dieser Anfrage." });
      continue;
    }
    const r = await postfachUebernehmen(anfrage, mail, art, { von, basis: site.url, thema: typeof u.thema === "string" ? u.thema : undefined });
    uebernommen.push(r.ok ? { anfrage, ok: true, text: `übernommen: ${art}` } : { anfrage, ok: false, text: r.fehler });
  }

  return NextResponse.json({ ok: true, ergebnisse, uebernommen });
}
