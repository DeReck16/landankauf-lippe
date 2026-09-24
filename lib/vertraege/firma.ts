import { site } from "@/lib/site";

// Pflichtangaben der TR Vertriebs GmbH für alle Vertragsdokumente.
// Bewusst ohne Stammkapital und ohne Umsatzzahlen.

export const FIRMA = {
  name: site.contact.company,
  marke: site.name,
  strasse: site.contact.street,
  plz: site.contact.zip,
  ort: site.contact.city,
  telefon: site.contact.phoneDisplay,
  email: site.contact.email,
  web: site.domain,
  registergericht: site.legal.registerCourt,
  registernummer: site.legal.registerNumber,
  geschaeftsfuehrer: site.legal.managingDirectors.join(" und "),
  ustId: site.legal.vatId,
} as const;

export const FIRMA_ANSCHRIFT = `${FIRMA.name}, ${FIRMA.strasse}, ${FIRMA.plz} ${FIRMA.ort}`;

/** Einzeilige Identität für Vertragsköpfe. */
export const FIRMA_KOPF = `${FIRMA.name}, handelnd unter der Marke „${FIRMA.marke}“, ${FIRMA.strasse}, ${FIRMA.plz} ${FIRMA.ort}, vertreten durch die Geschäftsführer ${FIRMA.geschaeftsfuehrer}, eingetragen im Handelsregister beim ${FIRMA.registergericht} unter ${FIRMA.registernummer}, USt-IdNr. ${FIRMA.ustId}, Telefon ${FIRMA.telefon}, E-Mail ${FIRMA.email}`;

export const KUNDENBEREICH_URL = `${site.url}/kunde`;
export const DATENSCHUTZ_URL = `${site.url}/datenschutz`;
