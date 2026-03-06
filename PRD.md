# MPL UX Fixes PRD

## Project Overview

Apply four UX fixes to the MPL (Manual Process Log) PWA widget. These changes address core interaction issues in the logging tray: timer trigger logic, manual entry flow, category navigation, and a contrast bug. The widget lives inside the HL Suite PiP toolbar. All changes are UI/UX only — no schema changes required.

## Architecture & Key Decisions

- Framework: React (existing MPL codebase)
- Database: Supabase — no schema changes in this PRD
- Styling: Tailwind CSS
- Widget surface: Document Picture-in-Picture (PiP) window — fixed height, no resizing
- Entry source tracking: `source` field on mpl_entries — values: `'bookmarklet'` | `'manual'`
- The `+` button and bookmarklet trigger are the two and only entry points into the logging flow
- Do NOT change the bookmarklet, relay iframe, or Supabase realtime subscription logic
- Do NOT modify Case Tracker (CT) components or the orange pill flow

## Environment & Setup

- NEXT_PUBLIC_SUPABASE_URL: set in .env.local
- NEXT_PUBLIC_SUPABASE_ANON_KEY: set in .env.local
- Existing codebase — read the file structure before making changes

---

## Tasks

### Phase 1: Fix Timer Trigger Logic

- [x] **Task 1: Bookmarklet-only live timer**
  - What: The blue MPL pill + live timer must ONLY start when a `MERIDIAN_PROCESS_START` message is received from the bookmarklet relay. The `+` button must NOT start a timer or create a pill.
  - Files to modify: The component that handles the `+` button click and the component that listens for `MERIDIAN_PROCESS_START` messages (likely `App.jsx` or `MplWidget.jsx` or similar — read the codebase first).
  - Behaviour change:
    - `MERIDIAN_PROCESS_START` received → blue pill appears, timer starts (no change from current)
    - `+` button clicked → open the manual entry form directly (see Task 2), no pill, no timer
  - Acceptance criteria: Clicking `+` shows the manual entry form immediately. No pill appears. Bookmarklet trigger still creates a pill with a running timer.
  - Test: `npm run typecheck` passes + manual smoke test both paths

### Phase 2: Manual Entry Form

- [x] **Task 2: Build manual entry form**
  - What: When `+` is tapped, show a fixed-height form tray (same container as the existing LOG PROCESS tray) with:
    1. **Duration picker** at the top — pill-style buttons: `5 min`, `10 min`, `15 min`, `20 min`, `30 min`, `45 min`, `60 min`, plus a `Custom` option that reveals a number input (minutes). One must be selected before logging is allowed.
    2. **Category list** below the duration picker — same list of categories as the bookmarklet-triggered flow (see Task 3 for the drill-down).
  - The duration picker stays visible when the user drills into subcategories (Task 3).
  - On final log: save entry with `source: 'manual'`, `duration_minutes: [selected]`, `logged_at: now()`, and the selected category/subcategory.
  - Files to create/modify: New component `ManualEntryForm.jsx` (or similar). Wire it into the `+` button handler.
  - Acceptance criteria: Duration + category + subcategory (if applicable) can be selected and logged. Entry appears in today's log with correct duration and `source: 'manual'`.
  - Test: `npm run typecheck` passes

### Phase 3: Drill-Down Category Navigation

- [x] **Task 3: Replace expand-in-place with drill-down navigation**
  - What: The LOG PROCESS tray currently expands downward when a category is selected, showing subcategories below it. Replace this with a full screen swap (slide-in replacement) so the widget height never changes.
  - New flow:
    1. **Category screen** — shows the list of categories for the user's team (CH or MH). Full-width tap targets.
    2. User taps a category:
       - **Category HAS subcategories** → subcategory screen slides in, replacing the category screen entirely. A `← Back` button at the top returns to the category screen.
       - **Category has NO subcategories** → log immediately, close tray.
    3. User taps a subcategory → log entry, close tray.
  - This drill-down applies to BOTH bookmarklet-triggered flow (pill tap → category screen) AND manual entry form (after duration is selected, same drill-down for category/subcategory).
  - The widget/tray height must remain fixed at every step — no vertical expansion.
  - Files to modify: The existing category/subcategory selection component. Extract into a `CategoryDrillDown.jsx` component that can be used by both flows.
  - Acceptance criteria:
    - Tapping a category with subcategories replaces the category list with subcategory list (no expansion)
    - Back arrow returns to category list
    - Tapping a category with no subcategories logs immediately
    - Widget height does not change at any point during the flow
  - Test: `npm run typecheck` passes

### Phase 4: Category Button Contrast Fix

- [x] **Task 4: Fix white-on-white category button contrast**
  - What: Category buttons in the LOG PROCESS tray currently render white text on a white/near-white background, making them unreadable. Fix the contrast so buttons are clearly legible.
  - Target style: buttons should use a dark surface background (e.g. `bg-[#2a2d3e]` or `bg-slate-700`) with white text, OR a light gray background (e.g. `bg-slate-100`) with dark text (`text-slate-800`). Match whichever fits the existing tray design language.
  - The tray background is dark (`#1a1a2e` or similar navy). Buttons should contrast clearly against this.
  - Files to modify: The category button component / class definitions in the LOG PROCESS tray.
  - Acceptance criteria: All category buttons are clearly readable. No white-on-white or near-white-on-white combinations.
  - Test: Visual check via `npm run dev` — category list must be legible

---

## Testing Strategy

- Primary: `npm run typecheck`
- Secondary: `npm run build`
- Visual: `npm run dev` — manually test both `+` button flow and bookmarklet flow end-to-end

## Out of Scope

- No bookmarklet changes
- No relay iframe changes
- No Supabase schema changes
- No Case Tracker (CT / orange pill) changes
- No supervisor dashboard work
- No changes to auth, team switching, or settings
- No new Supabase tables or columns (the `source` field should already exist on mpl_entries — if it doesn't, add it as a nullable text column in a migration, but do not change anything else)

## Notes for Ralph

- The widget runs inside a Document Picture-in-Picture window — fixed dimensions, no scrolling. Every UI decision must respect this constraint. If content doesn't fit, reduce it — don't expand the container.
- The two entry paths (bookmarklet vs `+` button) must remain clearly separated in the code. Don't merge them into a single ambiguous flow.
- `CategoryDrillDown` should be a self-contained component that accepts `categories`, `onLog`, and optionally `headerSlot` (for the duration picker in manual mode) as props. Both flows can then use it without duplication.
- The taxonomy (CH and MH categories/subcategories) is already seeded in Supabase. Fetch from the DB — do not hardcode.
- Read the existing codebase structure before touching any files. The component names above are illustrative — match whatever naming convention is already in place.
