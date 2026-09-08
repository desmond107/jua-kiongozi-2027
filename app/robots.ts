import type { MetadataRoute } from 'next'
import { env } from '@/backend/config/env'

/**
 * /robots.txt
 *
 * Two jobs: point crawlers at the sitemap, and keep them out of the parts of
 * the site that are not public content.
 *
 * WHAT IS DISALLOWED, AND WHY
 * ───────────────────────────
 *   /admin        — the operator console. Auth-gated, and nothing behind it is
 *                   for the public.
 *   /api          — JSON endpoints. Crawling them wastes budget that should be
 *                   spent on candidate profiles, and they render nothing a
 *                   person would search for.
 *   /voter-card   — displays a citizen's voting token. This one is not about
 *                   crawl budget: it must never be fetched by a bot.
 *   /login        — no content of their own, and duplicate sign-in pages in an
 *   /register       index dilute the pages that should rank.
 *
 * Note that `Disallow` governs CRAWLING, not indexing: a disallowed URL can
 * still be listed if something links to it, because the crawler is not allowed
 * to fetch the page and see a `noindex`. For these routes that is the right
 * trade — they are all auth-gated, so there is no content to leak either way.
 * If a page ever needs to be publicly reachable AND absent from the index, give
 * it `robots: { index: false }` in its metadata and remove it from this list,
 * so the crawler can fetch it and read that directive.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/voter-card', '/login', '/register'],
      },
    ],
    // Built through `new URL` so a NEXT_PUBLIC_SITE_URL with a trailing slash
    // cannot produce a `//sitemap.xml`.
    sitemap: new URL('/sitemap.xml', env.siteUrl).toString(),
  }
}
