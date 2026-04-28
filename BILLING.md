# Billing System (Hire.ai)

## Overview
This project now includes a wallet-based subscription billing system with three tiers:
- **Free**
- **Pro**
- **Premium**

It introduces:
1. Persistent subscription state (`subscriptions` table)
2. Metered usage ledger (`usage_events` table)
3. Invoice lifecycle (`invoices` table)
4. Plan enforcement middleware (`checkPlanAccess`) integrated into AI-heavy and invite flows
5. Billing APIs for subscribe, top-up, usage monitoring, invoice payment, and webhook handling
6. Frontend billing page (`/billing`) with wallet, usage, invoices, and upgrade actions

---

## Tier Model

### Free
- No wallet deposit
- Enforced free feature caps per billing cycle
- Upgrade required when cap is exceeded

### Pro
- Monthly wallet deposit: **$36.13**
- Metered deductions by feature
- If wallet hits zero, account is paused and overage invoice is generated

### Premium
- Monthly wallet deposit: **$96.37**
- Metered deductions by feature
- High-usage friendly with no explicit overage cap in config

---

## Billable Features and Unit Costs
Defined in `api/[...path].ts`:

- `create_job`: $0.18
- `resume_parse`: $0.10
- `candidate_scoring`: $0.14
- `assessment_invite`: $0.12 (per candidate)
- `ai_interview_invite`: $0.30 (per candidate)
- `regenerate_interview_questions`: $0.06
- `assessment_mcq_generation`: $0.24

Free plan uses feature caps instead of wallet deductions.

---

## Database Schema
Migration file: `supabase/migrations/20260421193000_billing_system.sql`

### `subscriptions`
Tracks:
- current plan
- status (`active`, `paused`, `overdue`, `cancel_at_period_end`)
- deposit/wallet amounts
- cycle window
- overage and warnings

### `usage_events`
Append-only ledger of feature usage:
- `feature_type`
- `quantity`
- `unit_cost`
- `total_cost`
- optional job/candidate references

### `invoices`
Stores pending/paid invoices:
- period
- line items
- totals
- status + payment reference

Includes:
- indexes for user/time/status access patterns
- RLS enablement + service-role policy
- `updated_at` trigger maintenance

---

## Backend Enforcement and Flow

### Core Helpers (`api/[...path].ts`)
- `normalizeBillingPlan`
- `getOrCreateSubscription`
- `aggregateUsageByFeature`
- `createInvoiceForOverage`
- `checkPlanAccess`

### `checkPlanAccess` behavior
1. Blocks immediately for paused/overdue accounts
2. Free plan:
   - checks cycle usage vs cap
   - records zero-cost usage event
3. Paid plans:
   - deducts wallet by unit cost × quantity
   - records usage event
   - sends 80% consumption warning once per cycle
   - when exhausted: pauses account, creates/extends invoice, sends pause + invoice email

### Integrated endpoints
Plan checks are now wired into:
- `POST /api/jobs`
- `POST /api/jobs/:jobId/regenerate-questions`
- `POST /api/candidates/:id/upload-resume`
- `POST /api/screening/run`
- `GET /api/assessments/:sessionId/mcq` (at generation point)
- `POST /api/assessments/invite`
- `POST /api/ai-interview/invite`

---

## Billing APIs

### New routes (`/api/billing/*`)
- `POST /api/billing/subscribe`  
  Creates Stripe checkout for Pro/Premium deposit.

- `GET /api/billing/usage`  
  Returns wallet state, cycle, limits, feature costs, and usage breakdown.

- `POST /api/billing/topup`  
  Creates checkout session for wallet top-up.

- `GET /api/billing/invoices`  
  Lists user invoices.

- `POST /api/billing/pay-invoice`  
  Creates checkout session for invoice payment.

- `POST /api/billing/webhook`  
  Handles checkout completion for:
  - subscribe
  - top-up
  - invoice payment

  Restores account on successful payment and sends restoration email.

---

## Frontend UX

### Billing page
File: `src/pages/BillingPage.tsx`

Features:
- wallet balance + consumption meter
- top-up action
- plan upgrade actions (Pro/Premium)
- usage breakdown by feature
- invoice listing + pay action
- paused-state callout with “Pay Now” CTA

### Global pause banner
File: `src/components/layout/DashboardLayout.tsx`

Shows a warning banner outside `/billing` if account status is `paused`, with quick navigation to billing page.

### Navigation and route
- route: `src/App.tsx` (`/billing`)
- sidebar entry: `src/components/layout/Sidebar.tsx`

---

## Client API additions
File: `src/lib/api.ts`

Added:
- `billingApi.subscribe(plan)`
- `billingApi.usage()`
- `billingApi.topup(amount)`
- `billingApi.payInvoice(invoiceId)`
- `billingApi.invoices()`

Also added strongly typed interfaces:
- `BillingUsageResponse`
- `BillingInvoice`

---

## Notifications
Emails are sent for:
1. 80% wallet usage warning
2. services paused due to wallet exhaustion
3. invoice generated for overage
4. payment confirmed / services restored

---

## Tests
Added frontend API regression tests:
- `src/test/billingApi.test.ts`

Covered:
- subscribe request payload + auth header
- usage endpoint call shape
- invoice payment payload

---

## Validation Run
Executed successfully:
- `npm run build`
- `npm test`

---

## Environment Variables
Ensure these are available for billing and payments:
- `STRIPE_SECRET_KEY`
- `FRONTEND_URL`
- existing auth/database env vars (`SUPABASE_*`, `CLERK_*`)

---

## Notes / Caveats
- Stripe webhook signature verification is not yet implemented in this iteration.
- Existing `subscription` routes still exist for backward compatibility.
- Historical TypeScript IDE lint warning about `openai` module declarations appears environment-specific; build passes successfully.
