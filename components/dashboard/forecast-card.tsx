"use client"

import { TrendingUp, TrendingDown, Flag, CalendarRange } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { fmt, fmtInt, type Metrics } from "@/lib/calculations"

export function ForecastCard({ metrics }: { metrics: Metrics }) {
  const ahead = metrics.variance >= 0
  const varianceText = `${ahead ? "+" : "-"}${fmt(Math.abs(metrics.variance))}`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Forecast</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Flag className="size-5" />
          </span>
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">Projected year-end finish</span>
            <span className="text-2xl font-semibold tabular-nums tracking-tight">
              {fmt(metrics.projected, 0)} <span className="text-base font-normal text-muted-foreground">hrs</span>
            </span>
          </div>
        </div>

        {metrics.uncoveredWorkdays > 0 && (
          <p className="text-xs text-muted-foreground">
            Based on logged days only · ~{Math.max(1, Math.round(metrics.uncoveredWorkdays / 5))} weeks
            not yet logged
          </p>
        )}

        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
            ahead ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
          )}
        >
          {ahead ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          <span className="tabular-nums">{varianceText} hours</span>
          <span className="font-normal">{ahead ? "ahead of target" : "behind target"}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MiniStat
            icon={<CalendarRange className="size-4" />}
            label="Remaining workdays"
            value={fmtInt(metrics.remainingWorkdays)}
          />
          <MiniStat
            icon={<TrendingUp className="size-4" />}
            label="Hours remaining"
            value={fmt(metrics.remaining, 0)}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums tracking-tight">{value}</span>
    </div>
  )
}
