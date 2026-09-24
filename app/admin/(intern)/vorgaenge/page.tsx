import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/session";
import { ladeVerwaltung } from "@/lib/admin/daten";
import { MATCH_STATUS, type LeadView } from "@/lib/admin/model";
import { datumZeit } from "@/lib/admin/format";
import { ladeNeu, ladePortal } from "@/lib/admin/neu";
import { vorgangSchritte } from "@/lib/portal/schritte";
import { SchrittKurz } from "../Schritte";
import * as M from "@/lib/portal/model";
import { datumDe, tagDe } from "@/lib/portal/texte";
import { bewertungFaellig } from "@/lib/portal/vorgang";
import { alleGesehenAktion } from "../../portal-actions";
import { Meldung } from "../teile";

export const metadata: Metadata = { title: "Vorgänge" };

function stufeBadge(k: M.KundeRecord | null | undefined, rolle: M.Rolle) {
  const s = M.stufe(k);
  const farbe = s === "unterschrieben" ? "lfa-badge-ok" : s === "widerrufen" || s === "gesperrt" || s === "gekuendigt" ? "lfa-badge-rot" : s === "neu" ? "lfa-badge-keine" : "lfa-badge-warn";
  return (
    <span className={`lfa-badge ${farbe}`} title={`${M.ROLLE_NAME[rolle]}: ${M.STUFE_INFO[s].tipp}`}>
      {M.STUFE_INFO[s].label}
    </span>
  );
}

