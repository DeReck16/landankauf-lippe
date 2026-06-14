"use client";

import { useEffect, useState } from "react";
import { site } from "@/lib/site";

export default function WhatsAppFloat() {
  const [number, setNumber] = useState<string | null>(null);

  useEffect(() => {
    try {
      const decoded = atob(site.contact.whatsappEncoded);
      setNumber(decoded.replace(/[^0-9]/g, ""));
    } catch {
      // ignore
    }
  }, []);

  const message = encodeURIComponent(
    "Guten Tag, ich möchte meine Fläche im Kreis Lippe verkaufen — bitte um eine diskrete Erstbewertung."
  );

  return (
    <a
      href={number ? `https://wa.me/${number}?text=${message}` : "#"}
      target="_blank"
      rel="noopener nofollow"
      aria-label="WhatsApp-Chat starten"
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[#25D366] text-white px-4 py-3 shadow-xl hover:bg-[#1ebe57] transition-colors"
      onClick={(e) => {
        if (!number) {
          e.preventDefault();
        }
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M20.52 3.48A11.83 11.83 0 0 0 12 0C5.37 0 0 5.37 0 12c0 2.11.55 4.17 1.6 5.99L0 24l6.16-1.61A11.94 11.94 0 0 0 12 24c6.63 0 12-5.37 12-12 0-3.2-1.25-6.21-3.48-8.52ZM12 21.82c-1.83 0-3.62-.49-5.18-1.42l-.37-.22-3.66.96.98-3.57-.24-.37A9.78 9.78 0 0 1 2.18 12C2.18 6.6 6.6 2.18 12 2.18c2.62 0 5.08 1.02 6.93 2.87A9.74 9.74 0 0 1 21.82 12c0 5.4-4.42 9.82-9.82 9.82Zm5.39-7.34c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15s-.77.97-.94 1.17c-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.46-.88-.78-1.47-1.74-1.64-2.03-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.21 5.1 4.5.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35Z" />
      </svg>
      <span className="text-sm font-semibold">WhatsApp</span>
    </a>
  );
}
