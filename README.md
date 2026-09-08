# WebNB

Rental cashflow tracker for bookings, occupancy, expenses, and monthly performance.

The app is a Vite + React + TypeScript single-page app backed by Supabase. It tracks booking revenue, pass-through tax, owner-use days, Kindred occupancy days, expected and actual variable expenses, tax overrides, monthly notes, skipped months, prorated months, fixed costs, principal gained, and tiered monthly performance.

## Features

- Booking CRUD with revenue, pass-through tax, booking date, check-in date, and check-out date.
- Occupancy table that combines Airbnb booking days with manually entered Kindred and owner-use days.
- Expected expenses table with month-level cleaning, support, tax, and misc costs, plus a bulk update for future expected variable expenses.
- Performance view with revenue distribution, taxes, variable expenses, fixed costs, principal gained, tier totals, notes, and default collapsed past years.
- A per-month flag in both the performance and expenses tables: **S** skips the month from that table's totals, **P** prorates that month's fixed costs by its owner-use days, **V** counts every cost except the fixed costs. A month carries at most one — picking a flag clears the others, and clicking the active one turns it off. Fixed costs are flat and fully counted unless a month is flagged P or V.
- Each tab stores its own flags, so skipping, prorating, or flagging a month variable-only in Performance does not affect Expenses, or vice versa. Each flag has its own table, holding nothing but the fact that a month is selected — never a computed figure.
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
- `variable_only_months`
- `expense_excluded_months`
- `expense_prorated_months`
- `expense_variable_only_months`
- `performance_notes`

The app expects snake_case database columns and maps them to camelCase TypeScript models in the hooks under `src/features`.

## Deployment

The project includes `vercel.json` with an SPA rewrite to `index.html`, so browser routes such as `/performance`, `/revenue-per-night`, `/bookings`, `/occupancy`, and `/expenses` work when deployed on Vercel.
