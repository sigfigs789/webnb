# WebNB

Rental cashflow tracker for bookings, occupancy, expenses, and monthly performance.

The app is a Vite + React + TypeScript single-page app backed by Supabase. It tracks booking revenue, pass-through tax, owner-use days, Kindred occupancy days, expected and actual variable expenses, tax overrides, monthly notes, skipped months, prorated months, fixed costs, principal gained, and tiered monthly performance.

## Features

- Booking CRUD with revenue, pass-through tax, booking date, check-in date, and check-out date.
- Occupancy table that combines Airbnb booking days with manually entered Kindred and owner-use days.
- Expected expenses table with month-level cleaning, support, tax, and misc costs, plus a bulk update for future expected variable expenses.
- Performance view with revenue distribution, taxes, variable expenses, fixed costs, principal gained, tier totals, notes, and default collapsed past years.
- Two independent per-month toggles in both the performance and expenses tables: **S** skips the month from that table's totals, **P** prorates that month's fixed costs by its owner-use days. Fixed costs are flat unless a month opts in to proration.
- Each tab stores its own flags, so skipping or prorating a month in Performance does not affect Expenses, or vice versa.
- Revenue/night tab with an interactive bar chart of revenue per occupied night across the years: monthly or yearly granularity, per-year toggles, click-to-pin bar detail, and a weighted-average reference line.
- Shared calculation modules covered by Vitest tests.

## Setup

Install dependencies:

```sh
npm install
```

Create a local environment file with Supabase credentials:

```sh
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Start the dev server:

```sh
npm run dev
```

## Scripts

- `npm run dev` starts Vite locally.
- `npm run build` type-checks and builds the app.
- `npm run preview` serves the production build locally.
- `npm run lint` runs ESLint.
- `npm run test` runs the Vitest suite once.
- `npm run test:watch` runs Vitest in watch mode.

## Supabase Data

The frontend reads and writes these Supabase tables:

- `bookings`
- `expenses`
- `occupancy`
- `actual_taxes`
- `excluded_months`
- `prorated_months`
- `expense_excluded_months`
- `expense_prorated_months`
- `performance_notes`

The app expects snake_case database columns and maps them to camelCase TypeScript models in the hooks under `src/features`.

## Deployment

The project includes `vercel.json` with an SPA rewrite to `index.html`, so browser routes such as `/performance`, `/revenue-per-night`, `/bookings`, `/occupancy`, and `/expenses` work when deployed on Vercel.

### Supabase heartbeat

Free-tier Supabase projects are paused after about a week of inactivity, so
[`api/keepalive.js`](api/keepalive.js) reads a single row from `bookings` and is
triggered daily by the `crons` entry in `vercel.json`. It returns HTTP 500 on a
failed ping so the run shows up as a failure in the Vercel dashboard rather than
passing silently.

Two things worth knowing:

- A project that has already been paused stops resolving in DNS, so no ping can
  revive it — it has to be restored from the Supabase dashboard. Treat a failing
  heartbeat as something to act on within the week.
- Set a `CRON_SECRET` environment variable in the Vercel project to reject
  requests that do not come from Vercel Cron. Without it the endpoint is public;
  it only ever performs a `limit=1` read, but setting it is preferable.

This replaces a GitHub Actions workflow that GitHub disabled automatically after
60 days without commits — scheduled workflows are not a dependable heartbeat for
a repo that goes quiet.
