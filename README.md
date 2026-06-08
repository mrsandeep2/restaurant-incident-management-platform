# Sentry — Restaurant Incident Reporting Tool

A production-quality SaaS for restaurant operations teams to report, triage,
and resolve incidents across stores — with role-based access, an admin
approval workflow, AI-assisted analysis, file attachments, and analytics.

## Tech Stack

- **Frontend:** React 19, TanStack Start (Router + Server Functions), Vite 7
- **Styling:** Tailwind CSS v4, shadcn/ui, Framer Motion
- **Backend:** Postgres + Auth + Storage (managed), RLS-secured
- **AI:** Google Gemini (via secure server-side gateway)
- **Charts:** Recharts

## Features

- Email/password auth with admin approval workflow (pending → approved/rejected)
- Three fixed roles: **Staff**, **Manager**, **Admin** — enforced via RLS + route guards
- Incident submission with category, severity, store, attachments
- Dashboard with KPIs, monthly trends, severity & category charts
- Incident detail view with status workflow, comments, and activity timeline
- AI summary, category prediction, severity recommendation, resolution suggestions
- Store management, user approval center, and audit log (admin only)
- CSV export, search, multi-filter

## Demo Accounts

| Role    | Email                      | Password    |
| ------- | -------------------------- | ----------- |
| Admin   | admin@restaurant.com       | Admin@123   |
| Manager | manager@restaurant.com     | Manager@123 |
| Staff   | staff@restaurant.com       | Staff@123   |

## Getting Started

```bash
bun install
bun run dev
```

The app runs on http://localhost:5173.

## Environment

Server-side secrets (already wired in this project):

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `LOVABLE_API_KEY` — AI gateway key (server-only, never exposed to the browser)

Client-visible:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

## Project Structure

```
src/
  routes/                 # File-based routing (TanStack Router)
    _authenticated/       # Protected app (dashboard, incidents, analytics, …)
    auth.tsx              # Sign-in / sign-up
  lib/                    # Server functions and shared utilities
  components/             # UI components (shadcn-based)
  integrations/supabase/  # Auth-aware DB clients
supabase/migrations/      # Versioned schema + RLS + seed data
```

## License

MIT