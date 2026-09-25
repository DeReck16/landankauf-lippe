"use client";

import { useEffect, useState } from "react";

// Pulsierende Zahl an „Flächenbörse“ (Kopfzeile und Handy-Menü): wie viele Angebote gerade
// live sind. Geholt im Browser über /api/boerse — so stimmt sie auch auf statischen Seiten.
// Ein Abruf je Seitenaufruf, geteilt von allen Stellen; bei 0 Angeboten erscheint nichts.

type Stand = { anzahl: number; pacht: number; kauf: number };

let abruf: Promise<Stand | null> | null = null;

function laden(): Promise<Stand | null> {
  abruf ??= fetch("/api/boerse")
    .then((r) => (r.ok ? (r.json() as Promise<Stand>) : null))
    .catch(() => null);
  return abruf;
}

export default function BoerseZaehler() {
  const [stand, setStand] = useState<Stand | null>(null);
  useEffect(() => {
    let aktiv = true;
    void laden().then((s) => {
      if (aktiv) setStand(s);
    });
    return () => {
      aktiv = false;
    };
  }, []);
  if (!stand || stand.anzahl <= 0) return null;
  const teile = [stand.pacht ? `${stand.pacht} zur Pacht` : "", stand.kauf ? `${stand.kauf} zum Kauf` : ""].filter(Boolean).join(", ");
  const tipp = `${stand.anzahl} ${stand.anzahl === 1 ? "Fläche steht" : "Flächen stehen"} gerade anonym in der Flächenbörse${teile ? ` (${teile})` : ""}`;
  return (
    <span className="lf-zaehler" title={tipp} aria-label={tipp}>
      <span className="lf-puls-ring" aria-hidden />
      <span className="lf-zaehler-zahl">{stand.anzahl}</span>
    </span>
  );
}
