"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { fmt, fmtInt, type Metrics, type PaceStatus } from "@/lib/calculations"

const STATUS_META: Record<PaceStatus, { label: string; dot: string; text: string; bg: string }> = {
  ahead: { label: "Ahead of pace", dot: "bg-success", text: "text-success", bg: "bg-success/10" },
  on: { label: "On pace", dot: "bg-warning", text: "text-warning", bg: "bg-warning/10" },
  behind: { label: "Behind pace", dot: "bg-danger", text: "text-danger", bg: "bg-danger/10" },
}

function Ring({ pct, status }: { pct: number; status: PaceStatus }) {
  const size = 132
  const stroke = 12
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (Math.min(100, pct) / 100) * c
  const color =
    status === "ahead" ? "var(--success)" : status === "behind" ? "var(--danger)" : "var(--warning)"

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums tracking-tight">{Math.round(pct)}%</span>
        <span className="text-xs text-muted-foreground">complete</span>
      </div>
    </div>
  )
}

export function ProgressCard({ metrics }: { metrics: Metrics }) {
  const meta = STATUS_META[metrics.status]
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-6 py-6 sm:flex-row sm:items-center sm:gap-8">
        <Ring pct={metrics.progressPct} status={metrics.status} />

        <div className="flex w-full flex-1 flex-col gap-4">
          <div className={cn("inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-sm font-medium", meta.bg, meta.text)}>
            <span className={cn("size-2 rounded-full", meta.dot)} />
            {meta.label}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Stat label="Target" value={fmtInt(metrics.target)} />
            <Stat label="Completed" value={fmt(metrics.completed, 1)} />
            <Stat label="Remaining" value={fmt(metrics.remaining, 1)} accent />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-lg font-semibold tabular-nums tracking-tight", accent && "text-primary")}>
        {value}
      </span>
    </div>
  )
}
