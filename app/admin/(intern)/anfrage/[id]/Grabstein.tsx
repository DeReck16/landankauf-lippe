import Link from "next/link";
import { notFound } from "next/navigation";
import { datumZeit } from "@/lib/admin/format";
import type { LoeschPlan } from "@/lib/admin/loeschen";
import type { Grabstein as GrabsteinDaten } from "@/lib/admin/model";
import { Meldung } from "../../teile";
import LoeschenKnopf, { type LoeschVorschau } from "./LoeschenKnopf";

/** Vorschau für den Lösch-Knopf (nur Texte). */
export function vorschauAus(plan: LoeschPlan): LoeschVorschau {
  return {
    loeschen: plan.loeschen,
    sperren: plan.sperren.map((p) => ({ was: p.was, bis: p.bis, grund: p.grund })),
    schwaerzen: plan.schwaerzen,
    hinweise: plan.hinweise,
    weitere: plan.weitere,
    extern: plan.extern,
    blockiert: plan.blockiert,
  };
}

function datum(iso: string): string {
  const [j, m, t] = iso.split("-");
  return t && m && j ? `${t}.${m}.${j}` : iso;
}

/**
 * Anfrage-Seite nach dem endgültigen Löschen: nur der Grabstein (ohne Personendaten) und was wegen
 * Aufbewahrungspflicht gesperrt ist. Ein unvollständiger Lauf lässt sich hier fortsetzen.
 */
export default function Grabstein({
  id,
  grabstein: g,
  plan,
  sp,
}: {
  id: string;
  grabstein: GrabsteinDaten | null;
  plan: LoeschPlan | null;
  sp: Record<string, string | string[] | undefined>;
}) {
  const offen = Boolean(plan?.vorhanden);
  if (!g && !offen) notFound();
  return (
    <>
      <p style={{ marginBottom: "0.75rem" }}>
        <Link href="/admin" className="lfa-klein" title="Zurück zur Liste aller Anfragen">← Alle Anfragen</Link>
      </p>
      <Meldung sp={sp} />
      <div className="lfa-titelzeile">
        <div>
          <h1 className="lfa-h1">Vorgang {id} — gelöscht</h1>
          <p className="lfa-unterzeile">Endgültig gelöscht nach Art. 17 DSGVO. Übrig ist nur dieser Grabstein ohne Personendaten.</p>
        </div>
      </div>
      <section className="lfa-panel" id="loeschen">
        {g ? (
          <dl className="lfa-daten">
            <dt>Vorgangsnummer</dt><dd>{g.id}</dd>
            <dt>Eingang</dt><dd title="Monat des Eingangs — genauer wird es nicht festgehalten">{g.monat.split("-").reverse().join("/")}</dd>
            <dt>Art</dt><dd>{g.art}</dd>
            <dt>Letzter Status</dt><dd>{g.status}</dd>
            <dt>Gelöscht</dt><dd>{datumZeit(g.geloeschtAm)} von {g.geloeschtVon}</dd>
            {g.loeschwunsch && (
              <>
                <dt>Löschwunsch</dt>
                <dd title="Monatsfrist nach Art. 12 Abs. 3 DSGVO">vom {datumZeit(g.loeschwunsch.am)}, Frist {datumZeit(g.loeschwunsch.frist)}</dd>
              </>
            )}
            <dt>Stand</dt>
            <dd>{g.stand === "fertig" ? "vollständig gelöscht" : g.stand === "laeuft" ? "Löschen begonnen, nicht abgeschlossen" : `unvollständig (${(g.fehler ?? []).join("; ")})`}</dd>
          </dl>
        ) : (
          <p className="lfa-hinweis lfa-hinweis-fehler">Das Löschen wurde begonnen, aber nicht abgeschlossen.</p>
        )}

        {g && g.umfang.length > 0 && (
          <div className="lfa-abschnitt">
            <h3 className="lfa-h3" title="Nur Kategorien und Anzahl — die Inhalte gibt es nicht mehr">Gelöscht</h3>
            <ul className="lfa-loeschen-liste">
              {g.umfang.map((u) => (
                <li key={u.was}>
                  {u.was}
                  {u.anzahl > 1 ? <span className="lfa-klein"> ({u.anzahl})</span> : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="lfa-abschnitt">
          <h3 className="lfa-h3" title="Aufbewahrungspflicht nach HGB/AO (Art. 17 Abs. 3 lit. b DSGVO): bis zum Datum nur gesperrt, danach zu löschen">Nur gesperrt (Aufbewahrungspflicht)</h3>
          {!g || g.gesperrt.length === 0 ? (
            <p className="lfa-klein">Nichts — es gab keinen unterschriebenen Vertrag, keinen Nachweis und keine Provision.</p>
          ) : (
            <ul className="lfa-loeschen-liste">
              {g.gesperrt.map((p) => (
                <li key={`${p.ort}|${p.ref}|${p.was}`}>
                  <span title={p.grund}>
                    {p.ort === "vorgang" ? `Vorgang ${p.ref}: ` : ""}
                    {p.was} — <strong>gesperrt bis {datum(p.bis)}</strong>
                  </span>
                  {p.dokumente.length > 0 && (
                    <div className="lfa-klein">
                      {p.dokumente.map((d, i) => (
                        <span key={d.id}>
                          {i > 0 ? " · " : ""}
                          <a
                            href={`/admin/dokument/${d.id}?${p.ort === "vorgang" ? `v=${encodeURIComponent(p.ref)}` : `s=${encodeURIComponent(p.ref)}`}`}
                            target="_blank"
                            rel="noopener"
                            title="Gesperrtes Dokument öffnen — nur zur Aufbewahrung, für Prüfungen oder Rechtsansprüche (Art. 18 Abs. 2 DSGVO)"
                          >
                            {d.titel}
                          </a>
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {offen && plan && (
          <div className="lfa-abschnitt">
            <h3 className="lfa-h3" title="Ein früherer Lauf ist nicht fertig geworden">Löschen fortsetzen</h3>
            <p className="lfa-klein">Es ist noch nicht alles gelöscht. Der Knopf setzt das Löschen fort (jeder Schritt lässt sich gefahrlos wiederholen).</p>
            <LoeschenKnopf id={id} vorschau={vorschauAus(plan)} knopfText="Löschen fortsetzen" />
          </div>
        )}
      </section>
    </>
  );
}
