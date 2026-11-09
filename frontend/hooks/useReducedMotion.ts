'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/**
 * Tracks the OS-level `prefers-reduced-motion` setting.
 *
 * Returns `true` during SSR and hydration, so the motion-free variant is what
 * renders on the server. Enabling motion only after hydration avoids a
 * mismatch and means a user who wants no motion never sees a frame of it.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true,
  )
}
