// Attrappe für next/cache: Revalidierung tut in Tests nichts, unstable_cache ruft direkt auf.
export const aufrufe = [];
export function revalidatePath(pfad, typ) {
  aufrufe.push(["revalidatePath", pfad, typ]);
}
export function revalidateTag(tag, profil) {
  aufrufe.push(["revalidateTag", tag, profil]);
}
export function updateTag(tag) {
  aufrufe.push(["updateTag", tag]);
}
export function unstable_cache(fn) {
  return (...args) => fn(...args);
}
