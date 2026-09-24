import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/session";
import { ladeVerwaltung } from "@/lib/admin/daten";
import { findeKandidaten, type Kandidat } from "@/lib/admin/matching";
import { LEAD_STATUS, MATCH_STATUS, formatGroesse, type LeadView, type Zustand } from "@/lib/admin/model";
import { artLabel, datum } from "@/lib/admin/format";
import { ladeNeu, ladePortal, type Neu } from "@/lib/admin/neu";
import { entwuerfeKunde, entwuerfePaar, type Entwurf } from "@/lib/portal/entwuerfe";
import * as M from "@/lib/portal/model";
import { basisUrl } from "@/lib/portal/sitzung";
import { freigabePruefung } from "@/lib/portal/vorgang";
import { paarAktion } from "../../actions";
import { freigebenAktion, zustimmungErfassenAktion } from "../../portal-actions";
import BestaetigenKnopf from "../BestaetigenKnopf";
import GesehenMarker from "../GesehenMarker";
import MailEntwurf from "../MailEntwurf";
import { KundenStand, Meldung, Puls, VorgangLink } from "../teile";
import OrteKnopf from "./OrteKnopf";

export const metadata: Metadata = { title: "Matching" };

type Portal = Awaited<ReturnType<typeof ladePortal>>;

function Seite({ lead, titel }: { lead: LeadView; titel: string }) {
  return (
    <div className="lfa-paar-seite">
      <div className="lfa-klein" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>{titel}</div>
      <Link href={`/admin/anfrage/${lead.id}`} className="lfa-link-name" title="Anfrage öffnen: alle Angaben, Onboarding, Kontakt, Matching-Angaben korrigieren">
        {lead.name}
      </Link>
      <div style={{ marginTop: "0.2rem" }}>
        {lead.typ} · {formatGroesse(lead.groesseWert)}
        {lead.groesseWert.unsicher ? " (geschätzt)" : ""}
      </div>
      <div className="lfa-klein">
        {lead.ortText || "Ort offen"}
        {lead.rolle === "gesuch" ? ` · Radius ${lead.radiusKm} km` : ""}
      </div>
      <div className="lfa-klein">
        {artLabel(lead.art)} · eingegangen {datum(lead.receivedAt)} ·{" "}
        <span title={LEAD_STATUS[lead.status].tipp}>{LEAD_STATUS[lead.status].label}</span>
      </div>
    </div>
  );
}

function AktionsKnopf({ k, aktion, text, tipp, leise, disabled }: { k: Kandidat; aktion: string; text: string; tipp: string; leise?: boolean; disabled?: boolean }) {
  return (
    <form action={paarAktion}>
      <input type="hidden" name="key" value={k.key} />
      <input type="hidden" name="aktion" value={aktion} />
      <button type="submit" className={`lfa-knopf lfa-knopf-klein ${leise ? "lfa-knopf-leise" : ""}`} title={tipp} disabled={disabled}>
        {text}
      </button>
    </form>
  );
}

function Zustimmung({ k, rolle, zurueck }: { k: Kandidat; rolle: M.Rolle; zurueck: string }) {
  const am = rolle === "anbieter" ? k.meta?.zustimmungAnbieter : k.meta?.zustimmungSuchender;
  const quelle = k.meta?.zustimmungQuelle?.[rolle];
  const wer = rolle === "anbieter" ? "Anbieter" : "Suchender";
  const abgelehnt = k.meta?.ablehnung?.rolle === rolle;
  return (
    <form action={zustimmungErfassenAktion} className="lfa-zustimmung">
      <input type="hidden" name="key" value={k.key} />
      <input type="hidden" name="rolle" value={rolle} />
      <input type="hidden" name="art" value={k.angebot.art ?? "pacht"} />
      <input type="hidden" name="an" value={am ? "0" : "1"} />
      <input type="hidden" name="zurueck" value={zurueck} />
      <button
        type="submit"
        className={`lfa-knopf lfa-knopf-klein ${am ? "" : "lfa-knopf-hell"}`}
        title={
          am
            ? `${wer} hat am ${datum(am)} zugestimmt${quelle === "kunde" ? " (selbst im Kundenbereich)" : quelle ? ` (erfasst von ${quelle})` : ""}. Klick nimmt die Zustimmung zurück.`
            : `Zustimmung des ${wer}s zu genau diesem Kontakt erfassen (z. B. telefonisch oder per Mail erteilt). Der Kunde kann auch selbst im Kundenbereich zustimmen.`
        }
      >
        {am ? `✓ ${wer} stimmt zu (${datum(am)}${quelle === "kunde" ? ", selbst" : ""})` : abgelehnt ? `${wer}: kein Interesse gemeldet` : `Zustimmung ${wer} erfassen`}
      </button>
    </form>
  );
}

