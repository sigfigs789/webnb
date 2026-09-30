# WebNB

Rental cashflow tracker for bookings, occupancy, expenses, and monthly performance.

The app is a Vite + React + TypeScript single-page app backed by Supabase. It tracks booking revenue, pass-through tax, owner-use days, Kindred occupancy days, expected and actual variable expenses, tax overrides, monthly notes, skipped months, prorated months, fixed costs, principal gained, and tiered monthly performance.

## Features

- Booking CRUD with revenue, pass-through tax, booking date, check-in date, and check-out date. The booking table shows revenue per night and take-home per night (revenue excluding pass-through tax); when a booking has none entered, the tax is estimated as the 17.962% Oahu tax share of its revenue (`revenue × rate ÷ (1 + rate)`) and marked with `~`. This is display-only; stored bookings are not changed.
- Occupancy table that combines Airbnb booking days with manually entered Kindred and owner-use days.
- Expected expenses table with month-level cleaning, support, tax, and misc costs, plus a bulk update for future expected variable expenses.
- Performance view with revenue distribution, taxes, variable expenses, fixed costs, principal gained, tier totals, notes, and default collapsed past years.
- A per-month flag in both the performance and expenses tables: **S** skips the month from that table's totals, **P** prorates that month's fixed costs by its owner-use days, **V** counts every cost except the fixed costs. A month carries at most one — picking a flag clears the others, and clicking the active one turns it off. Fixed costs are flat and fully counted unless a month is flagged P or V.
- Each tab stores its own flags, so skipping, prorating, or flagging a month variable-only in Performance does not affect Expenses, or vice versa. Each flag has its own table, holding nothing but the fact that a month is selected — never a computed figure.
- Revenue/night tab with an interactive bar chart of revenue per occupied night (excluding pass-through tax) across the years: monthly or yearly granularity, per-year toggles, click-to-pin bar detail, and a weighted-average reference line.
- Analyze booking tab for a hypothetical stay (nothing is saved). It opens on the next July 4 → August 7 stay taking home $6,900, and "take-home" is the stay's revenue with no tax in it:
  - compares its revenue/night (excluding pass-through tax) with the same dates last year, the same months last year, last year's average, and the all-time average;
  - shows the calendar impact against the minimum stay (30 nights by default): gaps left before and after it, nights stranded, and how many stays the window can still hold before vs after, with numbered potential-stay blocks drawn in the before/after bars where they would go, extra blocked dates you can add, and a gap-between-bookings input (0 = perfect back-to-back) with a 0–3 night comparison table, since each future stay then needs that many free nights beside its neighbours;
  - shows what an x% discount costs in pocket after taxes and how its revenue/night compares with the same dates last year, with a 5–20% ladder and a break-even in nights;
  - a special offer calculator for Airbnb's host-only fee, which applies to new bookings: the special offer price (what the guest pays all-in) is the listing price plus 17.962% Oahu taxes on it (4.712% GET + 10.25% TAT + 3% Oahu TAT), and take-home is the listing price less the host fee, so `take-home = special offer price ÷ (1 + tax) × (1 − host fee)`. The host fee defaults to 13.2109%, worked out from a real booking ($9,381 paid → $6,901.96 take-home). Your take-home per night is compared with the same dates last year. Revenue/night is take-home ÷ nights; pass-through tax is the tax on the listing price, `take-home ÷ (1 − host fee) × tax`, unless entered. Past bookings and the Performance tab are unchanged.
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

To play with the app without Supabase, run it on fake booking data instead. Ten made-up bookings from 2025–2027 are seeded from `src/lib/fixtures.ts`; edits are kept in the browser's localStorage, and the banner's Reset button restores the seed. The fixture data is a permanent reference: `src/lib/fixtures.test.ts` pins what it demonstrates (history on the analyzer's default Jul 4 → Aug 7, 2027 stay, stranded gaps on both sides, and bookings with and without pass-through tax), so extend it rather than remove it:

```sh
npm run dev:fixtures
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
- `variable_only_months`
- `expense_excluded_months`
- `expense_prorated_months`
- `expense_variable_only_months`
- `performance_notes`

The app expects snake_case database columns and maps them to camelCase TypeScript models in the hooks under `src/features`.

## Deployment

The project includes `vercel.json` with an SPA rewrite to `index.html`, so browser routes such as `/performance`, `/revenue-per-night`, `/bookings`, `/occupancy`, `/expenses`, and `/analyze` work when deployed on Vercel.

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
