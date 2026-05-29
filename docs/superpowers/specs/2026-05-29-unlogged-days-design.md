> **SUPERSEDED (2026-05-29).** This week-bucketing approach was never wired into the
> app and has been replaced by the span-based data model (entries are time spans;
> coverage and pace are measured in workdays, not Mon–Sun weeks). Kept for history.
> See the implementation in `lib/calculations.ts` (`entrySpan`, `coveredWorkdays`).

# Unlogged Days / Weeks — Coverage Gap Design

## Problem

The app currently treats missing log entries the same as explicitly-logged 0-hour entries. A user who simply hasn't logged yet sees "Behind pace — 0.0 hrs/wk," which is misleading. Only a logged entry with `hours: 0` should be treated as no work done; the absence of an entry should be surfaced as an unknown gap rather than assumed to be zero.

## Decision

Add coverage metadata to `Metrics` and display a contextual warning in the Pace and Forecast cards when gaps exist. Pace math is not changed — missing weeks are not excluded from denominators. The warning tells the user the pace number may be incomplete.

## Approach

**Approach A — Coverage metadata in `Metrics`** (chosen)

- Minimal new surface area: two fields added to the existing `Metrics` object.
- Pace and forecast numbers keep their current meaning (no silent denominator changes).
- UI components have a clean data source for the coverage note.

Rejected alternatives:

- **Approach B** (standalone `computeCoverage()`) — duplicates date-range logic, splits one computation into two calls.
- **Approach C** (adjust pace denominator) — changes what the pace number means without a clear user mental model; risks making pace look artificially optimistic.

## Data Model & Calculations (`lib/calculations.ts`)

Two new fields on `Metrics`:

```ts
coveredWeeks: number // Mon–Sun weeks in [goalStart, today] with ≥1 entry
totalElapsedWeeks: number // total Mon–Sun weeks overlapping [goalStart, today]
```

New helper: `coveredWeekCount(entries, startISO, endISO)`

- Walks Mon–Sun week boundaries from the first Monday ≤ `startISO` through the week containing `endISO`.
- A week is "covered" if any entry's representative `date` falls within that Mon–Sun span.
- All entry kinds (`daily`, `weekly`, `monthly`) use the same `date` field — no special-casing needed.
- Returns `{ coveredWeeks, totalElapsedWeeks }`.

`computeMetrics` calls this helper and includes both values in its return. No changes to `trailingPerWeek`, `ytdPerWeek`, `projected`, or any other existing metric.

All computation runs client-side (called from `dashboard-view.tsx` inside a `"use client"` component).

## UI — Pace Card (`components/dashboard/pace-card.tsx`)

When `metrics.coveredWeeks < metrics.totalElapsedWeeks`:

- Render a small muted line below the two pace bars, above the existing explanatory sentence:
  > Based on **N of M** logged weeks · X weeks unlogged
- Hidden when `coveredWeeks === totalElapsedWeeks` (no noise for users who log consistently).

## UI — Forecast Card (`components/dashboard/forecast-card.tsx`)

When `metrics.coveredWeeks < metrics.totalElapsedWeeks`:

- Render the same coverage note below the "Projected year-end finish" value and above the variance badge:
  > Based on **N of M** logged weeks · X weeks unlogged
- Same visibility rule: hidden when fully covered.

## Out of Scope

- Changing the pace denominator to exclude unlogged weeks.
- Day-level coverage tracking.
- Any backend / Supabase changes.
- Real-time merge or conflict resolution for multi-device edits.
