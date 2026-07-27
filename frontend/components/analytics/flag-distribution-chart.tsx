'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  FLAG_COLOR_ORDER,
  FLAG_META,
  type CandidateAnalytics,
} from '@/backend/validators'
import { AXIS, ChartLegend, ChartPanel, TooltipShell } from './chart-primitives'
import { EmptyState } from '@/frontend/components/ui/primitives'

/**
 * Trust-flag distribution across all candidates.
 *
 * Rendered as 100%-share stacked bars rather than raw counts: the question a
 * reader has here is "what proportion of people trust this candidate", and
 * absolute counts would let a widely-rated candidate dominate the axis and
 * flatten everyone else into unreadable slivers. Raw counts remain available in
 * the tooltip and in the table view below the charts.
 */
export function FlagDistributionChart({ candidates }: { candidates: CandidateAnalytics[] }) {
  const withFlags = candidates.filter((candidate) => candidate.totalFlags > 0)

  const totals = FLAG_COLOR_ORDER.map((color) => ({
    label: `${FLAG_META[color].label} — ${FLAG_META[color].description}`,
    color: FLAG_META[color].hex,
    value: candidates.reduce((sum, candidate) => sum + candidate.flags[color], 0),
  }))

  const data = withFlags.map((candidate) => {
    const row: Record<string, string | number> = {
      name: candidate.fullName,
      total: candidate.totalFlags,
    }

    for (const color of FLAG_COLOR_ORDER) {
      row[color] = (candidate.flags[color] / candidate.totalFlags) * 100
      row[`${color}_count`] = candidate.flags[color]
    }

    return row
  })

  return (
    <ChartPanel
      title="Trust flags by candidate"
      description="Share of respondents at each level of trust. Ordered from green (no concerns) to black (would not accept)."
    >
      {withFlags.length === 0 ? (
        <EmptyState
          title="No trust flags recorded yet"
          description="Flags appear here as soon as citizens begin rating candidates."
        />
      ) : (
        <>
          <div className="h-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                barCategoryGap={14}
              >
                <CartesianGrid horizontal={false} stroke={AXIS.stroke} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(value: number) => `${value}%`}
                  tick={AXIS.tick}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={AXIS.tick}
                  axisLine={false}
                  tickLine={false}
                  width={128}
                />
                <Tooltip
                  cursor={{ fill: 'rgb(247 245 240 / 0.04)' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const row = payload[0]?.payload as Record<string, number> | undefined

                    return (
                      <TooltipShell
                        label={String(label)}
                        rows={payload.map((entry) => {
                          const key = String(entry.dataKey)
                          return {
                            name: FLAG_META[key as keyof typeof FLAG_META].label,
                            value: Number(row?.[`${key}_count`] ?? 0),
                            color: String(entry.color),
                            share: `${Math.round(Number(entry.value ?? 0))}%`,
                          }
                        })}
                      />
                    )
                  }}
                />

                {FLAG_COLOR_ORDER.map((color, index) => (
                  <Bar
                    key={color}
                    dataKey={color}
                    stackId="flags"
                    fill={FLAG_META[color].hex}
                    stroke="#131A29"
                    strokeWidth={2}
                    radius={
                      index === FLAG_COLOR_ORDER.length - 1
                        ? ([0, 4, 4, 0] as [number, number, number, number])
                        : undefined
                    }
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* The legend spells out each colour's meaning in text — mandatory
              here, because red and orange sit close in hue. */}
          <ChartLegend className="mt-4 flex-col gap-y-1.5 sm:flex-row sm:gap-x-5" items={totals} />
        </>
      )}
    </ChartPanel>
  )
}
