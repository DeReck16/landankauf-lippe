import { site } from "@/lib/site";

// Einheitlicher Abschluss aller E-Mails von Lippe Forst (Dennis, 21.09.2026: eigener
// Lippe-Forst-Block, passend zum Impressum) — ohne Telefonnummer, Kontakt nur per
// E-Mail. Gilt für Antworten, Einladungen, Hinweise, Bestätigungen und Systemmails.

export const GRUSS = [
  "Mit freundlichen Grüßen",
  site.contact.contactPerson,
  "--",
  `${site.name} · ${site.domain}`,
  `${site.contact.street} · ${site.contact.zip} ${site.contact.city}`,
  `${site.contact.company} · ${site.legal.registerCourt} ${site.legal.registerNumber}`,
  `Geschäftsführer: ${site.legal.managingDirectors.join(", ")}`,
].join("\n");
