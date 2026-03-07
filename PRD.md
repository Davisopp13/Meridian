# Meridian Activity Log — PRD

## Project Overview
Add the `ActivityLog` component to the Meridian PWA dashboard. This is a new panel that sits above the existing CT stats cards section. It shows the agent's logged cases and manual processes in a unified, filterable feed. The component design is fully finalized — this task is purely integration work: wire it to Supabase, drop it into the dashboard layout, and make the data real.

## Architecture & Key Decisions
- Framework: React (Vite or CRA — match whatever Meridian uses)
- Database: Supabase (`ct_sessions` and `mpl_sessions` tables, shared schema)
- Styling: Inline styles only — no Tailwind, no CSS modules (match existing Meridian pattern)
- State: Local component state only (`useState`, `useMemo`) — no new context or global store
- The finalized UI component is at `/src/components/ActivityLog.jsx` (Ralph creates this file)
- Do NOT modify the existing CT stats cards or daily summary table below it

## Color Tokens
These are locked — do not deviate:
```js
bg: "#0f1117"
bgCard: "#1a1d27"
bgHover: "#1e2130"
border: "rgba(255,255,255,0.07)"
orange: "#E8540A"
green: "#22c55e"  greenBg: "rgba(34,197,94,0.12)"   greenBorder: "rgba(34,197,94,0.28)"
red: "#ef4444"    redBg: "rgba(239,68,68,0.12)"     redBorder: "rgba(239,68,68,0.28)"
blue: "#38bdf8"   blueBg: "rgba(56,189,248,0.12)"   blueBorder: "rgba(56,189,248,0.28)"
purple: "#a78bfa" purpleBg: "rgba(167,139,250,0.12)" purpleBorder: "rgba(167,139,250,0.28)"
textPrimary: "#f1f5f9"
textSecondary: "#94a3b8"
textMuted: "#4b5563"
```

## Data Model
### ct_sessions (Case Tracker entries)
Relevant columns:
- `id` — uuid
- `user_id` — uuid (filter by current user)
- `case_number` — text
- `action_type` — text: "Resolved" | "Reclassified" | "Call" | "Awaiting" | "Not a Case"
- `category` — text (e.g. "Inland / Inland Precarriage")
- `time_spent` — integer (seconds)
- `is_rfc` — boolean
- `created_at` — timestamptz

### mpl_sessions (Manual Process Log entries)
Relevant columns:
- `id` — uuid
- `user_id` — uuid
- `category` — text (e.g. "Work Order Creation")
- `duration` — integer (seconds)
- `created_at` — timestamptz

### Unified shape for the component
Both sources should be normalized into this shape before passing to `ActivityLog`:
```ts
{
  id: string
  type: "Resolved" | "Reclassified" | "Call" | "Awaiting" | "Not a Case" | "Process"
  src: "case" | "process"
  case_number: string | null   // null for process entries
  category: string
  dur: number                  // seconds — format in component as "6s", "2m 14s"
  rfc: boolean
  ts: Date
}
```

## Filter Behavior
- **Filters:** Resolved · Reclassified · Calls · Processes (multi-select Set)
- **All** button clears the selection (shows everything)
- **Range:** Today | 2 Days | This Week | Month — controls the date cutoff for the Supabase query
- Filtered-out entries dim to 15% opacity (do NOT hide/remove from DOM — keep layout stable)
- Count badges on each tab reflect total count for the active range, regardless of other active filters

## Row Structure (single flat line per entry)
```
[3px accent bar] [● Type  RFC?] · [case # or "Manual"] · [Category…] [dur] [HH:MM:SS] [✎ on hover]
```
- Type label column: 110px fixed width
- Case # column: 96px fixed width
- Category: flex-grows, truncates with ellipsis
- Duration: plain text, no pill/chip
- Time: monospace, 68px fixed width, right-aligned
- Edit icon: appears on hover only (supervisor time correction — wire to no-op for now)

---

## Tasks

### Phase 1: Component file

