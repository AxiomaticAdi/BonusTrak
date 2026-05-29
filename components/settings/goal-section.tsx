"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useStore } from "@/lib/store"
import { todayISO } from "@/lib/dates"
import { toast } from "sonner"

function defaultYear() {
  const y = new Date().getFullYear()
  return { start: `${y}-01-01`, end: `${y}-12-31` }
}

export function GoalSection() {
  const { data, setGoal } = useStore()
  const dy = defaultYear()

  const [target, setTarget] = useState(data.goal ? String(data.goal.target) : "1900")
  const [start, setStart] = useState(data.goal?.startDate ?? dy.start)
  const [end, setEnd] = useState(data.goal?.endDate ?? dy.end)

  function save() {
    const t = Number.parseFloat(target)
    if (!Number.isFinite(t) || t <= 0) {
      toast.error("Enter a valid annual target.")
      return
    }
    if (!start || !end || start >= end) {
      toast.error("Fiscal year end must be after the start.")
      return
    }
    setGoal({ target: t, startDate: start, endDate: end })
    toast.success("Annual goal saved.")
  }

  const dirty =
    !data.goal ||
    String(data.goal.target) !== target ||
    data.goal.startDate !== start ||
    data.goal.endDate !== end

  return (
    <Card>
      <CardHeader>
        <CardTitle>Annual Goal</CardTitle>
        <CardDescription>Set your billable-hour target and fiscal year.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="target">Annual billable-hour target</Label>
          <Input
            id="target"
            type="number"
            inputMode="decimal"
            min="1"
            step="1"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="1900"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="fy-start">Fiscal year start</Label>
            <Input id="fy-start" type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fy-end">Fiscal year end</Label>
            <Input id="fy-end" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={!dirty}>
            Save goal
          </Button>
        </div>
        {data.goal && todayISO() > data.goal.endDate && (
          <p className="text-sm text-warning">Heads up: today is past your fiscal year end.</p>
        )}
      </CardContent>
    </Card>
  )
}
