"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { EinstellErgebnis, FlaechenZeile } from "@/lib/portal/eigene-flaechen";
import { flaechenEinstellenAktion, flaechenPruefenAktion } from "../../flaechen-actions";

// „Flächen einstellen“: Flurstücke zeilenweise eingeben → im Kataster NRW prüfen (Größe,
// Nutzung, grobe Lage, Bodenrichtwert) → je Fläche Typ und öffentlichen Text prüfen →
// alle ausgewählten einzeln und anonym veröffentlichen (mit Rückfrage in der Zeile).

const ha = (x: number | null) => (x == null ? "—" : `${x.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`);

type Auswahl = { an: boolean; typ: string; text: string };

export default function FlaechenEinstellen({
  typen,
  standardEmail,
  vorbelegt,
}: {
  typen: readonly string[];
  standardEmail: string;
  /** Vorbelegung aus dem Link (leer = Standard). */
  vorbelegt: { zeilen: string; eigentuemer: string; text: string; typ: string; art: "pacht" | "kauf" };
}) {
  const [zeilen, setZeilen] = useState(vorbelegt.zeilen);
  const [art, setArt] = useState<"pacht" | "kauf">(vorbelegt.art);
  const [eigentuemer, setEigentuemer] = useState(vorbelegt.eigentuemer || "Dennis Reckling (privat)");
  const [email, setEmail] = useState(standardEmail);
  const [standardTyp, setStandardTyp] = useState(typen.includes(vorbelegt.typ) ? vorbelegt.typ : "Wiese / Grünland");
  const [text, setText] = useState(vorbelegt.text);
  const [vorschau, setVorschau] = useState<FlaechenZeile[] | null>(null);
  const [auswahl, setAuswahl] = useState<Auswahl[]>([]);
  const [fragen, setFragen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnisse, setErgebnisse] = useState<EinstellErgebnis[] | null>(null);
  const [pending, starten] = useTransition();
  const gewaehlt = vorschau ? vorschau.map((z, i) => ({ z, a: auswahl[i] })).filter((x) => x.a?.an && !x.z.fehler) : [];

  function pruefen() {
    setFehler(null);
    setErgebnisse(null);
    setFragen(false);
    starten(async () => {
      const fd = new FormData();
      fd.set("zeilen", zeilen);
      fd.set("text", text);
      fd.set("typ", standardTyp);
      const r = await flaechenPruefenAktion(fd);
      if ("fehler" in r) {
        setFehler(r.fehler);
        return;
      }
      setVorschau(r.zeilen);
      setAuswahl(r.zeilen.map((z) => ({ an: !z.fehler, typ: z.typ, text: z.text })));
    });
  }

  function einstellen() {
    setFehler(null);
    starten(async () => {
      const fd = new FormData();
      fd.set("art", art);
      fd.set("eigentuemer", eigentuemer);
      fd.set("email", email);
      fd.set("eintraege", JSON.stringify(gewaehlt.map((x) => ({ zeile: x.z.zeile, typ: x.a.typ, text: x.a.text }))));
      const r = await flaechenEinstellenAktion(fd);
      setFragen(false);
      if ("fehler" in r) {
        setFehler(r.fehler);
        return;
      }
      setErgebnisse(r.ergebnisse);
      if (r.ergebnisse.some((e) => e.ok)) setVorschau(null);
    });
  }

  function setze(i: number, teil: Partial<Auswahl>) {
    setAuswahl((alt) => alt.map((a, j) => (j === i ? { ...a, ...teil } : a)));
  }

  return (
    <div className="lfa-flaechen">
      {ergebnisse && (
        <div className={`lfa-hinweis ${ergebnisse.every((e) => e.ok) ? "lfa-hinweis-ok" : "lfa-hinweis-fehler"}`} role="status">
          <strong>{ergebnisse.filter((e) => e.ok).length} von {ergebnisse.length} Flächen eingestellt und anonym veröffentlicht.</strong>
          <ul className="lfa-assistent-zeilen">
            {ergebnisse.map((e) => (
              <li key={e.zeile} className={e.ok ? "lfa-assistent-zeile-ok" : "lfa-assistent-zeile-fehler"}>
                {e.ok ? (
                  <>
                    {e.eckdaten} →{" "}
                    <a href={`/flaechenboerse/${e.code}`} target="_blank" rel="noopener" title="Öffentliche Angebotsseite in neuem Tab öffnen">
                      {e.code}
                    </a>{" "}
                    ·{" "}
                    <Link href={`/admin/anfrage/${e.id}#boerse`} title="Anfrage öffnen: Börsenangaben ändern oder offline nehmen">
                      Anfrage
                    </Link>
                  </>
                ) : (
                  <>
                    {e.zeile}: {e.fehler}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {fehler && (
        <p className="lfa-hinweis lfa-hinweis-fehler" role="alert">
          {fehler}
        </p>
      )}

      <section className="lfa-panel">
        <h2 className="lfa-h2">1. Flächen eingeben</h2>
        <div className="lfa-formraster">
          <label className="lfa-breit">
            <span className="field-label">Flurstücke — eine Fläche je Zeile</span>
            <textarea
              value={zeilen}
              onChange={(e) => setZeilen(e.target.value)}
              disabled={pending}
              className="field-textarea"
              style={{ minHeight: "8rem", fontFamily: "ui-monospace, monospace", fontSize: "0.85rem" }}
              placeholder={"Leopoldstal, Flur 3, Flurstück 416\nHorn, Flur 9, Flurstück 113 | eigener Text nur für diese Fläche"}
              title="Je Zeile: Gemarkung oder Gemeinde, Flur und Flurstück. Nach „|“ optional ein eigener öffentlicher Text für diese Fläche."
            />
          </label>
          <fieldset className="lfa-breit" style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="field-label">Angeboten wird</legend>
            <label style={{ marginRight: "1.2rem" }} title="Die Flächen erscheinen als „Zur Pacht“">
              <input type="radio" name="art" checked={art === "pacht"} onChange={() => setArt("pacht")} disabled={pending} /> zur Pacht
            </label>
            <label title="Die Flächen erscheinen als „Zum Kauf“">
              <input type="radio" name="art" checked={art === "kauf"} onChange={() => setArt("kauf")} disabled={pending} /> zum Kauf
            </label>
          </fieldset>
          <label>
            <span className="field-label">Eigentümer (nur intern)</span>
            <input value={eigentuemer} onChange={(e) => setEigentuemer(e.target.value)} disabled={pending} className="field-input" title="Steht nur in der Verwaltung — nie in der Börse" />
          </label>
          <label>
            <span className="field-label">E-Mail des Eigentümers (für den Ablauf)</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} disabled={pending} className="field-input" title="An diese Adresse geht später die Einladung zur (kostenlosen) Vereinbarung für Anbieter — nie öffentlich" />
          </label>
          <label>
            <span className="field-label">Flächentyp bei „Landwirtschaft“</span>
            <select value={standardTyp} onChange={(e) => setStandardTyp(e.target.value)} disabled={pending} className="field-select" title="Das Kataster unterscheidet Acker und Grünland nicht — dieser Typ wird vorgeschlagen (je Fläche änderbar)">
              {typen.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="lfa-breit">
            <span className="field-label">Öffentlicher Text für alle (je Fläche änderbar)</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={pending}
              maxLength={400}
              className="field-textarea"
              style={{ minHeight: "4rem" }}
              placeholder="z. B. Extensiv genutzte Mähwiese in ruhiger Lage am Eggegebirge."
              title="Erscheint anonym auf der Angebotskarte — keine Namen, Flurstücke, Straßen oder Telefonnummern"
            />
          </label>
          <div className="lfa-breit">
            <button type="button" className="lfa-knopf" disabled={pending || !zeilen.trim()} onClick={pruefen} title="Sucht jede Zeile im Kataster NRW (dauert ein paar Sekunden) — es wird noch nichts veröffentlicht">
              {pending && !vorschau ? "Kataster wird abgefragt …" : "Im Kataster prüfen"}
            </button>
          </div>
        </div>
      </section>

      {vorschau && (
        <section className="lfa-panel">
          <h2 className="lfa-h2">2. Prüfen und veröffentlichen</h2>
          <p className="lfa-klein" style={{ marginTop: 0 }}>
            Öffentlich sichtbar sind nur Art, Typ, Größe, grobe Lage und Text — nie Eigentümer, Flurstück oder Straße. Jede Fläche wird ein eigenes Angebot.
          </p>
          <ul className="lfa-flaechen-liste">
            {vorschau.map((z, i) => {
              const a = auswahl[i];
              return (
                <li key={z.zeile} className={`lfa-flaechen-zeile ${z.fehler ? "lfa-flaechen-fehler" : ""}`}>
                  <label className="lfa-flaechen-wahl" title={z.fehler ? "Nicht gefunden — Zeile korrigieren und neu prüfen" : a?.an ? "Häkchen entfernen: diese Fläche nicht einstellen" : "Häkchen setzen: diese Fläche einstellen"}>
                    <input type="checkbox" checked={Boolean(a?.an) && !z.fehler} disabled={pending || Boolean(z.fehler)} onChange={() => setze(i, { an: !a?.an })} />
                    <span>
                      <strong>{z.zeile.split("|")[0]}</strong>
                      {z.fs ? (
                        <span className="lfa-klein">
                          {" "}
                          — amtlich {z.fs.gemarkung}, Flur {z.fs.flur}, Flurstück {z.fs.nummer} · {z.fs.flaecheM2.toLocaleString("de-DE")} m² · {z.fs.nutzung}
                          {z.fs.lage ? ` · „${z.fs.lage}“` : ""}
                          {z.brw ? ` · Bodenrichtwert ${z.brw.wert.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €/m²` : ""}
                        </span>
                      ) : (
                        <span className="lfa-klein lfa-dash-warnung"> — {z.fehler}</span>
                      )}
                    </span>
                  </label>
                  {z.fs && a && (
                    <div className="lfa-flaechen-karte" title="So erscheint die Fläche anonym in der Flächenbörse">
                      <span className="lfa-klein">
                        {art === "pacht" ? "Zur Pacht" : "Zum Kauf"} · {ha(z.groesseHa)} · {z.lage}
                      </span>
                      <select value={a.typ} onChange={(e) => setze(i, { typ: e.target.value })} disabled={pending} className="field-select" title="Flächentyp in der Börse">
                        {typen.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <input value={a.text} onChange={(e) => setze(i, { text: e.target.value })} disabled={pending} maxLength={400} className="field-input" placeholder="Öffentlicher Text (optional)" title="Öffentlicher Text dieser Fläche — keine Namen, Flurstücke oder Straßen" />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {fragen ? (
            <div className="lfa-assistent-frage" role="alertdialog" aria-label="Sicherheitsabfrage">
              <strong>
                {gewaehlt.length} {gewaehlt.length === 1 ? "Fläche" : "Flächen"} jetzt einzeln und anonym {art === "pacht" ? "zur Pacht" : "zum Kauf"} veröffentlichen?
              </strong>
              <ul className="lfa-assistent-liste">
                <li>Je Fläche eine eigene Anfrage (Angebot) mit erfasster Einwilligung — Eigentümer „{eigentuemer}“ steht nur intern.</li>
                <li>Die Angebote erscheinen sofort auf lippeforst.de (Startseite und Flächenbörse) mit der üblichen Provision für Suchende; offline nehmen jederzeit in der Anfrage.</li>
                <li>Es geht keine E-Mail raus.</li>
              </ul>
              <div className="lfa-knopfreihe">
                <button type="button" className="lfa-knopf" disabled={pending} onClick={einstellen} title="Legt die Angebote an und veröffentlicht sie">
                  {pending ? "Wird eingestellt … (Kataster wird erneut geprüft)" : `Ja – ${gewaehlt.length} veröffentlichen`}
                </button>
                <button type="button" className="lfa-knopf lfa-knopf-leise" disabled={pending} onClick={() => setFragen(false)} title="Nichts veröffentlichen, zurück">
                  Nein, zurück
                </button>
              </div>
            </div>
          ) : (
            <div className="lfa-knopfreihe">
              <button type="button" className="lfa-knopf" disabled={pending || gewaehlt.length === 0} onClick={() => setFragen(true)} title="Fragt noch einmal nach — erst dann wird veröffentlicht">
                {gewaehlt.length} {gewaehlt.length === 1 ? "Fläche" : "Flächen"} einzeln veröffentlichen
              </button>
              <button type="button" className="lfa-link-knopf" disabled={pending} onClick={pruefen} title="Kataster erneut abfragen (z. B. nach Korrektur einer Zeile)">
                Neu prüfen
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
