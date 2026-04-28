# Billing System (Hire.ai)

## Overview
This project includes a credit-based billing system with three tiers:
- **None** (no plan selected)
- **Pro**
- **Premium**

It introduces:
1. Persistent subscription state (`subscriptions` table)
2. Metered usage ledger (`usage_events` table)
3. Plan enforcement middleware (`checkPlanAccess`) integrated into AI-heavy and invite flows
4. Billing APIs for subscribe, top-up, and usage monitoring
5. Frontend billing page (`/billing`) with credits, usage, and plan purchase actions

---

## Tier Model

### None
- No initial credits
- Users can add top-ups anytime
- Services stop when credits are exhausted

### Pro
- One-time credit purchase: **$36.13**
- Credits added to wallet immediately
- Services stop when credits are exhausted
- Users can add additional top-ups

### Premium
- One-time credit purchase: **$96.37**
- Credits added to wallet immediately
- Services stop when credits are exhausted
- Users can add additional top-ups

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

All plans use the same metered pricing. Credits are deducted from the wallet balance for each feature used.

---

## Database Schema
Migration file: `supabase/migrations/20260428193000_credit_based_billing.sql`

### `subscriptions`
Tracks:
- current plan (`none`, `pro`, `premium`)
- status (`active`, `paused`)
- credit_amount (total credits purchased)
- wallet_balance (remaining credits)

### `usage_events`
Append-only ledger of feature usage:
- `feature_type`
- `quantity`
- `unit_cost`
- `total_cost`
- optional job/candidate references

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
- `checkPlanAccess`

### `checkPlanAccess` behavior
1. Blocks immediately for paused accounts
2. Checks if user has sufficient credits for the requested feature
3. If sufficient credits:
   - deducts wallet by unit cost × quantity
   - records usage event
   - if wallet reaches zero: pauses account and sends pause email
4. If insufficient credits:
   - blocks the request with error message
   - prompts user to purchase plan or add credits

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
  Creates Stripe checkout for Pro/Premium credit purchase.

- `GET /api/billing/usage`  
  Returns wallet state, credit amount, feature costs, and usage breakdown.

- `POST /api/billing/topup`  
  Creates checkout session for wallet top-up.

- `POST /api/billing/webhook`  
  Handles checkout completion for:
  - subscribe (adds credits to wallet)
  - top-up (adds credits to wallet)

  Restores account on successful payment and sends confirmation email.

---

## Frontend UX

### Billing page
File: `src/pages/BillingPage.tsx`

Features:
- credit balance display
- top-up action (add any amount)
- plan purchase actions (Pro/Premium - one-time credit purchases)
- usage breakdown by feature
- paused-state callout with “Add Credits” CTA

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

Also added strongly typed interface:
- `BillingUsageResponse`

---

## Notifications
Emails are sent for:
1. services paused due to credit exhaustion
2. credits added (top-up or plan purchase)

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
- The system is credit-based: there are no monthly billing cycles or recurring charges. Users purchase credits once and can add more as needed.
