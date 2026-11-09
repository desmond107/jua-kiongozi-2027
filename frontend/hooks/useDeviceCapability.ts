'use client'

import { useSyncExternalStore } from 'react'
import { useReducedMotion } from './useReducedMotion'

export type DeviceCapability = {
  /**
   * The connection can afford the hero footage.
   *
   * Gated on BANDWIDTH only — not on screen size, and not on CPU or GPU.
   * Phone-sized viewports were excluded back when the clips were 45MB each; at
   * ~1.9MB after transcoding that cost mobile visitors the hero for no real
   * saving. What remains is the case the gate exists for: a metered or slow
   * connection, where even 2MB is an imposition and the clip would stall.
   *
   * This deliberately does NOT account for reduced motion. A visitor who asked
   * for less motion should still see the hero imagery — just held still — so
   * callers pair this with `canAnimate` to choose between a playing clip and a
   * static poster frame.
   */
  canPlayVideo: boolean
  /** Safe to run continuous animation (autoplay, rotating copy, parallax, tilt). */
  canAnimate: boolean
  /** True until the capability probe has run, so callers can hold back. */
  probing: boolean
}

/**
 * Decides how much motion and media this device and connection should be given.
 *
 * Everything here is measured on the client after mount, never guessed on the
 * server: the first render is identical for every visitor, which is what keeps
 * the swap from causing a hydration mismatch.
 */
export function useDeviceCapability(): DeviceCapability {
  const reducedMotion = useReducedMotion()
  // 'probing' is the server snapshot, so SSR and hydration agree; the client
  // snapshot replaces it immediately after, without an effect.
  const video = useSyncExternalStore(subscribeNever, probeVideo, () => 'probing' as const)

  return {
    canPlayVideo: video === 'capable',
    canAnimate: !reducedMotion,
    probing: video === 'probing',
  }
}

type VideoProbe = 'probing' | 'capable' | 'incapable'

/** Neither signal is watched for changes, so there is nothing to subscribe to. */
function subscribeNever(): () => void {
  return () => {}
}

// Measured once per page load: React calls the snapshot on every render, and
// creating a <video> element each time would be wasted work.
let videoProbe: VideoProbe | undefined

function probeVideo(): VideoProbe {
  if (videoProbe) return videoProbe

  const navigatorWithHints = navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean }
  }

  const connection = navigatorWithHints.connection

  // Save-Data is an explicit request; the effectiveType values below are the
  // coarsest signal a browser gives that a few megabytes will hurt.
  const slowNetwork =
    connection?.saveData === true ||
    ['slow-2g', '2g', '3g'].includes(connection?.effectiveType ?? '')

  // Guards the exotic case of a browser that cannot decode H.264.
  const canDecodeMp4 = document
    .createElement('video')
    .canPlayType('video/mp4; codecs="avc1.42E01E"')

  videoProbe = Boolean(canDecodeMp4) && !slowNetwork ? 'capable' : 'incapable'
  return videoProbe
}