function PaarKarte({ k, zustand, portal, neu, basis, zurueck, bewertungsUrl }: { k: Kandidat; zustand: Zustand; portal: Portal; neu: Neu; basis: string; zurueck: string; bewertungsUrl: string | null }) {
  const status = k.meta?.status ?? "vorschlag";
  const anbieter = portal.kunden.get(k.angebot.id) ?? null;
  const suchender = portal.kunden.get(k.gesuch.id) ?? null;
  const vorgang = portal.vorgaenge.get(k.key) ?? null;
  const neuerVorschlag = !k.meta && neu.vorschlag(k.key);
  const neueEreignisse = neu.vorgang(vorgang).length + neu.kunde(anbieter).length + neu.kunde(suchender).length;
  const pr = freigabePruefung({ key: k.key, art: k.angebot.art === "kauf" ? "kauf" : "pacht", meta: k.meta, vorgang, angebot: k.angebot, gesuch: k.gesuch, anbieter, suchender, zustand });
  const aktiv = status === "vorgemerkt" || status === "angefragt";

  const entwuerfe: Entwurf[] =
    status === "verworfen"
      ? []
      : [
          ...entwuerfePaar({ key: k.key, angebot: k.angebot, gesuch: k.gesuch, anbieter, suchender, vorgang, meta: k.meta, zustand, einstellungen: portal.einstellungen, basis, bewertungsUrl }),
          ...(aktiv
            ? [
                ...entwuerfeKunde({ lead: k.gesuch, kunde: suchender, einstellungen: portal.einstellungen, basis }),
                ...entwuerfeKunde({ lead: k.angebot, kunde: anbieter, einstellungen: portal.einstellungen, basis }),
              ].filter((e) => e.zweck === "einladung" || e.zweck === "erinnerung")
            : []),
        ];
  const faellig = entwuerfe.filter((e) => e.faellig && !e.gesendetAm).length;

  return (
    <article className={`lfa-paar ${neuerVorschlag ? "lfa-puls-ring" : ""}`} id={k.key}>
      <Seite lead={k.angebot} titel="Angebot" />
      <div className="lfa-paar-mitte" title="Punktzahl aus Entfernung (45 %), Flächentyp (35 %) und Größe (20 %)">
        <span className="lfa-score">{k.score != null ? `${k.score} %` : "—"}</span>
        <span className="lfa-scorebalken"><span style={{ width: `${k.score ?? 0}%` }} /></span>
        {k.distanzKm != null && <span className="lfa-klein">{k.distanzKm} km</span>}
        <span className="lfa-badge lfa-badge-keine" title={MATCH_STATUS[status].tipp}>{MATCH_STATUS[status].label}</span>
        {neuerVorschlag && <span className="lfa-neu-text" title="Neuer Vorschlag — noch nie angesehen"><span className="lfa-puls" />neu</span>}
      </div>
      <Seite lead={k.gesuch} titel="Gesuch" />

      <div className="lfa-paar-fuss">
        {k.gruende.length > 0 && (
          <ul className="lfa-gruende">
            {k.gruende.map((g) => <li key={g}>{g}</li>)}
          </ul>
        )}
        {k.hinweise.map((h) => (
          <p key={h} className="lfa-hinweis" style={{ margin: 0 }}>{h}</p>
        ))}

        {status !== "vorschlag" && status !== "verworfen" && (
          <div className="lfa-texte">
            <KundenStand k={anbieter} rolle="anbieter" neu={neu.kunde(anbieter).length} />
            <KundenStand k={suchender} rolle="suchender" neu={neu.kunde(suchender).length} />
          </div>
        )}

        <div className="lfa-knopfreihe">
          {status === "vorschlag" && (
            <>
              <AktionsKnopf k={k} aktion="vormerken" text="Vormerken" tipp="Paar passt — vormerken; danach stehen die anonymen Hinweise und Einladungen als Entwürfe bereit" />
              <AktionsKnopf k={k} aktion="verwerfen" text="Passt nicht" leise tipp="Paar verwerfen — wird nicht mehr vorgeschlagen (lässt sich unten unter „Verworfen“ zurückholen)" />
            </>
          )}
          {aktiv && (
            <>
              {status === "vorgemerkt" && (
                <AktionsKnopf k={k} aktion="angefragt" text="Hinweise extern verschickt" leise tipp="Nur klicken, wenn beide anonymen Hinweise außerhalb der Verwaltung (Telefon, eigenes Postfach) gesendet wurden — setzt den Status auf „Angefragt“" />
              )}
              <Zustimmung k={k} rolle="anbieter" zurueck={zurueck} />
              <Zustimmung k={k} rolle="suchender" zurueck={zurueck} />
              <AktionsKnopf k={k} aktion="verwerfen" text={status === "angefragt" ? "Abgesagt" : "Passt nicht"} leise tipp="Eine Seite hat abgelehnt oder das Paar passt nicht — verwerfen" />
              {status === "vorgemerkt" && <AktionsKnopf k={k} aktion="zuruecksetzen" text="Zurücksetzen" leise tipp="Zurück zum unbearbeiteten Vorschlag; Zustimmungen und Notiz werden gelöscht" />}
            </>
          )}
          {(status === "kontakt" || status === "abschluss") && (
            <span className="lfa-klein">
              Freigegeben {vorgang?.freigabe ? `am ${datum(vorgang.freigabe.am)}` : ""} · Zustimmung Anbieter {datum(k.meta?.zustimmungAnbieter ?? "")}, Suchender {datum(k.meta?.zustimmungSuchender ?? "")}
            </span>
          )}
          {status === "verworfen" && (
            <AktionsKnopf k={k} aktion="zuruecksetzen" text="Wieder vorschlagen" leise tipp="Verwerfen rückgängig machen — das Paar erscheint wieder als Vorschlag" />
          )}
          {k.meta && <VorgangLink k={k.key} />}
          {neueEreignisse > 0 && <span className="lfa-neu-text" title="Neue Ereignisse bei diesem Paar oder seinen Kunden"><span className="lfa-puls" />{neueEreignisse} neu</span>}
        </div>

        {aktiv && (
          <div className="lfa-abschnitt" style={{ marginTop: 0 }}>
            <h3 className="lfa-h3">Freigabe der Kontaktdaten</h3>
            <ul className="lfa-pruefliste">
              {pr.punkte.map((p) => (
                <li key={p.text} className={p.ok ? "lfa-ok" : undefined}>{p.text}</li>
              ))}
            </ul>
            <form action={freigebenAktion}>
              <input type="hidden" name="key" value={k.key} />
              <input type="hidden" name="zurueck" value={zurueck} />
              <BestaetigenKnopf
                disabled={!pr.bereit}
                frage={`Kontakt jetzt freigeben? ${k.angebot.name} und ${k.gesuch.name} sehen danach im Kundenbereich Namen, Kontaktdaten und Flurstücke des Gegenübers. Das lässt sich nicht ungeschehen machen.`}
                tipp={pr.bereit ? "Gibt die Kontaktdaten beider Seiten im Kundenbereich frei; danach die Freigabe-Mitteilungen senden" : "Erst möglich, wenn beide unterschrieben haben (bei Verbrauchern Widerrufsfrist geklärt) und beide diesem Kontakt zugestimmt haben"}
              >
                Kontakt freigeben
              </BestaetigenKnopf>
            </form>
          </div>
        )}

        {entwuerfe.length > 0 && (
          <details className="lfa-details" open={faellig > 0}>
            <summary title="Fertige E-Mails für die nächsten Schritte — vor dem Senden änderbar; gesendet wird nur auf Klick">
              {faellig > 0 && <span className="lfa-puls" />}E-Mail-Entwürfe ({entwuerfe.length}{faellig > 0 ? `, ${faellig} jetzt dran` : ""})
            </summary>
            <div className="lfa-entwuerfe">
              {entwuerfe.map((e) => (
                <MailEntwurf key={e.id} e={e} />
              ))}
            </div>
          </details>
        )}

        <details className="lfa-details" open={Boolean(k.meta?.notiz)}>
          <summary title="Interne Notiz zu diesem Paar, z. B. Gesprächsstand">Notiz{k.meta?.notiz ? " ✎" : ""}</summary>
          <form action={paarAktion}>
            <input type="hidden" name="key" value={k.key} />
            <input type="hidden" name="aktion" value="notiz" />
            <textarea name="notiz" defaultValue={k.meta?.notiz ?? ""} className="field-textarea" title="Nur intern sichtbar" />
            <button type="submit" className="lfa-knopf lfa-knopf-klein" style={{ marginTop: "0.5rem" }} title="Notiz zu diesem Paar speichern">
              Notiz speichern
            </button>
          </form>
        </details>
      </div>
    </article>
  );
}

