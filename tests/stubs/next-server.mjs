// Attrappe für next/server: after() sammelt die Aufgaben (Tests warten mit nachher()).
export const offen = [];
export function after(fn) {
  offen.push(Promise.resolve().then(fn));
}
export async function nachher() {
  while (offen.length) await offen.shift();
}
export class NextResponse extends Response {
  static json(daten, init) {
    return new Response(JSON.stringify(daten), { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  }
}
