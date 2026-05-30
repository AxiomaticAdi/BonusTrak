"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { computePaceHistory, fmt, type PaceGranularity } from "@/lib/calculations"
import type { AppData, Goal } from "@/lib/types"

export function PaceHistoryCard({ data, goal }: { data: AppData; goal: Goal }) {
  const [granularity, setGranularity] = useState<PaceGranularity>("week")
  const periods = computePaceHistory(data, goal, granularity)

  const onPace = periods.filter((p) => p.status !== "behind").length
  // With a full year of weeks, labels would collide — thin them out.
  const thinLabels = granularity === "week" && periods.length > 16

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Pace history</CardTitle>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={granularity}
          onValueChange={(v) => v && setGranularity(v as PaceGranularity)}
        >
          <ToggleGroupItem value="week" className="px-3 text-xs">
            Week
          </ToggleGroupItem>
          <ToggleGroupItem value="month" className="px-3 text-xs">
            Month
          </ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {periods.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No periods to show yet.</p>
        ) : (
          <>
            <div className="flex items-end gap-1 overflow-x-auto pb-1">
              {periods.map((p, i) => {
                const pct = p.needed > 0 ? Math.min(100, (p.logged / p.needed) * 100) : p.logged > 0 ? 100 : 0
                const behind = p.status === "behind"
                const showLabel = !thinLabels || p.current || i % 4 === 0
                return (
                  <div key={p.key} className="flex min-w-[10px] flex-1 flex-col items-center gap-1.5">
                    <div
                      title={`${p.label}: ${fmt(p.logged)} / ${fmt(p.needed)} hrs`}
                      className={cn(
                        "relative h-24 w-full overflow-hidden rounded-md bg-muted",
                        p.current && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                      )}
                    >
                      <div
                        className={cn(
                          "absolute inset-x-0 bottom-0 rounded-md transition-all duration-500",
                          behind ? "bg-danger" : "bg-success",
                        )}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "h-3 text-[10px] leading-3 text-muted-foreground",
                        !showLabel && "invisible",
                        p.current && "font-medium text-foreground",
                      )}
                    >
                      {p.label}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span>
                <span className="font-medium text-foreground tabular-nums">{onPace}</span> of{" "}
                <span className="tabular-nums">{periods.length}</span>{" "}
                {granularity === "week" ? "weeks" : "months"} at or above pace
              </span>
              <span className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-success" />
                  At / above
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-danger" />
                  Below
                </span>
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
