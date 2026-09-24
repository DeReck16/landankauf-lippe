import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/session";
import { ladeVerwaltung } from "@/lib/admin/daten";
import { findeKandidaten, grobeLage, type Kandidat } from "@/lib/admin/matching";
import { LEAD_STATUS, MATCH_STATUS, formatGroesse, type LeadView, type Zustand } from "@/lib/admin/model";
import { artLabel, datum } from "@/lib/admin/format";
import { hinweisAnAnbieter, hinweisAnSuchenden } from "@/lib/admin/texte";
import { paarAktion } from "../../actions";
import KopierText from "./KopierText";
import OrteKnopf from "./OrteKnopf";

export const metadata: Metadata = { title: "Matching" };

function Seite({ lead, titel }: { lead: LeadView; titel: string }) {
  return (
    <div className="lfa-paar-seite">
      <div className="lfa-klein" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>{titel}</div>
      <Link href={`/admin/anfrage/${lead.id}`} className="lfa-link-name" title="Anfrage öffnen: alle Angaben, Kontakt, Matching-Angaben korrigieren">
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

function Zustimmung({ k, seite }: { k: Kandidat; seite: "anbieter" | "suchender" }) {
  const am = seite === "anbieter" ? k.meta?.zustimmungAnbieter : k.meta?.zustimmungSuchender;
  const w =
    seite === "anbieter"
      ? { nom: "Anbieter", art: "Der Anbieter", gen: "des Anbieters" }
      : { nom: "Suchender", art: "Der Suchende", gen: "des Suchenden" };
  return (
    <form action={paarAktion} className="lfa-zustimmung">
      <input type="hidden" name="key" value={k.key} />
      <input type="hidden" name="aktion" value={`zustimmung_${seite}`} />
      <button
        type="submit"
        className={`lfa-knopf lfa-knopf-klein ${am ? "" : "lfa-knopf-hell"}`}
        title={
          am
            ? `${w.art} hat am ${datum(am)} zugestimmt. Klick nimmt die Zustimmung wieder zurück.`
            : `Klicken, sobald ${w.art.toLowerCase()} zugestimmt hat, dass die Kontaktdaten weitergegeben werden (das Datum wird festgehalten).`
        }
      >
        {am ? `✓ ${w.nom} hat zugestimmt (${datum(am)})` : `Zustimmung ${w.gen} erfassen`}
      </button>
    </form>
  );
}

function PaarKarte({ k, zustand }: { k: Kandidat; zustand: Zustand }) {
  const status = k.meta?.status ?? "vorschlag";
  const beideZugestimmt = Boolean(k.meta?.zustimmungAnbieter && k.meta?.zustimmungSuchender);
  const lageAngebot = grobeLage(k.angebot, zustand.orte);
  const lageGesuch = grobeLage(k.gesuch, zustand.orte);

  return (
    <article className="lfa-paar" id={k.key}>
      <Seite lead={k.angebot} titel="Angebot" />
      <div className="lfa-paar-mitte" title="Punktzahl aus Entfernung (45 %), Flächentyp (35 %) und Größe (20 %)">
        <span className="lfa-score">{k.score != null ? `${k.score} %` : "—"}</span>
        <span className="lfa-scorebalken"><span style={{ width: `${k.score ?? 0}%` }} /></span>
        {k.distanzKm != null && <span className="lfa-klein">{k.distanzKm} km</span>}
        <span className="lfa-badge lfa-badge-keine" title={MATCH_STATUS[status].tipp}>{MATCH_STATUS[status].label}</span>
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

        <div className="lfa-knopfreihe">
          {status === "vorschlag" && (
            <>
              <AktionsKnopf k={k} aktion="vormerken" text="Vormerken" tipp="Paar passt — vormerken, um beiden Seiten einen anonymen Hinweis zu schicken" />
              <AktionsKnopf k={k} aktion="verwerfen" text="Passt nicht" leise tipp="Paar verwerfen — wird nicht mehr vorgeschlagen (lässt sich unten unter „Verworfen“ zurückholen)" />
            </>
          )}
          {status === "vorgemerkt" && (
            <>
              <AktionsKnopf k={k} aktion="angefragt" text="Beide anonym angefragt" tipp="Klicken, nachdem beide Seiten den anonymen Hinweis (Texte unten) per Mail oder Telefon bekommen haben" />
              <AktionsKnopf k={k} aktion="verwerfen" text="Passt nicht" leise tipp="Paar verwerfen — wird nicht mehr vorgeschlagen" />
              <AktionsKnopf k={k} aktion="zuruecksetzen" text="Zurücksetzen" leise tipp="Zurück zum unbearbeiteten Vorschlag; Zustimmungen und Notiz werden gelöscht" />
            </>
          )}
          {status === "angefragt" && (
            <>
              <Zustimmung k={k} seite="anbieter" />
              <Zustimmung k={k} seite="suchender" />
              <AktionsKnopf
                k={k}
                aktion="kontakt"
                text="Kontakt hergestellt"
                disabled={!beideZugestimmt}
                tipp={
                  beideZugestimmt
                    ? "Beide haben zugestimmt — klicken, nachdem die Kontaktdaten ausgetauscht wurden"
                    : "Erst möglich, wenn Anbieter UND Suchender zugestimmt haben — vorher keine Kontaktdaten weitergeben"
                }
              />
              <AktionsKnopf k={k} aktion="verwerfen" text="Abgesagt" leise tipp="Eine Seite hat abgelehnt oder kein Interesse — Paar verwerfen" />
            </>
          )}
          {status === "kontakt" && (
            <>
              <span className="lfa-klein">
                Zugestimmt: Anbieter am {datum(k.meta?.zustimmungAnbieter ?? "")}, Suchender am {datum(k.meta?.zustimmungSuchender ?? "")}
              </span>
              <AktionsKnopf k={k} aktion="zuruecksetzen" text="Zurücksetzen" leise tipp="Paar komplett zurücksetzen (Zustimmungen und Notiz werden gelöscht)" />
            </>
          )}
          {status === "verworfen" && (
            <AktionsKnopf k={k} aktion="zuruecksetzen" text="Wieder vorschlagen" leise tipp="Verwerfen rückgängig machen — das Paar erscheint wieder als Vorschlag" />
          )}
        </div>

        {status !== "verworfen" && (
          <details className="lfa-details" open={status === "vorgemerkt"}>
            <summary title="Vorschläge für die anonymen Hinweise an beide Seiten — ohne Namen, Kontaktdaten und Flurstück">
              Anonyme Hinweistexte
            </summary>
            <div className="lfa-texte">
              <KopierText
                titel={`An ${k.gesuch.name} (Suchender)`}
                text={hinweisAnSuchenden(k.angebot, k.gesuch, lageAngebot)}
                tipp="Kopiert den Text für den Suchenden in die Zwischenablage — zum Einfügen in die Antwort-Mail"
              />
              <KopierText
                titel={`An ${k.angebot.name} (Anbieter)`}
                text={hinweisAnAnbieter(k.angebot, k.gesuch, lageGesuch)}
                tipp="Kopiert den Text für den Anbieter in die Zwischenablage — zum Einfügen in die Antwort-Mail"
              />
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
  await requireAdmin();
  const sp = await props.searchParams;
  const nur = typeof sp.anfrage === "string" ? sp.anfrage : "";
  const { leads, zustand } = await ladeVerwaltung();
  const { kandidaten, ohneOrt } = findeKandidaten(leads, zustand);
  const auswahl = nur ? kandidaten.filter((k) => k.angebot.id === nur || k.gesuch.id === nur) : kandidaten;
  const nurLead = nur ? leads.find((l) => l.id === nur) : undefined;

  const gruppen: { titel: string; tipp: string; paare: Kandidat[]; zu?: boolean }[] = [
    { titel: "In Arbeit", tipp: "Vorgemerkte und angefragte Paare", paare: auswahl.filter((k) => k.meta?.status === "vorgemerkt" || k.meta?.status === "angefragt") },
    { titel: "Neue Vorschläge", tipp: "Automatisch gefunden, noch nicht angesehen — beste zuerst", paare: auswahl.filter((k) => !k.meta || k.meta.status === "vorschlag") },
    { titel: "Kontakt hergestellt", tipp: "Beide Seiten haben zugestimmt und wurden verbunden", paare: auswahl.filter((k) => k.meta?.status === "kontakt") },
    { titel: "Verworfen", tipp: "Passt nicht oder abgesagt", paare: auswahl.filter((k) => k.meta?.status === "verworfen"), zu: true },
  ];
  const angebote = leads.filter((l) => l.rolle === "angebot" && l.status !== "archiv" && l.status !== "erledigt").length;
  const gesuche = leads.filter((l) => l.rolle === "gesuch" && l.status !== "archiv" && l.status !== "erledigt").length;

  return (
    <>
      <div className="lfa-titelzeile">
        <div>
          <h1 className="lfa-h1">Matching</h1>
          <p className="lfa-unterzeile">
            {angebote} {angebote === 1 ? "aktives Angebot" : "aktive Angebote"} und {gesuche} {gesuche === 1 ? "Gesuch" : "Gesuche"}. Gepaart wird nur bei gleicher Art (Kauf/Pacht), passendem Flächentyp und Ort in Reichweite.
            Kontaktdaten erst weitergeben, wenn beide Seiten zugestimmt haben.
          </p>
        </div>
      </div>

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
            {g.paare.map((k) => <PaarKarte key={k.key} k={k} zustand={zustand} />)}
          </details>
        ) : (
          <section key={g.titel} style={{ marginTop: "1.25rem" }}>
            <h2 className="lfa-h2" title={g.tipp}>{g.titel} ({g.paare.length})</h2>
            {g.paare.map((k) => <PaarKarte key={k.key} k={k} zustand={zustand} />)}
          </section>
        ),
      )}

      {auswahl.length === 0 && (
        <div className="lfa-panel lfa-leer">
          Noch keine passenden Paare. Sobald ein Gesuch und ein Angebot zusammenpassen, erscheinen sie hier.
          {gesuche === 0 && " Bisher gibt es kein aktives Gesuch — Gesuche kommen über das neue Anliegen „Fläche gesucht“ im Formular oder lassen sich in einer Anfrage als Gesuch einordnen."}
        </div>
      )}
    </>
  );
}
