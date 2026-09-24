import type { Einstellungen } from "@/lib/portal/model";
import { VORLAGEN, VORLAGEN_REIHENFOLGE, aktuelleFreigabe } from "@/lib/vertraege/vorlagen";
import { alleVorlagenFreigebenAktion } from "../portal-actions";
import BestaetigenKnopf from "./BestaetigenKnopf";
import { Puls } from "./teile";

/** Hinweis mit „Alle freigeben“, solange noch eine Vertragsvorlage nicht freigegeben ist (Dashboard und Vorlagen). */
export default function AlleFreigeben({ e, zurueck }: { e: Einstellungen; zurueck: string }) {
  const offen = VORLAGEN_REIHENFOLGE.filter((id) => !aktuelleFreigabe(e, id));
  if (offen.length === 0) return null;
  const alle = offen.length === VORLAGEN_REIHENFOLGE.length;
  return (
    <section className="lfa-panel lfa-alle-freigeben" id="alle-freigeben">
      <h2 className="lfa-h2" style={{ marginBottom: "0.35rem" }}>
        <Puls an tipp="Ohne Freigabe kann kein Kunde online unterschreiben" />
        {alle ? "Vertragsvorlagen noch nicht freigegeben" : `${offen.length} von ${VORLAGEN_REIHENFOLGE.length} Vertragsvorlagen noch nicht freigegeben`}
      </h2>
      <p className="lfa-klein">
        Ohne Freigabe kann kein Kunde online unterschreiben. Offen: {offen.map((id) => VORLAGEN[id].titel).join(" · ")}
      </p>
      <form action={alleVorlagenFreigebenAktion} className="lfa-knopfreihe" style={{ marginTop: "0.7rem" }}>
        <input type="hidden" name="zurueck" value={zurueck} />
        <label className="lfa-check" title="Pflicht: ohne diesen Haken ist keine Freigabe möglich">
          <input type="checkbox" name="geprueft" value="1" required />
          <span>Ich habe {offen.length === 1 ? "diese Vorlage" : `alle ${offen.length} Vorlagen`} in der aktuellen Fassung geprüft bzw. anwaltlich prüfen lassen.</span>
        </label>
        <BestaetigenKnopf
          frage={`${offen.length === 1 ? "Die offene Vorlage" : `Alle ${offen.length} offenen Vorlagen`} freigeben? Ab sofort können Kunden diese Texte online unterschreiben.`}
          tipp="Gibt alle noch nicht freigegebenen Vorlagen in der aktuellen Fassung auf einmal frei"
        >
          {offen.length === 1 ? "Freigeben" : "Alle freigeben"}
        </BestaetigenKnopf>
      </form>
    </section>
  );
}