export default async function VorgaengePage(props: PageProps<"/admin/vorgaenge">) {
  const { email } = await requireAdmin();
  const sp = await props.searchParams;
  const [{ leads, zustand }, portal, neu] = await Promise.all([ladeVerwaltung(), ladePortal(), ladeNeu(email)]);
  const byId = new Map<string, LeadView>(leads.map((l) => [l.id, l]));
  const name = (id: string) => portal.kunden.get(id)?.stammdaten?.name || byId.get(id)?.name || id;
  const bewertungsUrl = M.bewertungsUrl(portal.einstellungen, process.env.GOOGLE_REVIEW_URL);

  // Alle Paare, die über den Vorschlag hinaus sind, plus Vorgangsakten.
  const keys = new Set<string>([
    ...Object.entries(zustand.paare).filter(([, m]) => m.status !== "vorschlag").map(([k]) => k),
    ...portal.vorgaenge.keys(),
  ]);
  const vorgaenge = [...keys]
    .map((key) => ({ key, meta: zustand.paare[key] ?? null, v: portal.vorgaenge.get(key) ?? null, a: portal.kunden.get(key.split("~")[0]) ?? null, s: portal.kunden.get(key.split("~")[1]) ?? null }))
    .filter((x) => byId.has(x.key.split("~")[0]) && byId.has(x.key.split("~")[1]))
    .sort((x, y) => (y.v?.ereignisse[0]?.am ?? y.meta?.geaendert?.am ?? "").localeCompare(x.v?.ereignisse[0]?.am ?? x.meta?.geaendert?.am ?? ""));

  const kunden = [...portal.kunden.values()].sort((a, b) => (b.ereignisse[0]?.am ?? b.angelegtAm).localeCompare(a.ereignisse[0]?.am ?? a.angelegtAm));
  const provisionen = [...portal.vorgaenge.values()].flatMap((v) => v.provisionen.map((p) => ({ v, p })));
  const summe = (st: M.ProvisionStatus[]) => provisionen.filter((x) => st.includes(x.p.status)).reduce((a, x) => a + (M.provisionNachGutschein(x.p).netto ?? 0), 0);
  const gutscheine = [...portal.vorgaenge.values()].filter((v) => v.gutschein).map((v) => ({ v, g: v.gutschein! }));

  const neuKunden = kunden.map((k) => ({ k, e: neu.kunde(k) })).filter((x) => x.e.length);
  const neuVorgaenge = [...portal.vorgaenge.values()].map((v) => ({ v, e: neu.vorgang(v) })).filter((x) => x.e.length);
  const alleNeuKeys = [...neuKunden.map((x) => `kunde:${x.k.id}`), ...neuVorgaenge.map((x) => `vorgang:${x.v.key}`)];

  const faellig: { text: string; href: string; tipp: string }[] = [];
  for (const x of vorgaenge) {
    if (!x.v) continue;
    const widerrufen = (x.a?.widerruf || x.s?.widerruf) && !x.v.abschluss;
    if (M.aktiveFreigabe(x.v) && widerrufen) faellig.push({ text: `Widerruf nach Freigabe — Freigabe zurückziehen: ${name(x.v.angebotId)} ↔ ${name(x.v.gesuchId)}`, href: `/admin/vorgang/${x.key}`, tipp: "Eine Seite hat ihren Vertrag widerrufen; der Kundenbereich zeigt die Kontaktdaten schon nicht mehr an" });
    else if (M.aktiveFreigabe(x.v) && !x.v.abschluss && !x.v.mails.some((m) => m.zweck === "freigabe" && m.ok)) faellig.push({ text: `Freigabe-Mitteilungen senden: ${name(x.v.angebotId)} ↔ ${name(x.v.gesuchId)}`, href: `/admin/vorgang/${x.key}#assistent`, tipp: "Die Kontaktdaten sind freigegeben, aber noch keine Mitteilung ist rausgegangen — im Vorgang über den Assistenten senden" });
    if (x.v.pachtvertrag?.status === "zur_unterschrift") faellig.push({ text: `Pachtvertrag wartet auf Unterschrift: ${name(x.v.angebotId)} ↔ ${name(x.v.gesuchId)}`, href: `/admin/vorgang/${x.key}#pachtvertrag`, tipp: "Beide Seiten müssen im Kundenbereich unterschreiben" });
    if (x.v.pachtvertrag?.status === "abgeschlossen" && !x.v.pachtvertrag.anzeigeErledigtAm) faellig.push({ text: `Pachtanzeige (§ 2 LPachtVG) nicht als erledigt vermerkt: ${x.key}`, href: `/admin/vorgang/${x.key}#pachtvertrag`, tipp: "Der Verpächter muss binnen eines Monats anzeigen — Erinnerungsentwurf im Vorgang" });
    if (bewertungsUrl && bewertungFaellig(x.v, portal.einstellungen).length) faellig.push({ text: `Bitte um Google-Bewertung fällig: ${name(x.v.angebotId)} ↔ ${name(x.v.gesuchId)}`, href: `/admin/vorgang/${x.key}#weitere`, tipp: "Entwurf ohne Anreiz — im Vorgang unter „Weitere Aktionen → Einzelne E-Mails“" });
  }

  const kacheln = [
    { wert: kunden.filter((k) => M.stufe(k) === "eingeladen" || M.stufe(k) === "geoeffnet" || M.stufe(k) === "angaben").length, name: "Onboarding offen", tipp: "Eingeladen, aber noch nicht unterschrieben" },
    { wert: kunden.filter((k) => M.stufe(k) === "unterschrieben").length, name: "Unterschrieben", tipp: "Kunden mit gültig unterschriebenem Vertrag" },
    { wert: [...portal.vorgaenge.values()].filter((v) => M.aktiveFreigabe(v)).length, name: "Freigaben", tipp: "Vorgänge mit freigegebenen Kontaktdaten" },
    { wert: [...portal.vorgaenge.values()].filter((v) => v.abschluss).length, name: "Abschlüsse", tipp: "Pacht-/Kaufverträge geschlossen (online oder erfasst)" },
    { wert: M.euro(summe(["faellig", "aufschiebend"])), name: "Provision offen (netto)", tipp: "Fällige und aufschiebend entstandene Provisionen, noch nicht abgerechnet" },
    { wert: M.euro(summe(["abgerechnet"])), name: "Abgerechnet (netto)", tipp: "Rechnung gestellt, Zahlung offen" },
    { wert: M.euro(summe(["bezahlt"])), name: "Bezahlt (netto)", tipp: "Bereits bezahlte Provisionen" },
  ];

  return (
    <>
      <div className="lfa-titelzeile">
        <div>
          <h1 className="lfa-h1">Vorgänge</h1>
          <p className="lfa-unterzeile">Onboarding, Freigaben, Verträge, Provisionen und Treue-Gutscheine — mit allem, was seit Ihrem letzten Besuch neu ist.</p>
        </div>
      </div>
      <Meldung sp={sp} />

      <div className="lfa-kacheln">
        {kacheln.map((k) => (
          <div key={k.name} className="lfa-kachel" title={k.tipp}>
            <div className="lfa-kachel-wert">{k.wert}</div>
            <div className="lfa-kachel-name">{k.name}</div>
          </div>
        ))}
      </div>

      {!bewertungsUrl && (
        <p className="lfa-hinweis" title="Ohne Bewertungslink wird Kunden keine Bitte um eine Bewertung angezeigt">
          Google-Profil anlegen, Bewertungslink hinterlegen — dann erscheint nach Abschlüssen die Bitte um eine Bewertung (Verwaltung → Vorlagen → Bewertungsbitte).
        </p>
      )}

      <section className="lfa-panel">
        <h2 className="lfa-h2">
          {alleNeuKeys.length > 0 && <span className="lfa-puls" />}Neu seit Ihrem letzten Besuch
        </h2>
        {alleNeuKeys.length === 0 ? (
          <p className="lfa-klein">Nichts Neues — alle Kundenereignisse sind gesehen.</p>
        ) : (
          <>
            <ul className="lfa-verlauf">
              {neuKunden.map(({ k, e }) => (
                <li key={k.id} className="lfa-verlauf-neu">
                  <Link href={`/admin/anfrage/${k.id}#kundenbereich`} className="lfa-link-name" title="Anfrage öffnen — die Ereignisse gelten dann als gesehen">
                    {name(k.id)}
                  </Link>{" "}
                  <span className="lfa-klein">({M.ROLLE_NAME[k.rolle]}, {k.id})</span>
                  {e.slice(0, 3).map((x) => (
                    <div key={x.id} className="lfa-klein">{datumZeit(x.am)} · {x.text}</div>
                  ))}
                  {e.length > 3 && <div className="lfa-klein">… und {e.length - 3 === 1 ? "ein weiterer Eintrag" : `${e.length - 3} weitere Einträge`}</div>}
                </li>
              ))}
              {neuVorgaenge.map(({ v, e }) => (
                <li key={v.key} className="lfa-verlauf-neu">
                  <Link href={`/admin/vorgang/${v.key}`} className="lfa-link-name" title="Vorgang öffnen — die Ereignisse gelten dann als gesehen">
                    {name(v.angebotId)} ↔ {name(v.gesuchId)}
                  </Link>
                  {e.slice(0, 3).map((x) => (
                    <div key={x.id} className="lfa-klein">{datumZeit(x.am)} · {x.text}</div>
                  ))}
                  {e.length > 3 && <div className="lfa-klein">… und {e.length - 3 === 1 ? "ein weiterer Eintrag" : `${e.length - 3} weitere Einträge`}</div>}
                </li>
              ))}
            </ul>
            <form action={alleGesehenAktion} style={{ marginTop: "0.6rem" }}>
              <input type="hidden" name="keys" value={alleNeuKeys.join(",")} />
              <input type="hidden" name="zurueck" value="/admin/vorgaenge" />
              <button type="submit" className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" title="Markiert alle hier gelisteten Ereignisse als gesehen — das Pulsieren hört auf">
                Alle als gesehen markieren
              </button>
            </form>
          </>
        )}
      </section>

      {faellig.length > 0 && (
        <section className="lfa-panel">
          <h2 className="lfa-h2"><span className="lfa-puls" />Jetzt dran</h2>
          <ul className="lfa-verlauf">
            {faellig.map((f) => (
              <li key={f.text}>
                <Link href={f.href} className="lfa-link-name" title={f.tipp}>{f.text}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ marginTop: "1.25rem" }}>
        <h2 className="lfa-h2" title="Alle Paare jenseits des bloßen Vorschlags">Vorgänge ({vorgaenge.length})</h2>
        {vorgaenge.length === 0 ? (
          <div className="lfa-panel lfa-leer">Noch keine Vorgänge. Im Matching ein Paar vormerken, dann erscheint es hier.</div>
        ) : (
          <table className="lfa-liste">
            <thead>
              <tr>
                <th title="Anbieter ↔ Suchender">Paar</th>
                <th title="Stand im Matching und Fortschritt in sieben Schritten">Status &amp; Fortschritt</th>
                <th title="Onboarding des Anbieters">Anbieter</th>
                <th title="Onboarding des Suchenden">Suchender</th>
                <th title="Pacht- oder Kaufvertrag">Vertrag</th>
                <th title="Provision (netto)">Provision</th>
              </tr>
            </thead>
            <tbody>
              {vorgaenge.map((x) => {
                const n = neu.vorgang(x.v).length;
                const p = x.v?.provisionen.find((q) => q.status !== "storniert");
                const vertrag = x.v?.pachtvertrag
                  ? { entwurf: "Pacht: Entwurf", zur_unterschrift: "Pacht: zur Unterschrift", abgeschlossen: "Pacht: geschlossen", verworfen: "Pacht: verworfen" }[x.v.pachtvertrag.status]
                  : x.v?.kauf
                    ? `Kauf: ${x.v.kauf.status.replace("_", " ")}`
                    : x.v?.externeVertraege.length
                      ? "extern erfasst"
                      : "—";
                return (
                  <tr key={x.key}>
                    <td data-label="Paar">
                      <Link href={`/admin/vorgang/${x.key}`} className="lfa-link-name" title="Vorgang öffnen">
                        {n > 0 && <span className="lfa-puls" />}
                        {name(x.key.split("~")[0])} ↔ {name(x.key.split("~")[1])}
                      </Link>
                      <div className="lfa-klein">{x.key}</div>
                    </td>
                    <td data-label="Status">
                      <span className="lfa-badge lfa-badge-keine" title={MATCH_STATUS[x.meta?.status ?? "vorschlag"].tipp}>{MATCH_STATUS[x.meta?.status ?? "vorschlag"].label}</span>
                      {(() => {
                        const sch = vorgangSchritte({ art: x.v?.art ?? (byId.get(x.key.split("~")[0])?.art === "kauf" ? "kauf" : "pacht"), meta: x.meta, vorgang: x.v, anbieter: x.a, suchender: x.s });
                        return <div style={{ marginTop: "0.3rem" }}><SchrittKurz schritte={sch.schritte} aktuell={sch.aktuell} verworfen={sch.verworfen} /></div>;
                      })()}
                    </td>
                    <td data-label="Anbieter">{stufeBadge(x.a, "anbieter")}</td>
                    <td data-label="Suchender">{stufeBadge(x.s, "suchender")}</td>
                    <td data-label="Vertrag">{vertrag}</td>
                    <td data-label="Provision">{p ? `${M.euro(M.provisionNachGutschein(p).netto)} · ${M.PROVISION_STATUS[p.status].label}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: "1.25rem" }}>
        <h2 className="lfa-h2" title="Alle Kunden mit Einladung oder Kundenakte">Kundenakten ({kunden.length})</h2>
        {kunden.length === 0 ? (
          <div className="lfa-panel lfa-leer">Noch keine Kundenakten — sie entstehen mit der ersten Einladung.</div>
        ) : (
          <table className="lfa-liste">
            <thead>
              <tr>
                <th title="Name und Anfrage">Kunde</th>
                <th title="Anbieter oder Suchender">Rolle</th>
                <th title="Stand des Onboardings">Stand</th>
                <th title="Unterschrift, Widerruf, Kündigung">Vertrag</th>
              </tr>
            </thead>
            <tbody>
              {kunden.map((k) => (
                <tr key={k.id}>
                  <td data-label="Kunde">
                    <Link href={`/admin/anfrage/${k.id}#kundenbereich`} className="lfa-link-name" title="Anfrage mit Kundenakte öffnen">
                      {neu.kunde(k).length > 0 && <span className="lfa-puls" />}
                      {name(k.id)}
                    </Link>
                    <div className="lfa-klein">{k.id} · {k.email}</div>
                  </td>
                  <td data-label="Rolle">{M.ROLLE_NAME[k.rolle]} · {k.art === "kauf" ? "Kauf" : "Pacht"}</td>
                  <td data-label="Stand">{stufeBadge(k, k.rolle)}</td>
                  <td data-label="Vertrag">
                    {k.vertrag ? `unterschrieben ${datumDe(k.vertrag.signatur.am)}` : "—"}
                    {k.widerruf ? ` · widerrufen ${datumDe(k.widerruf.am)}` : ""}
                    {k.kuendigung ? ` · gekündigt ${datumDe(k.kuendigung.am)}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: "1.25rem" }}>
        <h2 className="lfa-h2" title="Alle Provisionsansprüche — die Rechnung stellt die Buchhaltung">Provisionen ({provisionen.length})</h2>
        {provisionen.length === 0 ? (
          <div className="lfa-panel lfa-leer">Noch keine Provisionsansprüche.</div>
        ) : (
          <table className="lfa-liste">
            <thead>
              <tr>
                <th title="Vorgang">Vorgang</th>
                <th title="Grundlage und Datum">Grundlage</th>
                <th title="Netto und brutto nach Gutschein">Betrag</th>
                <th title="Stand">Status</th>
              </tr>
            </thead>
            <tbody>
              {provisionen.map(({ v, p }) => {
                const b = M.provisionNachGutschein(p);
                return (
                  <tr key={p.id}>
                    <td data-label="Vorgang">
                      <Link href={`/admin/vorgang/${v.key}#provision`} className="lfa-link-name" title="Provision im Vorgang bearbeiten">
                        {name(v.gesuchId)}
                      </Link>
                      <div className="lfa-klein">Schuldner: Suchender · {v.key}</div>
                    </td>
                    <td data-label="Grundlage">{p.grundlage === "pachtvertrag" ? "Pachtvertrag" : p.grundlage === "kaufvertrag" ? "Kaufvertrag" : "extern"} · {datumDe(p.entstandenAm)}</td>
                    <td data-label="Betrag">{M.euro(b.netto)} netto / {M.euro(b.brutto)} brutto</td>
                    <td data-label="Status"><span className="lfa-badge lfa-badge-warn" title={M.PROVISION_STATUS[p.status].tipp}>{M.PROVISION_STATUS[p.status].label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: "1.25rem" }}>
        <h2 className="lfa-h2" title="Treue-Gutscheine — unabhängig von Bewertungen, nur auf die nächste Provision anrechenbar">Treue-Gutscheine ({gutscheine.length})</h2>
        {gutscheine.length === 0 ? (
          <div className="lfa-panel lfa-leer">
            Noch keine Gutscheine. {portal.einstellungen.gutschein?.aktiv ? `Bei jedem Abschluss erhält der Provisionszahler einen Gutschein über ${M.euro(portal.einstellungen.gutschein.betrag)}.` : "Die Ausgabe ist ausgeschaltet (Vorlagen → Treue-Gutschein)."}
          </div>
        ) : (
          <table className="lfa-liste">
            <thead>
              <tr>
                <th title="Gutscheincode">Code</th>
                <th title="Inhaber (nicht übertragbar)">Kunde</th>
                <th title="Ausgabe und Gültigkeit">Ausgegeben</th>
                <th title="Offen, eingelöst oder storniert">Stand</th>
              </tr>
            </thead>
            <tbody>
              {gutscheine.map(({ v, g }) => (
                <tr key={g.code}>
                  <td data-label="Code"><strong>{g.code}</strong> · {M.euro(g.betrag)}</td>
                  <td data-label="Kunde">
                    <Link href={`/admin/vorgang/${v.key}#provision`} className="lfa-link-name" title="Vorgang öffnen, aus dem der Gutschein stammt">{name(g.kundeId)}</Link>
                  </td>
                  <td data-label="Ausgegeben">{datumDe(g.ausgegebenAm)} · gültig bis {tagDe(g.gueltigBis)}</td>
                  <td data-label="Stand">
                    {g.eingeloest ? (
                      <span className="lfa-badge lfa-badge-ok" title={`Eingelöst im Vorgang ${g.eingeloest.vorgang}`}>eingelöst {datumDe(g.eingeloest.am)}</span>
                    ) : g.storniert ? (
                      <span className="lfa-badge lfa-badge-keine" title={g.storniert.grund}>storniert</span>
                    ) : (
                      <span className="lfa-badge lfa-badge-warn" title="Noch nicht angerechnet">offen</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
