import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/session";
import { formatGroesse, type LeadView } from "@/lib/admin/model";
import { artLabel, datum, datumZeit } from "@/lib/admin/format";
import { seitText } from "@/lib/portal/assistent-typen";
import { ladeDashboard, type DashBoerse, type DashUebersicht, type DashVorgang, type DashVorschlag } from "@/lib/portal/dashboard";
import * as M from "@/lib/portal/model";
import { anfrageStatusAktion, vorschlagAktion } from "../../assistent-actions";
import { boerseAktion } from "../../actions";
import BestaetigenKnopf from "../BestaetigenKnopf";
import AlleFreigeben from "../AlleFreigeben";
import Assistent, { Chips } from "../Assistent";
import GesehenMarker from "../GesehenMarker";
import { SchrittKurz } from "../Schritte";
import { Meldung } from "../teile";
import { AbschnittErgebnis, AufklappenBeiErgebnis, EinKlick } from "./EinKlick";

export const metadata: Metadata = { title: "Dashboard" };

// Das Dashboard: alles, was zu tun ist, auf einer Seite — je Vorgang mit dem einen
// Knopf des Assistenten (lib/portal/assistent.ts). Die Rückmeldung eines Klicks
// steht an der Karte (auch wenn sie danach den Abschnitt wechselt).

function kurz(l: LeadView): string {
  return [l.typ, formatGroesse(l.groesseWert), l.ortText || "Ort offen"].join(" · ");
}

function VorgangKarte({ x, bezug }: { x: DashVorgang; bezug: string }) {
  const wartet = x.plan.amZug === "kunde" && x.plan.wartetSeit;
  return (
    <article className="lfa-dash-karte" id={x.key}>
      <div className="lfa-dash-kopf">
        <Link href={`/admin/vorgang/${x.key}`} className="lfa-link-name" title="Vorgang öffnen: alle Details, Formulare, Dokumente, Verlauf und einzelne E-Mails">
          {x.anbieter} ↔ {x.suchender}
        </Link>
        <span className="lfa-badge lfa-badge-angebot" title={x.art === "kauf" ? "Flächenkauf" : "Flächenpacht"}>
          {x.art === "kauf" ? "Kauf" : "Pacht"}
        </span>
        {x.boerse && (
          <span className="lfa-badge lfa-badge-gesuch" title="Der Suchende kam über die öffentliche Flächenbörse auf dieses Angebot">
            über Flächenbörse {x.boerse}
          </span>
        )}
        {wartet && (
          <span className="lfa-badge lfa-badge-keine" title="So lange wartet der älteste offene Punkt dieses Vorgangs">
            wartet {seitText(x.plan.wartetSeit!, bezug)}
          </span>
        )}
        <Chips chips={x.plan.chips} />
        <span className="lfa-dash-fortschritt">
          <SchrittKurz schritte={x.schritte} aktuell={x.aktuell} verworfen={x.plan.verworfen} beendet={x.plan.beendet} />
        </span>
      </div>
      {x.ereignisse.length > 0 && (
        <ul className="lfa-dash-ereignisse" aria-label="Zuletzt passiert">
          {x.ereignisse.map((e) => (
            <li key={e.id} className={e.neu ? "lfa-dash-ereignis-neu" : undefined} title={e.neu ? "Neu seit Ihrem letzten Besuch" : "Zuletzt passiert"}>
              {e.neu ? <span className="lfa-puls" /> : <span className="lfa-klein">Zuletzt: </span>}
              <span className="lfa-klein">{datumZeit(e.am)} · {e.wer}:</span> {e.text}
            </li>
          ))}
        </ul>
      )}
      <div className="lfa-dash-seiten">
        {x.seiten.map((s) => (
          <div key={s.rolle} className="lfa-dash-seite">
            <span className="lfa-dash-wer" title={s.rolle === "anbieter" ? "Anbieter (bietet die Fläche an)" : "Suchender (sucht die Fläche, zahlt die Provision)"}>
              {M.ROLLE_NAME[s.rolle]}: <strong>{s.name}</strong>
            </span>
            <Chips chips={s.chips} />
          </div>
        ))}
      </div>
      <Assistent plan={x.plan} kompakt ohneChips />
    </article>
  );
}

