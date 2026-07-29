import { z } from 'zod'
import { KENYAN_COUNTIES } from './counties'

/**
 * Schemas for the operator console.
 *
 * Note what the login schema deliberately does NOT do: it sets no complexity
 * rules, no character-class requirements and no upper length cap beyond a sane
 * ceiling. Those belong at credential-creation time (`scripts/create-admin.ts`),
 * not at the door — validating a submitted password against a policy tells an
 * attacker which guesses are worth making, and rejecting a long one truncates
 * the very passwords that are hardest to guess.
 */

export const adminLoginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Enter your username.')
    .max(64, 'That username is too long.'),
  password: z
    .string()
    .min(1, 'Enter your password.')
    // bcrypt silently ignores input past 72 bytes; rejecting it here is honest
    // about the boundary rather than accepting a password that is not fully read.
    .max(72, 'Password must be 72 characters or fewer.'),
})

export type AdminLoginPayload = z.infer<typeof adminLoginSchema>

/** The datasets an operator may export. */
export const EXPORT_DATASETS = ['registrants', 'county-votes', 'county-flags', 'summary'] as const
export type ExportDataset = (typeof EXPORT_DATASETS)[number]

export const EXPORT_DATASET_LABELS: Record<ExportDataset, string> = {
  registrants: 'Registrants',
  'county-votes': 'Votes by county',
  'county-flags': 'Trust flags by county',
  summary: 'Overall summary',
}

export const exportQuerySchema = z.object({
  dataset: z.enum(EXPORT_DATASETS),
  format: z.enum(['csv', 'xlsx']).default('csv'),
  county: z.enum(KENYAN_COUNTIES).optional(),
})

export type ExportQuery = z.infer<typeof exportQuerySchema>

/**
 * Registrant list filters.
 *
 * `county` is constrained to the 47 rather than left free-text: it is
 * interpolated into a database filter, and an enum makes that provably safe
 * regardless of what arrives on the query string.
 */
export const registrantQuerySchema = z.object({
  county: z.enum(KENYAN_COUNTIES).optional(),
  search: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

export type RegistrantQuery = z.infer<typeof registrantQuerySchema>

export const REGISTRANTS_PER_PAGE = 50
