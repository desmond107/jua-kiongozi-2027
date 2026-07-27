import 'server-only'
import { NextResponse } from 'next/server'
import { ZodError, type ZodSchema } from 'zod'

/**
 * Thin, typed helpers shared by every route handler in `/app/api`.
 *
 * Routes stay declarative: parse → call a service → return. All error shaping
 * happens here so the JSON envelope is identical across the whole API.
 */

export type ApiSuccess<T> = { ok: true; data: T }
export type ApiFailure = {
  ok: false
  error: { code: string; message: string; fields?: Record<string, string> }
}
export type ApiResult<T> = ApiSuccess<T> | ApiFailure

/**
 * A failure that is safe to show the user verbatim.
 *
 * Anything thrown that is NOT an ApiError is treated as an internal fault and
 * reported generically, so an unexpected stack trace can never leak through the
 * response body.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  static badRequest(message: string, fields?: Record<string, string>) {
    return new ApiError(400, 'BAD_REQUEST', message, fields)
  }

  static unauthorized(message = 'You need to sign in to do that.') {
    return new ApiError(401, 'UNAUTHORIZED', message)
  }

  static forbidden(message: string) {
    return new ApiError(403, 'FORBIDDEN', message)
  }

  static notFound(message: string) {
    return new ApiError(404, 'NOT_FOUND', message)
  }

  static conflict(message: string, fields?: Record<string, string>) {
    return new ApiError(409, 'CONFLICT', message, fields)
  }

  static tooManyRequests(message: string, retryAfter: number) {
    const error = new ApiError(429, 'RATE_LIMITED', message)
    ;(error as ApiError & { retryAfter?: number }).retryAfter = retryAfter
    return error
  }
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data } as ApiSuccess<T>, init)
}

export function fail(error: ApiError): NextResponse<ApiFailure> {
  const retryAfter = (error as ApiError & { retryAfter?: number }).retryAfter

  return NextResponse.json(
    {
      ok: false,
      error: { code: error.code, message: error.message, fields: error.fields },
    } as ApiFailure,
    {
      status: error.status,
      headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined,
    },
  )
}

/**
 * Wraps a handler so any thrown ApiError becomes a clean JSON response and any
 * other throw becomes a generic 500 — logged server-side, opaque client-side.
 */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof ApiError) return fail(error)

    if (error instanceof ZodError) {
      return fail(ApiError.badRequest('Please check the form and try again.', zodFields(error)))
    }

    console.error('[api] unhandled error:', error)
    return fail(
      new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.'),
    )
  }
}

/** Flattens a ZodError into `{ fieldName: firstMessage }` for form display. */
export function zodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {}

  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_form'
    if (!fields[key]) fields[key] = issue.message
  }

  return fields
}

/**
 * Parses a JSON request body against a schema, throwing a field-annotated
 * ApiError on failure.
 */
export async function parseBody<S extends ZodSchema>(
  request: Request,
  schema: S,
): Promise<ReturnType<S['parse']>> {
  let raw: unknown

  try {
    raw = await request.json()
  } catch {
    throw ApiError.badRequest('Request body must be valid JSON.')
  }

  const result = schema.safeParse(raw)

  if (!result.success) {
    throw ApiError.badRequest('Please check the form and try again.', zodFields(result.error))
  }

  return result.data
}
