'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { KENYAN_COUNTIES } from '@/backend/validators'
import { Button } from '@/frontend/components/ui/button'

/**
 * County and name filters for the registrant list.
 *
 * State lives in the URL rather than in component state, so a filtered view can
 * be bookmarked, reloaded and shared between operators — and so the export
 * links can be built from exactly the same values the table was rendered from.
 */
export function RegistrantFilters({
  county,
  search,
}: {
  county?: string
  search?: string
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [term, setTerm] = useState(search ?? '')

  function apply(next: { county?: string; search?: string }) {
    const query = new URLSearchParams(params.toString())

    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, value)
      else query.delete(key)
    }

    // Any filter change invalidates the current page number — page 7 of an
    // unfiltered list is rarely page 7 of a filtered one.
    query.delete('page')
    router.push(`/admin/registrants?${query.toString()}`)
  }

  const filtered = Boolean(county || search)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          apply({ search: term.trim() || undefined })
        }}
        className="flex items-center gap-2"
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bone-dim"
            aria-hidden
          />
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search by name"
            aria-label="Search registrants by name"
            className="w-56 rounded-xl border border-white/12 bg-ink-900/60 py-2 pl-9 pr-3 text-sm text-bone placeholder:text-bone-dim/60 focus:border-gold/50"
          />
        </div>
        <Button type="submit" variant="glass" size="sm">
          Search
        </Button>
      </form>

      <label className="flex items-center gap-2 text-xs text-bone-dim">
        County
        <select
          value={county ?? ''}
          onChange={(event) => apply({ county: event.target.value || undefined })}
          className="rounded-xl border border-white/12 bg-ink-900/60 px-3 py-2 text-sm text-bone"
        >
          <option value="">All counties</option>
          {KENYAN_COUNTIES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

      {filtered ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setTerm('')
            router.push('/admin/registrants')
          }}
        >
          <X className="h-4 w-4" aria-hidden />
          Clear
        </Button>
      ) : null}
    </div>
  )
}
