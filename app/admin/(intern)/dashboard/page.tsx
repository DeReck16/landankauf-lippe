import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/session";
import { formatGroesse, type LeadView } from "@/lib/admin/model";
import { artLabel } from "@/lib/admin/format";
import { ladeDashboard, type Chip, type DashVorgang, type DashVorschlag } from "@/lib/portal/dashboard";
import * as M from "@/lib/portal/model";
import { dashboardPaarAktion } from "../../assistent-actions";
import AlleFreigeben from "../AlleFreigeben";
import Assistent from "../Assistent";
import GesehenMarker from "../GesehenMarker";
import { SchrittKurz } from "../Schritte";
import { Meldung } from "../teile";

export const metadata: Metadata = { title: "Dashboard" };

// Das Dashboard: alles, was zu tun ist, auf einer Seite — je Vorgang mit dem einen
// Knopf des Assistenten (lib/portal/assistent.ts). Nach jeder Aktion geht es hierher
// zurück (Meldung oben und an der Karte).

const HIER = "/admin/dashboard";

const CHIP_FARBE: Record<Chip["art"], string> = { ok: "lfa-badge-ok", warn: "lfa-badge-warn", rot: "lfa-badge-rot", grau: "lfa-badge-keine" };

type KartenMeldung = { text: string; fehler: boolean } | null;

function kurz(l: LeadView): string {
  return [l.typ, formatGroesse(l.groesseWert), l.ortText || "Ort offen"].join(" · ");
}

