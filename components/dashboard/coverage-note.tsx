import type { Metrics } from "@/lib/calculations"

/**
 * Muted line shown in the Pace and Forecast cards when some elapsed workdays have
 * no logged entry — signalling the pace/forecast number may be incomplete. Renders
 * nothing when coverage is complete. Coverage is measured in workdays (not weeks):
 * a month logged as one entry covers all of its workdays.
 */
export function CoverageNote({ metrics }: { metrics: Metrics }) {
  if (metrics.uncoveredWorkdays <= 0) return null

  const weeks = Math.max(1, Math.round(metrics.uncoveredWorkdays / 5))
  return (
    <p className="text-xs text-muted-foreground">
      Based on logged days only · ~{weeks} {weeks === 1 ? "week" : "weeks"} not yet logged
    </p>
  )
}
