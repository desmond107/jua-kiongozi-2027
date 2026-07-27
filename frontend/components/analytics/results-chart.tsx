'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  VOTE_CHOICE_COLORS,
  VOTE_CHOICE_LABELS,
  VOTE_CHOICE_ORDER,
  type CandidateAnalytics,
} from '@/backend/validators'
import { AXIS, ChartLegend, ChartPanel, TooltipShell } from './chart-primitives'
import { EmptyState } from '@/frontend/components/ui/primitives'

/**
 * Yes / No / Not-sure breakdown across all candidates, as a horizontal stacked
 * bar — one row per candidate.
 *
 * Horizontal because the category labels are people's names: vertical bars
 * would force them to rotate, which is the single most common readability
 * failure in this kind of chart.
 *
 * Segments are separated by a 2px surface-coloured stroke so adjacent fills
 * never bleed into one another — required here, since the palette's job is to
 * be distinguishable at small sizes.
 */
export function ResultsChart({ candidates }: { candidates: CandidateAnalytics[] }) {
  const withVotes = candidates.filter((candidate) => candidate.totalVotes > 0)

  const totals = VOTE_CHOICE_ORDER.map((choice) => ({
    label: VOTE_CHOICE_LABELS[choice],
    color: VOTE_CHOICE_COLORS[choice],
    value: candidates.reduce((sum, candidate) => sum + candidate.votes[choice], 0),
  }))

  return (
    <ChartPanel
      title="Sentiment by candidate"
      description="Would you consider supporting this candidate for President in 2027?"
    >
      {withVotes.length === 0 ? (
        <EmptyState
          title="No votes recorded yet"
          description="Once citizens begin rating candidates, the breakdown will appear here and update automatically."
        />
      ) : (
        <>
          <div className="h-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={withVotes.map((candidate) => ({
                  name: candidate.fullName,
                  total: candidate.totalVotes,
                  ...VOTE_CHOICE_ORDER.reduce<Record<string, number>>((acc, choice) => {
                    acc[choice] = candidate.votes[choice]
                    return acc
                  }, {}),
                }))}
                layout="vertical"
                margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                barCategoryGap={14}
              >
                <CartesianGrid horizontal={false} stroke={AXIS.stroke} />
                <XAxis
                  type="number"
                  tick={AXIS.tick}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
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
                    const total = Number(payload[0]?.payload?.total ?? 0)

                    return (
                      <TooltipShell
                        label={String(label)}
                        rows={payload.map((entry) => {
                          const value = Number(entry.value ?? 0)
                          return {
                            name: VOTE_CHOICE_LABELS[
                              entry.dataKey as keyof typeof VOTE_CHOICE_LABELS
                            ],
                            value,
                            color: String(entry.color),
                            share: total ? `${Math.round((value / total) * 100)}%` : undefined,
                          }
                        })}
                      />
                    )
                  }}
                />

                {VOTE_CHOICE_ORDER.map((choice, index) => (
                  <Bar
                    key={choice}
                    dataKey={choice}
                    stackId="votes"
                    fill={VOTE_CHOICE_COLORS[choice]}
                    // 2px surface-coloured separator between stacked segments.
                    stroke="#131A29"
                    strokeWidth={2}
                    // Only the final segment gets rounded ends, so the stack
                    // reads as one bar rather than three pills.
                    radius={
                      index === VOTE_CHOICE_ORDER.length - 1
                        ? ([0, 4, 4, 0] as [number, number, number, number])
                        : undefined
                    }
                  >
                    {withVotes.map((candidate) => (
                      <Cell key={candidate.candidateId} />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <ChartLegend className="mt-4" items={totals} />
        </>
      )}
    </ChartPanel>
  )
}
