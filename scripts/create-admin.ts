/**
 * Creates or updates a platform operator.
 *
 *   ADMIN_USERNAME=oneterm ADMIN_PASSWORD='...' npm run admin:create
 *
 * Or set both in `.env` (which is gitignored) and run `npm run admin:create`.
 *
 * WHY A SCRIPT AND NOT A SEED ENTRY
 * ─────────────────────────────────
 * `prisma db seed` runs on every reset and its file is committed, so a
 * credential placed there would live in git history forever and be recreated
 * every time the database was rebuilt. Reading from the environment means the
 * password exists in exactly two places — the operator's password manager and a
 * bcrypt hash in the database — and in neither case in the repository.
 *
 * Re-running with the same username rotates that operator's password rather
 * than failing, which is the behaviour you want at 2am.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/** Cost 12: ~250ms per attempt on current hardware. */
const BCRYPT_COST = 12

function requireEnv(name: string): string {
  const value = process.env[name]

  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing ${name}. Run:\n\n` +
        `  ADMIN_USERNAME=<name> ADMIN_PASSWORD='<password>' npm run admin:create\n\n` +
        `or set both in .env`,
    )
  }

  return value
}

async function main() {
  const username = requireEnv('ADMIN_USERNAME').trim().toLowerCase()
  const password = requireEnv('ADMIN_PASSWORD')

  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters.')
  }

  // bcrypt truncates silently at 72 bytes. Failing loudly is better than
  // storing a hash of a password that is not the one the operator set.
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('ADMIN_PASSWORD must be 72 bytes or fewer (bcrypt truncates beyond that).')
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)

  const admin = await prisma.admin.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash },
  })

  const total = await prisma.admin.count()

  console.log(`✓ Operator "${admin.username}" is ready (${total} total).`)
  console.log('  Sign in at /admin/login — the entry point is the dot at the left of the footer.')
  console.log('  The password is not stored anywhere in this repository.')
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
