import "server-only";
import { dateiAnlegen, dateiLesen } from "@/lib/admin/store";
import { felder, h3, p, type Block, type Dokument } from "@/lib/vertraege/dokument";
import { sha256Hex } from "@/lib/vertraege/hash";
import { alsPdf, type PdfTeil } from "@/lib/vertraege/pdf";
import { kurzId, type DokumentArt, type DokumentMeta, type KundeRecord, type Rolle, type Signatur, type VorgangRecord } from "./model";
import { datumZeitDe } from "./texte";

// Unterschriebene Dokumente: PDF erzeugen, unveränderlich ablegen, Metadaten
// liefern. Abgelegt wird unter portal/dokumente/<kunde|vorgang>/<id>/<DOK>.pdf;
// ausgeliefert nur über authentifizierte Routen (/admin/dokument, /kunde/dokument).

export type Eigentuemer = { typ: "kunde"; id: string } | { typ: "vorgang"; key: string };

function ordner(e: Eigentuemer): string {
  return e.typ === "kunde" ? `portal/dokumente/kunde/${e.id}` : `portal/dokumente/vorgang/${e.key}`;
}

/** Unterschriftsprotokoll als eigenes Dokument (wird ans PDF angehängt). */
export function protokollDokument(dokumentId: string, eintraege: { rolle: string; s: Signatur }[]): Dokument {
  const bloecke: Block[] = [
    p(
      "Die Unterzeichnung erfolgte elektronisch in Textform (§ 126b BGB): Die unterzeichnende Person hat den vollständigen Vertragstext im Kundenbereich von lippeforst.de angezeigt bekommen, die aufgeführten Erklärungen einzeln bestätigt, ihren Namen eingegeben und die Schaltfläche zur Unterzeichnung betätigt. Die Prüfsumme (SHA-256) belegt, welcher Text angezeigt und unterzeichnet wurde.",
    ),
  ];
  for (const { rolle, s } of eintraege) {
    bloecke.push(
      h3(rolle),
      felder([
        ["Eingegebener Name", s.name],
        ["E-Mail (Kundenkonto)", s.email],
        ["Zeitpunkt", `${datumZeitDe(s.am)} (${s.am})`],
        ["IP-Adresse", s.ip],
        ["Browser", s.userAgent],
        ["Vorlage", `${s.vorlageId}, Version ${s.vorlageVersion}`],
        ["SHA-256 Vertragstext", s.textHash],
        ["Sitzung", s.sitzung],
      ]),
      ...(s.erklaerungen.length ? [p("Bestätigte Erklärungen:"), ...s.erklaerungen.map((e) => p(`[x] ${e.text}`))] : []),
    );
  }
  bloecke.push(p(`Dokument-ID: ${dokumentId}`));
  return { titel: "Unterschriftsprotokoll", untertitel: "Elektronische Unterzeichnung über den Kundenbereich von lippeforst.de", bloecke };
}

/** PDF erzeugen und unveränderlich ablegen; liefert Metadaten und die Bytes (für den Mail-Anhang). */
export async function pdfAblegen(opts: {
  eigentuemer: Eigentuemer;
  art: DokumentArt;
  titel: string;
  dateiname: string;
  teile: PdfTeil[];
  fusszeile: string;
  sichtbarFuer: Rolle[];
  von: string;
  version?: string;
  ersetzt?: string;
  dokumentId?: string;
}): Promise<{ meta: DokumentMeta; bytes: Uint8Array }> {
  const id = opts.dokumentId ?? kurzId("DOK");
  const bytes = await alsPdf(opts.teile, { dokumentId: id, kurztitel: opts.titel, fusszeile: `${opts.fusszeile} · Dokument-ID ${id}` });
  const pfad = `${ordner(opts.eigentuemer)}/${id}.pdf`;
  await dateiAnlegen(pfad, bytes, "application/pdf");
  const meta: DokumentMeta = {
    id,
    art: opts.art,
    titel: opts.titel,
    dateiname: opts.dateiname,
    pfad,
    contentType: "application/pdf",
    groesse: bytes.byteLength,
    sha256: sha256Hex(bytes),
    erstelltAm: new Date().toISOString(),
    von: opts.von,
    ...(opts.version ? { version: opts.version } : {}),
    sichtbarFuer: opts.sichtbarFuer,
    ...(opts.ersetzt ? { ersetzt: opts.ersetzt } : {}),
  };
  return { meta, bytes };
}

/** Beliebige Datei (Upload der Verwaltung) ablegen. */
export async function dateiAblegen(opts: {
  eigentuemer: Eigentuemer;
  titel: string;
  dateiname: string;
  inhalt: Uint8Array;
  contentType: string;
  sichtbarFuer: Rolle[];
  von: string;
}): Promise<DokumentMeta> {
  const id = kurzId("DOK");
  const endung = opts.contentType === "application/pdf" ? "pdf" : opts.contentType === "image/png" ? "png" : "jpg";
  const pfad = `${ordner(opts.eigentuemer)}/${id}.${endung}`;
  await dateiAnlegen(pfad, opts.inhalt, opts.contentType);
  return {
    id,
    art: "upload",
    titel: opts.titel,
    dateiname: opts.dateiname,
    pfad,
    contentType: opts.contentType,
    groesse: opts.inhalt.byteLength,
    sha256: sha256Hex(opts.inhalt),
    erstelltAm: new Date().toISOString(),
    von: opts.von,
    sichtbarFuer: opts.sichtbarFuer,
  };
}

export function findeDokument(quelle: KundeRecord | VorgangRecord | null | undefined, id: string): DokumentMeta | null {
  return quelle?.dokumente.find((d) => d.id === id) ?? null;
}

export async function dokumentBytes(meta: DokumentMeta): Promise<Uint8Array | null> {
  const res = await dateiLesen(meta.pfad);
  return res ? new Uint8Array(res.bytes) : null;
}

/** Antwort für einen Download — nie gecacht, nie indexiert. */
export function dokumentAntwort(meta: DokumentMeta, bytes: Uint8Array, herunterladen: boolean): Response {
  const name = meta.dateiname.replace(/[^\w.\-äöüÄÖÜß ]/g, "_");
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": meta.contentType,
      "content-length": String(bytes.byteLength),
      "content-disposition": `${herunterladen ? "attachment" : "inline"}; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "cache-control": "private, no-store, max-age=0",
      "x-robots-tag": "noindex, nofollow",
      "x-content-type-options": "nosniff",
    },
  });
}
