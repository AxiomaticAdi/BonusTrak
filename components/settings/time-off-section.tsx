"use client"

import { useState } from "react"
import { Plus, Pencil, Trash2, CalendarOff } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { TIME_OFF_LABELS, type TimeOff, type TimeOffType } from "@/lib/types"
import { formatShort, todayISO } from "@/lib/dates"
import { toast } from "sonner"

const TYPES: TimeOffType[] = ["vacation", "personal", "holiday", "other"]

const TYPE_BADGE: Record<TimeOffType, string> = {
  vacation: "bg-primary/10 text-primary",
  personal: "bg-success/10 text-success",
  holiday: "bg-warning/10 text-warning",
  other: "bg-muted text-muted-foreground",
}

export function TimeOffSection() {
  const { data, addTimeOff, updateTimeOff, deleteTimeOff } = useStore()

  const sorted = [...data.timeOff].sort((a, b) => a.start.localeCompare(b.start))

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Time Off</CardTitle>
          <CardDescription>Vacations, personal days, and holidays adjust your required pace.</CardDescription>
        </div>
        <TimeOffDialog
          onSave={(t) => {
            addTimeOff(t)
            toast.success("Time off added.")
          }}
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              Add
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CalendarOff className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No time off added yet.</p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {sorted.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={TYPE_BADGE[t.type]}>
                      {TIME_OFF_LABELS[t.type]}
                    </Badge>
                    {t.label && <span className="text-sm font-medium">{t.label}</span>}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatShort(t.start)}
                    {t.end !== t.start && <> – {formatShort(t.end)}</>}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <TimeOffDialog
                    initial={t}
                    onSave={(patch) => {
                      updateTimeOff(t.id, patch)
                      toast.success("Time off updated.")
                    }}
                    trigger={
                      <Button variant="ghost" size="icon" aria-label="Edit time off">
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  <DeleteButton
                    label={t.label || TIME_OFF_LABELS[t.type]}
                    onConfirm={() => {
                      deleteTimeOff(t.id)
                      toast.success("Time off removed.")
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function TimeOffDialog({
  trigger,
  initial,
  onSave,
}: {
  trigger: React.ReactNode
  initial?: TimeOff
  onSave: (t: Omit<TimeOff, "id">) => void
}) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<TimeOffType>(initial?.type ?? "vacation")
  const [start, setStart] = useState(initial?.start ?? todayISO())
  const [end, setEnd] = useState(initial?.end ?? todayISO())
  const [label, setLabel] = useState(initial?.label ?? "")

  function reset() {
    setType(initial?.type ?? "vacation")
    setStart(initial?.start ?? todayISO())
    setEnd(initial?.end ?? todayISO())
    setLabel(initial?.label ?? "")
  }

  function submit() {
    if (!start || !end) {
      toast.error("Pick start and end dates.")
      return
    }
    const s = start <= end ? start : end
    const e = start <= end ? end : start
    onSave({ type, start: s, end: e, label: label.trim() || undefined })
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
          <DialogTitle>{initial ? "Edit time off" : "Add time off"}</DialogTitle>
          <DialogDescription>Future dates are supported and excluded from remaining workdays.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5 py-2">
          <div className="flex flex-col gap-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as TimeOffType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIME_OFF_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="to-start">Start</Label>
              <Input id="to-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="to-end">End</Label>
              <Input id="to-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="to-label">Label (optional)</Label>
            <Input
              id="to-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Summer holiday"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>{initial ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Delete" className="text-muted-foreground hover:text-danger">
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
          <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
