import type { AppData, Goal, HoursEntry, PaceMode, TimeOff } from "./types"
import {
  addDays,
  clampISO,
  eachDay,
  formatMonth,
  formatShort,
  formatWeekRange,
  isWeekend,
  lastOfMonth,
  maxISO,
  minISO,
  mondayOf,
  monthName,
  parseISODate,
  todayISO,
} from "./dates"

export type PaceStatus = "ahead" | "on" | "behind"

export type PaceGranularity = "week" | "month"

/** One period (week or month) in the pace-history visualization. */
export interface PacePeriod {
  /** Stable React key: the period's raw start ISO date. */
  key: string
  /** Short label, e.g. "May 5" (week) or "May" (month). */
  label: string
  /** In-window logged hours, clipped to the goal window and to today. */
  logged: number
  /** Flat-rate hours needed in this period: flatPerWorkday × period workdays. */
  needed: number
  /** Mon–Fri minus time off, clipped to the goal window and today. */
  workdays: number
  /** Logged vs needed, with a dead-band so near-equal reads as "on". */
  status: PaceStatus
  /** True for the period containing the real "now" (in progress). */
  current: boolean
}

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

  /** Coverage: elapsed workdays falling inside at least one entry's span. */
  coveredWorkdays: number
  /** Elapsed workdays not covered by any entry (>= 0). */
  uncoveredWorkdays: number
  /** Latest workday any entry covers, or null when nothing is logged. */
  lastCoveredDate: string | null
  /** Workdays since the last covered day, up to today. Drives the log reminder. */
  trailingGapWorkdays: number
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

/**
 * The inclusive date span an entry covers. This is the single source of truth for
 * interpreting a kind's anchor; nothing else reads `date`/`weekStart`/`month`.
 */
export function entrySpan(e: HoursEntry): { start: string; end: string } {
  switch (e.kind) {
    case "day":
      return { start: e.date, end: e.date }
    case "week":
      return { start: e.weekStart, end: addDays(e.weekStart, 6) }
    case "month":
      return { start: `${e.month}-01`, end: lastOfMonth(e.month) }
  }
}

/** Human label for an entry, span-aware (e.g. "May 6", "Week of May 5", "May 2026"). */
export function entryLabel(e: HoursEntry): string {
  switch (e.kind) {
    case "day":
      return formatShort(e.date)
    case "week":
      return `Week of ${formatShort(e.weekStart)}`
    case "month":
      return formatMonth(e.month)
  }
}

/**
 * Hours of an entry attributable to [winStart, winEnd], proportional to the entry's
 * span workdays that fall inside the window. Hours spread evenly across the span's
 * workdays — a month entry's 160h becomes ~7.3h per May workday.
 */
function hoursInRange(
  e: HoursEntry,
  winStart: string,
  winEnd: string,
  offSet: Set<string>,
): number {
  const { start, end } = entrySpan(e)
  const oStart = maxISO(start, winStart)
  const oEnd = minISO(end, winEnd)
  if (oStart > oEnd) return 0 // span doesn't overlap the window

  const hours = Number.isFinite(e.hours) ? e.hours : 0
  const spanWorkdays = countWorkdays(start, end, offSet)
  if (spanWorkdays === 0) {
    // Span has no workdays (e.g. a day entry on a Saturday, or a span fully on
    // time off). Distribute by calendar days so the hours aren't lost.
    const spanDays = eachDay(start, end).length
    const overlapDays = eachDay(oStart, oEnd).length
    return spanDays === 0 ? 0 : hours * (overlapDays / spanDays)
  }
  const overlapWorkdays = countWorkdays(oStart, oEnd, offSet)
  return hours * (overlapWorkdays / spanWorkdays)
}

/** Sum the in-window hours of every entry. */
function sumHours(entries: HoursEntry[], startISO: string, endISO: string, offSet: Set<string>): number {
  return entries.reduce((acc, e) => acc + hoursInRange(e, startISO, endISO, offSet), 0)
}

/**
 * The first existing entry whose span intersects `span`, or null. Used to warn at
 * log time that hours may double-count. `excludeId` skips the entry being edited.
 */
