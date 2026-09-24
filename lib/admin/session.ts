import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "./config";
import { createSessionToken, verifySessionToken } from "./token";

// Data Access Layer: jede Verwaltungsseite und jede Server Action prüft die
// Sitzung selbst. Der Proxy (proxy.ts) ist nur die Vorab-Weiche.

export const getAdminSession = cache(async (): Promise<{ email: string } | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token);
  return session ? { email: session.e } : null;
});

export async function requireAdmin(): Promise<{ email: string }> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/anmelden");
  return session;
}

export async function startSession(email: string): Promise<void> {
  const { token, maxAge } = createSessionToken(email);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // Nur für die Verwaltung — öffentliche Seiten bekommen das Cookie nie zu sehen.
    path: "/admin",
    maxAge,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/admin" });
}
