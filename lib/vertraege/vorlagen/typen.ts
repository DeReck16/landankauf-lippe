import type { Dokument } from "../dokument";
import type { Art, Eigenschaft } from "@/lib/portal/model";

// Eingabedaten der Vorlagen — alles bereits als Text formatiert. So lassen sich
// die Vorlagen mit Platzhaltern („«Name»“) rendern, und der Hash einer Vorlage
// hängt nur vom Vorlagentext ab, nicht von echten Kundendaten.

export type VorlageId = "nachweis-pacht" | "nachweis-kauf" | "anbieter" | "pachtvertrag" | "kaufabsicht";

export type ParteiText = {
  name: string;
  betrieb: string;
  anschrift: string;
  email: string;
  telefon: string;
};

export type NachweisDaten = {
  eigenschaft: Eigenschaft;
  kunde: ParteiText;
  vorgang: string;
  suchprofil: string;
  /** z. B. „eine volle Jahrespacht (netto) zzgl. 19 % Umsatzsteuer“ */
  provision: string;
  /** Gesamtbetrag für Verbraucher (PAngV), z. B. „119 % einer vollen Jahrespacht …“ */
  provisionBrutto: string;
  /** Die jeweils andere Provision (Kauf statt Pacht bzw. Pacht statt Kauf). */
  provisionAndere: string;
  konditionenVersion: string;
  /** Monate Provisionsschutz für weitere Flächen desselben Anbieters. */
  schutzMonate: string;
};

export type AnbieterDaten = {
  eigenschaft: Eigenschaft;
  art: Art;
  kunde: ParteiText;
  vorgang: string;
  angebot: string;
  flaechen: string[];
};

export type FlaecheText = { bezeichnung: string; groesse: string; nutzung: string };

export type PachtvertragDaten = {
  vorgang: string;
  verpaechter: { name: string; anschrift: string };
  paechter: { name: string; anschrift: string; betrieb: string };
  flaechen: FlaecheText[];
  gesamtFlaeche: string;
  nutzungsart: string;
  pachtBeginn: string;
  befristet: boolean;
  laufzeit: string;
  pachtEnde: string;
  pachtjahr: string;
  pachtzins: string;
  jahrespacht: string;
  staffel: string;
  zahlweise: string;
  umsatzsteuer: "ohne" | "zuzueglich";
  konto: string;
  wasserverband: "verpaechter" | "paechter";
  verpflichtungen: string;
  besonderes: string;
  anzeigeStelle: string;
};

export type KaufabsichtDaten = {
  vorgang: string;
  verkaeufer: { name: string; anschrift: string };
  kaeufer: { name: string; anschrift: string; betrieb: string };
  flaechen: FlaecheText[];
  gesamtFlaeche: string;
  kaufpreis: string;
  uebergabe: string;
  bestehendePacht: string;
  notarWunsch: string;
  besonderes: string;
  provisionKaeufer: string;
  genehmigungStelle: string;
};

export type Vorlage<D> = {
  id: VorlageId;
  version: string;
  titel: string;
  beschreibung: string;
  render: (d: D) => Dokument;
  /** Platzhalter-Daten je Textvariante — Grundlage für Prüfsumme und Vorschau. */
  varianten: { name: string; daten: D }[];
};
