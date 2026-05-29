export type PaceMode = "trailing" | "ytd"

export interface Goal {
  /** Annual billable-hour target, e.g. 1900 */
  target: number
  /** Fiscal year start date, ISO "YYYY-MM-DD" */
  startDate: string
  /** Fiscal year end date, ISO "YYYY-MM-DD" */
  endDate: string
}

export type HoursEntryKind = "day" | "week" | "month"

interface HoursEntryBase {
  id: string
  hours: number
  note?: string
}

/**
 * An entry is a span of time carrying a total number of hours. The hours are
 * distributed across the workdays inside that span (see lib/calculations.ts).
 * The anchor field differs per kind so an invalid shape is unrepresentable:
 *  - day:   `date`      a single ISO "YYYY-MM-DD" day
 *  - week:  `weekStart` the Monday of the week, ISO "YYYY-MM-DD"
 *  - month: `month`     the calendar month, "YYYY-MM"
 */
export type HoursEntry =
  | (HoursEntryBase & { kind: "day"; date: string })
  | (HoursEntryBase & { kind: "week"; weekStart: string })
  | (HoursEntryBase & { kind: "month"; month: string })

/**
 * A new/edited entry, before an id is assigned. A plain `Omit<HoursEntry, "id">`
 * would collapse the union to its common keys and drop the per-kind anchor, so we
 * distribute the Omit across each member to keep the discriminant intact.
 */
type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never
export type HoursEntryInput = DistributiveOmit<HoursEntry, "id">

export type TimeOffType = "vacation" | "personal" | "holiday" | "other"

export interface TimeOff {
  id: string
  type: TimeOffType
  /** Inclusive start date, ISO "YYYY-MM-DD" */
  start: string
  /** Inclusive end date, ISO "YYYY-MM-DD" */
  end: string
  label?: string
}

export interface AppData {
  goal: Goal | null
  entries: HoursEntry[]
  timeOff: TimeOff[]
}

export const TIME_OFF_LABELS: Record<TimeOffType, string> = {
  vacation: "Vacation",
  personal: "Personal day",
  holiday: "Holiday",
  other: "Other",
}

export const HOURS_KIND_LABELS: Record<HoursEntryKind, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
}
