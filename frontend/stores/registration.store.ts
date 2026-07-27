'use client'

import { create } from 'zustand'
import type { RegistrationResult } from '@/backend/services/auth.service'

/**
 * In-memory hand-off between the registration form and the Voter Card screen.
 *
 * WHY A STORE AND NOT A QUERY PARAM OR localStorage
 * ─────────────────────────────────────────────────
 * The raw voting token must reach `/voter-card` after a client-side navigation
 * without ever touching a URL (which lands in browser history, server logs and
 * referrer headers) or localStorage (which persists indefinitely and is
 * readable by any script on the origin).
 *
 * A Zustand store lives in the page's JS heap only. It survives the
 * `router.push` from registration to the card, and it is gone the moment the
 * tab is closed or reloaded — which is exactly the lifetime a
 * shown-once credential should have.
 *
 * NOT persisted. Do not add zustand/middleware `persist` to this store.
 */

type RegistrationState = {
  issued: RegistrationResult | null
  setIssued: (result: RegistrationResult) => void
  /** Called once the card has been displayed, so it cannot be re-read. */
  clear: () => void
}

export const useRegistrationStore = create<RegistrationState>((set) => ({
  issued: null,
  setIssued: (result) => set({ issued: result }),
  clear: () => set({ issued: null }),
}))
