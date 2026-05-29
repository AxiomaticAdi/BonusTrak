"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { fmt, type Metrics } from "@/lib/calculations"
import { useStore } from "@/lib/store"

export function PaceCard({ metrics }: { metrics: Metrics }) {
  const { paceMode, setPaceMode } = useStore()

  const current = metrics.currentPerWeek
  const required = metrics.requiredPerWeek
  const max = Math.max(current, required, 1)
  const ahead = current >= required

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Pace comparison</CardTitle>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={paceMode}
          onValueChange={(v) => v && setPaceMode(v as "trailing" | "ytd")}
        >
          <ToggleGroupItem value="trailing" className="px-3 text-xs">
            4-week
          </ToggleGroupItem>
          <ToggleGroupItem value="ytd" className="px-3 text-xs">
            YTD
          </ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Bar
          label="Current pace"
          value={current}
          max={max}
          colorClass={ahead ? "bg-success" : "bg-danger"}
        />
        <Bar label="Required pace" value={required} max={max} colorClass="bg-primary" />

        {metrics.uncoveredWorkdays > 0 && (
          <p className="text-xs text-muted-foreground">
            Pace based on logged days only · ~{Math.max(1, Math.round(metrics.uncoveredWorkdays / 5))} weeks
            not yet logged
          </p>
        )}

        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {required <= 0 ? (
            <>You&apos;ve reached your goal — no further hours required.</>
          ) : (
            <>
              You need to average{" "}
              <span className="font-semibold text-foreground">{fmt(required)} hours/week</span> ({fmt(metrics.requiredPerWorkday)}{" "}
              per workday) to reach your goal.
            </>
          )}
        </p>
      </CardContent>
    </Card>
  )
}

function Bar({
  label,
  value,
  max,
  colorClass,
}: {
  label: string
  value: number
  max: number
  colorClass: string
}) {
  const pct = Math.max(2, (value / max) * 100)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold tabular-nums">
          {fmt(value)} <span className="font-normal text-muted-foreground">hrs/wk</span>
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", colorClass)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  )
}
