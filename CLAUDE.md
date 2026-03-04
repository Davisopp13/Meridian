# Meridian PiP Bar

A Document Picture-in-Picture capture surface for Hapag-Lloyd IDT and Customer Service agents. Floats above all windows (including Salesforce) using the browser's native PiP API. Logs Cases and Processes to Supabase in real time.

## Stack
- React (Vite) — no TypeScript
- Inline styles only — no Tailwind, no CSS modules (PiP window has a separate document context)
- Supabase JS client — initialized in `src/lib/supabase.js`
- Document Picture-in-Picture API (Chrome/Edge 116+)
- Existing bookmarklet + relay iframe for Salesforce integration

## Key Files
- `PRD.md` — full feature spec and task checklist (source of truth)
- `AGENTS.md` — patterns, gotchas, reusable code snippets
- `progress.txt` — Ralph's build log
- `src/lib/supabase.js` — single Supabase client, always import from here
- `src/lib/constants.js` — color tokens (C), window sizes (SIZES), formatElapsed()
- `public/relay.html` — bookmarklet relay iframe, DO NOT TOUCH

## Architecture
- `App.jsx` — host page, holds ALL state, handles ALL Supabase writes
- `PipBar.jsx` — rendered into the PiP window via a separate ReactDOM root
- Components fire callbacks only — no direct Supabase access in components
- Timers run in App.jsx context (host page), not inside the PiP window

## Supabase Project
- Tables: `case_sessions`, `case_events`, `process_sessions`, `process_categories`, `bar_sessions`
- Shared platform tables: `profiles`, `teams`
- All user tables have RLS: `user_id = auth.uid()`
- `process_categories` is read-only for authenticated users
- Timezone: always use `America/New_York` for daily stat boundaries

## Naming Conventions
- Components: PascalCase, `src/components/`
- Hooks: camelCase with `use` prefix, `src/hooks/`
- Supabase tables: snake_case, prefixed by domain (`case_`, `process_`, `bar_`)
- Constants: SCREAMING_SNAKE for objects, camelCase for functions

## Do Not
- Create a second Supabase client instance anywhere
- Import styles from external CSS files into PiP components (they won't apply)
- Run setInterval inside the PiP window — keep timers in App.jsx
- Modify `public/relay.html` or the bookmarklet script
- Auto-reload the app when state changes (active timers will reset)
- Use localStorage or sessionStorage (not supported in this environment)
- Hardcode process categories — always fetch from `process_categories` table
- Query Supabase without an authenticated session guard

## Bookmarklet Messages
Received via `window.addEventListener('message', ...)` in App.jsx:
- `{ type: 'CASE_START', caseNumber: '130971881' }` — SF case page
- `{ type: 'PROCESS_START' }` — any non-SF page

## Case Outcomes & Metrics

| Action | excluded | type | Counted in metrics |
|--------|----------|------|--------------------|
| Resolved | false | resolved | ✓ |
| Reclassified | false | reclassified | ✓ |
| Call | false | call | ✓ |
| RFC (after Resolve) | false | rfc | tracked separately |
| Not a Case | true | not_a_case | ✗ excluded |

- `not_a_case` events are logged but `excluded = true` — filter these out of all stat counts
- RFC prompt always follows Resolved or Reclassified — never standalone
- Awaiting sets `case_sessions.status = 'awaiting'`, pauses timer, does not close session

## PiP Window React Root Pattern
```js
// After openPip() succeeds in App.jsx:
const container = pipWindow.document.createElement('div');
pipWindow.document.body.appendChild(container);
pipWindow.document.body.style.cssText = 'margin:0;padding:0;overflow:hidden;background:#1a1a2e';
const pipRoot = ReactDOM.createRoot(container);
pipRoot.render(<PipBar {...props} />);
```

## Window Resize Pattern
```js
// Always null-check before resizing
if (pipWindow) {
  pipWindow.resizeTo(SIZES[mode].width, SIZES[mode].height);
}
```
