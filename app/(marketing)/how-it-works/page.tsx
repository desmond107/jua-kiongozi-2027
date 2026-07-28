import type { Metadata } from 'next'
import Link from 'next/link'
import { FLAG_COLOR_ORDER, FLAG_META, VOTE_CHOICE_META, VOTE_CHOICE_ORDER } from '@/backend/validators'
import { Button } from '@/frontend/components/ui/button'
import { PageContainer, SectionHeading } from '@/frontend/components/ui/primitives'

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'How Jua Kiongozi ’27 issues voting tokens, enforces one rating per person per candidate, and protects the national ID numbers it collects.',
}

const STEPS = [
  {
    step: '01',
    title: 'You register once',
    body: 'You provide your name, phone number, county and national ID number. Before anything is written to the database, your ID number and phone number are put through a keyed cryptographic hash — a one-way transformation. The originals are never stored.',
  },
  {
    step: '02',
    title: 'A token is generated',
    body: 'The server generates a voting token from 32 bytes of cryptographically secure randomness. It is not derived from your ID, your phone number, your name, or the time you registered — knowing any of those tells an attacker nothing about your token.',
  },
  {
    step: '03',
    title: 'You see it once, and can retrieve it later',
    body: 'The token is displayed on your Voter Card at registration. You can retrieve it again afterwards, but only by proving control of the phone number the account was registered with — you must supply that number and a fresh code sent to it. A session alone is never enough, so a borrowed or stolen laptop does not hand over your vote.',
  },
  {
    step: '04',
    title: 'You rate a candidate',
    body: 'You submit one sentiment vote and one trust flag together. The server re-hashes the token you present, matches it against the stored hash, confirms it belongs to your account, and confirms it has not already been spent on that candidate.',
  },
  {
    step: '05',
    title: 'The token is spent',
    body: 'That candidate is recorded against your token permanently. You can go on to rate the other candidates, but you can never rate the same candidate twice. This is enforced by a uniqueness constraint in the database itself, not merely by application code — so it holds even under two simultaneous requests.',
  },
  {
    step: '06',
    title: 'The tally updates publicly',
    body: 'Your response joins the aggregate counts on the transparency dashboard within a minute. Nothing published there can be traced back to you: the export contains counts per candidate and nothing else.',
  },
]

export default function HowItWorksPage() {
  return (
    <PageContainer className="py-20">
      <div className="mx-auto max-w-3xl space-y-16">
        <SectionHeading
          eyebrow="Methodology"
          title="How one person comes to count exactly once"
          description="The mechanics of registration, token issuance and vote submission, described in plain language."
        />

        <ol className="space-y-4">
          {STEPS.map((item) => (
            <li key={item.step} className="glass flex gap-5 p-6">
              <span className="font-display text-2xl font-semibold text-gold/50">{item.step}</span>
              <div className="space-y-2">
                <h2 className="font-display text-lg font-semibold text-bone">{item.title}</h2>
                <p className="text-sm leading-relaxed text-bone-muted">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* What you are actually asked */}
        <section className="space-y-6">
          <h2 className="font-display text-xl font-semibold text-bone">What you are asked</h2>

          <div className="glass space-y-4 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-gold">
              The sentiment vote
            </h3>
            <p className="text-sm text-bone-muted">
              Would you consider supporting this candidate for President in 2027?
            </p>
            <ul className="space-y-2">
              {VOTE_CHOICE_ORDER.map((choice) => (
                <li key={choice} className="text-sm text-bone-dim">
                  <strong className="font-semibold text-bone">
                    {VOTE_CHOICE_META[choice].label}
                  </strong>{' '}
                  — {VOTE_CHOICE_META[choice].description}
                </li>
              ))}
            </ul>
          </div>

          <div className="glass space-y-4 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-gold">
              The trust flag
            </h3>
            <p className="text-sm text-bone-muted">
              How much trust do you place in this candidate? The four flags run from no concerns
              through to outright rejection.
            </p>
            <ul className="space-y-2.5">
              {FLAG_COLOR_ORDER.map((color) => (
                <li key={color} className="flex items-start gap-3 text-sm">
                  <span
                    className="mt-1 h-3 w-3 shrink-0 rounded-full ring-2 ring-white/15"
                    style={{ backgroundColor: FLAG_META[color].hex }}
                    aria-hidden
                  />
                  <span className="text-bone-dim">
                    <strong className="font-semibold text-bone">
                      {FLAG_META[color].label} flag
                    </strong>{' '}
                    — {FLAG_META[color].description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Integrity */}
        <section className="space-y-5">
          <h2 className="font-display text-xl font-semibold text-bone">
            What stops someone gaming this
          </h2>
          <div className="space-y-4 text-base leading-relaxed text-bone-muted">
            <p>
              A phone number and a national ID hash can each appear only once in the database. That
              rule is enforced by the database itself, so it cannot be bypassed by racing two
              requests or by finding a gap in the application logic.
            </p>
            <p>
              Registration and voting are both rate-limited, by network address and by phone number
              independently, which makes automated bulk registration impractical rather than merely
              inconvenient.
            </p>
            <p>
              Signing in does not grant voting authority on its own — every submission must also
              present the raw token. A stolen session cookie therefore cannot cast a rating on its
              own, and retrieving the token needs a fresh code sent to your registered phone.
            </p>
            <p className="text-sm text-bone-dim">
              No system of this kind is perfect, and it would be dishonest to claim otherwise. What
              this design guarantees is that casting duplicate ratings requires genuinely
              impersonating distinct citizens, rather than simply clicking twice.
            </p>
          </div>
        </section>

        {/* Privacy */}
        <section className="space-y-5">
          <h2 className="font-display text-xl font-semibold text-bone">What we know about you</h2>
          <div className="glass space-y-3 p-6 text-sm leading-relaxed text-bone-muted">
            <p>
              <strong className="text-bone">Stored:</strong> your name, a hash of your phone number,
              a hash of your ID number, the last three digits of each for your own recognition, and
              your county.
            </p>
            <p>
              <strong className="text-bone">Never stored in readable form:</strong> your national ID
              number and your phone number. Both exist on our servers only as irreversible hashes,
              and cannot be read back — not by us, and not by anyone who obtained a copy of the
              database.
            </p>
            <p>
              <strong className="text-bone">Stored encrypted:</strong> your voting token. So that we
              can show it to you again after you prove control of your phone, the token is held
              encrypted rather than hashed. Being honest about the trade-off: unlike your ID number,
              this one <em>is</em> reversible by design. It is protected by an encryption key held
              separately from the database, so a stolen database alone does not expose it — but a
              stolen database <em>and</em> that key would.
            </p>
            <p>
              <strong className="text-bone">Never published:</strong> anything that could identify
              you. The public dashboard and CSV export contain aggregate counts only.
            </p>
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="primary">
            <Link href="/register">Register and get your token</Link>
          </Button>
          <Button asChild variant="glass">
            <Link href="/transparency">See the live results</Link>
          </Button>
        </div>
      </div>
    </PageContainer>
  )
}
