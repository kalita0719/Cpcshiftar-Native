# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### shift-scheduler (React + Vite)
- **Preview path**: `/`
- **Purpose**: Custom shift schedule manager with alarm reminders
- **Features**:
  - Dashboard: summary stats (weekly shifts, hours, alarms), today/tomorrow shifts, alarm toggles
  - Schedule: month view (default) + week view toggle, navigation, click day to add shift; "週期排班" button for recurring schedules
  - Shifts: two tabs — "所有班次" (list with edit/delete) and "班次模板" (template management)
  - Shift Templates: 3 defaults seeded automatically (早班 07:00-15:00, 午班 15:00-23:00, 夜班 23:00-07:00); fully customizable
  - Recurring Schedule Dialog: pick a template, choose day range (up to 300 days), select weekdays, preview count, bulk-create
  - ShiftDialog: "快速套用模板" quick-pick at top to pre-fill from saved templates
  - Alarms: create/edit/delete alarms with day-of-week selection, enable/disable toggle, minutes-before setting
  - Browser Notification API + Web Audio API alarm checker running every minute
- **Tech**: wouter routing, framer-motion animations, TanStack Query, teal/ocean color theme

### api-server (Express 5)
- **Preview path**: `/api`
- **Routes**: `/api/shifts`, `/api/alarms`, `/api/shift-templates`, `/api/healthz`
- **Bulk endpoint**: `POST /api/shifts/bulk` — creates shifts from template over a date range + weekdays (max 300 days)
- **Schema**: `shifts`, `alarms`, `shift_templates` tables in PostgreSQL via Drizzle ORM

## Notes

- `lib/api-spec/package.json` codegen script patches `lib/api-zod/src/index.ts` to only export from `./generated/api` (avoids naming conflict between Zod schemas and TypeScript types)
- `daysOfWeek` in alarms is stored as JSON string in PostgreSQL, parsed on read
