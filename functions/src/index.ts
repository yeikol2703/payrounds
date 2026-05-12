/**
 * Deploy with Firebase CLI from repo root:
 * `firebase deploy --only functions`
 *
 * Ensure `firebase.json` points `functions.source` to `functions`.
 *
 * Env: set `RESEND_API_KEY` (and optionally `RESEND_FROM_EMAIL`) in the
 * Functions runtime (Firebase Console or `functions/.env` for emulator).
 */

import "./initAdmin";

export { openCycle } from "./openCycle";
export { deadlineReminder } from "./deadlineReminder";
export { cleanupProofs } from "./cleanupProofs";
