export type PaceMode = "trailing" | "ytd"

export interface Goal {
  /** Annual billable-hour target, e.g. 1900 */
  target: number
  /** Fiscal year start date, ISO "YYYY-MM-DD" */
  startDate: string
  /** Fiscal year end date, ISO "YYYY-MM-DD" */
  endDate: string
}

export type HoursEntryKind = "daily" | "weekly" | "monthly"

export interface HoursEntry {
  id: string
  /**
   * Representative date for the entry, ISO "YYYY-MM-DD".
   * For weekly entries this is the week-ending date; for monthly it is any day in the month.
   */
  date: string
  hours: number
  kind: HoursEntryKind
  note?: string
}

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
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
}
