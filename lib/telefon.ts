import "server-only";

// Telefonnummer — nur serverseitig: Pflichtangaben in Vertragsdokumenten
// (Art. 246a § 1 Abs. 1 Nr. 3 EGBGB verlangt für Fernabsatzverträge mit
// Verbrauchern Telefonnummer und E-Mail, dazu die Widerrufsbelehrung) und die
// WhatsApp-Weiterleitung app/whatsapp/route.ts. Auf der Website und in Kunden-
// Mails steht sie nicht (Dennis, 24.09.2026: Kontakt per E-Mail, Telefon
// möglichst vermeiden; WhatsApp bleibt).
export const TELEFON = {
  anzeige: "0176 38803064",
  whatsapp: "4917638803064",
} as const;
