"use client"

import { useState } from "react"
import { Pencil, Trash2, Clock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useStore } from "@/lib/store"
import { HOURS_KIND_LABELS, type HoursEntry, type HoursEntryKind } from "@/lib/types"
import { formatShort } from "@/lib/dates"
import { fmt } from "@/lib/calculations"
import { toast } from "sonner"

const KINDS: HoursEntryKind[] = ["daily", "weekly", "monthly"]

export function HoursLogSection() {
  const { data, updateEntry, deleteEntry } = useStore()
  const sorted = [...data.entries].sort((a, b) => b.date.localeCompare(a.date))
  const total = data.entries.reduce((s, e) => s + (Number.isFinite(e.hours) ? e.hours : 0), 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Hours Log</CardTitle>
          <CardDescription>Every logged entry. Add new hours from the dashboard.</CardDescription>
        </div>
        {data.entries.length > 0 && (
          <div className="flex flex-col items-end">
            <span className="text-lg font-semibold tabular-nums">{fmt(total)}</span>
            <span className="text-xs text-muted-foreground">total hrs</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Clock className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No hours logged yet.</p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {sorted.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold tabular-nums">{fmt(e.hours)} hrs</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{formatShort(e.date)}</span>
                    <Badge variant="outline" className="text-xs font-normal">
                      {HOURS_KIND_LABELS[e.kind]}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <EntryDialog
                    initial={e}
                    onSave={(patch) => {
                      updateEntry(e.id, patch)
                      toast.success("Entry updated.")
                    }}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="Edit entry">
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete entry"
                        className="text-muted-foreground hover:text-danger"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {fmt(e.hours)} hours on {formatShort(e.date)} will be removed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            deleteEntry(e.id)
                            toast.success("Entry deleted.")
                          }}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function EntryDialog({
  trigger,
  initial,
  onSave,
}: {
  trigger: React.ReactNode
  initial: HoursEntry
  onSave: (patch: Partial<Omit<HoursEntry, "id">>) => void
}) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<HoursEntryKind>(initial.kind)
  const [date, setDate] = useState(initial.date)
  const [hours, setHours] = useState(String(initial.hours))

  function reset() {
    setKind(initial.kind)
    setDate(initial.date)
    setHours(String(initial.hours))
  }

  function submit() {
    const value = Number.parseFloat(hours)
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a valid number of hours.")
      return
    }
    onSave({ kind, date, hours: value })
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
          <DialogTitle>Edit entry</DialogTitle>
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-date">Date</Label>
            <Input id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-hours">Hours</Label>
            <Input
              id="edit-hours"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
