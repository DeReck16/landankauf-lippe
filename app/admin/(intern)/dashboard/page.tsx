import type { Metadata } from "next";
import Link from "next/link";
import { testModus } from "@/lib/admin/config";
import { requireAdmin } from "@/lib/admin/session";
import { formatGroesse, type LeadView } from "@/lib/admin/model";
import { artLabel, datum, datumZeit } from "@/lib/admin/format";
import type { NachfassKandidat } from "@/lib/portal/anfrage-typen";
import { aufgabenAus, faelligeErinnerung, hauptAktion, sammelEinladungen, type Aufgabe } from "@/lib/portal/aufgaben";
import { seitText } from "@/lib/portal/assistent-typen";
import { ladeDashboard, type DashAutomatik, type DashBoerse, type DashPostausgang, type DashUebersicht, type DashVorgang, type DashVorschlag, type Dashboard } from "@/lib/portal/dashboard";
import * as M from "@/lib/portal/model";
import { NACHFASS_PAUSE_TAGE } from "@/lib/portal/nachfassen";
import { RUECKMELDUNG_NAME } from "@/lib/portal/rueckmeldung-typen";
import {
  anfrageStatusAktion,
  postausgangJetztAktion,
  postausgangVerwerfenAktion,
  sammelEinladenAktion,
  sammelErinnernAktion,
  vorschlagAktion,
} from "../../assistent-actions";
import { boerseAktion } from "../../actions";
import BestaetigenKnopf from "../BestaetigenKnopf";
import AlleFreigeben from "../AlleFreigeben";
import Assistent, { AssistentKnopf, Chips } from "../Assistent";
import GesehenMarker from "../GesehenMarker";
import GesehenBeimAufklappen from "../GesehenBeimAufklappen";
import { SchrittKurz } from "../Schritte";
import { Meldung } from "../teile";
import AnfrageAktionen from "./AnfrageAktionen";
import AntwortKompakt from "./AntwortKompakt";
import { AbschnittErgebnis, AufklappenBeiErgebnis, EinKlick } from "./EinKlick";
import Nachfassen from "./Nachfassen";
import PostfachAktionen from "./PostfachAktionen";
import SammelKnopf from "./SammelKnopf";

export const metadata: Metadata = { title: "Dashboard" };

// Server Actions dieser Seite (u. a. „Nachfass-Mail senden“ an viele Kunden) dürfen bis zu
// 60 Sekunden laufen — so viel erlaubt Vercel in jedem Tarif; das Nachfassen teilt sich die Zeit selbst ein.
export const maxDuration = 60;

// Das Dashboard (Review 27.09.2026): oben EINE Aufgabenliste — je Zeile ein Knopf, sortiert nach
// Fristen & Recht, Geld, Kunde wartet, neuen Eingängen und Wachstum (lib/portal/aufgaben.ts);
// Details je Zeile zum Aufklappen. Darunter eingeklappt: Warten, Vorschläge, Nachfassen,
// Flächenbörse, Automatik, Kennzahlen, Abgeschlossenes. Es pulsiert nur, was neu ist.

function kurz(l: LeadView): string {
  return [l.typ, formatGroesse(l.groesseWert), l.ortText || "Ort offen"].join(" · ");
}

const ZEICHEN_TIPP: Record<Aufgabe["zeichen"], string> = {
  "!": "Frist oder Recht — zuerst erledigen",
  "€": "Geld — Provision fällig",
  "•": "Ein Kunde wartet auf uns",
  "": "Neuer Eingang bzw. Wachstum",
};