function VorschlagZeile({ v }: { v: DashVorschlag }) {
  return (
    <li className="lfa-dash-vorschlag" id={v.key}>
      <div className="lfa-dash-vorschlag-text">
        <div>
          {v.neu && <span className="lfa-puls" title="Neuer Vorschlag — noch nie angesehen" />}
          <strong>{v.angebot.name}</strong> <span className="lfa-klein">bietet</span> {kurz(v.angebot)}
        </div>
        <div>
          <strong>{v.gesuch.name}</strong> <span className="lfa-klein">sucht</span> {kurz(v.gesuch)}
          {v.boerse && (
            <>
              {" "}
              <span className="lfa-badge lfa-badge-gesuch" title="Der Suchende kam über die öffentliche Flächenbörse auf dieses Angebot">
                über Flächenbörse {v.boerse}
              </span>
            </>
          )}
        </div>
        <div className="lfa-klein" title={v.gruende.join(" · ")}>
          {artLabel(v.angebot.art)} · Passung {v.score != null ? `${v.score} %` : "—"}
          {v.distanzKm != null ? ` · ${v.distanzKm} km Luftlinie` : ""}
        </div>
        {v.hinweise.map((h) => (
          <div key={h} className="lfa-klein lfa-dash-warnung">
            {h}
          </div>
        ))}
      </div>
      <div className="lfa-knopfreihe lfa-dash-vorschlag-knoepfe">
        <EinKlick
          aktion={vorschlagAktion}
          werte={{ key: v.key, aktion: "vormerken" }}
          ziel={v.key}
          klasse="lfa-knopf lfa-knopf-klein"
          knopf="Vormerken"
          tipp="Paar passt — vormerken. Danach steht es unter „Jetzt dran“ mit „Beide einladen“. Es geht noch keine E-Mail raus."
        />
        <Link href={`/admin/matching?anfrage=${v.angebot.id}#${v.key}`} className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" title="Paar im Matching ansehen: alle Gründe der Punktzahl und beide Anfragen">
          Details
        </Link>
        <EinKlick
          aktion={vorschlagAktion}
          werte={{ key: v.key, aktion: "verwerfen" }}
          ziel="vorschlaege"
          klasse="lfa-link-knopf"
          knopf="Passt nicht"
          tipp="Paar passt nicht — wird nicht mehr vorgeschlagen (im Matching unter „Verworfen“ zurückholbar). Es geht keine E-Mail raus."
        />
      </div>
    </li>
  );
}

