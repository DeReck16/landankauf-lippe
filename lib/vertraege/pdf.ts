import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Block, Dokument } from "./dokument";

// PDF aus strukturierten Dokumenten — Helvetica (WinAnsi) kann äöüß€„“§ und
// Gedankenstriche; Zeichen außerhalb von WinAnsi werden ersetzt (→ „->“ usw.).

const A4: [number, number] = [595.28, 841.89];
const RAND_L = 62;
const RAND_R = 62;
const RAND_O = 74;
const RAND_U = 66;
const BREITE = A4[0] - RAND_L - RAND_R;

const FARBE_TEXT = rgb(0.11, 0.145, 0.1);
const FARBE_GRAU = rgb(0.42, 0.46, 0.41);
const FARBE_MARKE = rgb(0.184, 0.365, 0.227);
const FARBE_AKZENT = rgb(0.784, 0.608, 0.235);
const FARBE_LINIE = rgb(0.86, 0.84, 0.78);

const ERSATZ: Record<string, string> = {
  "→": "->",
  "←": "<-",
  "↔": "<->",
  "✓": "x",
  "✔": "x",
  "≈": "ca.",
  "≤": "<=",
  "≥": ">=",
  " ": " ",
  " ": " ",
  "‑": "-",
  "­": "",
  "\t": "    ",
};

export type PdfTeil = { dok: Dokument; neueSeite?: boolean };
export type PdfMeta = { dokumentId: string; kurztitel: string; fusszeile: string; betreff?: string };

type Schriften = { normal: PDFFont; fett: PDFFont; kursiv: PDFFont };

function saeubererText(font: PDFFont, cache: Map<string, string>, text: string): string {
  let out = "";
  for (const ch of text) {
    let ersetzt = cache.get(ch);
    if (ersetzt === undefined) {
      if (ch in ERSATZ) ersetzt = ERSATZ[ch];
      else {
        try {
          font.encodeText(ch);
          ersetzt = ch;
        } catch {
          ersetzt = "?";
        }
      }
      cache.set(ch, ersetzt);
    }
    out += ersetzt;
  }
  return out;
}

function umbrechen(text: string, font: PDFFont, groesse: number, max: number): string[] {
  const zeilen: string[] = [];
  for (const absatz of text.split("\n")) {
    const woerter = absatz.split(/ +/);
    let zeile = "";
    for (let wort of woerter) {
      // Überlange Wörter (Links, Prüfsummen) hart umbrechen.
      while (font.widthOfTextAtSize(wort, groesse) > max) {
        let n = wort.length;
        while (n > 1 && font.widthOfTextAtSize(wort.slice(0, n), groesse) > max) n--;
        if (zeile) {
          zeilen.push(zeile);
          zeile = "";
        }
        zeilen.push(wort.slice(0, n));
        wort = wort.slice(n);
      }
      const probe = zeile ? `${zeile} ${wort}` : wort;
      if (font.widthOfTextAtSize(probe, groesse) <= max) zeile = probe;
      else {
        if (zeile) zeilen.push(zeile);
        zeile = wort;
      }
    }
    zeilen.push(zeile);
  }
  return zeilen;
}

class Setzer {
  private seite!: PDFPage;
  private y = 0;
  private cache = new Map<string, string>();
  seiten: PDFPage[] = [];

  constructor(
    private pdf: PDFDocument,
    private f: Schriften,
  ) {
    this.neueSeite();
  }

  neueSeite() {
    this.seite = this.pdf.addPage(A4);
    this.seiten.push(this.seite);
    this.y = A4[1] - RAND_O;
  }

  private platz(hoehe: number) {
    if (this.y - hoehe < RAND_U) this.neueSeite();
  }

  t(s: string): string {
    return saeubererText(this.f.normal, this.cache, s);
  }

  zeilen(text: string, font: PDFFont, groesse: number, farbe = FARBE_TEXT, einzug = 0, zeilenhoehe = groesse * 1.42, balken = false) {
    const max = BREITE - einzug;
    for (const z of umbrechen(this.t(text), font, groesse, max)) {
      this.platz(zeilenhoehe);
      this.y -= zeilenhoehe;
      if (balken) {
        this.seite.drawRectangle({ x: RAND_L, y: this.y - 3, width: 2.4, height: zeilenhoehe, color: FARBE_AKZENT });
      }
      this.seite.drawText(z, { x: RAND_L + einzug, y: this.y, size: groesse, font, color: farbe });
    }
  }

  abstand(n: number) {
    this.y -= n;
  }

  titel(dok: Dokument) {
    this.zeilen(dok.titel, this.f.fett, 16.5, FARBE_MARKE, 0, 21);
    if (dok.untertitel) {
      this.abstand(2);
      this.zeilen(dok.untertitel, this.f.normal, 9.5, FARBE_GRAU, 0, 13);
    }
    this.abstand(10);
  }

