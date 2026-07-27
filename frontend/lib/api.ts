import type { AccountStatus, LoginResult, RegistrationResult } from '@/backend/services/auth.service'
import type { OtpChallenge } from '@/backend/services/otp.service'
import type { RevealedToken } from '@/backend/services/token.service'
import type { BallotReceipt } from '@/backend/services/vote.service'
import type { CandidateSummary } from '@/backend/services/candidate.service'
import type { AnalyticsSnapshot } from '@/backend/validators'
import type {
  LoginInput,
  RegisterInput,
  RequestOtpInput,
  RevealTokenInput,
  SubmitBallotPayload,
} from '@/backend/validators'

/**
 * Client-side wrappers around `/app/api`.
 *
 * This is the only place the frontend talks to the network. Components import
 * these functions rather than calling `fetch` directly, so error shaping and
 * the response envelope are handled in exactly one place.
 *
 * Type-only imports from `/backend` are erased at compile time, so no
 * server code is ever pulled into the client bundle.
 */

export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } }

/** A failed request, carrying per-field messages for form display. */
export class RequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'RequestError'
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
  } catch {
    // Network-level failure: no response at all. Common on the intermittent
    // mobile connections a large share of users will be on.
    throw new RequestError(
      'NETWORK_ERROR',
      'Could not reach the server. Check your connection and try again.',
    )
  }

  let payload: ApiEnvelope<T>

  try {
    payload = (await response.json()) as ApiEnvelope<T>
  } catch {
    throw new RequestError('BAD_RESPONSE', 'The server returned an unexpected response.')
  }

  if (!payload.ok) {
    throw new RequestError(
      payload.error.code,
      payload.error.message,
      payload.error.fields,
      response.status,
    )
  }

  return payload.data
}

export const api = {
  /**
   * Sends the SMS code that `register` requires. Resolves identically whether or
   * not the number is already registered — the server refuses to distinguish.
   */
  requestOtp(input: RequestOtpInput): Promise<OtpChallenge> {
    return request<OtpChallenge>('/api/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  register(input: RegisterInput): Promise<RegistrationResult> {
    return request<RegistrationResult>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  login(input: LoginInput): Promise<LoginResult> {
    return request<LoginResult>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  session(): Promise<AccountStatus | null> {
    return request<AccountStatus | null>('/api/auth/session')
  },

  signOut(): Promise<{ signedOut: boolean }> {
    return request<{ signedOut: boolean }>('/api/auth/session', { method: 'DELETE' })
  },

  /**
   * Retrieves the signed-in citizen's own voting token. Requires the account's
   * phone number plus a fresh SMS code — a session alone is not sufficient.
   */
  revealToken(input: RevealTokenInput): Promise<RevealedToken> {
    return request<RevealedToken>('/api/auth/reveal-token', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  verifyToken(token: string): Promise<{ valid: boolean; spentCandidateIds: string[] }> {
    return request('/api/auth/verify-token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
  },

  candidates(): Promise<CandidateSummary[]> {
    return request<CandidateSummary[]>('/api/candidates')
  },

  /** Submits the sentiment vote and the trust flag together, atomically. */
  submitBallot(payload: SubmitBallotPayload): Promise<BallotReceipt> {
    return request<BallotReceipt>('/api/vote', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  analytics(): Promise<AnalyticsSnapshot> {
    return request<AnalyticsSnapshot>('/api/analytics')
  },
}

export const CSV_EXPORT_URL = '/api/analytics?format=csv'
