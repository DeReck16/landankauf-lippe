"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, sitzungNochGueltigFrisch } from "@/lib/admin/session";
import { mutateZustand } from "@/lib/admin/store";
import { zugangAnlegen, zugangRechteAendern, zugangSperren } from "@/lib/api/zugang";

export type ZugangState = { status: "idle" | "ok" | "fehler"; text?: string; schluessel?: string; name?: string };

/** Neuen API-Zugang anlegen. Der Schlüssel steht nur in dieser Antwort — danach nirgends mehr lesbar. */
export async function zugangAnlegenAktion(_prev: ZugangState, formData: FormData): Promise<ZugangState> {
  const { email } = await requireAdmin();
  const r = await zugangAnlegen(email, {
    name: String(formData.get("name") ?? ""),
    rechte: formData.getAll("recht").map(String),
    tage: Number(formData.get("tage") ?? 365),
  });
  if (!r.ok) return { status: "fehler", text: r.fehler };
  // Läuft gleichzeitig „Alle Sitzungen beenden“, darf der eben angelegte Schlüssel nicht überleben.
  if (!(await sitzungNochGueltigFrisch())) {
    await zugangSperren(email, r.id);
    return { status: "fehler", text: "Die Sitzung wurde gerade beendet — der Zugang wurde nicht angelegt. Bitte neu anmelden." };
  }
  await mutateZustand(email, () => ({ was: `API-Zugang „${r.zugang.name}“ angelegt (${r.zugang.rechte.join(", ")}), gültig bis ${r.zugang.laeuftAb.slice(0, 10)}` }));
  revalidatePath("/admin/api-zugaenge");
  return { status: "ok", schluessel: r.schluessel, name: r.zugang.name };
}

export async function zugangSperrenAktion(formData: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!/^[a-f0-9]{10}$/.test(id)) throw new Error("Ungültiger Zugang");
  if (await zugangSperren(email, id)) {
    await mutateZustand(email, () => ({ was: `API-Zugang ${id} gesperrt` }));
  }
  revalidatePath("/admin/api-zugaenge");
}

/** Rechte eines bestehenden Zugangs ändern (nur mit Anmeldung in der Verwaltung). */
export async function zugangRechteAktion(formData: FormData): Promise<void> {
  const { email } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!/^[a-f0-9]{10}$/.test(id)) throw new Error("Ungültiger Zugang");
  // Wie beim Anlegen: Wurde gerade „Alle Sitzungen beenden“ ausgelöst, darf von dieser Sitzung aus nichts mehr erweitert werden.
  if (!(await sitzungNochGueltigFrisch())) throw new Error("Die Sitzung wurde beendet — bitte neu anmelden.");
  const r = await zugangRechteAendern(email, id, formData.getAll("recht").map(String));
  if (!r.ok) throw new Error(r.fehler);
  if (r.geaendert) await mutateZustand(email, () => ({ was: `API-Zugang „${r.zugang.name}“: Rechte geändert (${r.zugang.rechte.join(", ")})` }));
  revalidatePath("/admin/api-zugaenge");
}
