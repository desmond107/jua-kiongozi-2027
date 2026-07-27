/**
 * Hero carousel artwork.
 *
 * These are hand-built SVG scenes rather than photographs, for two reasons:
 * they ship as a few kilobytes of markup instead of megabytes of imagery on
 * connections where that matters, and they carry no licensing encumbrance.
 *
 * TO USE REAL PHOTOGRAPHY: drop licensed images into `/public/hero/` and
 * replace the `<Art />` element inside HeroCarousel with next/image. The
 * carousel does not care which it renders. See README → "Replacing hero art".
 *
 * Each scene renders full-bleed via `preserveAspectRatio="xMidYMid slice"`.
 */

type ArtProps = { className?: string }

const SHARED = {
  className: 'h-full w-full',
  preserveAspectRatio: 'xMidYMid slice',
  viewBox: '0 0 1200 700',
  'aria-hidden': true as const,
}

/** Mount Kenya at first light — layered ridgelines under a rising sun. */
export function MountainDawn({ className }: ArtProps) {
  return (
    <svg {...SHARED} className={className ?? SHARED.className}>
      <defs>
        <linearGradient id="dawn-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A0E1A" />
          <stop offset="55%" stopColor="#2A1B3D" />
          <stop offset="100%" stopColor="#7B3F2E" />
        </linearGradient>
        <radialGradient id="dawn-sun" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#F5B942" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#F5B942" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#F5B942" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="1200" height="700" fill="url(#dawn-sky)" />
      <circle cx="820" cy="430" r="230" fill="url(#dawn-sun)" />
      <circle cx="820" cy="430" r="52" fill="#F5B942" fillOpacity="0.9" />

      {/* Ridgelines, far to near — each darker, which is what builds the depth. */}
      <path d="M0 470 L180 380 L320 440 L470 330 L620 430 L780 360 L950 450 L1200 370 V700 H0Z" fill="#1A2233" fillOpacity="0.75" />
      <path d="M0 540 L160 470 L340 520 L520 420 L700 510 L880 450 L1060 530 L1200 480 V700 H0Z" fill="#111726" fillOpacity="0.9" />
      <path d="M0 620 L220 560 L430 610 L640 540 L860 600 L1080 555 L1200 590 V700 H0Z" fill="#070A12" />
    </svg>
  )
}

/** Nairobi at dusk — the KICC silhouette among the skyline. */
export function CityDusk({ className }: ArtProps) {
  return (
    <svg {...SHARED} className={className ?? SHARED.className}>
      <defs>
        <linearGradient id="dusk-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#070A12" />
          <stop offset="60%" stopColor="#152238" />
          <stop offset="100%" stopColor="#1E4D3A" />
        </linearGradient>
        <linearGradient id="tower" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#252F45" />
          <stop offset="100%" stopColor="#0A0E1A" />
        </linearGradient>
      </defs>

      <rect width="1200" height="700" fill="url(#dusk-sky)" />

      {/* Scattered window lights. */}
      {Array.from({ length: 46 }).map((_, index) => (
        <circle
          key={index}
          cx={90 + ((index * 137) % 1020)}
          cy={430 + ((index * 71) % 210)}
          r={1.8}
          fill="#F5B942"
          fillOpacity={0.35 + ((index * 13) % 40) / 100}
        />
      ))}

      {/* Skyline blocks. */}
      <path d="M0 560 H90 V430 H160 V560 H250 V470 H320 V560 H1200 V700 H0Z" fill="#111726" />
      <rect x="360" y="360" width="70" height="340" fill="url(#tower)" />
      <rect x="470" y="410" width="55" height="290" fill="#1A2233" />
      <rect x="700" y="390" width="64" height="310" fill="#1A2233" />
      <rect x="820" y="440" width="80" height="260" fill="#111726" />
      <rect x="960" y="400" width="58" height="300" fill="#1A2233" />

      {/* KICC: cylindrical tower with its distinctive crown. */}
      <rect x="570" y="250" width="86" height="450" rx="43" fill="url(#tower)" />
      <ellipse cx="613" cy="250" rx="43" ry="14" fill="#36425C" />
      <ellipse cx="613" cy="228" rx="62" ry="17" fill="#252F45" />
      <rect x="609" y="180" width="8" height="50" fill="#36425C" />
    </svg>
  )
}

