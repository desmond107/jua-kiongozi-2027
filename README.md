# Jua Kiongozi ’27

An independent civic-engagement platform where Kenyan citizens register once, receive a single
secure voting token, record a sentiment vote and a trust flag on each declared 2027 presidential
candidate, and view fully public real-time results.

> **This is not an official election system.** Jua Kiongozi ’27 is not affiliated with, endorsed by,
> or a substitute for the Independent Electoral and Boundaries Commission (IEBC) or any official
> Kenyan electoral process. Results are public sentiment only and carry no electoral or legal
> weight. This disclaimer appears in the footer of every page, on the About page, and on the
> registration screen.

---

## Table of contents

- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Deploying to Vercel](#deploying-to-vercel)
- [Architecture](#architecture)
- [Security model](#security-model)
- [Design system](#design-system)
- [Accessibility](#accessibility)
- [Common tasks](#common-tasks)
- [Known limitations](#known-limitations)
- [Before you launch](#before-you-launch)

---

## Quick start

Requires **Node 18.17+** and a **PostgreSQL 14+** database.

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
#    Fill in DATABASE_URL, then generate each secret:
#    openssl rand -base64 48

# 3. Create the schema and seed the seven candidates
npm run db:migrate
npm run db:seed

# 4. Run
npm run dev          # http://localhost:3000
```

To create a local database first:

```bash
createdb jua_kiongozi_2027
# DATABASE_URL="postgresql://<user>@localhost:5432/jua_kiongozi_2027?schema=public"
```

### Scripts

| Script | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | `prisma generate` + `migrate deploy` + seed + production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:deploy` | Apply existing migrations (production/CI) |
| `npm run db:seed` | Seed or refresh the seven candidates (idempotent) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:reset` | **Drops all data**, re-migrates, re-seeds |

---

## Environment variables

All are required in production. The app fails loudly at startup rather than silently falling back to
a weak default.

| Variable | Purpose | Rotatable? |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | yes |
| `JWT_SECRET` | Signs the HTTP-only session cookie | yes — logs everyone out |
| `TOKEN_HASH_SECRET` | Pepper for hashing voting tokens | **no** — invalidates every token ever issued |
| `TOKEN_ENCRYPTION_KEY` | AES-256 key making tokens retrievable by their owner | yes — old tokens become unretrievable, but still work |
| `IDENTITY_HASH_SECRET` | Pepper for hashing ID and phone numbers | **no** — locks out every existing account |
| `NEXT_PUBLIC_SITE_URL` | Absolute URLs and QR payloads | yes |
| `SMS_PROVIDER` | Delivers registration codes. **Required in production** | yes |
| `AT_API_KEY` / `AT_USERNAME` | Africa's Talking credentials, if that provider is selected | yes |
| `TRUSTED_PROXY_HOPS` | Reverse proxies in front of the app. Required off Vercel | yes |

Secrets must be at least 32 characters. Generate with `openssl rand -base64 48`.

**`SMS_PROVIDER` is not optional in production.** Registration is gated on a code sent to the
citizen's phone, and that gate is the only thing making a fake account cost anything. With no
provider configured the app refuses to issue codes rather than waving registrations through.
Unset (or `console`) is a development-only mode that prints the code to the server log.

**`TRUSTED_PROXY_HOPS` must match your topology.** Rate limiting reads the client IP that many
entries from the *right* of `X-Forwarded-For`, because that header is append-only and everything
further left was supplied by the caller. Leave it unset on Vercel, which supplies a trustworthy IP
directly. Set it to the number of proxies you actually run — too high lets clients spoof their
bucket, too low lumps everyone behind the proxy into one.

**Treat the two hash secrets as permanent.** They are not encryption keys that can be rotated —
rotating either makes existing hashes unmatchable, which means nobody can log in and no token can be
verified. Back them up somewhere durable before going live.

---

## Deploying to Vercel

`.env` is gitignored, so **nothing in it reaches Vercel**. Every variable in the table above must be
re-entered under Project → Settings → Environment Variables, for the Production environment. A
missing secret throws at first use, and a page that queries the database throws on render — both
surface as the generic "Something went wrong" boundary with a `Reference:` digest.

**1. Use a hosted Postgres, with the pooled connection string.** Serverless functions open a
connection per invocation and will exhaust a direct Postgres connection limit under any real
traffic. Neon and Supabase both expose a separate pooled host — use that one, and append
`?pgbouncer=true&connection_limit=1` for Prisma.

**2. Leave `TRUSTED_PROXY_HOPS` unset.** Vercel supplies a trustworthy client IP directly. Setting a
hop count here would read the wrong end of a header Vercel already normalised.

**3. `SMS_PROVIDER` is required.** Without it, `/api/auth/request-otp` returns 503 and nobody can
register — the app refuses to hand out accounts it cannot gate. The rest of the site still works.

### The build applies migrations and seeds

```
prisma generate && prisma migrate deploy && prisma db seed && next build
```

`migrate deploy` is what creates the tables. Without it a correctly configured `DATABASE_URL` still
yields a schema-less database, and every page that reads it throws. It never generates new
migrations and never drops data, so it is safe to run on every deploy. The seed upserts the seven
candidates and touches nothing else, so it will not disturb accumulated votes.

Two consequences worth knowing:

- **The build now fails loudly if `DATABASE_URL` is missing or unreachable**, rather than succeeding
  and producing a deployment that errors on every request. That is the intended trade.
- **The seed runs `tsx`, a devDependency.** Vercel installs devDependencies at build time by
  default. If you switch to a production-only install, move the seed to a separate one-off step.

### Reading an error reference

The `Reference:` string on the error page is Next.js's `error.digest`. The same digest is printed in
Vercel → your deployment → **Runtime Logs**, next to the real stack trace, which the browser
deliberately never receives. Search the logs for that number to get the actual exception.

---

## Architecture

A single Next.js repo with an enforced separation between layers:

```
/app                     Routes only — pages and thin API handlers
  /(marketing)           Landing, about, how-it-works, privacy, terms
  /(auth)                register, login, voter-card
  /candidates            Grid + [slug] profiles
  /transparency          Public analytics dashboard
  /api                   Route handlers: validate → call a service → return JSON

/backend                 All business logic. Never imports React.
  /config                Validated environment access
  /db                    Prisma singleton
  /services              auth, token, vote, flag, analytics, candidate, session
  /repositories          One per model — the only place Prisma is queried
  /validators            Zod schemas + shared types (imported by BOTH layers)
  /utils                 crypto, rate limiting, HTTP envelope

/frontend                All UI. Never touches the database or crypto.
  /components            ui, layout, hero, candidates, analytics, forms, voter-card
  /hooks                 reduced motion, device capability, 3D tilt
  /lib                   fetch wrappers, formatting
  /stores                Zustand (one store, for the registration hand-off)

/prisma                  schema.prisma, migrations, seed.ts
```

**The rules, and why they hold:**

- `/app/api` handlers are thin: parse with Zod, call a service, return. No business logic.
- `/backend` never imports React; `/frontend` never imports Prisma or `node:crypto`. Server-only
  modules import the `server-only` package, so a mistaken client import fails the build instead of
  leaking secrets into the bundle.
- Zod schemas in `/backend/validators` are imported directly by the React forms, so client and
  server validation cannot drift apart. Type-only imports from `/backend` are erased at compile time
  and never reach the client bundle.

### Data model

`User` → `VotingToken` → `TokenUsage` → `Candidate`, plus `Vote`, `Flag` and `RateLimit`.

The integrity guarantees live in the database, not only in application code:

| Constraint | Guarantees |
|---|---|
| `User.phoneHash` unique | One account per phone number |
| `User.idNumberHash` unique | One account per national ID |
| `Vote @@unique([userId, candidateId])` | One vote per citizen per candidate |
| `Flag @@unique([userId, candidateId])` | One flag per citizen per candidate |
| `TokenUsage @@unique([tokenId, candidateId])` | A token can never be replayed against a candidate |

Application-level checks exist too, but only to produce friendly error messages. The constraints
above are what hold under two simultaneous requests.

---

## Security model

**Nothing sensitive is stored in readable form.** National ID numbers and phone numbers exist in the
database only as HMAC-SHA256 digests keyed with a server-side pepper, and are never recoverable.
Voting tokens are stored as a digest *and* as AES-256-GCM ciphertext, so a citizen can retrieve their
own token — readable only with `TOKEN_ENCRYPTION_KEY`, which is not in the database.

Verified against a live database — a full table dump contains no raw ID, phone number or token:

```
name          | phoneHash            | phoneMasked | idNumberHash         | idMasked
Amina Wanjiku | 641f5eed5ab246eb...  | ***678      | 4c723645e09c72ce...  | ***789
```

### Why peppered HMAC rather than per-record salted bcrypt

These three values are *lookup keys* — the database must answer "does this ID already exist?" and
"which token is this?" without scanning every row. A per-record random salt makes that impossible by
construction. A keyed HMAC gives the property that actually matters: an attacker holding the entire
database still cannot brute-force the ~8-digit Kenyan ID space, because the key is not in it.

### The token lifecycle

1. Generated from 32 bytes of `crypto.randomBytes` — never derived from the ID, phone, name or
   timestamp.
2. Encoded in Crockford base32 without `I`, `L`, `O` or `U`, the characters people most often
   mistranscribe. Hyphens are cosmetic; the token verifies with or without them.
3. Stored two ways: as an HMAC hash, which is the only value any verification path reads, and as an
   AES-256-GCM ciphertext, which exists solely so the owner can retrieve it later. The raw value is
   returned by `POST /api/auth/register` and by `POST /api/auth/reveal-token`, and is never logged.
   **It is never reissued** — retrieval returns the same token, so nothing an impostor does can
   replace a token they cannot read.
4. Handed to the Voter Card screen through an in-memory Zustand store, never via the URL (which
   lands in history, logs and referrer headers) or `localStorage` (which persists indefinitely).
5. Spent per candidate, recorded permanently in `TokenUsage`.

### Defence in depth

- **Sessions do not grant voting authority.** Every submission must also present the raw token. A
  stolen session cookie cannot cast a rating — and cannot retrieve the token either, because
  `POST /api/auth/reveal-token` additionally requires the account's own phone number and a fresh SMS
  code. Retrieval is deliberately a second factor, not a session privilege.
- **Session cookies** are `httpOnly`, `sameSite=lax`, and `secure` in production.
- **Registration requires a code sent by SMS.** The national ID number is a self-declaration that
  nothing on this platform can verify — any 7-to-9 digit string is shape-valid. Proving control of a
  phone number is what stops accounts from being free to mint: a thousand fake voters needs a
  thousand real SIMs, not a thousand invented numbers. See [Known limitations](#known-limitations)
  for what this still does not prove.
- **Rate limiting is database-backed, not in-memory** — the deployment target is serverless, where
  process memory dies on every cold start and would be trivially bypassed by fanning requests across
  instances. Registration, login and voting are each limited by IP *and* by phone number
  independently.
- **Rate limit buckets cannot be chosen by the caller.** The client IP comes from the platform, or
  from a hop count into `X-Forwarded-For` that the caller cannot influence. Reading the left-most
  entry — the common shortcut — lets anyone reset every limit by rotating one header.
- **Each bucket is consumed in a single atomic statement.** Read-then-check-then-increment races:
  concurrent requests all read the same count, all see room, and all proceed, which caps concurrency
  rather than volume.
- **Rate limiting fails closed.** It shares a database with everything it guards, so if Postgres is
  unreachable the guarded operation is failing anyway — failing open would remove the brake without
  keeping anything alive.
- **Uniform rejection messages.** Unknown account, wrong token and revoked token return the same
  status and message, and the login path performs the same lookups in every case, so it cannot be
  used to enumerate registered phone numbers by response *or* by timing.
- **Registration never names a duplicate ID.** A conflicting phone is reported plainly, because the
  caller just proved they hold that SIM. A conflicting national ID gets a generic message with no
  field annotation — otherwise verifying one phone would buy the ability to test whether any given
  stranger has registered, which is exactly the political-participation leak the hashing exists to
  prevent.
- **The QR code on the Voter Card encodes the public serial only**, never the token. A photographed
  card does not leak voting authority.
- **CSV injection is neutralised** — cells beginning `=`, `+`, `-` or `@` are prefixed before export.

---

## Design system

"Vibrant elegance with depth": a near-black navy base (`#0A0E1A`) with the three Kenyan flag accents
used as *light* — glows, gradient meshes, card edges — rather than flat blocks.

- **Type:** Fraunces (display) over Inter (body), both variable, `display: swap`.
- **Depth:** a lazy-loaded React Three Fiber scene behind the hero, cursor-following 3D tilt on cards
  and the Voter Card, layered parallax on scroll, and frosted-glass panels.

### Chart palettes were validated, not eyeballed

Both palettes were checked with a CVD/contrast validator against the dark chart surface (`#131A29`).

**Vote choices** (`#2F8FD9` / `#D06D9E` / `#C2871F`) pass every check on all pairs: OKLCH lightness
band, chroma floor, ≥3:1 contrast, and OKLab ΔE above both the colour-vision-deficiency target and
the normal-vision floor.

**Trust flags** are a harder case worth understanding before changing them. Green → Orange → Red →
Black is the product's vocabulary, so the hues are fixed by the domain — and that is the classic
colourblind-hostile traffic-light scale. It is therefore treated as an **ordinal severity ramp**
rather than a free categorical palette: the four steps have strictly decreasing OKLCH lightness
(0.68 → 0.61 → 0.55 → 0.49, every gap ≥ 0.06).

The consequence that matters: **lightness carries the ordering, so the ramp stays readable under any
colour-vision deficiency.** Red and orange remain close in hue, so secondary encoding is mandatory —
every segment and swatch ships with a visible text label and a 2px surface gap, and the transparency
page carries a full table view of the same data. Do not render these colours bare.

Both palettes are defined once in [`backend/validators/vote.validator.ts`](backend/validators/vote.validator.ts)
and mirrored into the Tailwind theme.

---

## Accessibility

- Every interactive element has a visible, high-contrast focus ring (a subtle one disappears against
  this palette).
- Vote and flag selectors are proper `radiogroup`s with `aria-checked` and arrow-key support.
- Charts are never colour-alone: legends are always present, meanings are spelled out in text, and a
  full table view of the same data sits on the transparency page.
- Carousel autoplay pauses on hover, on focus and when the tab is hidden, and has an explicit
  pause/play control.
- `prefers-reduced-motion` is honoured in CSS *and* in JS — the WebGL scene is never mounted, rather
  than merely animating at zero duration.
- Skip-to-content link, labelled form fields, `role="alert"` on errors, alt text throughout.

### Graceful degradation

The 3D scene is withheld — falling back to designed gradient art, not a broken state — when the user
prefers reduced motion, the viewport is phone-sized, the device reports ≤4 cores or ≤4 GB RAM, the
connection is metered or slow, or WebGL is unavailable. It loads via `next/dynamic` with
`ssr: false`, so three.js is not in the initial bundle and is never requested on a device that fails
the probe.

---

## Common tasks

### Adding candidate photographs

The seed ships `photoUrl: null` for most candidates and the UI renders a designed monogram — this is
an *expected* state, not a missing asset. Bundle a photograph only where the project holds a licence
for that likeness.

To add them: place files in `/public/candidates/`, set `photoUrl` (e.g.
`/candidates/martha-karua.jpg`) in `prisma/seed.ts`, and re-run `npm run db:seed`. The seed upserts,
so it will not disturb existing votes.

### Adding or changing a candidate

Edit the `CANDIDATES` array in `prisma/seed.ts` and run `npm run db:seed`.

**Note:** `/candidates/[slug]` sets `dynamicParams = false`, so a newly added candidate needs a
rebuild before their page resolves. This is a deliberate trade — see
[Known limitations](#known-limitations).

The editorial rules at the top of the seed file are not decoration. Bios carry publicly documented
facts only, no attributed quotes, no editorialising, and identical structure and length across all
seven, so no candidate reads as more prominently covered than another.

### Replacing the hero art

The carousel renders hand-built SVG scenes (a few KB, no licensing encumbrance) rather than
photography. To swap in real images, replace the `<Art />` element in
[`frontend/components/hero/hero-carousel.tsx`](frontend/components/hero/hero-carousel.tsx) with
`next/image`. The carousel does not care which it renders.

### Caching

Analytics is memoised for 60 seconds behind a cache tag via `getCachedSnapshot`, shared by the
transparency page, the JSON API and the CSV export. Caching the *computation* rather than the route
is deliberate: the CSV endpoint reads `searchParams`, which makes that route dynamic and would
silently disable route-level caching.

Vote and flag submissions call `revalidateTag`, so new ratings appear immediately rather than waiting
out the window.

---

## Known limitations

Stated plainly rather than buried.

1. **`notFound()` returns HTTP 200 on unknown candidate slugs.** The correct "Page not found" page
   renders, but Next.js 14.2 does not set a 404 status for `notFound()` inside a matched dynamic
   segment. Confirmed by experiment not to be caused by the async root layout.
   `dynamicParams = false` limits the affected URLs to a fixed set, none of which are linked from
   anywhere. Worth revisiting on Next 15.

2. **Results are self-selected, not a representative sample.** Participants opt in rather than being
   randomly sampled, so results describe the people who used this platform — likely younger, more
   urban and more online than Kenya as a whole. This is stated on the transparency page, the About
   page and the terms, and should not be quietly dropped when results are reported.

3. **Tokens are recoverable, which is a deliberate weakening.** The token is stored encrypted as
   well as hashed so its owner can retrieve it, gated behind the registered phone plus a fresh SMS
   code. The cost is real and should be stated plainly: an attacker holding *both* a database dump
   and `TOKEN_ENCRYPTION_KEY` can read every token and vote as anyone, which was impossible when
   only hashes existed. Keep the key out of the database's blast radius. Tokens issued before this
   change have no ciphertext and remain permanently unrecoverable.

4. **Identity is not verified against any registry.** The platform checks that an ID number has not
   been used twice; it cannot check that the number belongs to the person entering it, or that it
   exists at all. SMS verification raises the cost of a fake account from nothing to the price of a
   SIM card, but a determined actor with a box of SIMs can still register under invented ID numbers.
   Duplicate voting requires impersonating distinct citizens rather than merely clicking twice —
   that is the honest guarantee, and it is weaker than an official roll.

5. **Registration still leaks one bit per verified phone.** Submitting a national ID that is already
   registered fails, and submitting a fresh one succeeds, so a caller who controls a SIM can learn
   whether one specific ID is registered. This cannot be closed without silently accepting duplicate
   registrations. What changed is the price: each probe now costs an SMS, and a *successful* probe
   consumes the prober's own registration, so a phone number buys roughly one question rather than
   unlimited ones.

6. **Aggregate analytics can be differenced over time.** `/api/analytics` is public and is
   revalidated on every submission, and the county breakdown has no minimum cell size. An observer
   polling it and diffing consecutive snapshots can attribute a single new rating to a candidate,
   choice and county — re-identifying in a sparsely represented county. Suppressing small cells and
   decoupling the public snapshot from per-vote invalidation would close this.

7. **No security response headers.** `next.config.mjs` sets no CSP, HSTS, `X-Frame-Options` or
   `Referrer-Policy`, so the voting widget can be framed for clickjacking.

5. **No automated test suite.** Flows were verified end-to-end against a live database (registration,
   duplicate rejection across phone formats, ballot submission, single-use enforcement, invalid-token
   rejection, session-less rejection, rate limiting, CSV export, page rendering, auth redirects).
   Adding Vitest/Playwright coverage is the obvious next step before this takes real traffic.

---

## Before you launch

**This section is not optional if you intend to collect real national ID numbers.**

- [ ] **Register with the Office of the Data Protection Commissioner** as a data controller under
      Kenya's Data Protection Act, 2019.
- [ ] **Complete a Data Protection Impact Assessment.** Collecting national ID numbers at scale
      almost certainly requires one.
- [ ] **Have `/privacy-policy` and `/terms` reviewed by counsel.** The current pages are a good-faith
      technical description of what the software does, not legal advice.
- [ ] **Back up `TOKEN_HASH_SECRET` and `IDENTITY_HASH_SECRET`** somewhere durable and separate from
      the database. Losing either bricks every account permanently.
- [ ] **Store `TOKEN_ENCRYPTION_KEY` outside the database's blast radius** — a secrets manager, not
      an env file sitting next to a backup. It is the one key that turns a database dump into the
      ability to vote as anyone.
- [ ] **Put the database behind TLS with restricted network access**, and confirm backups are
      encrypted at rest.
- [ ] **Configure `SMS_PROVIDER` and confirm codes actually arrive** on all three Kenyan networks.
      Registration is dead without it — by design, since the alternative is registration being free.
- [ ] **Set `TRUSTED_PROXY_HOPS` to match your deployment**, unless you are on Vercel. Getting this
      wrong either lets clients pick their own rate-limit bucket or throttles every user as one.
- [ ] **Budget for SMS.** Codes cost money per send, which makes the request-code endpoint a
      denial-of-wallet target as well as an abuse vector — watch the `otp:*` rate-limit buckets.
- [ ] **Add monitoring** on the registration and vote endpoints — a sudden spike is the signal that
      the rate limits need tightening.
- [ ] **Add an automated test suite**, covering the token single-use path in particular.
- [ ] **Consider a defamation review** of the trust-flag feature. Publishing aggregate "black flag"
      counts against named living public figures carries reputational-harm risk worth taking advice
      on in the Kenyan context.

---

## Licence

No licence has been specified. Add one before publishing.
# jua-kiongozi-2027
