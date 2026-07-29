'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, LogIn } from 'lucide-react'
import { adminLoginSchema } from '@/backend/validators'
import { Button } from '@/frontend/components/ui/button'
import { Field, FieldLabel, Input } from '@/frontend/components/ui/field'
import { api, RequestError } from '@/frontend/lib/api'

/**
 * Operator sign-in.
 *
 * Note the absence of the usual conveniences: no "remember me", no password
 * reset link, no hint about whether the username exists. Recovery is
 * deliberately out-of-band — `npm run admin:create` re-runs against the same
 * username to rotate a password — because an emailed reset link would make the
 * console only as strong as an inbox.
 */
export function AdminLoginForm() {
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)
    setErrors({})

    const parsed = adminLoginSchema.safeParse({ username, password })

    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.')
        if (!next[key]) next[key] = issue.message
      }
      setErrors(next)
      return
    }

    setSubmitting(true)

    try {
      await api.adminLogin(parsed.data)
      router.replace('/admin')
      // The console is force-dynamic and reads the cookie that was just set;
      // refresh discards any RSC payload cached before sign-in.
      router.refresh()
    } catch (error) {
      setFormError(
        error instanceof RequestError ? error.message : 'Could not sign in. Please try again.',
      )
      setPassword('')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {formError ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-flame/30 bg-flame/10 p-3.5 text-sm text-bone"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-flame" aria-hidden />
          {formError}
        </p>
      ) : null}

      {/* No `id` on these controls: Field supplies one through context and
          FieldLabel points at it, so an explicit id would spread over the
          generated one and silently break the label association. */}
      <Field error={errors.username}>
        <FieldLabel>Username</FieldLabel>
        <Input
          name="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </Field>

      <Field error={errors.password}>
        <FieldLabel>Password</FieldLabel>
        <Input
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </Field>

      <Button type="submit" variant="primary" size="lg" className="w-full" loading={submitting}>
        <LogIn className="h-4 w-4" aria-hidden />
        Sign in
      </Button>
    </form>
  )
}
