import 'server-only'
import { env } from '@/backend/config/env'

/**
 * Outbound SMS, behind a provider-agnostic seam.
 *
 * WHY THIS FAILS CLOSED
 * ─────────────────────
 * Verification codes are the only cost imposed on registration. If delivery
 * silently no-ops in production, every registration would be gated on a code
 * that reaches nobody — which either locks out every real citizen or, worse,
 * gets "temporarily" bypassed and leaves the platform wide open again. So an
 * unconfigured provider is a hard startup-time error in production, and only in
 * development does the code fall back to the server log.
 */

export class SmsDeliveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SmsDeliveryError'
  }
}

type SmsProvider = (to: string, message: string) => Promise<void>

/**
 * Africa's Talking — the common choice for Kenyan numbers. Kept as the only
 * built-in because a second half-tested provider is worse than none; anything
 * else should be added here deliberately.
 */
const africasTalking: SmsProvider = async (to, message) => {
  const apiKey = process.env.AT_API_KEY
  const username = process.env.AT_USERNAME

  if (!apiKey || !username) {
    throw new SmsDeliveryError(
      'SMS_PROVIDER=africastalking requires AT_API_KEY and AT_USERNAME to be set.',
    )
  }

  const response = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      username,
      to,
      message,
      ...(process.env.AT_SENDER_ID ? { from: process.env.AT_SENDER_ID } : {}),
    }),
  })

  if (!response.ok) {
    // The body may carry the subscriber's number, so it is deliberately not
    // interpolated into an error that could surface in a log aggregator.
    throw new SmsDeliveryError(`SMS provider rejected the request (HTTP ${response.status}).`)
  }
}

/**
 * Development sink. Prints the code to the server console so the flow is
 * testable without a provider account. Never reachable in production — the
 * guard in `sendSms` runs first.
 */
const consoleSink: SmsProvider = async (to, message) => {
  console.info(`\n  ┌─ SMS (development sink — not delivered)\n  │ to: ${to}\n  │ ${message}\n  └─\n`)
}

function resolveProvider(): SmsProvider {
  switch (process.env.SMS_PROVIDER) {
    case 'africastalking':
      return africasTalking
    case 'console':
      return consoleSink
    default:
      return env.isProduction ? failClosed : consoleSink
  }
}

const failClosed: SmsProvider = async () => {
  throw new SmsDeliveryError(
    'No SMS provider is configured. Set SMS_PROVIDER before running in production — ' +
      'registration cannot verify phone numbers without one.',
  )
}

/**
 * Sends one message. Throws on failure so the caller can refuse to record a
 * verification challenge that the citizen will never receive.
 */
export async function sendSms(to: string, message: string): Promise<void> {
  await resolveProvider()(to, message)
}
