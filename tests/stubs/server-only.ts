// Vitest stand-in for the `server-only` guard.
// The real package throws outside a React Server Component; under test the
// modules it protects are imported directly by Node, which is intended.
export {}
