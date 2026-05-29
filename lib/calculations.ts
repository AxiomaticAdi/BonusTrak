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

  /** Mon–Sun weeks in [goalStart, today] with ≥1 logged entry */
  coveredWeeks: number
  /** Total Mon–Sun weeks overlapping [goalStart, today] */
  totalElapsedWeeks: number
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

/** The Monday on or before the given ISO date. */
function mondayOf(iso: string): string {
  const day = parseISODate(iso).getDay()
  const offset = day === 0 ? 6 : day - 1
  return addDays(iso, -offset)
}

/**
 * Count Mon–Sun weeks overlapping [startISO, endISO] and how many of them
 * contain at least one logged entry. A week is "covered" if any entry's
 * representative `date` falls within its Mon–Sun span.
 */
export function coveredWeekCount(
  entries: HoursEntry[],
  startISO: string,
  endISO: string,
): { coveredWeeks: number; totalElapsedWeeks: number } {
  if (startISO > endISO) return { coveredWeeks: 0, totalElapsedWeeks: 0 }
  let weekStart = mondayOf(startISO)
  let coveredWeeks = 0
  let totalElapsedWeeks = 0
  let guard = 0
  while (weekStart <= endISO && guard < 10_000) {
    const weekEnd = addDays(weekStart, 6)
    totalElapsedWeeks++
    if (entries.some((e) => e.date >= weekStart && e.date <= weekEnd))
      coveredWeeks++
    weekStart = addDays(weekStart, 7)
    guard++
  }
  return { coveredWeeks, totalElapsedWeeks }
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

  const { coveredWeeks, totalElapsedWeeks } = coveredWeekCount(
    data.entries,
    goal.startDate,
    today,
  )

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
    coveredWeeks,
    totalElapsedWeeks,
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
