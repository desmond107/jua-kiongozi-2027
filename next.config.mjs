/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,

  experimental: {
    /**
     * Rewrites barrel imports to deep ones at build time. `import { Pause } from
     * 'lucide-react'` otherwise pulls the package index, and the bundler has to
     * prove the other ~1,500 icons are unused before it can drop them.
     *
     * `recharts` is deliberately NOT in this list — it was measured and buys
     * nothing. The charts already live in their own dynamic chunk
     * (frontend/components/analytics/lazy-charts.tsx), so /transparency comes
     * out at exactly 138 kB either way. Given that, the library is left alone:
     * Recharts resolves its children by component identity, which is the kind
     * of thing barrel rewriting can disturb, and there is no upside to trade
     * against that risk.
     */
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },

  async headers() {
    return [
      {
        /**
         * Hero footage and poster frames.
         *
         * Files in /public are served `max-age=0` by default, which meant the
         * ~7MB of video was re-fetched on EVERY visit — the single largest
         * inefficiency on the site, and invisible unless you read the response
         * headers.
         *
         * 30 days rather than a year-and-immutable on purpose: these filenames
         * are stable, so a clip replaced in place would otherwise stay pinned in
         * caches long after it changed. A month captures essentially all repeat
         * traffic while keeping the blast radius of a swap bounded. If you
         * replace a clip and need it live immediately, rename it — the playlist
         * and its tests reference filenames explicitly, so a rename is a tracked
         * change rather than a silent one.
         */
        source: '/:file(jk[1-4]-vid\\.mp4)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }],
      },
      {
        source: '/hero-posters/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }],
      },
      {
        // Icons change even less often than the footage.
        source: '/:file(favicon\\.ico|icon\\.svg|apple-icon\\.png)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }],
      },
    ]
  },
}

export default nextConfig
