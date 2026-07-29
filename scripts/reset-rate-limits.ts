/**
 * Clears every rate-limit bucket and any unconsumed verification challenge.
 *
 * For the case that prompted it: exercising registration or sign-in repeatedly
 * exhausts the per-phone allowance, and there is then no way to continue except
 * waiting out the window. This is the escape hatch.
 *
 *   npm run db:reset-limits
 *
 * Refuses to run against a production database — the limits are a live control
 * there, and wiping them mid-incident would remove the brake at exactly the
 * wrong moment.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const url = process.env.DATABASE_URL ?? ''

  if (process.env.NODE_ENV === 'production' || /prod/i.test(url)) {
    throw new Error(
      'Refusing to clear rate limits against what looks like a production database.',
    )
  }

  const limits = await prisma.rateLimit.deleteMany({})
  const challenges = await prisma.phoneVerification.deleteMany({ where: { consumedAt: null } })

  console.log(`Cleared ${limits.count} rate-limit buckets.`)
  console.log(`Cleared ${challenges.count} unconsumed verification challenges.`)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
