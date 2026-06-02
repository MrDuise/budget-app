# Budget App

A household finance hub built with Next.js 14, Prisma, and Plaid. Tracks income, expenses, and bank transactions for one or more people. Works fully solo out of the box — household features unlock when a second person joins.

## Features

- **Variable income support** — log income when it arrives, not when assumed
- **Expense timeline** — see when money actually moves, not just monthly totals
- **Skip a payment** — defer a recurring bill without breaking the recurring rule
- **Daily free-spend allowance** — dynamically calculated from what's left after known obligations
- **Red-line projection** — "if I keep spending like this, when do I overdraft?"
- **Plaid bank sync** — real transactions auto-imported into a review queue
- **Payment plans** — finite recurring bills with progress tracking (e.g. 4 weekly installments)
- **Solo + household modes** — one UI, adapts based on member count

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| ORM | Prisma + SQLite (swap to Postgres by changing one env var) |
| Auth | NextAuth v5 + Credentials |
| Bank sync | Plaid + react-plaid-link |
| Date logic | date-fns |
| Forms | react-hook-form + zod |

## Getting Started

### Prerequisites

- Node.js 18+
- Plaid account (sandbox is free at [dashboard.plaid.com](https://dashboard.plaid.com))

### Setup

```bash
# Install dependencies
npm install

# Copy env template and fill in values
cp .env.local .env.local   # already exists — edit the values

# Push schema to SQLite
npm run db:push

# (Optional) Seed dev data
npm run db:seed

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first load you'll be redirected to `/setup` to create your account.

### Environment Variables

```env
DATABASE_URL="file:./dev.db"

NEXTAUTH_SECRET="<random 32+ char string>"
NEXTAUTH_URL="http://localhost:3000"

PLAID_CLIENT_ID=""
PLAID_SECRET=""
PLAID_ENV="sandbox"   # sandbox | development | production

ENCRYPTION_KEY=""     # 32-byte hex key for encrypting Plaid access tokens
```

## Project Structure

```
budget-app/
├── prisma/
│   ├── schema.prisma       # Full data model
│   └── seed.ts             # Dev seed data
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Dashboard (Phase 4)
│   │   ├── (auth)/login/               # Login page
│   │   ├── (auth)/setup/               # First-run onboarding
│   │   ├── timeline/                   # 60-day chart (Phase 7)
│   │   ├── budget/                     # Budget tracking (Phase 6)
│   │   ├── expenses/                   # Expense CRUD (Phase 5)
│   │   ├── income/                     # Income tracking (Phase 5)
│   │   ├── review/                     # Plaid import queue (Phase 8)
│   │   ├── history/                    # Reports (Phase 9)
│   │   ├── accounts/                   # Account management (Phase 10)
│   │   ├── settings/                   # Settings + invite (Phase 10)
│   │   └── api/                        # API routes
│   ├── components/
│   │   ├── ui/                         # shadcn/ui primitives
│   │   ├── dashboard/                  # Phase 4
│   │   ├── timeline/                   # Phase 7
│   │   ├── budget/                     # Phase 6
│   │   ├── expenses/                   # Phase 5
│   │   ├── review/                     # Phase 8
│   │   ├── history/                    # Phase 9
│   │   ├── accounts/                   # Phase 10
│   │   └── settings/                   # Phase 10
│   ├── lib/
│   │   ├── auth.ts                     # NextAuth config
│   │   ├── db.ts                       # Prisma singleton
│   │   ├── plaid.ts                    # Plaid client (Phase 8)
│   │   ├── projection.ts               # Balance projection engine
│   │   ├── recurrence.ts               # Expand recurring transactions
│   │   ├── allowance.ts                # Daily spending allowance
│   │   ├── redline.ts                  # Overdraft trajectory
│   │   └── reports.ts                  # Period reports & budgets
│   └── hooks/
└── middleware.ts                        # Route protection
```

## Data Model Highlights

**Transaction types:** `income` | `expense` | `transfer`

**Expense categories:**
- `FIXED_BILL` — rent, subscriptions (same amount every month)
- `VARIABLE_RECURRING` — utilities, groceries (recurring but variable amount)
- `VARIABLE_REGULAR` — dining, entertainment
- `SHARED` — visible to all household members
- `UNPLANNED` — one-off surprises
- `SAVINGS` | `INVESTMENT`

**Recurrence patterns:** `monthly` (by day-of-month) | `biweekly` | `weekly` | `once` | custom interval (days)

**Payment plans** (`isFinite: true`): finite recurring bills with either a set number of occurrences or specific dates. Auto-archive when all occurrences are paid/skipped.

**Flexible ownership:** no co-ownership model. Each transaction belongs to one person. If you cover part of someone else's bill, log it as your own expense. Use `OccurrenceOverride.note` to annotate.

**Visibility:** `personal` (default, only owner sees it) | `shared` (visible in household views)

## Running Tests

```bash
npm test
```

32 unit tests covering the core financial logic: recurrence expansion, balance projection, daily allowance, red-line trajectory, and period reports.

## Build Phases

| Phase | Status | What |
|-------|--------|------|
| 1 | ✅ Done | Project scaffold, Prisma schema, NextAuth, solo setup/login |
| 2 | ✅ Done | Pure lib functions + unit tests |
| 3 | 🔜 | All API routes (manual data only) |
| 4 | 🔜 | AppShell + Dashboard |
| 5 | 🔜 | Expenses + Income + SkipDialog |
| 6 | 🔜 | Budget page + daily allowance |
| 7 | 🔜 | Timeline + red-line overlay |
| 8 | 🔜 | Plaid integration |
| 9 | 🔜 | History + CSV export |
| 10 | 🔜 | Accounts + Settings + invite flow |
| 11 | 🔜 | Mobile polish, loading states, error boundaries |

## Plaid Sandbox

During development, use Plaid Sandbox to test bank connections without real credentials.

1. Sign up at [dashboard.plaid.com](https://dashboard.plaid.com) (free)
2. Copy your Sandbox `client_id` and `secret` into `.env.local`
3. Use test credentials: username `user_good`, password `pass_good`
