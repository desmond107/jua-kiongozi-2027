import type { MetadataRoute } from 'next'
import { candidateRepository } from '@/backend/repositories/candidate.repository'
import { env } from '@/backend/config/env'

/**
 * /sitemap.xml
 *
 * Regenerated hourly rather than frozen at build time, so a candidate added
 * through the admin console appears without a redeploy.
 */
export const revalidate = 3600

/**
 * Only publicly reachable content belongs here. The auth-gated routes
 * (/voter-card, /login, /register, /admin) are deliberately absent — listing a
 * page in a sitemap asks Google to index it, which is the opposite of what
 * app/robots.ts says about them.
 *
 * No `lastModified`: the Candidate model records `createdAt` but not an update
 * timestamp, and the marketing copy changes with deploys rather than on a date
 * this code can know. A lastmod that is invented is worse than none — crawlers
 * learn to distrust the whole file. `priority` is a relative hint within this
 * site only; it says nothing about ranking against anyone else.
 */
const STATIC_ROUTES: Array<{ path: string; priority: number }> = [
  { path: '/', priority: 1 },
  { path: '/candidates', priority: 0.9 },
  { path: '/transparency', priority: 0.8 },
  { path: '/how-it-works', priority: 0.6 },
  { path: '/about', priority: 0.5 },
  { path: '/privacy-policy', priority: 0.3 },
  { path: '/terms', priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => new URL(path, env.siteUrl).toString()

  // Same tolerance as generateStaticParams in app/candidates/[slug]/page.tsx:
  // an unreachable database should degrade the sitemap to its static routes,
  // not fail the build.
  const slugs = await candidateRepository.allSlugs().catch(() => [])

  return [
    ...STATIC_ROUTES.map(({ path, priority }) => ({
      url: url(path),
      changeFrequency: 'weekly' as const,
      priority,
    })),

    // The profiles are the pages worth finding — someone searching a
    // candidate's name should land here rather than on the grid.
    ...slugs.map((slug) => ({
      url: url(`/candidates/${slug}`),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ]
}
