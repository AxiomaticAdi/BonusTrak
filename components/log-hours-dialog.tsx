"use client"

import { useState, type ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useStore } from "@/lib/store"
import { HOURS_KIND_LABELS, type HoursEntry, type HoursEntryInput, type HoursEntryKind } from "@/lib/types"
import { mondayOf, todayISO, formatWeekRange, formatMonth } from "@/lib/dates"
import { entryLabel, entrySpan, findOverlap } from "@/lib/calculations"
import { toast } from "sonner"

const KINDS: HoursEntryKind[] = ["day", "week", "month"]

export function LogHoursDialog({ trigger }: { trigger: ReactNode }) {
  const { addEntry, data } = useStore()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<HoursEntryKind>("day")
  const [date, setDate] = useState(todayISO())
  const [weekStart, setWeekStart] = useState(mondayOf(todayISO()))
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const [hours, setHours] = useState("")

  function reset() {
    setKind("day")
    setDate(todayISO())
    setWeekStart(mondayOf(todayISO()))
    setMonth(todayISO().slice(0, 7))
    setHours("")
  }

  function buildInput(): HoursEntryInput | null {
    const value = Number.parseFloat(hours)
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid number of hours.")
      return null
    }
    switch (kind) {
      case "day":
        if (!date) {
          toast.error("Pick a date.")
          return null
        }
        return { kind: "day", date, hours: value }
      case "week":
        if (!weekStart) {
          toast.error("Pick a week.")
          return null
        }
        return { kind: "week", weekStart, hours: value }
      case "month":
        if (!/^\d{4}-\d{2}$/.test(month)) {
          toast.error("Pick a month.")
          return null
        }
        return { kind: "month", month, hours: value }
    }
  }

  function submit() {
    const input = buildInput()
    if (!input) return
    const conflict = findOverlap(entrySpan(input as HoursEntry), data.entries)
    addEntry(input)
    if (conflict) {
      toast.warning(`Logged ${input.hours} hours — but this overlaps your "${entryLabel(conflict)}" entry, so hours may double-count.`)
    } else {
      toast.success(`Logged ${input.hours} hours.`)
    }
    reset()
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) reset()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log hours</DialogTitle>
          <DialogDescription>Add billable hours at whatever level of detail you prefer.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          <div className="flex flex-col gap-2">
            <Label>Entry type</Label>
            <ToggleGroup
              type="single"
              value={kind}
              onValueChange={(v) => v && setKind(v as HoursEntryKind)}
              variant="outline"
              className="w-full"
            >
              {KINDS.map((k) => (
                <ToggleGroupItem key={k} value={k} className="flex-1">
                  {HOURS_KIND_LABELS[k]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <EntryAnchorField
            kind={kind}
            date={date}
            weekStart={weekStart}
            month={month}
            onDate={setDate}
            onWeekStart={setWeekStart}
            onMonth={setMonth}
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-hours">Hours</Label>
            <Input
              id="entry-hours"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              placeholder="e.g. 7.5"
              value={hours}
              autoFocus
              onChange={(e) => setHours(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit()
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>Add entry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The anchor control, shaped to the selected kind: a date picker for a day, a
 * Monday-snapped date picker for a week (native <input type="week"> is unsupported
 * in Firefox), and a month picker for a month.
 */
export function EntryAnchorField({
  kind,
  date,
  weekStart,
  month,
  onDate,
  onWeekStart,
  onMonth,
  idPrefix = "entry",
}: {
  kind: HoursEntryKind
  date: string
  weekStart: string
  month: string
  onDate: (v: string) => void
  onWeekStart: (v: string) => void
  onMonth: (v: string) => void
  idPrefix?: string
}) {
  if (kind === "day") {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-date`}>Date</Label>
        <Input id={`${idPrefix}-date`} type="date" value={date} onChange={(e) => onDate(e.target.value)} />
      </div>
    )
  }
  if (kind === "week") {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-week`}>Week</Label>
        <Input
          id={`${idPrefix}-week`}
          type="date"
          value={weekStart}
          onChange={(e) => e.target.value && onWeekStart(mondayOf(e.target.value))}
        />
        <p className="text-xs text-muted-foreground">Week of {formatWeekRange(weekStart)}</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${idPrefix}-month`}>Month</Label>
      <Input id={`${idPrefix}-month`} type="month" value={month} onChange={(e) => onMonth(e.target.value)} />
      {/^\d{4}-\d{2}$/.test(month) && (
        <p className="text-xs text-muted-foreground">{formatMonth(month)}</p>
      )}
    </div>
  )
}
