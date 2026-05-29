# CLAUDE.md

Guidance for working in this repository.

## What this is

**BonusTrak** is a client-only billable-hours tracker built with Next.js 16 (App Router) and React 19. It helps a user stay on pace toward an annual billable-hour goal: log hours, plan time off, and forecast the year-end finish.

There is **no backend**. All state lives in the browser's `localStorage` under keys prefixed `bonustrak:` (`bonustrak:data:v1`, `bonustrak:paceMode:v1`). Treat the browser as the only source of truth.

> The project was originally scaffolded with [v0.app](https://v0.app); some files still contain `[v0]` log prefixes and a v0 `generator` metadata field.

## Commands

```bash
npm run dev     # dev server (http://localhost:3000)
npm run build   # production build
npm run start   # serve production build
npm run lint    # ESLint
```

There is no test suite.

## Architecture

- **Routes** (`app/`): `/` is the dashboard (`app/page.tsx`), `/settings` holds the editors. `app/layout.tsx` wraps everything in `StoreProvider` and the Sonner `Toaster`.
- **State** (`lib/store.tsx`): a single React Context store. `StoreProvider` hydrates from `localStorage` on mount (`hydrated` flag guards against writing before the first read) and persists on every change. Mutations go through the `useStore()` hook — `setGoal`, `addEntry`/`updateEntry`/`deleteEntry`, `addTimeOff`/`updateTimeOff`/`deleteTimeOff`, `setPaceMode`. Don't write to `localStorage` directly elsewhere.
- **Domain types** (`lib/types.ts`): `Goal`, `HoursEntry` (`kind`: daily/weekly/monthly), `TimeOff`, and the `AppData` envelope.
- **Metrics** (`lib/calculations.ts`): `computeMetrics()` is the single source of all pace/forecast math (completed, remaining, required-per-week, projected, variance, status). Two pace modes: `trailing` (last 28 calendar days ÷ 4) and `ytd`. Workdays are Mon–Fri minus time-off days.
- **Dates** (`lib/dates.ts`): all dates are `"YYYY-MM-DD"` strings treated as **local** calendar days to avoid timezone drift. Use these helpers (`addDays`, `eachDay`, `clampISO`, etc.) — never construct `Date` from an ISO string directly, and never compare dates across timezones.
- **UI** (`components/`): `components/ui/` is shadcn/ui (new-york style) — generally don't hand-edit these. Feature UI lives in `components/dashboard/` and `components/settings/`.

## Conventions

- **Imports**: use the `@/*` path alias (e.g. `@/lib/store`, `@/components/ui/button`).
- **Client vs server**: the store and any interactive component need `"use client"`. Keep `page.tsx` server components thin where possible.
- **Styling**: Tailwind v4 with CSS variables (theme tokens in `app/globals.css`). Use the `cn()` helper from `@/lib/utils` for conditional classes. Icons come from `lucide-react`.
- **Adding shadcn components**: use the shadcn CLI so config in `components.json` is respected, rather than authoring primitives by hand.

## Gotchas

- `next.config.mjs` sets `typescript.ignoreBuildErrors: true` and `images.unoptimized: true`. **A green `npm run build` does not mean the types are clean** — run `npx tsc --noEmit` if you need real type checking.
- Anything reading `localStorage` must wait for `hydrated` to be `true`, or it will flash empty/default state on first render.
- When changing the persisted shape, bump the storage key version (e.g. `:v1` → `:v2`) and handle migration, since existing users have data under the old key.