export function findOverlap(
  span: { start: string; end: string },
  entries: HoursEntry[],
  excludeId?: string,
): HoursEntry | null {
  for (const e of entries) {
    if (excludeId && e.id === excludeId) continue
    const s = entrySpan(e)
    if (span.start <= s.end && s.start <= span.end) return e
  }
  return null
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * Runtime shape + value guard for a stored entry. Used to filter the loaded blob
 * so a stale old-shape row (e.g. `{kind:"weekly", date}`) can't crash entrySpan.
 */
export function isValidEntry(e: unknown): e is HoursEntry {
  if (typeof e !== "object" || e === null) return false
  const r = e as Record<string, unknown>
  if (typeof r.id !== "string") return false
  if (typeof r.hours !== "number" || !Number.isFinite(r.hours)) return false
  if (r.note !== undefined && typeof r.note !== "string") return false
  switch (r.kind) {
    case "day":
      return typeof r.date === "string" && ISO_DAY.test(r.date)
    case "week":
      return typeof r.weekStart === "string" && ISO_DAY.test(r.weekStart) && mondayOf(r.weekStart) === r.weekStart
    case "month":
      return typeof r.month === "string" && ISO_MONTH.test(r.month)
    default:
      return false
  }
}

export function computeMetrics(data: AppData, goal: Goal, paceMode: PaceMode, now = todayISO()): Metrics {
  const offSet = timeOffDateSet(data.timeOff)
  const today = clampISO(now, goal.startDate, goal.endDate)

  // Total hours banked toward the goal (full span, clipped to the goal window).
  const completed = sumHours(data.entries, goal.startDate, goal.endDate, offSet)
  // Hours attributable to elapsed time only. Equals `completed` when logging in
  // arrears; prevents a current-period entry from spiking pace/forecast if the
  // user logs a span before it has fully elapsed.
  const completedToDate = sumHours(data.entries, goal.startDate, today, offSet)
  const target = goal.target
  const remaining = Math.max(0, target - completed)
  const progressPct = target > 0 ? Math.min(100, (completed / target) * 100) : 0

  const elapsedWorkdays = countWorkdays(goal.startDate, today, offSet)
  const remainingWorkdays = countWorkdays(addDays(today, 1), goal.endDate, offSet)

  // Required pace
  const requiredPerWorkday = remainingWorkdays > 0 ? remaining / remainingWorkdays : 0
  const requiredPerWeek = requiredPerWorkday * 5

  // Trailing 4 weeks (last 28 calendar days), hours spread across each entry's span.
  const windowStart = addDays(now, -27)
  const trailingHours = sumHours(data.entries, windowStart, now, offSet)
  const trailingPerWeek = trailingHours / 4

  // Year to date
  const ytdPerWeek = elapsedWorkdays > 0 ? (completedToDate / elapsedWorkdays) * 5 : 0

  const currentPerWeek = paceMode === "trailing" ? trailingPerWeek : ytdPerWeek
  const currentPerWorkday = currentPerWeek / 5

  const projected = completedToDate + currentPerWorkday * remainingWorkdays
  const variance = projected - target
  const variancePct = target > 0 ? (variance / target) * 100 : 0

  let status: PaceStatus = "on"
  if (variancePct >= 1) status = "ahead"
  else if (variancePct < -1) status = "behind"

  // Coverage: which elapsed workdays are inside at least one entry span. Workdays
  // are Mon–Fri minus time off, matching elapsedWorkdays, so covered <= elapsed.
  const coveredSet = new Set<string>()
  for (const e of data.entries) {
    const { start, end } = entrySpan(e)
    const s = maxISO(start, goal.startDate)
    const en = minISO(end, today)
    if (s > en) continue
    for (const d of eachDay(s, en)) {
      if (isWeekend(d)) continue
      if (offSet.has(d)) continue
      coveredSet.add(d)
    }
  }
  const coveredWorkdays = coveredSet.size
  const uncoveredWorkdays = Math.max(0, elapsedWorkdays - coveredWorkdays)
  let lastCoveredDate: string | null = null
  for (const d of coveredSet) {
    if (lastCoveredDate === null || d > lastCoveredDate) lastCoveredDate = d
  }
  const trailingGapWorkdays = lastCoveredDate
    ? countWorkdays(addDays(lastCoveredDate, 1), today, offSet)
    : 0

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
    coveredWorkdays,
    uncoveredWorkdays,
    lastCoveredDate,
    trailingGapWorkdays,
  }
}

