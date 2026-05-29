import type { Metrics } from "@/lib/calculations"

/**
 * Muted line shown in the Pace and Forecast cards when some elapsed weeks have
 * no logged entries — signalling the pace/forecast number may be incomplete.
 * Renders nothing when every elapsed week is covered.
 */
export function CoverageNote({ metrics }: { metrics: Metrics }) {
  const { coveredWeeks, totalElapsedWeeks } = metrics
  if (coveredWeeks >= totalElapsedWeeks) return null

  const unlogged = totalElapsedWeeks - coveredWeeks
  return (
    <p className="text-xs text-muted-foreground">
      Based on{" "}
      <span className="font-semibold text-foreground">
        {coveredWeeks} of {totalElapsedWeeks}
      </span>{" "}
      logged weeks · {unlogged} {unlogged === 1 ? "week" : "weeks"} unlogged
    </p>
  )
}