function VorgangKarte({ x, meldung }: { x: DashVorgang; meldung: KartenMeldung }) {
  return (
    <article className="lfa-dash-karte" id={x.key}>
      <div className="lfa-dash-kopf">
        <Link href={`/admin/vorgang/${x.key}`} className="lfa-link-name" title="Vorgang öffnen: alle Details, Formulare, Dokumente, Verlauf und einzelne E-Mails">
          {x.anbieter} ↔ {x.suchender}
        </Link>
        <span className="lfa-badge lfa-badge-angebot" title={x.art === "kauf" ? "Flächenkauf" : "Flächenpacht"}>
          {x.art === "kauf" ? "Kauf" : "Pacht"}
        </span>
        {x.provision && (
          <span className={`lfa-badge lfa-badge-lang ${CHIP_FARBE[x.provision.art]}`} title={x.provision.tipp}>
            {x.provision.text}
          </span>
        )}
        {x.neu > 0 && (
          <span className="lfa-neu-text" title="Neue Ereignisse bei diesem Vorgang oder seinen Kunden seit Ihrem letzten Besuch">
            <span className="lfa-puls" />
            {x.neu} neu
          </span>
        )}
        <span className="lfa-dash-fortschritt">
          <SchrittKurz schritte={x.schritte} aktuell={x.aktuell} />
        </span>
      </div>
      <div className="lfa-dash-seiten">
        {x.seiten.map((s) => (
          <div key={s.rolle} className="lfa-dash-seite">
            <span className="lfa-dash-wer" title={s.rolle === "anbieter" ? "Anbieter (bietet die Fläche an)" : "Suchender (sucht die Fläche, zahlt die Provision)"}>
              {M.ROLLE_NAME[s.rolle]}: <strong>{s.name}</strong>
            </span>
            <span className="lfa-dash-chips">
              {s.chips.map((c) => (
                <span key={c.text} className={`lfa-badge lfa-badge-lang ${CHIP_FARBE[c.art]}`} title={c.tipp}>
                  {c.text}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
      <Assistent plan={x.plan} zurueck={HIER} kompakt umleiten meldung={meldung} />
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
        </div>
        <div className="lfa-klein" title={v.gruende.join(" · ")}>
          {artLabel(v.angebot.art)} · Passung {v.score != null ? `${v.score} %` : "—"}
          {v.distanzKm != null ? ` · ${v.distanzKm} km Luftlinie` : ""}
        </div>
      </div>
      <div className="lfa-knopfreihe">
        <form action={dashboardPaarAktion}>
          <input type="hidden" name="key" value={v.key} />
          <input type="hidden" name="aktion" value="vormerken" />
          <button type="submit" className="lfa-knopf lfa-knopf-klein" title="Paar passt — vormerken. Danach steht es unter „Jetzt dran“ mit „Beide einladen“. Es geht noch keine E-Mail raus.">
            Vormerken
          </button>
        </form>
        <form action={dashboardPaarAktion}>
          <input type="hidden" name="key" value={v.key} />
          <input type="hidden" name="aktion" value="verwerfen" />
          <button type="submit" className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" title="Paar passt nicht — wird nicht mehr vorgeschlagen (im Matching unter „Verworfen“ zurückholbar). Es geht keine E-Mail raus.">
            Passt nicht
          </button>
        </form>
        <Link href={`/admin/matching?anfrage=${v.angebot.id}#${v.key}`} className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" title="Paar im Matching ansehen: alle Gründe der Punktzahl und beide Anfragen">
          Details
        </Link>
      </div>
    </li>
  );
}

export default async function DashboardPage(props: PageProps<"/admin/dashboard">) {
  const { email } = await requireAdmin();
  const sp = await props.searchParams;
  const d = await ladeDashboard(email);
  const m = typeof sp.m === "string" ? sp.m.slice(0, 400) : "";
  const fuerKarte = typeof sp.k === "string" ? sp.k : "";
  const meldung = (key: string): KartenMeldung => (m && key === fuerKarte ? { text: m, fehler: sp.mt === "fehler" } : null);

  const jetztPuls = d.jetzt.some((x) => x.neu > 0 || Boolean(x.plan.aktion?.dran && !x.plan.aktion.gesperrt));
  const kacheln = [
    {
      href: "#jetzt",
      wert: String(d.jetzt.length),
      name: "Jetzt dran",
      tipp: "Vorgänge, bei denen Sie handeln müssen — je Vorgang ein Knopf",
      puls: d.jetzt.length > 0 && jetztPuls,
    },
    {
      href: "#warten",
      wert: String(d.warten.length),
      name: "Warten auf Kunden",
      tipp: "Vorgänge, bei denen Kunden (oder Notar, Behörde) am Zug sind — mit „Erinnerung senden“",
      puls: d.warten.some((x) => x.neu > 0),
    },
    {
      href: "#vorschlaege",
      wert: String(d.vorschlaege.length),
      name: "Neue Vorschläge",
      tipp: "Passende Paare aus dem Matching, noch nicht bearbeitet — vormerken oder verwerfen",
      puls: d.vorschlaege.some((v) => v.neu),
    },
    {
      href: d.provisionFaellig > 0 ? "#jetzt" : "#abgeschlossen-liste",
      wert: M.euro(d.provisionOffen),
      name: "Provision offen (netto)",
      tipp: `Noch nicht bezahlte Provisionen (fällig, abgerechnet, aufschiebend)${d.provisionFaellig ? ` — ${d.provisionFaellig} fällig, bitte abrechnen` : ""}`,
      puls: d.provisionFaellig > 0,
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
      <AlleFreigeben e={d.einstellungen} zurueck={HIER} />

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

      <section className="lfa-dash-abschnitt" id="jetzt">
        <h2 className="lfa-h2" title="Hier sind Sie am Zug — je Vorgang ein Knopf für den nächsten Schritt">
          {jetztPuls && <span className="lfa-puls" />}Jetzt dran ({d.jetzt.length})
        </h2>
        {d.jetzt.length === 0 ? (
          <div className="lfa-panel lfa-leer">Nichts zu tun — alle Vorgänge warten auf Kunden oder sind abgeschlossen.</div>
        ) : (
          d.jetzt.map((x) => <VorgangKarte key={x.key} x={x} meldung={meldung(x.key)} />)
        )}
      </section>

      <section className="lfa-dash-abschnitt" id="warten">
        <h2 className="lfa-h2" title="Hier sind Kunden, Notar oder Behörde am Zug — Sie können erinnern">
          {d.warten.some((x) => x.neu > 0) && <span className="lfa-puls" />}Warten auf Kunden ({d.warten.length})
        </h2>
        {d.warten.length === 0 ? (
          <div className="lfa-panel lfa-leer">Kein Vorgang wartet gerade auf Kunden.</div>
        ) : (
          d.warten.map((x) => <VorgangKarte key={x.key} x={x} meldung={meldung(x.key)} />)
        )}
      </section>

      <section className="lfa-dash-abschnitt" id="vorschlaege">
        <h2 className="lfa-h2" title="Automatisch gefundene Paare aus dem Matching, beste zuerst">
          {d.vorschlaege.some((v) => v.neu) && <span className="lfa-puls" />}Neue Vorschläge ({d.vorschlaege.length})
        </h2>
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

      {/* Offen, wenn die Rückmeldung einer Aktion zu einer Karte hier gehört (sonst eingeklappt). */}
      <details className="lfa-weitere lfa-dash-abschnitt" id="abgeschlossen" open={d.abgeschlossen.some((x) => x.key === fuerKarte) || undefined}>
        <summary title="Geschlossene Verträge mit Provisionsstand — Zahlungseingang mit einem Klick vermerken">
          Abgeschlossen ({d.abgeschlossen.length})
          <span className="lfa-klein" style={{ fontWeight: 400 }}> — Verträge geschlossen, Provision abgerechnet bzw. bezahlt</span>
        </summary>
        <div className="lfa-weitere-inhalt" id="abgeschlossen-liste">
          {d.abgeschlossen.length === 0 ? (
            <p className="lfa-klein">Noch kein abgeschlossener Vorgang.</p>
          ) : (
            d.abgeschlossen.map((x) => <VorgangKarte key={x.key} x={x} meldung={meldung(x.key)} />)
          )}
        </div>
      </details>
    </>
  );
}
