// Attrappe für next/navigation: redirect/notFound werfen wie in Next.js.
export class Weiterleitung extends Error {
  constructor(ziel) {
    super(`NEXT_REDIRECT ${ziel}`);
    this.ziel = ziel;
  }
}
export function redirect(ziel) {
  throw new Weiterleitung(ziel);
}
export function notFound() {
  throw new Error("NEXT_NOT_FOUND");
}
export function unstable_rethrow(err) {
  if (err instanceof Weiterleitung) throw err;
}
