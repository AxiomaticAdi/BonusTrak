# BonusTrak

A billable-hours tracker that keeps you on pace toward your annual billable-hour goal. Log hours, plan time off, and forecast where you'll land at year-end.

BonusTrak runs entirely in the browser — all data lives in `localStorage`, so there is no account, no server, and nothing leaves your device.

## Features

- **Goal tracking** — set an annual billable-hour target and a fiscal year window.
- **Flexible logging** — record hours as daily, weekly, or monthly entries.
- **Time off** — add vacation, personal days, holidays, and other time off so they're excluded from your required-pace math.
- **Live forecast** — see projected year-end hours, variance against target, and whether you're ahead, on, or behind pace.
- **Two pace modes** — compare a *trailing* (last 4 weeks) pace against a *year-to-date* pace.
- **PWA-ready** — installable with app icons and a web manifest; dark mode included.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router) + [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/) (new-york style) with [Radix UI](https://www.radix-ui.com/) primitives and [lucide](https://lucide.dev/) icons
- [Recharts](https://recharts.org/) for charts, [Sonner](https://sonner.emilkowal.ski/) for toasts

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first load you'll be prompted to set up your goal.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Project structure

```
app/                  App Router routes (dashboard + /settings) and layout
components/
  dashboard/          Progress, pace, and forecast cards
  settings/           Goal, hours-log, and time-off editors
  ui/                 shadcn/ui primitives
lib/
  store.tsx           React Context store, localStorage persistence
  calculations.ts     Pace/forecast metrics
  dates.ts            Timezone-safe "YYYY-MM-DD" date helpers
  types.ts            Core domain types
hooks/                Reusable React hooks
public/               Icons, manifest, static assets
```

## Data & privacy

All state is persisted in the browser under the `bonustrak:` `localStorage` keys. Clearing site data resets the app. There is no backend.
