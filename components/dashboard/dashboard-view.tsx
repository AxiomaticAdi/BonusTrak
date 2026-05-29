"use client"

import { Plus, Clock } from "lucide-react"
import { useStore } from "@/lib/store"
import { computeMetrics } from "@/lib/calculations"
import { formatShort } from "@/lib/dates"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { LogHoursDialog } from "@/components/log-hours-dialog"
import { SetupPrompt } from "./setup-prompt"
import { ProgressCard } from "./progress-card"
import { PaceCard } from "./pace-card"
import { ForecastCard } from "./forecast-card"

export function DashboardView() {
  const { data, paceMode, hydrated } = useStore()

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    )
  }

  if (!data.goal) {
    return <SetupPrompt />
  }

  const metrics = computeMetrics(data, data.goal, paceMode)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {formatShort(data.goal.startDate)} – {formatShort(data.goal.endDate)} · {metrics.elapsedWorkdays} workdays elapsed
          </p>
        </div>
        <LogHoursDialog
          trigger={
            <Button size="lg" className="shrink-0 shadow-sm">
              <Plus className="size-5" />
              Log hours
            </Button>
          }
        />
      </div>

      {metrics.lastCoveredDate && metrics.trailingGapWorkdays >= 5 && (
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          <Clock className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">
            You haven&apos;t logged since{" "}
            <span className="font-medium text-foreground">{formatShort(metrics.lastCoveredDate)}</span> ·{" "}
            {metrics.trailingGapWorkdays} workdays unlogged
          </span>
        </div>
      )}

      <ProgressCard metrics={metrics} />

      <div className="grid gap-5 md:grid-cols-2">
        <PaceCard metrics={metrics} />
        <ForecastCard metrics={metrics} />
      </div>
    </div>
  )
}