/** Raw calendar span of a period, before clipping to the goal window/today. */
interface RawSpan {
  rawStart: string
  rawEnd: string
}

/** Monday-anchored week spans from `start` up to the week containing `end`. */
function weekSpans(start: string, end: string): RawSpan[] {
  const spans: RawSpan[] = []
  let monday = mondayOf(start)
  let guard = 0
  while (monday <= end && guard < 1000) {
    spans.push({ rawStart: monday, rawEnd: addDays(monday, 6) })
    monday = addDays(monday, 7)
    guard++
  }
  return spans
}

/** Calendar-month spans from `start`'s month up to the month containing `end`. */
function monthSpans(start: string, end: string): RawSpan[] {
  const spans: RawSpan[] = []
  const startDate = parseISODate(start)
  let year = startDate.getFullYear()
  let month = startDate.getMonth() // 0-indexed
  let guard = 0
  while (guard < 1000) {
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`
    const rawStart = `${monthStr}-01`
    if (rawStart > end) break
    spans.push({ rawStart, rawEnd: lastOfMonth(monthStr) })
    if (month === 11) {
      month = 0
      year++
    } else {
      month++
    }
    guard++
  }
  return spans
}

/**
 * Per-period (week or month) logged-vs-needed history for the goal year so far.
 *
 * Each period's `needed` is a flat rate — `goal.target / totalWorkdaysInYear` times
 * the period's own workdays — so time off is accounted for twice over: it shrinks the
 * year denominator (raising the rate) and shrinks each affected period's target.
 * `logged` reuses the same span-distribution (`sumHours`) as `computeMetrics`, so the
 * periods sum to `completedToDate`.
 */
export function computePaceHistory(
  data: AppData,
  goal: Goal,
  granularity: PaceGranularity,
  now = todayISO(),
): PacePeriod[] {
  // Guard on the RAW now, before any clamp: nothing to show before the year starts
  // or without a positive, achievable target.
  if (goal.target <= 0) return []
  if (now < goal.startDate) return []

  const offSet = timeOffDateSet(data.timeOff)
  const totalWorkdays = countWorkdays(goal.startDate, goal.endDate, offSet)
  if (totalWorkdays === 0) return []

  const flatPerWorkday = goal.target / totalWorkdays
  const today = minISO(now, goal.endDate)

  const spans = granularity === "week" ? weekSpans(goal.startDate, today) : monthSpans(goal.startDate, today)

  const periods: PacePeriod[] = []
  for (const { rawStart, rawEnd } of spans) {
    const winStart = maxISO(rawStart, goal.startDate)
    const winEnd = minISO(rawEnd, today)
    if (winStart > winEnd) continue

    const logged = sumHours(data.entries, winStart, winEnd, offSet)
    const workdays = countWorkdays(winStart, winEnd, offSet)
    const needed = flatPerWorkday * workdays

    const eps = Math.max(needed * 0.01, 0.05)
    let status: PaceStatus
    if (needed <= 0) {
      status = logged > eps ? "ahead" : "on"
    } else if (logged > needed + eps) {
      status = "ahead"
    } else if (logged < needed - eps) {
      status = "behind"
    } else {
      status = "on"
    }

    periods.push({
      key: rawStart,
      label: granularity === "week" ? formatShort(rawStart) : monthName(rawStart),
      logged,
      needed,
      workdays,
      status,
      // The in-progress period contains the real now (not the clamped today), so a
      // past goal year leaves nothing marked current.
      current: now >= rawStart && now <= rawEnd,
    })
  }
  return periods
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
