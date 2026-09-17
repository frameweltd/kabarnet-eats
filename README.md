# Kabarnet Eats

Food delivery marketplace connecting hotels/restaurants with customers in
Kabarnet, Baringo County, Kenya. Built with Next.js (App Router), Supabase
(Postgres + Auth + Row Level Security), and deployed on Vercel.

## Stack

- **Next.js 14** (App Router, TypeScript, Tailwind CSS)
- **Supabase** — Postgres database, authentication, real-time subscriptions,
  Row Level Security
- **M-Pesa Daraja API** — STK Push for mobile money payments
- **Vercel** — hosting

## Roles

- **Customer** — browses hotels, orders food, tracks delivery, files disputes
- **Hotel** — manages menu, receives/processes orders, views earnings
- **Rider** — toggles availability, sees assigned deliveries (optional layer
  — orders work fine with just a contact phone if you don't need this yet)
- **Admin** (you) — approves/suspends hotels, sets commission rates,
  generates payout settlements, resolves disputes

## Project structure

```
supabase/migrations/     SQL migrations — run these in order
src/app/                 Next.js pages, organized by role
  ├─ login/, signup/      Auth pages
  ├─ customer/             Customer-facing pages
  ├─ hotel/                Hotel dashboard
  ├─ admin/                Admin dashboard
  ├─ rider/                Rider dashboard
  └─ api/                  Route handlers (M-Pesa STK push + callback)
src/lib/                 Supabase clients, commission math, M-Pesa helpers
src/types/database.ts    TypeScript types matching the schema
```

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project, and note
your project URL and keys from **Settings → API**.

### 2. Run the migrations

In the Supabase dashboard, open **SQL Editor** and run each file in
`supabase/migrations/` **in order** (0001, 0002, 0003, 0004). Each is
idempotent-ish but not designed to be re-run blindly — if you need to
reset, drop the tables first or start a fresh project.

Alternatively, if you have the Supabase CLI installed locally:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in your Supabase URL/keys. Leave the M-Pesa values as placeholders
until you're ready to test payments (see below) — the app runs fine with
cash-only orders in the meantime.

### 4. Install dependencies and run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

### 5. Create your admin account

Sign up through the app UI (any role — the signup form doesn't expose
"admin" on purpose). Then in the Supabase SQL Editor:

```sql
select id, email from auth.users; -- find your user's UUID
update profiles set role = 'admin' where id = 'paste-uuid-here';
```

Log out and back in — you'll be redirected to `/admin`.

### 6. Activate a test hotel

Sign up a second account via `/signup?role=hotel`. It starts as
`pending_approval`. Approve it from **Admin → Hotels → Activate**, then log
in as that hotel and add some menu items under **Menu**.

You can now place a test order as a customer.

## M-Pesa setup (when you're ready)

1. Register at [developer.safaricom.co.ke](https://developer.safaricom.co.ke)
   and create an app to get sandbox credentials.
2. Fill in `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`
   (use `174379` for sandbox testing), and `MPESA_PASSKEY` in `.env.local`.
3. `MPESA_CALLBACK_URL` must be a **publicly reachable HTTPS URL** —
   Safaricom's servers need to reach it. This won't work with
   `localhost`; deploy to Vercel first (see below), or use a tunnel tool
   like `ngrok` for local testing.
4. Go live with a real Paybill/Till number only after testing thoroughly
   in sandbox — Safaricom has a formal go-live review process.

## Deploying to Vercel

### First-time setup

```bash
git init
git add .
git commit -m "Initial commit: Kabarnet Eats platform"
```

Push to GitHub (create a new repo first, e.g. on github.com), then:

```bash
git remote add origin https://github.com/your-username/kabarnet-eats.git
git branch -M main
git push -u origin main
```

### Connect to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repo.
2. Vercel auto-detects Next.js — no build config changes needed.
3. Add environment variables under **Project Settings → Environment
   Variables**: copy every value from your `.env.local`.
4. Deploy. Vercel gives you a URL like `kabarnet-eats.vercel.app`.
5. Update `MPESA_CALLBACK_URL` in Vercel's env vars to point at your real
   deployed domain, then redeploy (env var changes require a redeploy to
   take effect).

### Ongoing deploys

Every `git push` to `main` auto-deploys via Vercel's GitHub integration.
For safer changes, push to a branch first — Vercel creates a preview
deployment automatically, so you can test before merging to `main`.

## Generating weekly payouts

As admin, go to **Admin → Settlements**. Pick a date range (defaults to
the last 7 days), and click **Generate batch** for each hotel with pending
orders. This locks in their commission records as "settled" and creates a
payout record showing what you owe them (for M-Pesa orders) or what they
owe you (for cash orders — check the breakdown, since this app tracks
commission owed either direction but doesn't auto-net the two; see the
commission logic notes below).

Actually transferring the money (M-Pesa B2C, bank transfer, or in-person
cash handoff) is a manual step for now — mark the batch `paid` once done.

## Commission logic — quick reference

- Commission rate is captured on **each order** at the moment it's placed
  (`orders.commission_rate_applied`) — so admin rate changes only affect
  future orders, never past ones.
- A `commission_records` row is created automatically (via database
  trigger) the instant an order's status becomes `delivered`.
- If a delivered order is later cancelled (e.g. a dispute resolved with a
  refund), the trigger reverses the commission with an offsetting negative
  record — nothing is deleted, so the audit trail stays intact.
- Full worked example and edge case reasoning: see the original design
  conversation, or read the comments in
  `supabase/migrations/0003_commission_logic.sql`.

## Things worth knowing about this build

- **Multi-hotel orders are disallowed by design** — one order always
  belongs to exactly one hotel. This was a deliberate v1 simplification.
- **Riders are optional.** If your hotels handle their own delivery staff,
  just leave `delivery_contact_phone` filled in on orders and skip the
  rider flow entirely — nothing forces you to onboard riders.
- **Landmark descriptions matter more than GPS pins** in a town like
  Kabarnet — the address form nudges customers to fill this in for a
  reason.
- **RLS is doing real work here.** Every table has Row Level Security
  policies restricting who can read/write what, enforced at the database
  level — this matters because the browser talks to Supabase directly in
  several places, not just through your API routes.
- The M-Pesa callback matches payments via `CheckoutRequestID`, stored the
  moment an STK push is initiated — this is deliberately more robust than
  matching on phone number + amount, which can misfire with concurrent
  orders.

## Known gaps / next steps

- No automated tests yet.
- Settlement batch generation is manually triggered by admin — could be
  automated with a Supabase Edge Function on a weekly cron.
- No SMS notifications wired up yet (the `notifications` table exists;
  hook up Africa's Talking or a similar SMS gateway when ready).
- Rider assignment to orders is currently manual (no `rider_id` is set
  automatically) — you'd add an admin action or a rider "claim order"
  button depending on how you want dispatch to work.
- Image uploads for menu items aren't wired to Supabase Storage yet —
  `menu_items.photo_url` is a plain text field for now.
