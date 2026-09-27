import { strict as assert } from "node:assert";
import { test } from "node:test";
import { werktagFrist } from "@/lib/portal/aufgaben";

test("Werktag-Zusage: Frist ist das Ende des nächsten Werktags (Wochenende übersprungen)", () => {
  // Mittwoch 23.09.2026, 10:00 → Donnerstag 24.09., 23:59 (Sommerzeit)
  assert.equal(werktagFrist("2026-09-23T08:00:00.000Z").toISOString(), "2026-09-24T21:59:00.000Z");
  // Freitag 25.09.2026, 18:00 → Montag 28.09., 23:59
  assert.equal(werktagFrist("2026-09-25T16:00:00.000Z").toISOString(), "2026-09-28T21:59:00.000Z");
  // Samstag 26.09.2026 → Montag 28.09.
  assert.equal(werktagFrist("2026-09-26T09:00:00.000Z").toISOString(), "2026-09-28T21:59:00.000Z");
  // Sonntag 27.09.2026 → Montag 28.09.
  assert.equal(werktagFrist("2026-09-27T09:00:00.000Z").toISOString(), "2026-09-28T21:59:00.000Z");
});
