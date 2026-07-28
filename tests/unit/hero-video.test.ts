import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HERO_CLIPS, nextClipIndex } from '@/frontend/components/hero/hero-video.constants'

/**
 * The hero clip sequence.
 *
 * "Play the four clips one after another and loop" is the entire feature, so
 * the ordering is asserted here rather than left to a browser to demonstrate.
 * The asset checks catch the other way this breaks in production: a renamed or
 * missing file, which shows up as a silent fallback to the illustrated
 * carousel rather than as an error anyone would notice.
 */

const PUBLIC_DIR = resolve(__dirname, '../../public')

describe('clip sequencing', () => {
  it('advances through all four clips in order', () => {
    const visited: number[] = []
    let index = 0

    for (let step = 0; step < HERO_CLIPS.length; step += 1) {
      visited.push(index)
      index = nextClipIndex(index, 1)
    }

    expect(visited).toEqual([0, 1, 2, 3])
  })

  it('loops back to the first clip after the last', () => {
    // The sequencing requirement, stated directly.
    expect(nextClipIndex(HERO_CLIPS.length - 1, 1)).toBe(0)
  })

  it('wraps backwards from the first clip to the last', () => {
    // `%` keeps the sign of the dividend in JS, so a naive implementation
    // returns -1 here and indexes off the end of the array.
    expect(nextClipIndex(0, -1)).toBe(HERO_CLIPS.length - 1)
  })

  it('returns to the start after a full cycle, from any position', () => {
    for (let start = 0; start < HERO_CLIPS.length; start += 1) {
      let index = start
      for (let step = 0; step < HERO_CLIPS.length; step += 1) index = nextClipIndex(index, 1)
      expect(index).toBe(start)
    }
  })

  it('never produces an out-of-range index', () => {
    for (let delta = -10; delta <= 10; delta += 1) {
      for (let start = 0; start < HERO_CLIPS.length; start += 1) {
        const result = nextClipIndex(start, delta)
        expect(result).toBeGreaterThanOrEqual(0)
        expect(result).toBeLessThan(HERO_CLIPS.length)
      }
    }
  })
})

describe('clip playlist', () => {
  it('lists the four hero videos in order', () => {
    expect(HERO_CLIPS.map((c) => c.src)).toEqual([
      '/jk1-vid.mp4',
      '/jk2-vid.mp4',
      '/jk3-vid.mp4',
      '/jk4-vid.mp4',
    ])
  })

  it('gives every clip a poster frame', () => {
    // The poster is what the hero paints before any video byte arrives, so a
    // missing one means a blank hero on first load.
    for (const clip of HERO_CLIPS) {
      expect(clip.poster).toMatch(/^\/hero-posters\/.+\.jpg$/)
    }
  })

  it('gives every clip a distinct accessible caption for its dot control', () => {
    const captions = HERO_CLIPS.map((c) => c.caption)
    expect(new Set(captions).size).toBe(HERO_CLIPS.length)
    for (const caption of captions) expect(caption.length).toBeGreaterThan(0)
  })
})

describe('clip assets', () => {
  it.each(HERO_CLIPS.map((c) => c.src))('%s exists in /public and is non-empty', (src) => {
    const file = resolve(PUBLIC_DIR, src.replace(/^\//, ''))
    expect(existsSync(file), `${src} is referenced by the hero but missing from /public`).toBe(true)
    expect(statSync(file).size).toBeGreaterThan(0)
  })

  it.each(HERO_CLIPS.map((c) => c.src))('%s is a real MP4', (src) => {
    // First box of an MP4 is 'ftyp' at offset 4. Guards against a stray
    // placeholder or a truncated upload being shipped as a video.
    const file = resolve(PUBLIC_DIR, src.replace(/^\//, ''))
    const { readFileSync } = require('node:fs') as typeof import('node:fs')
    const head = readFileSync(file).subarray(4, 8).toString('latin1')
    expect(head).toBe('ftyp')
  })

  it.each(HERO_CLIPS.map((c) => c.poster))('%s exists and is a real JPEG', (poster) => {
    const file = resolve(PUBLIC_DIR, poster.replace(/^\//, ''))
    expect(existsSync(file), `${poster} is missing from /public`).toBe(true)

    // JPEG magic number: FF D8 FF.
    const { readFileSync } = require('node:fs') as typeof import('node:fs')
    const head = readFileSync(file).subarray(0, 3)
    expect([head[0], head[1], head[2]]).toEqual([0xff, 0xd8, 0xff])
  })

  it('keeps poster frames small enough to paint instantly', () => {
    // These load before anything else in the hero; a heavyweight poster would
    // defeat the point of having one.
    for (const clip of HERO_CLIPS) {
      const file = resolve(PUBLIC_DIR, clip.poster.replace(/^\//, ''))
      expect(statSync(file).size).toBeLessThan(150 * 1024)
    }
  })

  it('keeps any single clip under the delivery budget', () => {
    // A ceiling, not a target. These are background clips on a platform whose
    // stated audience is mid-range Android on Kenyan mobile data, where each
    // megabyte is a real cost to a real person.
    //
    // Set just above the current 720p CRF-28 encodes (~2MB each). Tight on
    // purpose: re-uploading a 4K master is the realistic regression here, and it
    // should fail the suite rather than reach production. See README →
    // "Hero videos" for the encode command.
    const MAX_BYTES = 3 * 1024 * 1024

    for (const clip of HERO_CLIPS) {
      const file = resolve(PUBLIC_DIR, clip.src.replace(/^\//, ''))
      const megabytes = statSync(file).size / 1024 / 1024

      expect(
        statSync(file).size,
        `${clip.src} is ${megabytes.toFixed(1)}MB — transcode it before shipping`,
      ).toBeLessThan(MAX_BYTES)
    }
  })
})
