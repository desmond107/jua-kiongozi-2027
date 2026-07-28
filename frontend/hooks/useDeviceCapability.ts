'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from './useReducedMotion'

export type DeviceCapability = {
  /** Safe to mount the WebGL scene. */
  canRender3D: boolean
  /**
   * The connection can afford the hero footage.
   *
   * Gated separately from `canRender3D` because the two cost different things.
   * WebGL is bound by GPU and RAM; video is bound by BANDWIDTH. A cheap phone
   * on good wifi should get the footage even though it cannot handle the 3D
   * scene; a powerful laptop tethered to a metered phone should not.
   *
   * This deliberately does NOT account for reduced motion. A visitor who asked
   * for less motion should still see the hero imagery — just held still — so
   * the caller pairs this with `canAnimate` to decide between a playing clip
   * and a static poster frame.
   */
  canPlayVideo: boolean
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
  const [videoCapable, setVideoCapable] = useState(false)
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

    /**
     * Video is gated on BANDWIDTH only — not on screen size, and not on CPU/GPU.
     *
     * Phone-sized viewports used to be excluded because the clips were 45MB
     * each; at ~1.9MB after transcoding that restriction cost mobile visitors
     * the hero for no real saving, so it is gone. What remains is the case the
     * gate exists for: a metered or genuinely slow connection, where even 2MB
     * is an imposition and the clip would stall rather than play.
     *
     * `canPlayType` guards the exotic case of a browser without H.264.
     */
    const canDecodeMp4 = document
      .createElement('video')
      .canPlayType('video/mp4; codecs="avc1.42E01E"')

    setVideoCapable(Boolean(canDecodeMp4) && !slowNetwork)
    setProbing(false)
  }, [])

  return {
    canRender3D: capable && !reducedMotion,
    canPlayVideo: videoCapable,
    canAnimate: !reducedMotion,
    probing,
  }
}
