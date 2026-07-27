'use client'

import { useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useCallback } from 'react'
import { useReducedMotion } from './useReducedMotion'

type TiltOptions = {
  /** Maximum rotation in degrees at the card's edge. */
  max?: number
  /** How far the glare highlight travels. */
  glare?: boolean
}

/**
 * Cursor-following 3D tilt for cards.
 *
 * Built on Framer Motion values rather than React state so the transform is
 * written straight to the compositor — pointer movement never triggers a React
 * re-render, which is what keeps this smooth on a seven-card grid.
 *
 * Returns inert values when reduced motion is requested; the card then renders
 * flat with no listeners attached.
 */
export function useTilt({ max = 8, glare = true }: TiltOptions = {}) {
  const reducedMotion = useReducedMotion()

  // -0.5 … 0.5, relative to the card's centre.
  const px = useMotionValue(0)
  const py = useMotionValue(0)

  const spring = { stiffness: 220, damping: 22, mass: 0.6 }
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [max, -max]), spring)
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-max, max]), spring)

  // The glow drifts opposite to the tilt, so the card reads as catching light
  // from a fixed source rather than carrying its own lamp.
  const glareX = useTransform(px, [-0.5, 0.5], ['80%', '20%'])
  const glareY = useTransform(py, [-0.5, 0.5], ['80%', '20%'])
  const glareBackground = useMotionTemplate`radial-gradient(60% 60% at ${glareX} ${glareY}, rgb(247 245 240 / 0.16) 0%, transparent 70%)`

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (reducedMotion) return

      const bounds = event.currentTarget.getBoundingClientRect()
      px.set((event.clientX - bounds.left) / bounds.width - 0.5)
      py.set((event.clientY - bounds.top) / bounds.height - 0.5)
    },
    [px, py, reducedMotion],
  )

  const onPointerLeave = useCallback(() => {
    px.set(0)
    py.set(0)
  }, [px, py])

  return {
    enabled: !reducedMotion,
    handlers: reducedMotion ? {} : { onPointerMove, onPointerLeave },
    style: reducedMotion ? {} : { rotateX, rotateY, transformStyle: 'preserve-3d' as const },
    glareStyle: reducedMotion || !glare ? undefined : { background: glareBackground },
  }
}