/** The savannah — acacia against a wide gold sky. */
export function SavannahGold({ className }: ArtProps) {
  return (
    <svg {...SHARED} className={className ?? SHARED.className}>
      <defs>
        <linearGradient id="savannah-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A0E1A" />
          <stop offset="50%" stopColor="#4A3418" />
          <stop offset="100%" stopColor="#B47A0C" />
        </linearGradient>
      </defs>

      <rect width="1200" height="700" fill="url(#savannah-sky)" />
      <circle cx="380" cy="470" r="70" fill="#F5B942" fillOpacity="0.85" />

      <path d="M0 560 Q300 520 600 555 T1200 540 V700 H0Z" fill="#1A1206" fillOpacity="0.85" />
      <path d="M0 620 Q350 585 700 615 T1200 600 V700 H0Z" fill="#070A12" />

      {/* Acacia: trunk, branch structure, flat canopy. */}
      <g fill="#05070D">
        <path d="M905 620 L915 470 L925 620Z" />
        <path d="M912 500 L840 465 M912 495 L985 462 M914 520 L865 500 M914 515 L965 495"
          stroke="#05070D" strokeWidth="6" strokeLinecap="round" fill="none" />
        <ellipse cx="912" cy="450" rx="115" ry="34" />
        <ellipse cx="860" cy="462" rx="58" ry="20" />
        <ellipse cx="968" cy="460" rx="52" ry="18" />
      </g>

      <g fill="#05070D">
        <path d="M215 625 L221 540 L227 625Z" />
        <ellipse cx="221" cy="530" rx="62" ry="18" />
      </g>
    </svg>
  )
}

/** Unity — abstract figures beneath a shared arc of light. */
export function UnityArc({ className }: ArtProps) {
  return (
    <svg {...SHARED} className={className ?? SHARED.className}>
      <defs>
        <linearGradient id="unity-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#070A12" />
          <stop offset="50%" stopColor="#0E2A1C" />
          <stop offset="100%" stopColor="#0A0E1A" />
        </linearGradient>
        <linearGradient id="unity-arc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1EB854" stopOpacity="0.1" />
          <stop offset="50%" stopColor="#F5B942" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#E23D3D" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      <rect width="1200" height="700" fill="url(#unity-sky)" />

      <path d="M60 520 Q600 120 1140 520" stroke="url(#unity-arc)" strokeWidth="3" fill="none" />
      <path d="M120 560 Q600 220 1080 560" stroke="url(#unity-arc)" strokeWidth="1.5" fill="none" opacity="0.5" />

      {/* Figures: uniform in shape, varied only in height — no single figure
          reads as the leader, which matters on a non-partisan platform. */}
      {[
        { x: 330, h: 150 },
        { x: 430, h: 178 },
        { x: 530, h: 140 },
        { x: 630, h: 190 },
        { x: 730, h: 152 },
        { x: 830, h: 172 },
      ].map((figure) => (
        <g key={figure.x} fill="#05070D">
          <circle cx={figure.x} cy={620 - figure.h} r="21" />
          <path
            d={`M${figure.x - 26} 640 Q${figure.x - 26} ${618 - figure.h + 34} ${figure.x} ${612 - figure.h + 34} Q${figure.x + 26} ${618 - figure.h + 34} ${figure.x + 26} 640Z`}
          />
        </g>
      ))}

      <rect y="638" width="1200" height="62" fill="#05070D" />
    </svg>
  )
}

export const HERO_SLIDES = [
  {
    id: 'mountain',
    Art: MountainDawn,
    /** Describes the *scene*; the headline beside it carries the meaning. */
    alt: 'Illustration of Mount Kenya’s ridgelines silhouetted against a rising sun.',
    caption: 'A new political season',
  },
  {
    id: 'city',
    Art: CityDusk,
    alt: 'Illustration of the Nairobi skyline at dusk with the KICC tower at its centre.',
    caption: 'From every county and city',
  },
  {
    id: 'savannah',
    Art: SavannahGold,
    alt: 'Illustration of an acacia tree on the savannah beneath a gold evening sky.',
    caption: 'One land, many voices',
  },
  {
    id: 'unity',
    Art: UnityArc,
    alt: 'Illustration of six figures of equal form standing beneath an arc of light.',
    caption: 'Counted openly, together',
  },
] as const