  block(b: Block) {
    switch (b.t) {
      case "h2":
        // Überschrift nie allein am Seitenende.
        this.platz(46);
        this.abstand(9);
        this.zeilen(b.text, this.f.fett, 11.2, FARBE_TEXT, 0, 15);
        this.abstand(3);
        break;
      case "h3":
        this.platz(36);
        this.abstand(6);
        this.zeilen(b.text, this.f.fett, 10, FARBE_TEXT, 0, 13.5);
        this.abstand(2);
        break;
      case "p":
        this.zeilen(b.text, this.f.normal, 9.4, FARBE_TEXT, 0, 13.4);
        this.abstand(5);
        break;
      case "liste": {
        b.items.forEach((item, i) => {
          const marke = b.nummeriert ? `${i + 1}.` : "•";
          const zeilen = umbrechen(this.t(item), this.f.normal, 9.4, BREITE - 16);
          zeilen.forEach((z, j) => {
            this.platz(13.4);
            this.y -= 13.4;
            if (j === 0) this.seite.drawText(marke, { x: RAND_L + 2, y: this.y, size: 9.4, font: this.f.normal, color: FARBE_TEXT });
            this.seite.drawText(z, { x: RAND_L + 16, y: this.y, size: 9.4, font: this.f.normal, color: FARBE_TEXT });
          });
          this.abstand(2);
        });
        this.abstand(4);
        break;
      }
      case "kasten":
        this.abstand(3);
        if (b.titel) this.zeilen(b.titel, this.f.fett, 10, FARBE_TEXT, 11, 14, true);
        b.absaetze.forEach((a, i) => {
          this.zeilen(a, this.f.normal, 9.2, FARBE_TEXT, 11, 13.1, true);
          if (i < b.absaetze.length - 1) {
            this.platz(5);
            this.seite.drawRectangle({ x: RAND_L, y: this.y - 5, width: 2.4, height: 5, color: FARBE_AKZENT });
            this.abstand(5);
          }
        });
        this.abstand(8);
        break;
      case "felder": {
        const spalte = 150;
        for (const [name, wert] of b.zeilen) {
          const links = umbrechen(this.t(name), this.f.normal, 8.8, spalte - 8);
          const rechts = umbrechen(this.t(wert), this.f.normal, 9.2, BREITE - spalte);
          const n = Math.max(links.length, rechts.length);
          for (let i = 0; i < n; i++) {
            this.platz(12.6);
            this.y -= 12.6;
            if (links[i]) this.seite.drawText(links[i], { x: RAND_L, y: this.y, size: 8.8, font: this.f.normal, color: FARBE_GRAU });
            if (rechts[i]) this.seite.drawText(rechts[i], { x: RAND_L + spalte, y: this.y, size: 9.2, font: this.f.normal, color: FARBE_TEXT });
          }
          this.abstand(2.5);
        }
        this.abstand(5);
        break;
      }
      case "trenner":
        this.platz(14);
        this.abstand(6);
        this.seite.drawLine({ start: { x: RAND_L, y: this.y }, end: { x: A4[0] - RAND_R, y: this.y }, thickness: 0.6, color: FARBE_LINIE });
        this.abstand(8);
        break;
    }
  }

  kopfUndFuss(meta: PdfMeta) {
    const n = this.seiten.length;
    this.seiten.forEach((s, i) => {
      const kopfLinks = this.t(meta.kurztitel);
      const kopfRechts = "Lippe Forst · TR Vertriebs GmbH";
      s.drawText(kopfLinks, { x: RAND_L, y: A4[1] - 40, size: 8, font: this.f.normal, color: FARBE_GRAU });
      const w = this.f.normal.widthOfTextAtSize(kopfRechts, 8);
      s.drawText(kopfRechts, { x: A4[0] - RAND_R - w, y: A4[1] - 40, size: 8, font: this.f.fett, color: FARBE_MARKE });
      s.drawLine({ start: { x: RAND_L, y: A4[1] - 48 }, end: { x: A4[0] - RAND_R, y: A4[1] - 48 }, thickness: 0.5, color: FARBE_LINIE });

      s.drawLine({ start: { x: RAND_L, y: 46 }, end: { x: A4[0] - RAND_R, y: 46 }, thickness: 0.5, color: FARBE_LINIE });
      const fussLinks = umbrechen(this.t(meta.fusszeile), this.f.normal, 7, BREITE - 90);
      fussLinks.slice(0, 2).forEach((z, j) => s.drawText(z, { x: RAND_L, y: 35 - j * 9, size: 7, font: this.f.normal, color: FARBE_GRAU }));
      const seite = `Seite ${i + 1} von ${n}`;
      const sw = this.f.normal.widthOfTextAtSize(seite, 7.5);
      s.drawText(seite, { x: A4[0] - RAND_R - sw, y: 35, size: 7.5, font: this.f.normal, color: FARBE_GRAU });
    });
  }
}

/** Setzt ein oder mehrere Dokumente in ein PDF (A4, Kopf- und Fußzeile auf jeder Seite). */
export async function alsPdf(teile: PdfTeil[], meta: PdfMeta): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const f: Schriften = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    fett: await pdf.embedFont(StandardFonts.HelveticaBold),
    kursiv: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };
  const s = new Setzer(pdf, f);
  teile.forEach((teil, i) => {
    if (i > 0 && teil.neueSeite) s.neueSeite();
    else if (i > 0) s.abstand(14);
    s.titel(teil.dok);
    for (const b of teil.dok.bloecke) s.block(b);
  });
  s.kopfUndFuss(meta);
  pdf.setTitle(meta.kurztitel);
  pdf.setAuthor("TR Vertriebs GmbH (Lippe Forst)");
  pdf.setCreator("lippeforst.de");
  pdf.setProducer("lippeforst.de Kundenbereich");
  if (meta.betreff) pdf.setSubject(meta.betreff);
  pdf.setKeywords([meta.dokumentId]);
  pdf.setCreationDate(new Date());
  return pdf.save();
}
