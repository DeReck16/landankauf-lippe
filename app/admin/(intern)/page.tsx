import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/session";
import { ladeVerwaltung } from "@/lib/admin/daten";
import { findeKandidaten } from "@/lib/admin/matching";
import { LEAD_STATUS, formatGroesse, type LeadStatus, type LeadView } from "@/lib/admin/model";
import { FLAECHENTYPEN } from "@/lib/lead-options";
import { ROLLE_LABEL, ROLLE_TIPP, artLabel, datumZeit } from "@/lib/admin/format";
import { ladeNeu, ladePortal } from "@/lib/admin/neu";
import { STUFE_INFO, stufe } from "@/lib/portal/model";
import StatusSchnell from "./StatusSchnell";
import AlleFreigeben from "./AlleFreigeben";
import { Meldung } from "./teile";

export const metadata: Metadata = { title: "Anfragen" };

function passtZurSuche(l: LeadView, q: string): boolean {
  const heu = [l.id, l.name, l.email, l.phone, l.ort, l.flurstueck, l.message, l.intent, l.meta.notiz ?? ""]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((wort) => heu.includes(wort));
}

export default async function AnfragenPage(props: PageProps<"/admin">) {
  const { email } = await requireAdmin();
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "offen";
  const rolle = typeof sp.rolle === "string" ? sp.rolle : "alle";
  const typ = typeof sp.typ === "string" ? sp.typ : "alle";

  const [{ leads, zustand }, portal, neu] = await Promise.all([ladeVerwaltung(), ladePortal(), ladeNeu(email)]);
  const { kandidaten } = findeKandidaten(leads, zustand);
  const matchesJeAnfrage = new Map<string, number>();
  for (const k of kandidaten) {
    if (k.meta?.status === "verworfen") continue;
    for (const id of [k.angebot.id, k.gesuch.id]) matchesJeAnfrage.set(id, (matchesJeAnfrage.get(id) ?? 0) + 1);
  }

  const sichtbar = leads.filter((l) => {
    if (status === "offen" ? l.status === "archiv" : status !== "alle" && l.status !== status) return false;
    if (rolle !== "alle" && l.rolle !== rolle) return false;
    if (typ !== "alle" && l.typ !== typ) return false;
    return !q || passtZurSuche(l, q);
  });

  const aktiv = leads.filter((l) => l.status !== "archiv");
  const kacheln = [
    { wert: aktiv.length, name: "Anfragen", href: "/admin", tipp: "Alle Anfragen außer Archiv (Test, Spam, Dubletten)" },
    { wert: aktiv.filter((l) => l.status === "neu").length, name: "Neu", href: "/admin?status=neu", tipp: "Noch nicht bearbeitete Anfragen anzeigen", puls: aktiv.some((l) => neu.anfrage(l)) },
    { wert: aktiv.filter((l) => l.rolle === "angebot").length, name: "Angebote", href: "/admin?rolle=angebot", tipp: "Nur Flächen-Angebote (verkaufen/verpachten) anzeigen" },
    { wert: aktiv.filter((l) => l.rolle === "gesuch").length, name: "Gesuche", href: "/admin?rolle=gesuch", tipp: "Nur Gesuche (Fläche pachten/kaufen) anzeigen" },
    { wert: kandidaten.filter((k) => !k.meta).length, name: "Neue Vorschläge", href: "/admin/matching", tipp: "Zum Matching: Paare aus Angebot und Gesuch, die noch niemand bearbeitet hat", puls: kandidaten.some((k) => !k.meta && neu.vorschlag(k.key)) },
  ];

  return (
    <>
      <div className="lfa-titelzeile">
        <div>
          <h1 className="lfa-h1">Anfragen</h1>
          <p className="lfa-unterzeile">Alle Formular-Anfragen von lippeforst.de, neueste zuerst.</p>
        </div>
      </div>
      <Meldung sp={sp} />
      <AlleFreigeben e={portal.einstellungen} zurueck="/admin" />

      <div className="lfa-kacheln">
        {kacheln.map((k) => (
          <Link key={k.name} href={k.href} className={`lfa-kachel ${"puls" in k && k.puls ? "lfa-puls-ring" : ""}`} title={k.tipp}>
            <div className="lfa-kachel-wert">{k.wert}</div>
            <div className="lfa-kachel-name">{k.name}</div>
          </Link>
        ))}
      </div>

      <form className="lfa-filter" method="get">
        <label className="lfa-filter-suche">
          Suche
          <input
            name="q"
            defaultValue={q}
            placeholder="Name, Ort, E-Mail, Flurstück, Notiz …"
            className="field-input"
            title="Sucht in Name, E-Mail, Telefon, Ort, Flurstück, Nachricht und Notizen. Mehrere Wörter müssen alle vorkommen."
          />
        </label>
        <label>
          Status
          <select name="status" defaultValue={status} className="field-select" title="Nach Bearbeitungsstand filtern. „Offen“ blendet nur das Archiv aus.">
            <option value="offen">Alle außer Archiv</option>
            <option value="alle">Alle inkl. Archiv</option>
            {(Object.keys(LEAD_STATUS) as LeadStatus[]).map((s) => (
              <option key={s} value={s}>{LEAD_STATUS[s].label}</option>
            ))}
          </select>
        </label>
        <label>
          Art
          <select name="rolle" defaultValue={rolle} className="field-select" title="Angebote (Fläche wird angeboten), Gesuche (Fläche wird gesucht) oder sonstige Anliegen">
            <option value="alle">Alle</option>
            <option value="angebot">Angebote</option>
            <option value="gesuch">Gesuche</option>
            <option value="keine">Sonstige</option>
          </select>
        </label>
        <label>
          Flächentyp
          <select name="typ" defaultValue={typ} className="field-select" title="Nach Flächentyp filtern (inkl. in der Verwaltung korrigierter Typen)">
            <option value="alle">Alle</option>
            {FLAECHENTYPEN.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="lfa-knopf" title="Liste mit diesen Filtern neu laden">Filtern</button>
        <Link href="/admin" className="lfa-knopf lfa-knopf-leise" title="Alle Filter und die Suche zurücksetzen">Zurücksetzen</Link>
      </form>

      {sichtbar.length === 0 ? (
        <div className="lfa-panel lfa-leer">Keine Anfragen für diese Auswahl.</div>
      ) : (
        <table className="lfa-liste">
          <thead>
            <tr>
              <th title="Eingangszeit (deutsche Zeit) und Vorgangsnummer aus der Bestätigungsseite">Eingang</th>
              <th title="Angebot, Gesuch oder sonstiges Anliegen — aus dem Formular abgeleitet, in der Anfrage korrigierbar">Anliegen</th>
              <th title="Flächentyp und Größe; ≈ heißt: Größe aus Freitext geschätzt">Fläche</th>
              <th title="Ort bzw. Suchregion, wie im Formular angegeben (oder in der Anfrage fürs Matching korrigiert)">Ort</th>
              <th title="Name öffnet die Anfrage; E-Mail und Telefon starten direkt Mail bzw. Anruf">Kontakt</th>
              <th title="Anzahl passender Gegenstücke im Matching (ohne verworfene)">Matches</th>
              <th title="Bearbeitungsstand — Auswahl speichert sofort">Status</th>
            </tr>
          </thead>
          <tbody>
            {sichtbar.map((l) => {
              const matches = matchesJeAnfrage.get(l.id) ?? 0;
              const kunde = portal.kunden.get(l.id);
              const neuEreignisse = neu.kunde(kunde);
              const istNeu = neu.anfrage(l);
              return (
                <tr key={l.id} className={l.status === "neu" ? "lfa-zeile-neu" : undefined}>
                  <td data-label="Eingang">
                    <div>{datumZeit(l.receivedAt)}</div>
                    <div className="lfa-klein">{l.id}</div>
                  </td>
                  <td data-label="Anliegen">
                    <div className="lfa-zelle-stapel">
                      <span className={`lfa-badge lfa-badge-${l.rolle}`} title={ROLLE_TIPP[l.rolle]}>
                        {ROLLE_LABEL[l.rolle]}
                        {l.art ? ` · ${artLabel(l.art)}` : ""}
                      </span>
                      <span className="lfa-klein">{l.intent}</span>
                      {l.ausAds && (
                        <span className="lfa-badge lfa-badge-ads" title="Kam über eine Google-Anzeige (gclid vorhanden)">
                          Google Ads
                        </span>
                      )}
                    </div>
                  </td>
                  <td data-label="Fläche">
                    <div>{l.typ}</div>
                    <div className="lfa-klein" title={l.groesseWert.unsicher ? `Geschätzt aus „${l.groesse}“` : undefined}>
                      {l.groesseWert.unsicher ? "≈ " : ""}
                      {formatGroesse(l.groesseWert)}
                    </div>
                  </td>
                  <td data-label="Ort">
                    <div>{l.ortText || "—"}</div>
                    {l.flurstueck !== "—" && <div className="lfa-klein">{l.flurstueck}</div>}
                  </td>
                  <td data-label="Kontakt" className="lfa-kontakt">
                    <Link href={`/admin/anfrage/${l.id}`} className="lfa-link-name" title="Anfrage öffnen: alle Angaben, Onboarding, Bearbeitung, Matching-Angaben und passende Gegenstücke">
                      {(istNeu || neuEreignisse.length > 0) && <span className="lfa-puls" title={istNeu ? "Neue Anfrage — noch nicht geöffnet" : `${neuEreignisse.length} neue Ereignisse im Kundenbereich`} />}
                      {l.name}
                    </Link>
                    {kunde && (
                      <div>
                        <span className="lfa-badge lfa-badge-keine" title={STUFE_INFO[stufe(kunde)].tipp}>Onboarding: {STUFE_INFO[stufe(kunde)].label}</span>
                      </div>
                    )}
                    {neuEreignisse.length > 0 && <div className="lfa-neu-text">{neuEreignisse[0].text}</div>}
                    {l.email !== "—" && (
                      <div>
                        <a href={`mailto:${l.email}`} title="Öffnet eine neue E-Mail an diese Adresse im Mailprogramm">{l.email}</a>
                      </div>
                    )}
                    {l.phone !== "—" && (
                      <div>
                        <a href={`tel:${l.phone.replace(/[^\d+]/g, "")}`} title="Ruft die Nummer an (auf Handy oder mit Telefon-App)">{l.phone}</a>
                      </div>
                    )}
                  </td>
                  <td data-label="Matches">
                    {matches > 0 ? (
                      <Link href={`/admin/matching?anfrage=${l.id}`} className="lfa-badge lfa-badge-match" title="Passende Gegenstücke dieser Anfrage im Matching anzeigen">
                        {matches} {matches === 1 ? "Treffer" : "Treffer"}
                      </Link>
                    ) : (
                      <span className="lfa-klein" title={l.rolle === "keine" ? "Nimmt nicht am Matching teil" : "Noch kein passendes Gegenstück"}>—</span>
                    )}
                  </td>
                  <td data-label="Status">
                    <StatusSchnell id={l.id} status={l.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
