"use client";

import { useAuswahl, waehle } from "./sammel";

/** Häkchen vor einer Zeile der Anfragen-Liste: für „Ausgewählte veröffentlichen“ vormerken. */
export default function SammelKasten({ id, name }: { id: string; name: string }) {
  const gewaehlt = useAuswahl().has(id);
  return (
    <label className="lfa-sammelkasten" title="Für die Sammel-Veröffentlichung vormerken — veröffentlicht wird erst über „Ausgewählte veröffentlichen“ oberhalb der Liste">
      <input type="checkbox" checked={gewaehlt} onChange={(e) => waehle(id, e.target.checked)} aria-label={`${name} für die Sammel-Veröffentlichung auswählen`} />
    </label>
  );
}
