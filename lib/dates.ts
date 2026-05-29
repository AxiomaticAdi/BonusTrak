/**
 * Date helpers that operate on "YYYY-MM-DD" strings and treat all dates as
 * local calendar days (no timezone drift).
 */

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Parse "YYYY-MM-DD" into a local Date at midnight. */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function isWeekend(iso: string): boolean {
  const day = parseISODate(iso).getDay()
  return day === 0 || day === 6
}

/** Inclusive day difference (b - a) in whole calendar days. */
export function daysBetween(a: string, b: string): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime()
  return Math.round(ms / 86_400_000)
}

export function clampISO(iso: string, min: string, max: string): string {
  if (iso < min) return min
  if (iso > max) return max
  return iso
}

/** Iterate over each ISO date from start to end inclusive. */
export function eachDay(startISO: string, endISO: string): string[] {
  const out: string[] = []
  if (startISO > endISO) return out
  let cur = startISO
  // Guard against pathological ranges.
  let guard = 0
  while (cur <= endISO && guard < 100_000) {
    out.push(cur)
    cur = addDays(cur, 1)
    guard++
  }
  return out
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

export function formatHuman(iso: string): string {
  const d = parseISODate(iso)
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`
}

export function formatShort(iso: string): string {
  const d = parseISODate(iso)
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`
}

export function monthName(iso: string): string {
  return MONTHS[parseISODate(iso).getMonth()]
}