export default async function MatchingPage(props: PageProps<"/admin/matching">) {
  const { email } = await requireAdmin();
  const sp = await props.searchParams;
  const nur = typeof sp.anfrage === "string" ? sp.anfrage : "";
  const [{ leads, zustand }, portal, neu, basis] = await Promise.all([ladeVerwaltung(), ladePortal(), ladeNeu(email), basisUrl()]);
  const { kandidaten, ohneOrt } = findeKandidaten(leads, zustand);
  const auswahl = nur ? kandidaten.filter((k) => k.angebot.id === nur || k.gesuch.id === nur) : kandidaten;
  const nurLead = nur ? leads.find((l) => l.id === nur) : undefined;
  const zurueck = "/admin/matching";
  const bewertungsUrl = M.bewertungsUrl(portal.einstellungen, process.env.GOOGLE_REVIEW_URL);

  const gruppen: { titel: string; tipp: string; paare: Kandidat[]; zu?: boolean }[] = [
    { titel: "In Arbeit", tipp: "Vorgemerkte und angefragte Paare — Hinweise, Einladungen, Zustimmungen, Freigabe", paare: auswahl.filter((k) => k.meta?.status === "vorgemerkt" || k.meta?.status === "angefragt") },
    { titel: "Neue Vorschläge", tipp: "Automatisch gefunden, noch nicht bearbeitet — beste zuerst", paare: auswahl.filter((k) => !k.meta || k.meta.status === "vorschlag") },
    { titel: "Freigegeben und abgeschlossen", tipp: "Kontaktdaten freigegeben bzw. Vertrag geschlossen — Details im Vorgang", paare: auswahl.filter((k) => k.meta?.status === "kontakt" || k.meta?.status === "abschluss") },
    { titel: "Verworfen", tipp: "Passt nicht oder abgesagt", paare: auswahl.filter((k) => k.meta?.status === "verworfen"), zu: true },
  ];
  const angebote = leads.filter((l) => l.rolle === "angebot" && l.status !== "archiv" && l.status !== "erledigt").length;
  const gesuche = leads.filter((l) => l.rolle === "gesuch" && l.status !== "archiv" && l.status !== "erledigt").length;
  const gesehenKeys = auswahl.filter((k) => !k.meta && neu.vorschlag(k.key)).map((k) => `paar:${k.key}`);

  return (
    <>
      <GesehenMarker keys={gesehenKeys} />
      <div className="lfa-titelzeile">
        <div>
          <h1 className="lfa-h1">Matching</h1>
          <p className="lfa-unterzeile">
            {angebote} {angebote === 1 ? "aktives Angebot" : "aktive Angebote"} und {gesuche} {gesuche === 1 ? "Gesuch" : "Gesuche"}. Gepaart wird nur bei gleicher Art (Kauf/Pacht), passendem Flächentyp und Ort in Reichweite.
            Kontaktdaten erst freigeben, wenn beide Seiten unterschrieben und dem Kontakt zugestimmt haben.
          </p>
        </div>
      </div>
      <Meldung sp={sp} />

      {nurLead && (
        <p className="lfa-hinweis lfa-hinweis-ok">
          Gefiltert auf {nurLead.name} ({nurLead.id}).{" "}
          <Link href="/admin/matching" title="Alle Paare anzeigen" style={{ textDecoration: "underline" }}>Filter aufheben</Link>
        </p>
      )}

      {ohneOrt.length > 0 && (
        <div className="lfa-hinweis">
          <p style={{ marginBottom: "0.5rem" }}>
            {ohneOrt.length} {ohneOrt.length === 1 ? "Anfrage hat" : "Anfragen haben"} noch keinen aufgelösten Ort und {ohneOrt.length === 1 ? "kann" : "können"} deshalb nicht gepaart werden:{" "}
            {ohneOrt.slice(0, 8).map((l, i) => (
              <span key={l.id}>
                {i > 0 ? ", " : ""}
                <Link href={`/admin/anfrage/${l.id}`} title="Anfrage öffnen und den Ort fürs Matching prüfen" style={{ textDecoration: "underline" }}>{l.name}</Link>
              </span>
            ))}
            {ohneOrt.length > 8 ? " …" : ""}
          </p>
          <OrteKnopf />
        </div>
      )}

      {gruppen.map((g) =>
        g.paare.length === 0 ? null : g.zu ? (
          <details key={g.titel} className="lfa-details" style={{ marginTop: "1.25rem" }}>
            <summary title={g.tipp}>{g.titel} ({g.paare.length})</summary>
            {g.paare.map((k) => <PaarKarte key={k.key} k={k} zustand={zustand} portal={portal} neu={neu} basis={basis} zurueck={zurueck} bewertungsUrl={bewertungsUrl} />)}
          </details>
        ) : (
          <section key={g.titel} style={{ marginTop: "1.25rem" }}>
            <h2 className="lfa-h2" title={g.tipp}>
              <Puls an={g.titel === "Neue Vorschläge" && g.paare.some((k) => !k.meta && neu.vorschlag(k.key))} tipp="Neue Vorschläge seit Ihrem letzten Besuch" />
              {g.titel} ({g.paare.length})
            </h2>
            {g.paare.map((k) => <PaarKarte key={k.key} k={k} zustand={zustand} portal={portal} neu={neu} basis={basis} zurueck={zurueck} bewertungsUrl={bewertungsUrl} />)}
          </section>
        ),
      )}

      {auswahl.length === 0 && (
        <div className="lfa-panel lfa-leer">
          Noch keine passenden Paare. Sobald ein Gesuch und ein Angebot zusammenpassen, erscheinen sie hier.
          {gesuche === 0 && " Bisher gibt es kein aktives Gesuch — Gesuche kommen über das Anliegen „Fläche gesucht“ im Formular oder lassen sich in einer Anfrage als Gesuch einordnen."}
        </div>
      )}
    </>
  );
}
