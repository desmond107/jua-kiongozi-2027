import { z } from 'zod'
import { KENYAN_COUNTIES } from './counties'

/**
 * Shared registration / login schemas.
 *
 * These are imported by BOTH the API routes and the React forms so a rule can
 * never drift between the two layers. Keep this file free of server-only
 * imports.
 */

/** 07…, 01…, +2547…, 2547… or a bare nine-digit subscriber number. */
const KENYAN_PHONE = /^(?:\+?254|0)?[17]\d{8}$/

export const phoneNumberSchema = z
  .string()
  .trim()
  .min(1, 'Phone number is required')
  .transform((value) => value.replace(/[\s-]/g, ''))
  .refine((value) => KENYAN_PHONE.test(value), {
    message: 'Enter a valid Kenyan mobile number, e.g. 0712 345 678',
  })

/**
 * Kenyan national ID numbers are 7–9 digits. Deliberately permissive on length
 * so that older 7-digit IDs are not rejected.
 */
export const idNumberSchema = z
  .string()
  .trim()
  .min(1, 'National ID number is required')
  .transform((value) => value.replace(/[\s-]/g, ''))
  .refine((value) => /^\d{7,9}$/.test(value), {
    message: 'Enter a valid national ID number (7 to 9 digits)',
  })

export const fullNameSchema = z
  .string()
  .trim()
  .min(3, 'Enter your full name as it appears on your ID')
  .max(80, 'Name is too long')
  .refine((value) => value.split(/\s+/).length >= 2, {
    message: 'Enter at least two names',
  })
  .refine((value) => /^[\p{L}\s'.-]+$/u.test(value), {
    message: 'Name may only contain letters, spaces, apostrophes and hyphens',
  })

export const votingTokenSchema = z
  .string()
  .trim()
  .min(1, 'Voting token is required')
  .transform((value) => value.replace(/[\s-]/g, '').toUpperCase())
  .refine((value) => /^[0-9A-Z]{40,60}$/.test(value), {
    message: 'That does not look like a valid voting token',
  })

/**
 * County of residence.
 *
 * Required at registration. A bare `z.enum` would reject an empty selection
 * with "Invalid enum value, expected 'Baringo' | 'Bomet' | …" — the entire
 * 47-county union rendered under the field — so the empty case is caught first
 * and given its own message.
 */
export const countySchema = z.enum(KENYAN_COUNTIES, {
  errorMap: (issue, ctx) => {
    if (issue.code === 'invalid_type' || ctx.data === '' || ctx.data == null) {
      return { message: 'Select your county' }
    }
    return { message: 'Select a county from the list' }
  },
})

/** The six-digit code sent by SMS. Spaces and hyphens are forgiven. */
export const otpCodeSchema = z
  .string()
  .trim()
  .min(1, 'Enter the code we sent you')
  .transform((value) => value.replace(/[\s-]/g, ''))
  .refine((value) => /^\d{6}$/.test(value), {
    message: 'The code is six digits',
  })

export const requestOtpSchema = z.object({
  phoneNumber: phoneNumberSchema,
})

export const registerSchema = z.object({
  name: fullNameSchema,
  phoneNumber: phoneNumberSchema,
  idNumber: idNumberSchema,
  // Proof that the registrant controls the phone number. Without this the ID
  // number is an unverified self-declaration and accounts are free to mint.
  otpCode: otpCodeSchema,
  // Required. Every registration carries a county so the public
  // participation-by-region breakdown covers the whole electorate rather than
  // only the subset who volunteered one.
  county: countySchema,
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms to register' }),
  }),
  acknowledgedNotIebc: z.literal(true, {
    errorMap: () => ({
      message: 'Please confirm you understand this is not an official IEBC platform',
    }),
  }),
})

export const loginSchema = z.object({
  phoneNumber: phoneNumberSchema,
  token: votingTokenSchema,
})

export const verifyTokenSchema = z.object({
  token: votingTokenSchema,
})

/**
 * Retrieving your own token re-proves control of the registered SIM. The phone
 * number is required as well as the code so the server can confirm the number
 * belongs to this account before any code is accepted.
 */
export const revealTokenSchema = z.object({
  phoneNumber: phoneNumberSchema,
  otpCode: otpCodeSchema,
})

export type RegisterInput = z.input<typeof registerSchema>
export type RegisterPayload = z.output<typeof registerSchema>
export type LoginInput = z.input<typeof loginSchema>
export type LoginPayload = z.output<typeof loginSchema>
export type VerifyTokenPayload = z.output<typeof verifyTokenSchema>
export type RequestOtpInput = z.input<typeof requestOtpSchema>
export type RequestOtpPayload = z.output<typeof requestOtpSchema>
export type RevealTokenInput = z.input<typeof revealTokenSchema>
export type RevealTokenPayload = z.output<typeof revealTokenSchema>
