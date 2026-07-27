'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from './useReducedMotion'

export type DeviceCapability = {
  /** Safe to mount the WebGL scene. */
  canRender3D: boolean
  /** Safe to run continuous animation (parallax, autoplay, tilt). */
  canAnimate: boolean
  /** True until the capability probe has run, so callers can hold back. */
  probing: boolean
}

/**
 * Decides whether this device should get the full 3D + motion treatment.
 *
 * The platform's expected audience is largely on mid-range Android handsets, so
 * the flourishes are opt-in per device rather than assumed. The scene is
 * withheld when ANY of the following holds:
 *
 *   - the user asked for reduced motion
 *   - the viewport is phone-sized
 *   - the device reports ≤ 4 logical cores or ≤ 4 GB RAM
 *   - the connection is metered or slow (Save-Data, 2g/3g)
 *   - WebGL is unavailable or blocked
 *
 * Callers fall back to the static gradient artwork, which is designed to look
 * intentional rather than like a missing asset.
 */
export function useDeviceCapability(): DeviceCapability {
  const reducedMotion = useReducedMotion()
  const [capable, setCapable] = useState(false)
  const [probing, setProbing] = useState(true)

  useEffect(() => {
    const navigatorWithHints = navigator as Navigator & {
      deviceMemory?: number
      connection?: { effectiveType?: string; saveData?: boolean }
    }

    const cores = navigator.hardwareConcurrency ?? 4
    const memory = navigatorWithHints.deviceMemory ?? 4
    const connection = navigatorWithHints.connection
    const smallViewport = window.matchMedia('(max-width: 767px)').matches

    const slowNetwork =
      connection?.saveData === true ||
      ['slow-2g', '2g', '3g'].includes(connection?.effectiveType ?? '')

    // Probe for an actual WebGL context rather than trusting a feature flag —
    // some devices expose the API but fail to create a context.
    let webglAvailable = false
    try {
      const canvas = document.createElement('canvas')
      webglAvailable = Boolean(
        canvas.getContext('webgl2') ?? canvas.getContext('webgl'),
      )
    } catch {
      webglAvailable = false
    }

    setCapable(
      webglAvailable && !smallViewport && !slowNetwork && cores > 4 && memory > 4,
    )
    setProbing(false)
  }, [])

  return {
    canRender3D: capable && !reducedMotion,
    canAnimate: !reducedMotion,
    probing,
  }
}
