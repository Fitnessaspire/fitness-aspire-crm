# Fitness Aspire — Sales CRM

Internal lead management and sales pipeline for Fitness Aspire.
React + Vite + Tailwind. Currency throughout is Malaysian Ringgit (RM).

---

## Phase 1 — Get it running (about 20 minutes)

You need **Node.js 18 or newer**. Check with `node -v`. If that errors,
install from [nodejs.org](https://nodejs.org) — take the LTS version.

### 1. Install and run

```bash
cd fitness-aspire-crm
npm install
npm run dev
```

Open **http://localhost:5173**. The app loads with sample data so you can
see the whole workflow immediately.

### 2. Clear the sample data when you're ready for real leads

Settings → Data → **Reset to sample data** reloads the demo set.
To start genuinely empty, open `src/App.jsx`, find `seedData()`, and
replace its final `return` with:

```js
return {
  version: 1, users: DEFAULT_USERS, settings: DEFAULT_SETTINGS,
  campaigns: [], leads: [], activities: [], followups: [],
  appointments: [], notes: [], currentUserId: "u1", dismissedAlerts: [],
};
```

Then in Settings: put in your real packages, locations, trainers and team.

### 3. Put it on the internet

```bash
npm run build     # check it compiles — output lands in dist/
```

Push to GitHub, then connect the repo at [vercel.com](https://vercel.com).
Vercel auto-detects Vite; accept the defaults and deploy. You'll get a URL
in about a minute, and every future `git push` redeploys automatically.

To use your own address, add `crm.fitnessaspire.com` under
Vercel → Settings → Domains, then add the CNAME record it shows you at
your domain registrar.

### What Phase 1 gives you — and what it doesn't

Data is saved in **the browser you're using**. That means it works offline
and needs no server, but each device has its own separate copy and there
is no login. Fine for you alone. Not yet fine for a sales team.

---

## Phase 2 — Shared team data and logins

This is the step that turns it into a real multi-user system.

### 1. Create the database

Sign up at [supabase.com](https://supabase.com), create a project
(choose the **Singapore** region — closest to Johor Bahru).

Open **SQL Editor**, paste in `supabase/schema.sql`, and run it. That
creates every table from the spec — leads, activities, follow-ups,
appointments, campaigns, deals, packages, notes, notifications, settings —
with audit columns, indexes, and the row-level security rules that make
Admin see everything while Sales sees only their own leads.

### 2. Connect the app

```bash
npm install @supabase/supabase-js
cp .env.example .env
```

Fill `.env` with your project URL and anon key (Supabase → Settings → API),
and set `VITE_STORAGE_MODE=supabase`.

Then open `src/lib/storage.js`, uncomment the `remote` block, and change
the last line to export `remote` instead of `local`.

That single file is the only thing standing between browser storage and
the cloud — `App.jsx` doesn't change at all.

### 3. Add logins

Supabase → Authentication → enable **Email**. Invite your team, and insert
a matching row in `profiles` for each one with their role (`admin` or
`sales`). Then replace the role-switcher dropdown at the bottom of the
sidebar with the signed-in user, and gate the app behind a login screen.

### 4. Migrate table-by-table (optional, later)

The `app_state` bridge table lets the whole app move to the cloud in one
step while still storing everything as a single JSON blob. When you want
proper querying and reporting, move one table at a time — start with
`leads` — and leave the rest on the bridge until you get to them.

---

## Phase 3 — Integrations

The schema already carries `external_source` and `external_id` on `leads`
and `campaigns`, so connectors write straight in without a migration.

- **WhatsApp** — Meta Cloud API. Log every inbound and outbound message
  into `lead_activities`. Highest value: it kills manual data entry.
- **Meta / Google Ads** — pull spend nightly into `campaigns.spend_myr`.
  CPL, CPA and ROAS then update themselves.
- **Meta Lead Ads** — webhook straight into `leads` with
  `external_source = 'meta'`, so a form fill becomes a lead instantly.

Do them in that order. WhatsApp saves the most hours per week.

---

## Project structure

```
index.html              fonts + mount point
tailwind.config.js      scans src/ for classes
src/
  main.jsx              React entry
  App.jsx               the entire CRM
  index.css             Tailwind + the pine & brass theme
  lib/storage.js        the one file to change when moving to a server
supabase/
  schema.sql            full relational schema + RLS policies
```

`App.jsx` is one large file on purpose — it's easier to search and keeps
every calculation in one place. When it starts getting in your way, split
it along the view boundaries already marked by the section comments.

---

## Housekeeping

**Backups.** Phase 1 data lives in one browser. Settings → Data →
**Download a backup** exports everything. Do it weekly until Phase 2.

**Costs.** Vercel and Supabase both have free tiers that comfortably fit a
team your size. A domain runs roughly RM50–80 a year.

**Before you trust it with real money:** run one week in parallel with
however you track leads today. If the numbers agree at the end of the
week, switch over.
