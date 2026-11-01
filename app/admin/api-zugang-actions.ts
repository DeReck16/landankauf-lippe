"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/session";
import { mutateZustand } from "@/lib/admin/store";
import { zugangAnlegen, zugangSperren } from "@/lib/api/zugang";

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
