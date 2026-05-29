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
import type { HoursEntryKind } from "@/lib/types"
import { todayISO } from "@/lib/dates"
import { toast } from "sonner"

const KINDS: { value: HoursEntryKind; label: string; dateLabel: string }[] = [
  { value: "daily", label: "Day", dateLabel: "Date" },
  { value: "weekly", label: "Week", dateLabel: "Week ending" },
  { value: "monthly", label: "Month", dateLabel: "Any date in month" },
]

export function LogHoursDialog({ trigger }: { trigger: ReactNode }) {
  const { addEntry } = useStore()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<HoursEntryKind>("daily")
  const [date, setDate] = useState(todayISO())
  const [hours, setHours] = useState("")

  function reset() {
    setKind("daily")
    setDate(todayISO())
    setHours("")
  }

  function submit() {
    const value = Number.parseFloat(hours)
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid number of hours.")
      return
    }
    if (!date) {
      toast.error("Pick a date.")
      return
    }
    addEntry({ date, hours: value, kind })
    toast.success(`Logged ${value} hours.`)
    reset()
    setOpen(false)
  }

  const dateLabel = KINDS.find((k) => k.value === kind)?.dateLabel ?? "Date"

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
                <ToggleGroupItem key={k.value} value={k.value} className="flex-1">
                  {k.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-date">{dateLabel}</Label>
            <Input id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

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
