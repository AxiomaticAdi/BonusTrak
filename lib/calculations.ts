import type { AppData, Goal, HoursEntry, PaceMode, TimeOff } from "./types"
import { addDays, clampISO, eachDay, isWeekend, parseISODate, todayISO } from "./dates"

export type PaceStatus = "ahead" | "on" | "behind"

export interface Metrics {
  target: number
  completed: number
  remaining: number
  progressPct: number

  elapsedWorkdays: number
  remainingWorkdays: number

  /** Required pace to hit goal */
  requiredPerWorkday: number
  requiredPerWeek: number

  /** Current pace in the selected mode */
  currentPerWorkday: number
  currentPerWeek: number
  /** Both modes precomputed for comparison */
  trailingPerWeek: number
  ytdPerWeek: number

  projected: number
  variance: number
  variancePct: number
  status: PaceStatus
}

/** Build the set of ISO dates covered by time-off entries. */
export function timeOffDateSet(timeOff: TimeOff[]): Set<string> {
  const set = new Set<string>()
  for (const t of timeOff) {
    const start = t.start <= t.end ? t.start : t.end
    const end = t.start <= t.end ? t.end : t.start
    for (const d of eachDay(start, end)) set.add(d)
  }
  return set
}

/** Count workdays (Mon–Fri not covered by time off) between start and end inclusive. */
export function countWorkdays(startISO: string, endISO: string, offSet: Set<string>): number {
  if (startISO > endISO) return 0
  let count = 0
  for (const d of eachDay(startISO, endISO)) {
    if (isWeekend(d)) continue
    if (offSet.has(d)) continue
    count++
  }
  return count
}

/** Sum hours for entries whose representative date falls within [start, end]. */
function sumHours(entries: HoursEntry[], startISO: string, endISO: string): number {
  return entries.reduce((acc, e) => {
    if (e.date >= startISO && e.date <= endISO) return acc + (Number.isFinite(e.hours) ? e.hours : 0)
    return acc
  }, 0)
}

export function computeMetrics(data: AppData, goal: Goal, paceMode: PaceMode, now = todayISO()): Metrics {
  const offSet = timeOffDateSet(data.timeOff)
  const today = clampISO(now, goal.startDate, goal.endDate)

  const completed = sumHours(data.entries, goal.startDate, goal.endDate)
  const target = goal.target
  const remaining = Math.max(0, target - completed)
  const progressPct = target > 0 ? Math.min(100, (completed / target) * 100) : 0

  const elapsedWorkdays = countWorkdays(goal.startDate, today, offSet)
  const remainingWorkdays = countWorkdays(addDays(today, 1), goal.endDate, offSet)

  // Required pace
  const requiredPerWorkday = remainingWorkdays > 0 ? remaining / remainingWorkdays : 0
  const requiredPerWeek = requiredPerWorkday * 5

  // Trailing 4 weeks (last 28 calendar days)
  const windowStart = addDays(now, -27)
  const trailingHours = sumHours(data.entries, windowStart, now)
  const trailingPerWeek = trailingHours / 4

  // Year to date
  const ytdPerWeek = elapsedWorkdays > 0 ? (completed / elapsedWorkdays) * 5 : 0

  const currentPerWeek = paceMode === "trailing" ? trailingPerWeek : ytdPerWeek
  const currentPerWorkday = currentPerWeek / 5

  const projected = completed + currentPerWorkday * remainingWorkdays
  const variance = projected - target
  const variancePct = target > 0 ? (variance / target) * 100 : 0

  let status: PaceStatus = "on"
  if (variancePct >= 1) status = "ahead"
  else if (variancePct < -1) status = "behind"

  return {
    target,
    completed,
    remaining,
    progressPct,
    elapsedWorkdays,
    remainingWorkdays,
    requiredPerWorkday,
    requiredPerWeek,
    currentPerWorkday,
    currentPerWeek,
    trailingPerWeek,
    ytdPerWeek,
    projected,
    variance,
    variancePct,
    status,
  }
}

export function fmt(n: number, digits = 1): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString()
}

export { parseISODate }
