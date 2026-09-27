import "server-only";
import { jsonAendern, jsonListe } from "@/lib/admin/store";
import { sende, type PostausgangEintrag } from "./mail";
import * as M from "./model";
import { aendereKunde, aendereVorgang, ladeVorgang } from "./speicher";

// Postausgang: gescheiterte Systemmails (Vertragsbestätigung, Widerrufs- und
// Kündigungsbestätigung, Abschluss-Mails, Eingangsbestätigung, Meldungen an die
// Verwaltung …) werden hier erneut versucht — vom täglichen Cron und per Knopf im
// Dashboard. Klappt es, wird der Versand dort vermerkt, wo die Mail hingehört
// (Kundenakte bzw. Vorgang). Nach 6 Versuchen gilt sie als aufgegeben und bleibt als
// Aufgabe im Dashboard stehen.

export const MAX_VERSUCHE = 6;

export type PostausgangStand = {
  offen: PostausgangEintrag[];
  aufgegeben: PostausgangEintrag[];
};

export async function postausgangStand(): Promise<PostausgangStand> {
  const alle = await jsonListe<PostausgangEintrag>("portal/postausgang/");
  return {
    offen: alle.filter((e) => !e.erledigt).sort((a, b) => a.erstelltAm.localeCompare(b.erstelltAm)),
    aufgegeben: alle.filter((e) => e.erledigt?.wie === "aufgegeben").sort((a, b) => b.erstelltAm.localeCompare(a.erstelltAm)),
  };
}

/** Nach einem gelungenen späteren Versand vermerken, wo die Mail hingehört. */
async function vermerken(e: PostausgangEintrag, am: string): Promise<void> {
  const b = e.bezug;
  const text = `E-Mail „${e.mail.betreff}“ an ${e.mail.an.join(", ")} nachträglich gesendet (Postausgang, Versuch ${e.versuche + 1})`;
  if (b.typ === "kunde") {
    await aendereKunde(b.id, (k) => {
      const m = k.mails.find((x) => x.id === b.mailId);
      if (m) {
        m.ok = true;
        delete m.fehler;
        m.nachgesendetAm = am;
      }
      if (e.zweck === "vertragsbestaetigung" && k.vertrag && !k.vertrag.bestaetigungGesendetAm) k.vertrag.bestaetigungGesendetAm = am;
      if (e.zweck === "widerruf-bestaetigung" && k.widerruf && !k.widerruf.bestaetigtAm) k.widerruf.bestaetigtAm = am;
      if (e.zweck === "kuendigung-bestaetigung" && k.kuendigung && !k.kuendigung.bestaetigtAm) k.kuendigung.bestaetigtAm = am;
      M.ereignis(k, "system", "mail", text);
    });
  } else if (b.typ === "vorgang") {
    const v = await ladeVorgang(b.key);
    if (!v) return;
    await aendereVorgang(b.key, v.art, (x) => {
      const m = x.mails.find((y) => y.id === b.mailId);
      if (m) {
        m.ok = true;
        delete m.fehler;
        m.nachgesendetAm = am;
      }
      M.ereignis(x, "system", "mail", text);
    });
  }
}

/**
 * Fällige Mails erneut senden. `alle`: auch noch nicht fällige (Knopf „Jetzt erneut senden“).
 * Liefert, wie viele gesendet wurden bzw. noch offen sind.
 */
export async function postausgangAbarbeiten(opt: { alle?: boolean; von?: string; max?: number } = {}): Promise<{ gesendet: number; offen: number; aufgegeben: number }> {
  const { offen } = await postausgangStand();
  const jetzt = Date.now();
  let gesendet = 0;
  let aufgegeben = 0;
  let rest = 0;
  for (const e of offen.slice(0, opt.max ?? 50)) {
    if (!opt.alle && Date.parse(e.naechsterVersuch) > jetzt) {
      rest++;
      continue;
    }
    const r = await sende({
      an: e.mail.an,
      betreff: e.mail.betreff,
      text: e.mail.text,
      von: e.mail.von,
      replyTo: e.mail.replyTo,
      bcc: e.mail.bcc,
      anhaenge: e.mail.anhaenge?.map((a) => ({ dateiname: a.dateiname, inhalt: new Uint8Array(Buffer.from(a.base64, "base64")) })),
    });
    const am = new Date().toISOString();
    if (r.ok && !r.test) {
      await vermerken(e, am).catch((err) => console.error("[postausgang] Versand nicht vermerkt", e.id, err));
    }
    await jsonAendern<PostausgangEintrag>(`portal/postausgang/${e.id}.json`, () => e, (x) => {
      if (x.erledigt) return false;
      if (r.ok) {
        x.erledigt = { am, wie: "gesendet", von: opt.von ?? "system" };
        return;
      }
      x.versuche++;
      x.letzterFehler = r.fehler ?? "unbekannter Fehler";
      if (x.versuche >= MAX_VERSUCHE) x.erledigt = { am, wie: "aufgegeben", von: opt.von ?? "system" };
      // Wartezeit wächst: 1, 2, 4, 8 … Stunden.
      else x.naechsterVersuch = new Date(Date.now() + 2 ** (x.versuche - 1) * 3_600_000).toISOString();
    });
    if (r.ok) gesendet++;
    else if (e.versuche + 1 >= MAX_VERSUCHE) aufgegeben++;
    else rest++;
  }
  return { gesendet, offen: rest, aufgegeben };
}

/** Eine aufgegebene bzw. offene Mail aus dem Postausgang nehmen (z. B. nach Versand von Hand). */
export async function postausgangVerwerfen(id: string, von: string): Promise<boolean> {
  if (!/^PA-[A-Z0-9]+$/.test(id)) return false;
  let ok = false;
  await jsonAendern<PostausgangEintrag>(`portal/postausgang/${id}.json`, () => null as unknown as PostausgangEintrag, (x) => {
    if (!x || (x.erledigt && x.erledigt.wie !== "aufgegeben")) return false;
    x.erledigt = { am: new Date().toISOString(), wie: "verworfen", von };
    ok = true;
  });
  return ok;
}
