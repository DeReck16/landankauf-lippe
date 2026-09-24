import Link from "next/link";
import { datumZeit } from "@/lib/admin/format";
import AdresseAufraeumen from "./AdresseAufraeumen";
import * as M from "@/lib/portal/model";
import { datumDe } from "@/lib/portal/texte";

// Gemeinsame Bausteine der Verwaltungsseiten (Server-Komponenten).

/** Rückmeldung nach einer Aktion (?m=…&mt=ok|fehler). */
export function Meldung({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const m = typeof sp.m === "string" ? sp.m.slice(0, 400) : "";
  if (!m) return null;
  const fehler = sp.mt === "fehler";
  return (
    <p className={`lfa-hinweis ${fehler ? "lfa-hinweis-fehler" : "lfa-hinweis-ok"}`} role="status">
      {m}
      <AdresseAufraeumen />
    </p>
  );
}

export function Puls({ an, tipp }: { an: boolean; tipp?: string }) {
  return an ? <span className="lfa-puls" title={tipp ?? "Neu seit Ihrem letzten Besuch"} aria-label="neu" /> : null;
}

/** Stand des Onboardings einer Seite (Stufe, Verbraucher/Unternehmer, Widerruf, Bestätigung). */
export function KundenStand({ k, rolle, neu }: { k: M.KundeRecord | null; rolle: M.Rolle; neu?: number }) {
  const s = M.stufe(k);
  const info = M.STUFE_INFO[s];
  const farbe = s === "unterschrieben" ? "lfa-badge-ok" : s === "widerrufen" || s === "gesperrt" || s === "gekuendigt" ? "lfa-badge-rot" : s === "neu" ? "lfa-badge-keine" : "lfa-badge-warn";
  const fb = M.freigabeBereit(k);
  const v = k?.vertrag;
  return (
    <div className="lfa-seitenstatus">
      <div className="lfa-seitenstatus-zeile">
        <span className={`lfa-badge ${farbe}`} title={info.tipp}>
          {M.ROLLE_NAME[rolle]}: {info.label}
        </span>
        {v && (
          <span className="lfa-badge lfa-badge-keine" title="Wie der Kunde bei den Angaben gewählt hat (§ 13/§ 14 BGB)">
            {v.eigenschaft === "verbraucher" ? "Verbraucher" : "Unternehmer"}
          </span>
        )}
        {neu ? <span className="lfa-neu-text" title="Neue Ereignisse seit Ihrem letzten Besuch der Anfrage"><span className="lfa-puls" />{neu} neu</span> : null}
      </div>
      {v && (
        <div className="lfa-klein">
          Unterschrieben {datumZeit(v.signatur.am)} von „{v.signatur.name}“ · Vorlage {v.vorlageId} v{v.version}
          {v.konditionen ? ` · Konditionen Nr. ${v.konditionen.version}` : ""}
        </div>
      )}
      {v && M.hatWiderrufsrecht(k!) && (
        <div className="lfa-klein" title="Nur Suchende als Verbraucher haben ein Widerrufsrecht; vor der Freigabe muss die Frist abgelaufen sein oder der Kunde muss den Beginn ausdrücklich verlangt haben.">
          Widerrufsfrist bis {datumDe(v.widerrufsfristEnde)} · Beginnwunsch: {v.beginnwunschAm ? `ja (${datumDe(v.beginnwunschAm)})` : "nein"} · Bestätigung (PDF-Mail): {v.bestaetigungGesendetAm ? datumDe(v.bestaetigungGesendetAm) : "fehlt"}
        </div>
      )}
      {k && s === "unterschrieben" && !fb.bereit && <div className="lfa-klein" style={{ color: "#8a2a1d" }}>Noch nicht freigabebereit: {fb.grund}</div>}
    </div>
  );
}

function wer(von: string): string {
  if (von === "kunde") return "Kunde";
  if (von === "system") return "System";
  if (von === "cron") return "Automatik";
  if (von.startsWith("kunde:")) return "Kunde";
  return von;
}

/** Verlauf aus Ereignissen und gesendeten Mails (neueste zuerst). */
export function Verlauf({ ereignisse, mails, neuIds, max = 60 }: { ereignisse: M.Ereignis[]; mails: M.GesendeteMail[]; neuIds?: Set<string>; max?: number }) {
  type Zeile = { am: string; id: string; art: "e"; e: M.Ereignis } | { am: string; id: string; art: "m"; m: M.GesendeteMail };
  const zeilen: Zeile[] = [
    ...ereignisse.filter((e) => e.art !== "mail").map((e) => ({ am: e.am, id: e.id, art: "e" as const, e })),
    ...mails.map((m) => ({ am: m.am, id: m.id, art: "m" as const, m })),
  ]
    .sort((a, b) => b.am.localeCompare(a.am))
    .slice(0, max);
  if (zeilen.length === 0) return <p className="lfa-klein">Noch keine Einträge.</p>;
  return (
    <ul className="lfa-verlauf">
      {zeilen.map((z) =>
        z.art === "e" ? (
          <li key={z.id} className={neuIds?.has(z.id) ? "lfa-verlauf-neu" : undefined}>
            <span className="lfa-klein">
              {neuIds?.has(z.id) && <span className="lfa-puls" />}
              {datumZeit(z.am)} · {wer(z.e.von)}
            </span>
            <div>{z.e.text}</div>
          </li>
        ) : (
          <li key={z.id}>
            <span className="lfa-klein">
              {datumZeit(z.am)} · {wer(z.m.von)} · E-Mail {z.m.ok ? (z.m.test ? "protokolliert (Testmodus)" : "gesendet") : "NICHT gesendet"}
            </span>
            <details>
              <summary title="Vollständigen Text der E-Mail anzeigen">
                „{z.m.betreff}“ an {z.m.an}
                {z.m.anhang ? ` · Anhang ${z.m.anhang}` : ""}
              </summary>
              {z.m.fehler && <p className="lfa-hinweis lfa-hinweis-fehler" style={{ margin: "0.4rem 0 0" }}>{z.m.fehler}</p>}
              <div className="lfa-mailtext">{z.m.text}</div>
            </details>
          </li>
        ),
      )}
    </ul>
  );
}

function groesse(b: number): string {
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
}

/** Dokumente mit authentifiziertem Download (nie öffentliche Blob-URLs). */
export function DokumentListe({ dokumente, quelle, neu }: { dokumente: M.DokumentMeta[]; quelle: { k: string } | { v: string }; neu?: (id: string) => boolean }) {
  if (dokumente.length === 0) return <p className="lfa-klein">Noch keine Dokumente.</p>;
  const param = "k" in quelle ? `k=${encodeURIComponent(quelle.k)}` : `v=${encodeURIComponent(quelle.v)}`;
  return (
    <ul className="lfa-doks">
      {dokumente.map((d) => (
        <li key={d.id}>
          {neu?.(d.id) && <span className="lfa-puls" title="Neues Dokument seit Ihrem letzten Besuch" />}
          <strong>{d.titel}</strong>
          <span className="lfa-badge lfa-badge-keine" title="Art des Dokuments">{M.DOKUMENT_ART_NAME[d.art]}</span>
          <span className="lfa-klein">
            {datumZeit(d.erstelltAm)} · {groesse(d.groesse)}
            {d.version ? ` · Vorlage v${d.version}` : ""} · sichtbar für: {d.sichtbarFuer.length ? d.sichtbarFuer.map((r) => M.ROLLE_NAME[r]).join(", ") : "nur Verwaltung"}
          </span>
          <span className="lfa-klein" title="SHA-256-Prüfsumme der Datei — belegt, dass die Datei unverändert ist">SHA-256 {d.sha256.slice(0, 16)}…</span>
          <span className="lfa-knopfreihe" style={{ marginLeft: "auto" }}>
            <a href={`/admin/dokument/${d.id}?${param}`} target="_blank" rel="noopener" className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" title="Öffnet das Dokument in einem neuen Tab (nur für angemeldete Verwaltung)">
              Ansehen
            </a>
            <a href={`/admin/dokument/${d.id}?${param}&download=1`} className="lfa-knopf lfa-knopf-leise lfa-knopf-klein" title="Lädt das Dokument herunter">
              Herunterladen
            </a>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function VorgangLink({ k, text }: { k: string; text?: string }) {
  return (
    <Link href={`/admin/vorgang/${k}`} className="lfa-knopf lfa-knopf-hell lfa-knopf-klein" title="Vorgang öffnen: Freigabe, Pachtvertrag, Dokumente, Provision, Verlauf und E-Mail-Entwürfe">
      {text ?? "Vorgang öffnen"}
    </Link>
  );
}
