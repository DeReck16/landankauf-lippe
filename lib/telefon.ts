import "server-only";

// Telefonnummer im Klartext — nur serverseitig: Vertragsdokumente (die Widerrufs-
// belehrung verlangt sie) und die WhatsApp-Weiterleitung app/whatsapp/route.ts.
// Auf der Website steht sie nirgends im Klartext (Dennis, 24.09.2026): angezeigt
// wird sie nur per Klick (ClickToReveal mit site.contact.phoneEncoded), WhatsApp-
// Links zeigen auf /whatsapp. Deshalb auch nicht in lib/site.ts (landet sonst im
// Browser-Bundle, sobald eine Client-Komponente site importiert).
export const TELEFON = {
  anzeige: "0176 38803064",
  whatsapp: "4917638803064",
} as const;