/** Zweite Kachelreihe: Stand aller Kunden, Paare und der Flächenbörse auf einen Blick. */
function UebersichtKacheln({ u, vorschlaege }: { u: DashUebersicht; vorschlaege: number }) {
  const n = (x: number, eins: string, mehr: string) => `${x} ${x === 1 ? eins : mehr}`;
  const kacheln = [
    { href: "#warten", wert: u.eingeladen, name: "Einladungen raus", sub: `${n(u.eingeladen, "Kunde", "Kunden")} noch ohne Unterschrift${u.eingeladenGeoeffnet ? ` · ${u.eingeladenGeoeffnet} Link geöffnet` : ""}`, tipp: "Kunden mit Einladung, die ihren Vertrag mit Lippe Forst noch nicht unterschrieben haben" },
    { href: "/admin/vorgaenge", wert: u.unterschrieben, name: "Unterschrieben", sub: `${n(u.unterschriebenAnbieter, "Anbieter", "Anbieter")} · ${n(u.unterschriebenSuchende, "Suchender", "Suchende")}`, tipp: "Kunden mit gültigem Vertrag mit Lippe Forst (Suchende: Provisionsvereinbarung)" },
    { href: "#jetzt", wert: u.matchingOffen, name: "Matchings offen", sub: `Paare vor der Freigabe${vorschlaege ? ` · dazu ${n(vorschlaege, "neuer Vorschlag", "neue Vorschläge")}` : ""}`, tipp: "Vorgemerkte bzw. angefragte Paare, deren Kontakt noch nicht freigegeben ist" },
    { href: "#warten", wert: u.zustimmungOffen, name: "Zustimmung offen", sub: "anonym angefragt, Zustimmung fehlt", tipp: "Beide wurden anonym angefragt, mindestens eine Zustimmung zum Kontakt fehlt noch" },
    { href: "#warten", wert: u.freigegeben, name: "Kontakt freigegeben", sub: u.vertraegeOffen ? `${n(u.vertraegeOffen, "Vertrag", "Verträge")} zur Unterschrift` : "Vertrag noch offen", tipp: "Kontakt ist hergestellt (Nachweis) — Pacht- oder Kaufvertrag steht noch aus" },
    { href: "#abgeschlossen", wert: u.abschluesse, name: "Abschlüsse", sub: "Vertrag geschlossen", tipp: "Vorgänge mit geschlossenem Pacht- oder Kaufvertrag" },
    { href: "#boerse", wert: u.boerseBereit + u.boerseAngabenFehlen + u.boerseOhneEinwilligung, name: "Flächen nicht veröffentlicht", sub: `${u.boerseBereit} bereit · ${u.boerseAngabenFehlen ? `${u.boerseAngabenFehlen} Angaben fehlen · ` : ""}${u.boerseOhneEinwilligung} ohne Einwilligung`, tipp: "Kaufangebote, die (noch) nicht in der Flächenbörse stehen — „bereit“ heißt: Einwilligung liegt vor, ein Klick genügt", puls: u.boerseBereit > 0 },
    { href: "#boerse", wert: u.boerseOnline, name: "Flächen online", sub: "anonym in der Flächenbörse", tipp: "Kaufangebote, die anonym auf lippeforst.de stehen" },
    { href: "/admin?status=neu", wert: u.neueAnfragen, name: "Neue Anfragen", sub: "noch nicht bearbeitet", tipp: "Formular-Anfragen mit Status „Neu“", puls: u.neueAnfragen > 0 },
  ];
  return (
    <>
      <h2 className="lfa-h2 lfa-uebersicht-titel" title="Stand aller Kunden, Paare und der Flächenbörse — Klick springt zum passenden Abschnitt">Übersicht</h2>
      <nav className="lfa-kacheln lfa-uebersicht" aria-label="Übersicht nach Stand">
        {kacheln.map((k) => (
          <a key={k.name} href={k.href} className={`lfa-kachel ${"puls" in k && k.puls ? "lfa-puls-ring" : ""}`} title={k.tipp}>
            <div className="lfa-kachel-wert">{k.wert}</div>
            <div className="lfa-kachel-name">{k.name}</div>
            <div className="lfa-kachel-sub">{k.sub}</div>
          </a>
        ))}
      </nav>
    </>
  );
}

function tagDe(ymdOderIso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(ymdOderIso) ? new Date(`${ymdOderIso}T12:00:00`) : new Date(ymdOderIso);
  return d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
}

