import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescriptConfig from 'eslint-config-next/typescript'

/**
 * Flat config, replacing the old `.eslintrc.json`.
 *
 * ESLint 10 dropped eslintrc support outright, and `next lint` — which used to
 * supply these ignores for us — is deprecated and gone in Next 16. So both the
 * config format and the ignore list now live here explicitly.
 */
const config = [
  {
    // Generated or vendored output. `.next` in particular holds built bundles
    // that would otherwise be linted as if they were source.
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'coverage/**', 'video-sources/**'],
  },
  ...coreWebVitals,
  ...typescriptConfig,
  {
    /**
     * `eslint-plugin-react-hooks` v7 — new with eslint-config-next 16 — added
     * this rule, and it fires on six pre-existing effects. Every one of them is
     * the legitimate shape: read a browser-only source (`matchMedia`,
     * `document`, the registration store) on mount and sync it into state,
     * because it cannot be read while rendering on the server.
     *
     * A warning rather than an error on purpose. Rewriting six components'
     * effect logic — the honest fix is `useSyncExternalStore` — is not
     * something to do as a side effect of a dependency upgrade, and these
     * particular effects are what keep first-paint markup identical between
     * server and client (see tests/unit/hydration-safety.test.ts). Left
     * visible so it gets addressed deliberately rather than silently.
     */
    rules: { 'react-hooks/set-state-in-effect': 'warn' },
  },
]

export default config
