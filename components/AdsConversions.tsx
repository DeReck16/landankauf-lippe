"use client";

import { useEffect } from "react";

/**
 * Google-Ads-Conversion-Tracking (AW-18000118202).
 * Zentraler, delegierter Klick-Listener: feuert eine Conversion bei Klick auf
 * WhatsApp- (wa.me / api.whatsapp / whatsapp:) und Telefon- (tel:) Links —
 * ohne dass jeder einzelne Link angefasst werden muss.
 *
 * Robust: nutzt dataLayer direkt (funktioniert auch bevor gtag.js fertig lädt)
 * und transport_type 'beacon', damit die Conversion auch bei Navigation ankommt.
 */
const AW = "AW-18000118202";

export default function AdsConversions({
  whatsappLabel,
  phoneLabel,
}: {
  whatsappLabel: string;
  phoneLabel: string;
}) {
  useEffect(() => {
    // gclid/gbraid/wbraid aus der Landing-URL in ein 90-Tage-Cookie sichern,
    // damit jeder Lead (auch nach Seitenwechsel) der Anzeige zugeordnet werden kann.
    try {
      const p = new URLSearchParams(window.location.search);
      const g = p.get("gclid") || p.get("gbraid") || p.get("wbraid");
      if (g) {
        document.cookie = `tr_gclid=${encodeURIComponent(g)}; path=/; max-age=${60 * 60 * 24 * 90}; SameSite=Lax`;
      }
    } catch {
      /* noop */
    }

    const w = window as unknown as {
      dataLayer?: unknown[];
      gtag?: (...args: unknown[]) => void;
    };
    w.dataLayer = w.dataLayer || [];
    if (typeof w.gtag !== "function") {
      w.gtag = function (...args: unknown[]) {
        w.dataLayer!.push(args);
      };
    }
    w.gtag("config", AW);

    const fire = (label: string) => {
      try {
        w.gtag!("event", "conversion", {
          send_to: `${AW}/${label}`,
          transport_type: "beacon",
        });
      } catch {
        /* noop */
      }
    };

    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      const a = el?.closest?.("a") as HTMLAnchorElement | null;
      if (!a) return;
      const href = (a.getAttribute("href") || "").toLowerCase();
      if (!href) return;
      if (
        href.includes("wa.me") ||
        href.includes("api.whatsapp") ||
        href.startsWith("whatsapp:")
      ) {
        fire(whatsappLabel);
      } else if (href.startsWith("tel:")) {
        fire(phoneLabel);
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [whatsappLabel, phoneLabel]);

  return null;
}
