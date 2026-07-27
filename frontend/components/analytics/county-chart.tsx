'use client'

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CountyParticipation } from '@/backend/validators'
import { AXIS, ChartPanel, TooltipShell } from './chart-primitives'
import { EmptyState } from '@/frontend/components/ui/primitives'

/**
 * Participation by county.
 *
 * A single series measuring magnitude, so it gets one hue — not a categorical
 * palette. Colour here carries no identity (the axis label already does), which
 * is why every bar is the same gold: painting each county differently would
 * imply a distinction that does not exist in the data.
 *
 * Capped at the top 12 counties. The cap is stated in the UI rather than
 * silently truncating, and the CSV export carries the complete set.
 */
const VISIBLE_COUNTIES = 12

export function CountyChart({ byCounty }: { byCounty: CountyParticipation[] }) {
  const data = byCounty.slice(0, VISIBLE_COUNTIES)
  const hidden = Math.max(0, byCounty.length - VISIBLE_COUNTIES)

  return (
    <ChartPanel
      title="Participation by county"
      description={
        hidden > 0
          ? `Ratings cast by county — top ${VISIBLE_COUNTIES} shown, ${hidden} more in the CSV export.`
          : 'Ratings cast by the county each citizen declared at registration.'
      }
    >
      {data.length === 0 ? (
        <EmptyState
          title="No regional data yet"
          description="No ratings have been recorded yet. Every citizen declares a county when they register, so this breakdown fills in as voting begins."
        />
      ) : (
        <div style={{ height: Math.max(220, data.length * 32 + 40) }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 20, bottom: 0, left: 8 }}
              barCategoryGap={8}
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
                dataKey="county"
                tick={AXIS.tick}
                axisLine={false}
                tickLine={false}
                width={104}
              />
              <Tooltip
                cursor={{ fill: 'rgb(247 245 240 / 0.04)' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null

                  return (
                    <TooltipShell
                      label={String(label)}
                      rows={[
                        {
                          name: 'Ratings cast',
                          value: Number(payload[0]?.value ?? 0),
                          color: '#F5B942',
                        },
                      ]}
                    />
                  )
                }}
              />
              <Bar
                dataKey="votes"
                fill="#F5B942"
                radius={[0, 4, 4, 0]}
                maxBarSize={18}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartPanel>
  )
}
