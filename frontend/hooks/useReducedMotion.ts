'use client'

import { useEffect, useState } from 'react'

/**
 * Tracks the OS-level `prefers-reduced-motion` setting.
 *
 * Returns `true` during SSR and the first client render, so the motion-free
 * variant is what renders on the server. Enabling motion only after mount
 * avoids a hydration mismatch and means a user who wants no motion never sees
 * a frame of it.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