/** Flächenbörse: Kaufangebote mit Stand — „Veröffentlichen“ mit einem Klick, sobald die Einwilligung vorliegt. */
function BoerseListe({ liste }: { liste: DashBoerse[] }) {
  return (
    <section className="lfa-dash-abschnitt" id="boerse">
      <h2 className="lfa-h2" title="Kaufangebote für die anonyme Flächenbörse auf lippeforst.de — nur mit Einwilligung des Eigentümers">
        {liste.some((x) => !x.online && x.einwilligung && !x.luecken.length) && <span className="lfa-puls" />}Flächenbörse ({liste.length})
      </h2>
      {liste.length === 0 ? (
        <div className="lfa-panel lfa-leer">Keine aktiven Kaufangebote.</div>
      ) : (
        <div className="lfa-panel">
          <ul className="lfa-boerse-liste">
            {liste.map((x) => (
              <li key={x.id} className="lfa-boerse-zeile">
                <div className="lfa-boerse-text">
                  <Link href={`/admin/anfrage/${x.id}#boerse`} className="lfa-link-name" title="Anfrage öffnen: Einwilligung, anonyme Angaben, Vorschau">{x.name}</Link>
                  <div className="lfa-klein">{x.eckdaten}{x.code ? ` · ${x.code}` : ""}</div>
                </div>
                <div className="lfa-boerse-stand">
                  {x.online ? (
                    <>
                      <span className="lfa-badge lfa-badge-ok" title="Steht anonym auf lippeforst.de">online{x.seit ? ` seit ${tagDe(x.seit)}` : ""}</span>
                      {x.code && <a href={`/flaechenboerse/${x.code}`} target="_blank" rel="noopener" className="lfa-klein" title="Öffentliche Angebotsseite in neuem Tab öffnen">ansehen</a>}
                    </>
                  ) : x.einwilligung && !x.luecken.length ? (
                    <>
                      <span className="lfa-badge lfa-badge-warn" title={`Einwilligung ${x.einwilligung.quelle} am ${tagDe(x.einwilligung.am)}`}>Einwilligung ✓ {tagDe(x.einwilligung.am)}</span>
                      <form action={boerseAktion}>
                        <input type="hidden" name="id" value={x.id} />
                        <input type="hidden" name="aktion" value="online" />
                        <input type="hidden" name="zurueck" value="/admin/dashboard" />
                        <BestaetigenKnopf frage={`„${x.eckdaten}“ jetzt anonym auf lippeforst.de zeigen (Startseite und Flächenbörse)?`} tipp="Zeigt das Angebot sofort anonym auf der Website — Angaben vorher in der Anfrage prüfbar">
                          Veröffentlichen
                        </BestaetigenKnopf>
                      </form>
                    </>
                  ) : x.einwilligung ? (
                    <Link href={`/admin/anfrage/${x.id}#boerse`} className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" title={`Noch nicht veröffentlichbar: ${x.luecken.join(" · ")}`}>
                      Angaben ergänzen
                    </Link>
                  ) : (
                    <Link href={`/admin/anfrage/${x.id}#boerse`} className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" title="Keine Einwilligung — in der Anfrage erfassen oder den fertigen Text zum Erfragen nutzen (Verkäufer können auch selbst im Kundenbereich ankreuzen)">
                      Einwilligung fehlt
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default async function DashboardPage(props: PageProps<"/admin/dashboard">) {
  const { email } = await requireAdmin();
  const sp = await props.searchParams;
  const d = await ladeDashboard(email);
  const fokus = typeof sp.k === "string" ? sp.k : "";

  const jetztPuls = d.jetzt.some((x) => x.neu > 0 || x.plan.meldungen.length > 0 || Boolean(x.plan.aktion?.dran && !x.plan.aktion.gesperrt));
  const kacheln = [
    { href: "#jetzt", wert: String(d.jetzt.length), name: "Jetzt dran", tipp: "Vorgänge, bei denen Sie handeln müssen — je Vorgang ein Knopf", puls: d.jetzt.length > 0 && jetztPuls },
    { href: "#warten", wert: String(d.warten.length), name: "Warten auf Kunden", tipp: "Vorgänge, bei denen Kunden, Notar, Behörde oder die Zahlung am Zug sind — mit „Erinnerung senden“", puls: d.warten.some((x) => x.neu > 0) },
    {
      href: "#vorschlaege",
      wert: String(d.vorschlaege.length + d.anfragen.length),
      name: "Neue Vorschläge & Anfragen",
      tipp: `${d.vorschlaege.length} passende Paare aus dem Matching und ${d.anfragen.length} neue Anfragen ohne Paar`,
      puls: d.vorschlaege.some((v) => v.neu) || d.anfragen.some((a) => a.neu),
    },
    {
      href: "#jetzt",
      wert: M.euro(d.provisionOffen),
      name: "Provision offen (netto)",
      tipp: `Fällige und abgerechnete, noch nicht bezahlte Provisionen${d.provisionAufschiebend ? ` — dazu ${M.euro(d.provisionAufschiebend)} aufschiebend (Genehmigung ausstehend)` : ""}${d.provisionDran ? ` · ${d.provisionDran} fällig bzw. überfällig` : ""}`,
      puls: d.provisionDran > 0,
    },
  ];

  return (
    <>
      <GesehenMarker keys={d.gesehen} />
      <div className="lfa-titelzeile">
        <div>
          <h1 className="lfa-h1">Dashboard</h1>
          <p className="lfa-unterzeile">
            Alles, was jetzt zu tun ist — mit einem Knopf je Vorgang. Jeder Knopf fragt vorher nach und zeigt, welche E-Mails an wen rausgehen.
          </p>
        </div>
      </div>
      <Meldung sp={sp} />
      <AlleFreigeben e={d.einstellungen} zurueck="/admin/dashboard" />

      <nav className="lfa-kacheln" aria-label="Überblick">
        {kacheln.map((k) => (
          <a key={k.name} href={k.href} className={`lfa-kachel ${k.puls ? "lfa-puls-ring" : ""}`} title={k.tipp}>
            <div className="lfa-kachel-wert">{k.wert}</div>
            <div className="lfa-kachel-name">
              {k.puls && <span className="lfa-puls" aria-label="neu" />}
              {k.name}
            </div>
          </a>
        ))}
      </nav>
      <UebersichtKacheln u={d.uebersicht} vorschlaege={d.vorschlaege.length} />
      <AbschnittErgebnis ziel="weg" />

      <section className="lfa-dash-abschnitt" id="jetzt">
        <h2 className="lfa-h2" title="Hier sind Sie am Zug — je Vorgang ein Knopf für den nächsten Schritt">
          {jetztPuls && <span className="lfa-puls" />}Jetzt dran ({d.jetzt.length})
        </h2>
        {d.jetzt.length === 0 ? (
          <div className="lfa-panel lfa-leer">Nichts zu tun — alle Vorgänge warten auf Kunden oder sind abgeschlossen.</div>
        ) : (
          d.jetzt.map((x) => <VorgangKarte key={x.key} x={x} bezug={d.am} />)
        )}
      </section>

      <section className="lfa-dash-abschnitt" id="warten">
        <h2 className="lfa-h2" title="Hier sind Kunden, Notar, Behörde oder die Zahlung am Zug — Sie können erinnern; am längsten Wartendes zuerst">
          {d.warten.some((x) => x.neu > 0) && <span className="lfa-puls" />}Warten auf Kunden ({d.warten.length})
        </h2>
        {d.warten.length === 0 ? (
          <div className="lfa-panel lfa-leer">Kein Vorgang wartet gerade.</div>
        ) : (
          d.warten.map((x) => <VorgangKarte key={x.key} x={x} bezug={d.am} />)
        )}
      </section>

      <BoerseListe liste={d.boerse} />

      {d.anfragen.length > 0 ? (
        <section className="lfa-dash-abschnitt" id="anfragen">
          <h2 className="lfa-h2" title="Neue Anfragen, zu denen es (noch) kein passendes Gegenstück gibt — z. B. Bewertungen, Fragen oder Flächen ohne Gesuch">
            {d.anfragen.some((a) => a.neu) && <span className="lfa-puls" />}Neue Anfragen ohne Paar ({d.anfragen.length})
          </h2>
          <AbschnittErgebnis ziel="anfragen" />
          <ul className="lfa-dash-vorschlaege">
            {d.anfragen.map((a) => (
              <li key={a.id} className="lfa-dash-vorschlag">
                <div className="lfa-dash-vorschlag-text">
                  <div>
                    {a.neu && <span className="lfa-puls" title="Neue Anfrage — noch nicht geöffnet" />}
                    <Link href={`/admin/anfrage/${a.id}`} className="lfa-link-name" title="Anfrage öffnen: alle Angaben, Kontakt, Einordnung fürs Matching">
                      {a.name}
                    </Link>
                  </div>
                  <div className="lfa-klein">
                    {a.anliegen} · {a.ort} · eingegangen {datum(a.eingang)}
                  </div>
                </div>
                <div className="lfa-knopfreihe lfa-dash-vorschlag-knoepfe">
                  <EinKlick aktion={anfrageStatusAktion} werte={{ id: a.id, status: "in_arbeit" }} ziel="anfragen" klasse="lfa-knopf lfa-knopf-hell lfa-knopf-klein" knopf="In Arbeit" tipp="Setzt den Status auf „In Arbeit“ — die Anfrage verschwindet aus dieser Liste (in „Anfragen“ weiter sichtbar)" />
                  <EinKlick aktion={anfrageStatusAktion} werte={{ id: a.id, status: "archiv" }} ziel="anfragen" klasse="lfa-link-knopf" knopf="Archiv" tipp="Test, Spam oder Dublette — archivieren (nicht mehr im Dashboard und nicht im Matching)" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        // Letzte Anfrage erledigt: Abschnitt entfällt, die Rückmeldung bleibt sichtbar.
        <AbschnittErgebnis ziel="anfragen" />
      )}

      <section className="lfa-dash-abschnitt" id="vorschlaege">
        <h2 className="lfa-h2" title="Automatisch gefundene Paare aus dem Matching, beste zuerst">
          {d.vorschlaege.some((v) => v.neu) && <span className="lfa-puls" />}Neue Vorschläge ({d.vorschlaege.length})
        </h2>
        <AbschnittErgebnis ziel="vorschlaege" />
        {d.vorschlaege.length === 0 ? (
          <div className="lfa-panel lfa-leer">Keine neuen Vorschläge — sobald ein Angebot und ein Gesuch zusammenpassen, erscheinen sie hier.</div>
        ) : (
          <ul className="lfa-dash-vorschlaege">
            {d.vorschlaege.slice(0, 30).map((v) => (
              <VorschlagZeile key={v.key} v={v} />
            ))}
          </ul>
        )}
        {d.vorschlaege.length > 30 && (
          <p className="lfa-klein" style={{ marginTop: "0.5rem" }}>
            … und {d.vorschlaege.length - 30} weitere —{" "}
            <Link href="/admin/matching" title="Alle Vorschläge im Matching" style={{ textDecoration: "underline" }}>
              im Matching
            </Link>
            .
          </p>
        )}
      </section>

      {/* Offen, wenn eine Karte hier im Fokus steht (Link aus einer Verwaltungs-Mail); sonst eingeklappt. */}
      <details className="lfa-weitere lfa-dash-abschnitt" id="abgeschlossen" open={d.abgeschlossen.some((x) => x.key === fokus) || undefined}>
        <summary title="Geschlossene und bezahlte Vorgänge sowie ohne Abschluss beendete — dort lassen sie sich wieder aufnehmen">
          Abgeschlossen &amp; beendet ({d.abgeschlossen.length})
          <span className="lfa-klein" style={{ fontWeight: 400 }}> — Vertrag geschlossen und Provision bezahlt, oder ohne Abschluss beendet</span>
        </summary>
        <div className="lfa-weitere-inhalt">
          <AufklappenBeiErgebnis keys={d.abgeschlossen.map((x) => x.key)} />
          {d.abgeschlossen.length === 0 ? (
            <p className="lfa-klein">Noch kein abgeschlossener Vorgang.</p>
          ) : (
            d.abgeschlossen.map((x) => <VorgangKarte key={x.key} x={x} bezug={d.am} />)
          )}
        </div>
      </details>
    </>
  );
}