- [x] **Task 1: Create ActivityLog.jsx with mock data**
  - Create `src/components/ActivityLog.jsx`
  - Copy the finalized component code exactly as designed (see reference below)
  - Replace the hardcoded `ENTRIES` array with the mock data provided in this PRD
  - Verify the component renders correctly in isolation with `npm run dev`
  - Acceptance: component mounts without errors, all 4 filter tabs work, range selector works, multi-select works, "Clear all" resets filters
  - Test: `npm run typecheck` (or `npm run build` if no typecheck script)

### Phase 2: Supabase data hook

- [ ] **Task 2: Create useActivityData hook**
  - Create `src/hooks/useActivityData.js`
  - Hook signature: `useActivityData({ userId, rangeDays })` → `{ entries, loading, error }`
  - Queries both `ct_sessions` and `mpl_sessions` filtered by `user_id` and `created_at >= cutoff`
  - Cutoff: `new Date()` minus `rangeDays` days, time set to 00:00:00
  - Normalizes both result sets into the unified shape defined above
  - Merges and sorts by `ts` descending (newest first)
  - Format duration: `dur < 60 ? "${dur}s" : "${Math.floor(dur/60)}m ${dur%60}s"` (omit seconds if 0)
  - Use the existing Supabase client from wherever it's initialized in the codebase (do not create a new one)
  - Test: `npm run typecheck` passes; verify in browser that data loads for today

- [ ] **Task 3: Connect hook to ActivityLog component**
  - Replace mock `ENTRIES` in `ActivityLog.jsx` with data from `useActivityData`
  - Accept `userId` as a prop (passed from parent)
  - Show a subtle loading state while fetching: dim the feed to 50% opacity, no spinner needed
  - On error: show a single centered text line "Could not load activity" in `textMuted` color
  - Count badges on filter tabs must update to reflect live data counts
  - Test: `npm run typecheck` + verify in browser that real entries appear

### Phase 3: Dashboard integration

- [ ] **Task 4: Add ActivityLog to the dashboard page**
  - Find the existing dashboard page component (likely `src/pages/DashboardPage.jsx` or `src/App.jsx`)
  - Import `ActivityLog` and place it directly above the CT stats cards section
  - Pass `userId` from the authenticated user context (use whatever auth pattern exists in the codebase)
  - Margin between ActivityLog and the stats cards below: `20px`
  - Do not alter anything below the ActivityLog insertion point
  - Test: `npm run build` succeeds with no errors; dashboard renders with ActivityLog above stats cards

### Phase 4: Real-time updates

- [ ] **Task 5: Subscribe to live inserts**
  - In `useActivityData`, add a Supabase realtime subscription on both `ct_sessions` and `mpl_sessions`
  - Filter subscription to `user_id=eq.{userId}`
  - On INSERT event: prepend new entry to the top of the entries list (no full refetch)
  - Unsubscribe on hook cleanup (`useEffect` return)
  - Test: log a case via the PiP bar and verify it appears in the feed without a page refresh

---

## Testing Strategy
- Primary: `npm run typecheck` after every task
- Secondary: `npm run build` before marking Phase 3 complete
- Manual: open dashboard in browser, verify ActivityLog renders above CT section, filters work, real data loads

## Out of Scope
- Do NOT add pagination (the maxHeight + scroll handles this for now)
- Do NOT add search input (future task)
- Do NOT modify ct_sessions or mpl_sessions schema
- Do NOT touch the CT stats cards, period selector, or daily summary table below
- Do NOT add day-group collapsing (future task)
- Do NOT build the edit/time correction modal — wire the edit icon to `console.log` for now

## Notes for Ralph
- The Supabase client is already initialized somewhere in the codebase — find it and import from there, do not instantiate a new one
- `ct_sessions.action_type` maps to the unified `type` field; `mpl_sessions` entries always get `type: "Process"` and `src: "process"`
- The `is_rfc` field only exists on `ct_sessions` — set `rfc: false` for all process entries
- The component uses inline styles throughout — do not introduce className or Tailwind
- `FilterTab` must be defined outside `ActivityLog` to avoid hooks-in-loop (already done in reference code)
- The range selector controls the Supabase query date cutoff — it does NOT filter client-side after load; changing range should trigger a new query
- `Today` = 0 days back (from 00:00:00 today), `2 Days` = 1 day back, `This Week` = 6 days back, `Month` = 29 days back