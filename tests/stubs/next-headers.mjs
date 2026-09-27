// Attrappe für next/headers: Cookies und Header aus globalThis.__testAnfrage.
function anfrage() {
  globalThis.__testAnfrage ??= { cookies: new Map(), headers: new Map() };
  return globalThis.__testAnfrage;
}
export async function cookies() {
  const a = anfrage();
  return {
    get: (name) => (a.cookies.has(name) ? { name, value: a.cookies.get(name) } : undefined),
    has: (name) => a.cookies.has(name),
    set: (name, value) => a.cookies.set(name, value),
    delete: (opt) => a.cookies.delete(typeof opt === "string" ? opt : opt.name),
  };
}
export async function headers() {
  const a = anfrage();
  return { get: (name) => a.headers.get(name.toLowerCase()) ?? null };
}