/** Details eines Vorgangs (aufklappbar): Fortschritt, Ereignisse, beide Seiten, Assistent ohne den Zeilenknopf. */
function VorgangDetails({ x, bezug }: { x: DashVorgang; bezug: string }) {
  return (
    <div className="lfa-aufgabe-inhalt">
      <div className="lfa-dash-kopf">
        {x.boerse && (
          <span className="lfa-badge lfa-badge-gesuch" title="Der Suchende kam über die öffentliche Flächenbörse auf dieses Angebot">
            über Flächenbörse {x.boerse}
          </span>
        )}
        {x.plan.amZug === "kunde" && x.plan.wartetSeit && (
          <span className="lfa-badge lfa-badge-keine" title="So lange wartet der älteste offene Punkt dieses Vorgangs">
            wartet {seitText(x.plan.wartetSeit, bezug)}
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
      <Assistent plan={x.plan} kompakt ohneChips ohneHaupt />
    </div>
  );
}

function PostausgangDetails({ p }: { p: DashPostausgang }) {
  return (
    <ul className="lfa-protokoll" id="postausgang">
      {p.liste.map((e) => (
        <li key={e.id}>
          <span className="lfa-klein">
            {datumZeit(e.erstelltAm)} · {e.versuche} {e.versuche === 1 ? "Versuch" : "Versuche"}
            {e.aufgegeben ? " · aufgegeben" : ""}
          </span>
          <div>
            „{e.betreff}“ an {e.an}
            {e.fehler && <div className="lfa-klein lfa-dash-warnung">Fehler: {e.fehler}</div>}
          </div>
          <EinKlick
            aktion={postausgangVerwerfenAktion}
            werte={{ id: e.id }}
            ziel="aufgaben"
            klasse="lfa-link-knopf"
            knopf="Von Hand erledigt — verwerfen"
            tipp="Nur, wenn Sie die Mail anders zugestellt haben (z. B. selbst geschickt): nimmt sie aus dem Postausgang. Es geht keine E-Mail raus."
          />
        </li>
      ))}
    </ul>
  );
}

function AufgabeKnopf({ a, test }: { a: Aufgabe; test: boolean }) {
  const q = a.quelle;
  switch (q.typ) {
    case "vorgang": {
      const h = hauptAktion(q.x);
      return h ? (
        <AssistentKnopf plan={q.x.plan} a={h} />
      ) : (
        <Link href={a.href} className="lfa-knopf lfa-knopf-hell lfa-anfrage-knopf" title="Vorgang öffnen">
          Öffnen
        </Link>
      );
    }
    case "anfrage":
      return q.a.antwort ? <AntwortKompakt id={q.a.id} e={q.a.antwort} test={test} ziel="aufgaben" archiv /> : <AnfrageAktionen id={q.a.id} v={q.a.vorschlag} test={test} ziel="aufgaben" kompakt />;
    case "rueckmeldung":
      if (q.r.vorschlag) return <AnfrageAktionen id={q.r.id} v={q.r.vorschlag} test={test} ziel="aufgaben" ticket kompakt />;
      if (q.r.antwort) return <AntwortKompakt id={q.r.id} e={q.r.antwort} test={test} ziel="aufgaben" archiv={false} />;
      return q.r.antworten ? (
        <a href={q.r.antworten.href} className="lfa-knopf lfa-anfrage-knopf" title={`Öffnet eine neue E-Mail an ${q.r.antworten.an} in Ihrem Mailprogramm — danach „Als beantwortet markieren“ (Details)`}>
          Antwort schreiben
        </a>
      ) : (
        <EinKlick aktion={anfrageStatusAktion} werte={{ id: q.r.id, status: "beantwortet" }} ziel="aufgaben" klasse="lfa-knopf lfa-anfrage-knopf" knopf="Als beantwortet markieren" tipp="Setzt den Status auf „Beantwortet“ — das Ticket verschwindet. Es geht keine E-Mail raus." />
      );
    case "postfach":
      return <PostfachAktionen id={q.p.id} mail={q.p.key} vorschlag={q.p.mail.vorschlag} optionen={q.p.optionen} ziel="aufgaben" />;
    case "boerse":
      return (
        <form action={boerseAktion}>
          <input type="hidden" name="id" value={q.b.id} />
          <input type="hidden" name="aktion" value="online" />
          <input type="hidden" name="zurueck" value="/admin/dashboard" />
          <BestaetigenKnopf frage={`„${q.b.eckdaten}“ jetzt anonym auf lippeforst.de zeigen (Startseite und Flächenbörse)?`} tipp="Zeigt das Angebot sofort anonym auf der Website — Angaben vorher in der Anfrage prüfbar">
            Veröffentlichen
          </BestaetigenKnopf>
        </form>
      );
    case "erklaerung":
      return (
        <Link href={a.href} className="lfa-knopf lfa-anfrage-knopf" title="Öffnet die Kundenakte: Erklärung prüfen, ggf. „nicht vom Kunden — verwerfen“">
          Prüfen
        </Link>
      );
    case "loeschwunsch":
      return (
        <Link href={a.href} className="lfa-knopf lfa-anfrage-knopf" title="Öffnet die Anfrage (Abschnitt Datenschutz): was zu löschen bzw. zu sperren ist, dann „Als erledigt vermerken“">
          Öffnen
        </Link>
      );
    case "ankauf":
      return (
        <Link href={q.k.angebotAm ? a.href : `/admin/anfrage/${q.k.id}#entwuerfe`} className="lfa-knopf lfa-anfrage-knopf" title={q.k.angebotAm ? "Ergebnis des Direktankaufs erfassen" : "Zur Mail „Direktankauf“ unter E-Mail-Entwürfe"}>
          {q.k.angebotAm ? "Ergebnis erfassen" : "Mail ansehen"}
        </Link>
      );
    case "postausgang":
      return (
        <EinKlick
          aktion={postausgangJetztAktion}
          werte={{}}
          ziel="aufgaben"
          klasse="lfa-knopf lfa-anfrage-knopf"
          knopf="Jetzt erneut senden"
          tipp="Versucht alle nicht zugestellten Systemmails sofort erneut (sonst automatisch im täglichen Lauf) — es geht nur raus, was ohnehin fällig war"
        />
      );
  }
}

function AufgabeDetails({ a, d }: { a: Aufgabe; d: Dashboard }) {
  const q = a.quelle;
  switch (q.typ) {
    case "vorgang":
      return <VorgangDetails x={q.x} bezug={d.am} />;
    case "anfrage":
      return (
        <div className="lfa-aufgabe-inhalt">
          <div className="lfa-klein">
            {q.a.anliegen} · {q.a.ort} · eingegangen {datumZeit(q.a.eingang)}
          </div>
          <div className="lfa-anfrage-warum">Vorschlag: {q.a.antwort ? `Antwort ist vorbereitet (${q.a.antwort.themaName})` : q.a.vorschlag.warum}</div>
          <div className="lfa-knopfreihe">
            {q.a.vorschlag.antworten && (
              <a href={q.a.vorschlag.antworten.href} className="lfa-link-knopf" title={`Neue E-Mail an ${q.a.vorschlag.antworten.an} im Mailprogramm — danach „Als beantwortet markieren“`}>
                Antwort selbst schreiben
              </a>
            )}
            <EinKlick aktion={anfrageStatusAktion} werte={{ id: q.a.id, status: "archiv" }} ziel="aufgaben" klasse="lfa-link-knopf" knopf="Archiv (Test/Spam)" tipp="Test, Spam oder Dublette — archivieren. Es geht keine E-Mail raus; in der Anfrage jederzeit zurückholbar." />
            <Link href={a.href} className="lfa-link-knopf" title="Anfrage öffnen: alle Angaben, E-Mail-Entwürfe, Weg (selbst kaufen / vermitteln), Verlauf">
              Anfrage öffnen
            </Link>
          </div>
        </div>
      );
    case "rueckmeldung": {
      const r = q.r.r;
      return (
        <div className="lfa-aufgabe-inhalt">
          <div className="lfa-klein">
            {RUECKMELDUNG_NAME[r.art]}
            {r.thema ? `: ${r.thema}` : ""} · Antwort vom {datumZeit(r.am)} {r.quelle === "link" ? "über den Antwort-Link" : r.quelle === "email" ? "(aus der E-Mail übernommen)" : "(von Ihnen erfasst)"} · Anfrage vom {datum(q.r.eingang)}: {q.r.anliegen}
          </div>
          {(r.text || r.notiz) && <div className="lfa-nachricht lfa-ticket-text">{r.text ?? `Notiz: ${r.notiz}`}</div>}
          {r.vorgaenge?.length ? (
            <div className="lfa-klein lfa-dash-warnung">
              Läuft in {r.vorgaenge.length === 1 ? "einem Vorgang" : `${r.vorgaenge.length} Vorgängen`}:{" "}
              {r.vorgaenge.map((k, i) => (
                <span key={k}>
                  {i > 0 ? ", " : ""}
                  <Link href={`/admin/vorgang/${k}`}>{k}</Link>
                </span>
              ))}
            </div>
          ) : null}
          <div className="lfa-knopfreihe">
            <EinKlick aktion={anfrageStatusAktion} werte={{ id: q.r.id, status: "beantwortet" }} ziel="aufgaben" klasse="lfa-link-knopf" knopf="Als beantwortet markieren" tipp="Schon anders erledigt? Setzt den Status auf „Beantwortet“ — das Ticket verschwindet. Es geht keine E-Mail raus." />
            <Link href={a.href} className="lfa-link-knopf" title="Anfrage öffnen">
              Anfrage öffnen
            </Link>
          </div>
        </div>
      );
    }
    case "postfach": {
      const m = q.p.mail;
      return (
        <div className="lfa-aufgabe-inhalt">
          <div className="lfa-klein">
            E-Mail vom {datumZeit(m.am)} · {m.von}
            {m.betreff ? ` · „${m.betreff}“` : ""} · jetzt {q.p.einordnung}
          </div>
          <div className="lfa-nachricht lfa-ticket-text">{m.text || "— kein eigener Text —"}</div>
          {m.hinweis && <div className="lfa-klein lfa-dash-warnung">Hinweis: {m.hinweis}</div>}
        </div>
      );
    }
    case "postausgang":
      return <PostausgangDetails p={d.postausgang} />;
    case "boerse":
      return (
        <div className="lfa-aufgabe-inhalt lfa-klein">
          Einwilligung {q.b.einwilligung?.quelle} am {q.b.einwilligung ? new Date(`${q.b.einwilligung.am}T12:00:00`).toLocaleDateString("de-DE") : "—"} ·{" "}
          <Link href={a.href}>Angaben in der Anfrage prüfen</Link>
        </div>
      );
    case "ankauf":
      return (
        <div className="lfa-aufgabe-inhalt lfa-klein">
          {q.k.eckdaten}
          {q.k.preis ? ` · Kaufpreis-Angebot ${M.euro(q.k.preis)}` : ""} · „Selbst kaufen“ gewählt am {datumZeit(q.k.gewaehltAm)}
          {q.k.angebotAm ? ` · Mail am ${datumZeit(q.k.angebotAm)}` : ""}
        </div>
      );
    default:
      return (
        <div className="lfa-aufgabe-inhalt lfa-klein">
          <Link href={a.href}>Öffnen</Link>
        </div>
      );
  }
}

function AufgabeZeile({ a, test, d }: { a: Aufgabe; test: boolean; d: Dashboard }) {
  return (
    <li className={`lfa-aufgabe lfa-aufgabe-p${a.prio}`} id={a.id}>
      <div className="lfa-aufgabe-zeile">
        <span className="lfa-aufgabe-zeichen" title={ZEICHEN_TIPP[a.zeichen]} aria-hidden={a.zeichen ? undefined : true}>
          {a.zeichen}
        </span>
        <div className="lfa-aufgabe-text">
          <div>
            {a.neu && <span className="lfa-puls" title="Neu seit Ihrem letzten Besuch" />}
            <Link href={a.href} className="lfa-link-name" title="Öffnen: alle Details">
              {a.titel}
            </Link>
            {a.ueberfaellig && (
              <span className="lfa-badge lfa-badge-warn" title="Frist überschritten">
                überfällig
              </span>
            )}
            {a.seit && <span className="lfa-klein"> · {seitText(a.seit, d.am)}</span>}
          </div>
          <div className="lfa-klein lfa-aufgabe-grund">{a.grund}</div>
        </div>
        <div className="lfa-aufgabe-knopf">
          <AufgabeKnopf a={a} test={test} />
        </div>
      </div>
      <details className="lfa-aufgabe-details">
        <summary title="Schrittleiste, Chips, letzte Ereignisse und weitere Aktionen">Details</summary>
        <AufgabeDetails a={a} d={d} />
      </details>
    </li>
  );
}

/** Einzeiler eines wartenden Vorgangs — Knopf nur, wenn eine Erinnerung fällig ist. */
function WartenZeile({ x, bezug }: { x: DashVorgang; bezug: string }) {
  const e = faelligeErinnerung(x);
  return (
    <li className="lfa-aufgabe lfa-aufgabe-warten" id={x.key}>
      <div className="lfa-aufgabe-zeile">
        <span className="lfa-aufgabe-zeichen" aria-hidden />
        <div className="lfa-aufgabe-text">
          <div>
            {x.neu > 0 && <span className="lfa-puls" title="Neues im Vorgang seit Ihrem letzten Besuch" />}
            <Link href={`/admin/vorgang/${x.key}`} className="lfa-link-name" title="Vorgang öffnen">
              {x.anbieter} ↔ {x.suchender}
            </Link>{" "}
            <span className="lfa-klein">· {x.art === "kauf" ? "Kauf" : "Pacht"}</span>
            {x.plan.wartetSeit && <span className="lfa-klein"> · wartet {seitText(x.plan.wartetSeit, bezug)}</span>}
          </div>
          <div className="lfa-klein lfa-aufgabe-grund">{x.plan.warten[0]?.text ?? x.plan.stand}</div>
        </div>
        <div className="lfa-aufgabe-knopf">{e && <AssistentKnopf plan={x.plan} a={e} />}</div>
      </div>
      <details className="lfa-aufgabe-details">
        <summary title="Schrittleiste, Chips, letzte Ereignisse und weitere Aktionen">Details</summary>
        <VorgangDetails x={x} bezug={bezug} />
      </details>
    </li>
  );
}

function AutomatikInhalt({ a }: { a: DashAutomatik }) {
  return (
    <div id="automatik">
      <p className="lfa-klein" style={{ margin: "0 0 0.5rem" }}>
        {a.stand === "aus"
          ? "Die Automatik ist aus (alle Regeln aus)."
          : a.stand === "notaus"
            ? "Not-Aus ist an — es läuft nichts."
            : `${a.stand === "probelauf" ? "Probelauf" : "Scharf"} · Regeln: ${a.regeln.join(", ")}.`}{" "}
        <Link href="/admin/vorlagen#automatik" title="Regeln, Not-Aus, Probelauf, Tageslimit">
          Einstellungen
        </Link>
      </p>
      {a.eintraege.length === 0 ? (
        <p className="lfa-klein">Heute und gestern nichts erledigt.</p>
      ) : (
        <ul className="lfa-protokoll">
          {a.eintraege.slice(0, 60).map((e, i) => (
            <li key={i}>
              <span className="lfa-klein">
                {datumZeit(e.am)} · {e.regel.toUpperCase()}
                {e.art === "probe" ? " · Probelauf" : e.art === "fehler" ? " · Fehler" : ""}
              </span>
              <div className={e.art === "fehler" ? "lfa-dash-warnung" : undefined}>
                {e.ref && /^LL-/.test(e.ref) ? (
                  <Link href={e.ref.includes("~") ? `/admin/vorgang/${e.ref}` : `/admin/anfrage/${e.ref}`} title="Öffnen">
                    {e.ref}
                  </Link>
                ) : null}{" "}
                {e.text}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
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
function UebersichtKacheln({ u, vorschlaege, nachfassen }: { u: DashUebersicht; vorschlaege: number; nachfassen: { anzahl: number; neu: boolean; tage: number } }) {
  const n = (x: number, eins: string, mehr: string) => `${x} ${x === 1 ? eins : mehr}`;
  const kacheln = [
    { href: "#warten", wert: u.eingeladen, name: "Einladungen raus", sub: `${n(u.eingeladen, "Kunde", "Kunden")} noch ohne Unterschrift${u.eingeladenGeoeffnet ? ` · ${u.eingeladenGeoeffnet} Link geöffnet` : ""}`, tipp: "Kunden mit Einladung, die ihren Vertrag mit Lippe Forst noch nicht unterschrieben haben" },
    { href: "/admin/vorgaenge", wert: u.unterschrieben, name: "Unterschrieben", sub: `${n(u.unterschriebenAnbieter, "Anbieter", "Anbieter")} · ${n(u.unterschriebenSuchende, "Suchender", "Suchende")}`, tipp: "Kunden mit gültigem Vertrag mit Lippe Forst (Suchende: Provisionsvereinbarung)" },
    { href: "#jetzt", wert: u.matchingOffen, name: "Matchings offen", sub: `Paare vor der Freigabe${vorschlaege ? ` · dazu ${n(vorschlaege, "neuer Vorschlag", "neue Vorschläge")}` : ""}`, tipp: "Vorgemerkte bzw. angefragte Paare, deren Kontakt noch nicht freigegeben ist" },
    { href: "#warten", wert: u.zustimmungOffen, name: "Zustimmung offen", sub: "anonym angefragt, Zustimmung fehlt", tipp: "Beide wurden anonym angefragt, mindestens eine Zustimmung zum Kontakt fehlt noch" },
    { href: "#warten", wert: u.freigegeben, name: "Kontakt freigegeben", sub: u.vertraegeOffen ? `${n(u.vertraegeOffen, "Vertrag", "Verträge")} zur Unterschrift` : "Vertrag noch offen", tipp: "Kontakt ist hergestellt (Nachweis) — Pacht- oder Kaufvertrag steht noch aus" },
    { href: "#abgeschlossen", wert: u.abschluesse, name: "Abschlüsse", sub: "Vertrag geschlossen", tipp: "Vorgänge mit geschlossenem Pacht- oder Kaufvertrag" },
    { href: "#boerse", wert: u.boerseBereit + u.boerseAngabenFehlen + u.boerseOhneEinwilligung, name: "Flächen nicht veröffentlicht", sub: `${u.boerseBereit} bereit · ${u.boerseAngabenFehlen ? `${u.boerseAngabenFehlen} Angaben fehlen · ` : ""}${u.boerseOhneEinwilligung} ohne Einwilligung`, tipp: "Angebote (Kauf und Pacht), die (noch) nicht in der Flächenbörse stehen — „bereit“ heißt: Einwilligung liegt vor, ein Klick genügt", puls: u.boerseBereit > 0 },
    { href: "#boerse", wert: u.boerseOnline, name: "Flächen online", sub: "anonym in der Flächenbörse", tipp: "Angebote (Kauf und Pacht), die anonym auf lippeforst.de stehen" },
    { href: "/admin?status=neu", wert: u.neueAnfragen, name: "Neue Anfragen", sub: "noch nicht bearbeitet", tipp: "Formular-Anfragen mit Status „Neu“", puls: u.neueAnfragen > 0 },
    { href: "#nachfassen", wert: nachfassen.anzahl, name: "Nachfassen möglich", sub: "ältere Anfragen ohne Rückmeldung", tipp: `Anfragen ohne laufenden Vorgang und ohne Vertrag, bei denen Eingang und letzter Kontakt mehr als ${n(nachfassen.tage, "Tag", "Tage")} zurückliegen — eine kurze Mail fragt, ob noch Interesse besteht (nur auf Klick)`, puls: nachfassen.neu },
  ];
  return (
    <>
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

/** Flächenbörse: Angebote (Kauf und Pacht) mit Stand — „Veröffentlichen“ mit einem Klick, sobald die Einwilligung vorliegt. */
function BoerseListe({ liste }: { liste: DashBoerse[] }) {
  return (
    <div id="boerse">
      <p className="lfa-klein" style={{ margin: "0 0 0.5rem" }}>
        <Link href="/admin/flaechen-einstellen" title="Eigene oder telefonisch angebotene Flächen direkt einstellen — Flurstücke eingeben, Größe und Lage kommen aus dem Kataster NRW">
          + Flächen selbst einstellen
        </Link>
      </p>
      {liste.length === 0 ? (
        <div className="lfa-panel lfa-leer">Keine aktiven Angebote.</div>
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
    </div>
  );
}

/** Nachfassen: ältere Anfragen ohne Rückmeldung — Häkchen je Kunde, Textvorschau, ein Knopf mit Rückfrage. */
function NachfassenAbschnitt({ liste, tage, test }: { liste: NachfassKandidat[]; tage: number; test: boolean }) {
  const laenger = `länger als ${tage === 1 ? "einen Tag" : `${tage} Tage`}`;
  return (
    <div id="nachfassen">
      <AbschnittErgebnis ziel="nachfassen" />
      <div className={`lfa-panel ${liste.length === 0 ? "lfa-leer" : ""}`}>
        {liste.length === 0 ? (
          <>Niemand zum Nachfassen — ältere Anfragen ohne Rückmeldung erscheinen hier, sobald Eingang und letzter Kontakt {laenger} zurückliegen.</>
        ) : (
          <>
            <p className="lfa-klein lfa-nachfass-regel">
              Hier stehen offene Anfragen (neu, in Arbeit oder beantwortet), deren Eingang und letzter Kontakt {laenger} zurückliegen — ohne laufenden Vorgang, ohne unterschriebenen Vertrag und in den letzten {NACHFASS_PAUSE_TAGE} Tagen nicht nachgefasst.
              Jede Mail enthält einen persönlichen Antwort-Link: Die Antwort erscheint oben unter „Rückmeldungen“ als Ticket, „kein Interesse“ setzt die Anfrage automatisch auf „Erledigt“. Antworten per E-Mail tragen Sie in der Anfrage unter „Rückmeldung erfassen“ ein.
            </p>
            <Nachfassen kandidaten={liste} test={test} />
          </>
        )}
      </div>
    </div>
  );
}

export default async function DashboardPage(props: PageProps<"/admin/dashboard">) {
  const { email } = await requireAdmin();
  const sp = await props.searchParams;
  const d = await ladeDashboard(email);
  const fokus = typeof sp.k === "string" ? sp.k : "";
  const test = testModus();
  const aufgaben = aufgabenAus(d);
  const einladungen = sammelEinladungen(d);
  const erinnerungen = d.warten.map((x) => ({ x, a: faelligeErinnerung(x) })).filter((y) => y.a);
  const ueberfaellig = aufgaben.filter((a) => a.ueberfaellig || a.prio === 1).length;
  const neuAnzahl = aufgaben.filter((a) => a.neu).length;
  const aeltesterWarten = d.warten.map((x) => x.plan.wartetSeit).filter((x): x is string => Boolean(x)).sort()[0];
  const besterVorschlag = d.vorschlaege.reduce((m, v) => Math.max(m, v.score ?? 0), 0);
  const jetzt = new Date(d.am);
  // „Gesehen“ nur für die Aufgabenliste — eingeklappte Abschnitte erst beim Aufklappen.
  const gesehen = aufgaben.flatMap((a) => {
    const q = a.quelle;
    if (q.typ === "vorgang") return [`vorgang:${q.x.key}`, ...q.x.key.split("~").map((id) => `kunde:${id}`)];
    if (q.typ === "anfrage") return [`anfrage:${q.a.id}`];
    if (q.typ === "rueckmeldung") return [`rueckmeldung:${q.r.id}`];
    if (q.typ === "postfach") return [`postfach:${q.p.key}`];
    return [];
  });
  const autoText = d.automatik.stand === "aus" ? "aus" : d.automatik.stand === "notaus" ? "Not-Aus" : d.automatik.stand === "probelauf" ? `Probelauf (${d.automatik.regeln.join(", ")})` : `an (${d.automatik.regeln.join(", ")})`;

  return (
    <>
      <GesehenMarker keys={gesehen} />
      <div className="lfa-titelzeile">
        <div>
          <h1 className="lfa-h1">Dashboard</h1>
          <p className="lfa-unterzeile">
            {jetzt.toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })} ·{" "}
            <Link href="/admin/vorlagen#automatik" title="Automatik: Regeln, Not-Aus, Probelauf">
              Automatik: {autoText}
            </Link>
          </p>
        </div>
      </div>
      <Meldung sp={sp} />
      <AlleFreigeben e={d.einstellungen} zurueck="/admin/dashboard" />
      <AbschnittErgebnis ziel="weg" />

      <section className="lfa-dash-abschnitt" id="aufgaben">
        <h2 className="lfa-h2" title="Alles, wo Sie jetzt am Zug sind — je Zeile ein Knopf; Fristen & Recht zuerst, dann Geld, wartende Kunden, neue Eingänge, Wachstum">
          Jetzt zu tun ({aufgaben.length})
          <span className="lfa-klein" style={{ fontWeight: 400 }}>
            {ueberfaellig ? ` · ${ueberfaellig} dringend` : ""}
            {neuAnzahl ? ` · ${neuAnzahl} neu` : ""} · {d.warten.length} warten auf Kunden
          </span>
        </h2>
        <AbschnittErgebnis ziel="aufgaben" />
        <AbschnittErgebnis ziel="anfragen" />
        <AbschnittErgebnis ziel="rueckmeldungen" />
        {einladungen.length >= 2 && (
          <div className="lfa-panel lfa-sammel">
            <span>
              <strong>{einladungen.length} Einladungen</strong> sind fertig vorbereitet.
            </span>
            <SammelKnopf
              aktion={sammelEinladenAktion}
              eintraege={einladungen.map((x) => `${x.id}|${x.signatur}`)}
              liste={einladungen.map((x) => `${x.name} (${x.an})`)}
              knopf={`Alle ${einladungen.length} Einladungen senden`}
              frage={`Alle ${einladungen.length} Einladungen jetzt senden?`}
              tipp="Sendet jede Einladung einzeln — mit denselben Prüfungen wie der Einzelknopf; vorher wird nachgefragt"
              ziel="aufgaben"
              test={test}
            />
          </div>
        )}
        {aufgaben.length === 0 ? (
          <div className="lfa-panel lfa-leer">Nichts zu tun — alles wartet auf Kunden oder ist erledigt.</div>
        ) : (
          <ul className="lfa-aufgaben">
            {aufgaben.map((a) => (
              <AufgabeZeile key={a.id} a={a} test={test} d={d} />
            ))}
          </ul>
        )}
      </section>

      <details className="lfa-weitere lfa-dash-abschnitt" id="warten" open={d.warten.some((x) => x.key === fokus) || undefined}>
        <summary title="Hier sind Kunden, Notar, Behörde oder die Zahlung am Zug — Knopf nur, wenn eine Erinnerung fällig ist">
          {d.warten.some((x) => x.neu > 0) && <span className="lfa-puls" />}Warten auf Kunden ({d.warten.length})
          {aeltesterWarten ? <span className="lfa-klein" style={{ fontWeight: 400 }}> · ältester Punkt {seitText(aeltesterWarten, d.am)}</span> : null}
          {erinnerungen.length ? <span className="lfa-klein" style={{ fontWeight: 400 }}> · {erinnerungen.length} Erinnerung{erinnerungen.length === 1 ? "" : "en"} fällig</span> : null}
        </summary>
        <div className="lfa-weitere-inhalt">
          <GesehenBeimAufklappen keys={d.warten.flatMap((x) => [`vorgang:${x.key}`, ...x.key.split("~").map((id) => `kunde:${id}`)])} />
          <AbschnittErgebnis ziel="warten" />
          {erinnerungen.length >= 2 && (
            <div className="lfa-panel lfa-sammel">
              <span>
                <strong>{erinnerungen.length} Erinnerungen</strong> sind fällig.
              </span>
              <SammelKnopf
                aktion={sammelErinnernAktion}
                eintraege={erinnerungen.map((y) => `${y.x.key}|${y.a!.id}|${y.a!.signatur}`)}
                liste={erinnerungen.flatMap((y) => y.a!.mails.map((m) => `${m.wer} (${m.an}) — ${m.betreff}`))}
                knopf={`${erinnerungen.length} fällige Erinnerungen senden`}
                frage="Alle fälligen Erinnerungen jetzt senden?"
                tipp="Sendet die fälligen Erinnerungen einzeln — jeder Vorgang wird vorher frisch geprüft"
                ziel="warten"
                test={test}
              />
            </div>
          )}
          {d.warten.length === 0 ? (
            <p className="lfa-klein">Kein Vorgang wartet gerade.</p>
          ) : (
            <ul className="lfa-aufgaben">
              {d.warten.map((x) => (
                <WartenZeile key={x.key} x={x} bezug={d.am} />
              ))}
            </ul>
          )}
        </div>
      </details>

      <details className="lfa-weitere lfa-dash-abschnitt" id="vorschlaege">
        <summary title="Automatisch gefundene Paare aus dem Matching, beste zuerst">
          {d.vorschlaege.some((v) => v.neu) && <span className="lfa-puls" />}Matching-Vorschläge ({d.vorschlaege.length}
          {d.vorschlaege.length ? `, bester ${besterVorschlag} %` : ""})
        </summary>
        <div className="lfa-weitere-inhalt">
          <GesehenBeimAufklappen keys={d.vorschlaege.map((v) => `paar:${v.key}`)} />
          <AbschnittErgebnis ziel="vorschlaege" />
          {d.vorschlaege.length === 0 ? (
            <p className="lfa-klein">Keine neuen Vorschläge — sobald ein Angebot und ein Gesuch zusammenpassen, erscheinen sie hier.</p>
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
        </div>
      </details>

      <details className="lfa-weitere lfa-dash-abschnitt">
        <summary title="Ältere Anfragen ohne Rückmeldung: eine kurze Mail fragt, ob noch Interesse besteht — nur auf Klick">
          {d.nachfassen.some((c) => c.neu) && <span className="lfa-puls" />}Nachfassen möglich ({d.nachfassen.length})
        </summary>
        <div className="lfa-weitere-inhalt">
          <GesehenBeimAufklappen keys={d.nachfassen.map((c) => `nachfassen:${c.id}`)} />
          <NachfassenAbschnitt liste={d.nachfassen} tage={d.nachfassTage} test={test} />
        </div>
      </details>

      <details className="lfa-weitere lfa-dash-abschnitt">
        <summary title="Angebote zum Kauf und zur Pacht für die anonyme Flächenbörse — nur mit Einwilligung des Eigentümers">
          Flächenbörse: {d.uebersicht.boerseOnline} online · {d.uebersicht.boerseBereit} bereit · {d.uebersicht.boerseAngabenFehlen} Angaben fehlen · {d.uebersicht.boerseOhneEinwilligung} ohne Einwilligung
        </summary>
        <div className="lfa-weitere-inhalt">
          <BoerseListe liste={d.boerse} />
        </div>
      </details>

      <details className="lfa-weitere lfa-dash-abschnitt" open={sp.a === "automatik" || undefined}>
        <summary title="Was die Automatik heute und gestern erledigt (oder im Probelauf erledigt hätte)">
          Automatisch erledigt ({d.automatik.eintraege.length}) · Automatik: {autoText}
        </summary>
        <div className="lfa-weitere-inhalt">
          <AutomatikInhalt a={d.automatik} />
        </div>
      </details>

      <details className="lfa-weitere lfa-dash-abschnitt">
        <summary title="Stand aller Kunden, Paare, der Börse und der Provisionen">
          Kennzahlen: {d.uebersicht.eingeladen} eingeladen · {d.uebersicht.unterschrieben} unterschrieben · {d.uebersicht.zustimmungOffen} Zustimmung offen · {d.uebersicht.freigegeben} freigegeben · Provision offen {M.euro(d.provisionOffen)}
        </summary>
        <div className="lfa-weitere-inhalt">
          <UebersichtKacheln u={d.uebersicht} vorschlaege={d.vorschlaege.length} nachfassen={{ anzahl: d.nachfassen.length, neu: d.nachfassen.some((c) => c.neu), tage: d.nachfassTage }} />
          <p className="lfa-klein" style={{ marginTop: "0.5rem" }}>
            Provision offen (netto): {M.euro(d.provisionOffen)}
            {d.provisionAufschiebend ? ` · dazu ${M.euro(d.provisionAufschiebend)} aufschiebend (Genehmigung ausstehend)` : ""}
            {d.provisionDran ? ` · ${d.provisionDran} fällig bzw. überfällig` : ""}
          </p>
          {d.keinInteresse.length > 0 && (
            <>
              <h3 className="lfa-h2" style={{ fontSize: "0.95rem", marginTop: "0.8rem" }}>„Kein Interesse“ gemeldet (letzte 30 Tage, automatisch erledigt)</h3>
              <ul className="lfa-protokoll">
                {d.keinInteresse.map((x) => (
                  <li key={x.id}>
                    <span className="lfa-klein">{datumZeit(x.r.am)}</span>
                    <div>
                      <Link href={`/admin/anfrage/${x.id}`} className="lfa-link-name" title="Anfrage öffnen — über den Status lässt sie sich wieder aufnehmen">
                        {x.name}
                      </Link>{" "}
                      <span className="lfa-klein">· {x.anliegen}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </details>

      {/* Offen, wenn eine Karte hier im Fokus steht (Link aus einer Verwaltungs-Mail); sonst eingeklappt. */}
      <details className="lfa-weitere lfa-dash-abschnitt" id="abgeschlossen" open={d.abgeschlossen.some((x) => x.key === fokus) || undefined}>
        <summary title="Geschlossene und bezahlte Vorgänge sowie ohne Abschluss beendete — dort lassen sie sich wieder aufnehmen">
          Abgeschlossen &amp; beendet ({d.abgeschlossen.length})
        </summary>
        <div className="lfa-weitere-inhalt">
          <AufklappenBeiErgebnis keys={d.abgeschlossen.map((x) => x.key)} />
          {d.abgeschlossen.length === 0 ? (
            <p className="lfa-klein">Noch kein abgeschlossener Vorgang.</p>
          ) : (
            <ul className="lfa-aufgaben">
              {d.abgeschlossen.map((x) => (
                <WartenZeile key={x.key} x={x} bezug={d.am} />
              ))}
            </ul>
          )}
        </div>
      </details>
    </>
  );
}
