"use client"

import { Plus } from "lucide-react"
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

      <ProgressCard metrics={metrics} />

      <div className="grid gap-5 md:grid-cols-2">
        <PaceCard metrics={metrics} />
        <ForecastCard metrics={metrics} />
      </div>
    </div>
  )
}
