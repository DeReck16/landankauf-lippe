"use client";

import { useRef } from "react";
import { anfrageSpeichern } from "../actions";
import { LEAD_STATUS, type LeadStatus } from "@/lib/admin/model";

/** Status direkt in der Liste ändern — speichert sofort beim Auswählen. */
export default function StatusSchnell({ id, status }: { id: string; status: LeadStatus }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={anfrageSpeichern}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="bereich" value="status" />
      <select
        name="status"
        defaultValue={status}
        className={`field-select lfa-badge lfa-badge-status-${status}`}
        style={{ width: "auto", padding: "0.15rem 0.5rem", fontSize: "0.78rem", borderRadius: "9999px" }}
        onChange={() => formRef.current?.requestSubmit()}
        title={`${LEAD_STATUS[status].tipp} Auswahl ändern speichert den neuen Status sofort.`}
      >
        {(Object.keys(LEAD_STATUS) as LeadStatus[]).map((s) => (
          <option key={s} value={s} title={LEAD_STATUS[s].tipp}>
            {LEAD_STATUS[s].label}
          </option>
        ))}
      </select>
    </form>
  );
}
