# AGENTS.md — Meridian PiP Bar

Patterns, gotchas, and reusable code for Ralph. Read this before implementing any task. Update this file when you discover something new.

---

## Supabase Client

Always import from `src/lib/supabase.js`. Never create a second instance.

```js
// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

Get the current user:
```js
const { data: { user } } = await supabase.auth.getUser();
```

---

## Color Tokens & Sizes

Always import from `src/lib/constants.js`. Never hardcode hex values in components.

```js
// src/lib/constants.js
export const C = {
  bg:            '#1a1a2e',
  mBtn:          '#003087',
  mMark:         '#E8540A',
  resolved:      '#16a34a',
  reclass:       '#dc2626',
  calls:         '#0284c7',
  process:       '#60a5fa',
  processNavy:   'rgba(0,48,135,0.45)',
  awaiting:      '#d97706',
  activeDot:     '#4ade80',
  divider:       'rgba(255,255,255,0.08)',
  border:        'rgba(255,255,255,0.12)',
  textPri:       'rgba(255,255,255,0.93)',
  textSec:       'rgba(255,255,255,0.45)',
  textDim:       'rgba(255,255,255,0.25)',
  caseFocus:     'rgba(0,48,135,0.55)',
  caseBorder:    '#003087',
  rowFocus:      'rgba(0,48,135,0.28)',
  amberRow:      'rgba(217,119,6,0.18)',
};

export const SIZES = {
  idle:          { width: 320,  height: 64  },
  caseActive:    { width: 580,  height: 64  },
  processActive: { width: 500,  height: 64  },
  bothActive:    { width: 640,  height: 64  },
  trayOpen:      { width: 640,  height: 360 },
  overlay:       { width: 640,  height: 220 },
  minimized:     { width: 200,  height: 36  },
};

export function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
```

---

## PiP Window Setup

The PiP window has a completely separate document context. External CSS does not apply. Use this exact pattern after `openPip()`:

```js
async function openPip() {
  const pw = await window.documentPictureInPicture.requestWindow({
    width: SIZES.idle.width,
    height: SIZES.idle.height,
  });

  // Style the pip document body
  pw.document.body.style.cssText =
    'margin:0;padding:0;overflow:hidden;background:#1a1a2e;font-family:"Segoe UI",sans-serif';

  // Create a mount point
  const container = pw.document.createElement('div');
  pw.document.body.appendChild(container);

  // Create a fresh React root — NOT a portal
  const root = ReactDOM.createRoot(container);
  root.render(<PipBar {...pipBarProps} />);

  // Detect external close
  pw.addEventListener('pagehide', () => {
    setPipWindow(null);
    setIsOpen(false);
  });

  setPipWindow(pw);
  setIsOpen(true);
  setPipRoot(root);
}
```

When props change, call `pipRoot.render(<PipBar {...newProps} />)` to update.

---

## Resizing the PiP Window

Always null-check. Call on `pipWindow`, not `window`.

```js
function resizePip(mode) {
  if (!pipWindow) {
    console.warn('resizePip called but pipWindow is null');
    return;
  }
  pipWindow.resizeTo(SIZES[mode].width, SIZES[mode].height);
}
```

Determine the correct size based on state:
```js
function getBarSize(cases, processes, trayOpen, overlayOpen) {
  if (overlayOpen) return 'overlay';
  if (trayOpen) return 'trayOpen';
  if (cases.length > 0 && processes.length > 0) return 'bothActive';
  if (cases.length > 0) return 'caseActive';
  if (processes.length > 0) return 'processActive';
  return 'idle';
}
```

---

## Timer Pattern

One `useTimer` instance per active session. Keep all intervals in App.jsx — PiP windows can be throttled by the browser.

```js
// src/hooks/useTimer.js
import { useState, useEffect, useRef } from 'react';

export function useTimer() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(ref.current);
    }
    return () => clearInterval(ref.current);
  }, [running]);

  return {
    elapsed,
    isRunning: running,
    start:  () => { setElapsed(0); setRunning(true); },
    pause:  () => setRunning(false),
    resume: () => setRunning(true),
    reset:  () => { setElapsed(0); setRunning(false); },
  };
}
```

For multiple cases, store timers in a ref map keyed by session id:
```js
const timerRefs = useRef({}); // { [sessionId]: intervalRef }
```

---

## Today's Stats Query

Always use `America/New_York` for the daily boundary. Never use UTC dates for daily stats.

```js
async function fetchTodayStats(userId) {
  const today = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }); // e.g. "03/04/2026"

  // Convert to ISO for Supabase query
  const [month, day, year] = today.split('/');
  const todayISO = `${year}-${month}-${day}`;
  const tomorrowISO = new Date(new Date(todayISO).getTime() + 86400000)
    .toISOString().split('T')[0];

  const { data } = await supabase
    .from('case_events')
    .select('type, excluded')
    .eq('user_id', userId)
    .gte('timestamp', `${todayISO}T00:00:00-05:00`)
    .lt('timestamp',  `${tomorrowISO}T00:00:00-05:00`);

  return {
    resolved:    data.filter(e => e.type === 'resolved'      && !e.excluded).length,
    reclass:     data.filter(e => e.type === 'reclassified'  && !e.excluded).length,
    calls:       data.filter(e => e.type === 'call'          && !e.excluded).length,
  };
}
```

For process count, query `process_sessions` separately with the same date boundary on `logged_at`.

---

## Bookmarklet Message Listener

Wire this up in App.jsx `useEffect` on mount.

```js
useEffect(() => {
  function handleMessage(event) {
    // Relay iframe posts from same origin — no origin check needed
    const { type, caseNumber } = event.data || {};

    if (type === 'CASE_START' && caseNumber) {
      handleCaseStart(caseNumber);
    } else if (type === 'PROCESS_START') {
      handleProcessStart();
    }
  }

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);
```

Auto-restore minimized PiP on any bookmarklet trigger:
```js
async function handleCaseStart(caseNumber) {
  if (isMinimized) setIsMinimized(false);
  if (!pipWindow) await openPip();
  // ... create session, add pill, resize
}
```

---

## Pill Cap Enforcement

Max 2 cases and 2 processes visible on the bar. 3rd+ goes to tray only.

```js
function addCase(caseNumber, sessionId) {
  setCases(prev => {
    const next = [...prev, { id: sessionId, caseNum: caseNumber, elapsed: 0, paused: false, awaiting: false }];
    if (next.length > 2) {
      setTrayOpen(true); // auto-open tray on overflow
    }
    return next;
  });
  setFocusedCaseId(sessionId); // always focus new pill
}
```

Bar renders only `cases.slice(0, 2)` and `processes.slice(0, 2)`. Tray renders the full arrays.

---

## Supabase Write Patterns

### Create case session
```js
const { data, error } = await supabase
  .from('case_sessions')
  .insert({ user_id: user.id, case_number: caseNumber })
  .select('id')
  .single();
// store data.id as sessionId
```

### Log case event
```js
await supabase.from('case_events').insert({
  session_id: sessionId,
  user_id: user.id,
  type: 'resolved',      // 'resolved' | 'reclassified' | 'call' | 'rfc' | 'not_a_case'
  excluded: false,       // true only for not_a_case
  rfc: false,
});
```

### Close case session
```js
await supabase.from('case_sessions')
  .update({ ended_at: new Date().toISOString(), duration_s: elapsed, status: 'closed' })
  .eq('id', sessionId);
```

### Set awaiting
```js
await supabase.from('case_sessions')
  .update({ status: 'awaiting', awaiting_since: new Date().toISOString() })
  .eq('id', sessionId);
```

### Log process session
```js
await supabase.from('process_sessions').insert({
  user_id: user.id,
  category: selectedCategory,
  duration_s: elapsed,
  entry_mode: 'timer',
});
```

### Fetch process categories
```js
const { data } = await supabase
  .from('process_categories')
  .select('*')
  .eq('active', true)
  .order('team').order('sort_order');
// Returns CH rows first, then MH — use team field to style accordingly
```

---

## Inline Styles — Key Patterns

All PiP bar components use inline styles. Never use className in PiP components.

```js
// Pill base
const pillStyle = {
  height: 26, borderRadius: 13, display: 'flex', alignItems: 'center',
  gap: 5, padding: '0 8px', transition: 'all 150ms',
};

// Stat button base
const statBtnStyle = {
  height: 26, minWidth: 80, padding: '0 10px', borderRadius: 13,
  border: 'none', fontSize: 10.5, fontWeight: 700,
  display: 'flex', alignItems: 'center', gap: 5,
  transition: 'all 120ms', whiteSpace: 'nowrap',
};

// Divider
const dividerStyle = {
  width: 1, height: 20, background: C.divider, flexShrink: 0,
};

// Bar container
const barStyle = {
  height: 36, background: C.bg, display: 'flex',
  alignItems: 'center', padding: '0 6px', gap: 4,
};
```

---

## Context-Aware Focus

Derived from state in App.jsx. Never stored in Supabase.

```js
function getContextFocus(cases, processes, lastTrigger) {
  if (cases.length > 0 && processes.length === 0) return 'cases';
  if (processes.length > 0 && cases.length === 0) return 'processes';
  if (cases.length > 0 && processes.length > 0) return lastTrigger; // 'cases' | 'processes'
  return 'neutral';
}

function getLaneSplit(focus) {
  if (focus === 'cases')     return { cases: '60%', processes: '40%' };
  if (focus === 'processes') return { cases: '40%', processes: '60%' };
  return { cases: '50%', processes: '50%' };
}
```

---

## Not a Case Flow

Log the event, remove from active cases, do NOT show RFC prompt.

```js
async function handleNotACase(sessionId, elapsed) {
  await supabase.from('case_events').insert({
    session_id: sessionId,
    user_id: user.id,
    type: 'not_a_case',
    excluded: true,  // critical — omit from all metrics
  });
  await supabase.from('case_sessions')
    .update({ ended_at: new Date().toISOString(), duration_s: elapsed, status: 'closed' })
    .eq('id', sessionId);
  setCases(prev => prev.filter(c => c.id !== sessionId));
}
```

---

## Awaiting Info Flow

Pauses timer, marks session. Does NOT close the session.

```js
async function handleAwaiting(sessionId) {
  await supabase.from('case_sessions')
    .update({ status: 'awaiting', awaiting_since: new Date().toISOString() })
    .eq('id', sessionId);
  setCases(prev => prev.map(c =>
    c.id === sessionId ? { ...c, awaiting: true, paused: true } : c
  ));
  // Timer pauses because the case's paused flag is now true
}

async function handleResume(sessionId) {
  await supabase.from('case_sessions')
    .update({ status: 'active', awaiting_since: null })
    .eq('id', sessionId);
  setCases(prev => prev.map(c =>
    c.id === sessionId ? { ...c, awaiting: false, paused: false } : c
  ));
}
```

---

## Bar Session Tracking

Open and close a `bar_sessions` row to track PiP usage windows.

```js
// On openPip()
const { data } = await supabase
  .from('bar_sessions')
  .insert({ user_id: user.id })
  .select('id').single();
setBarSessionId(data.id);

// On PiP close or page unload
await supabase.from('bar_sessions')
  .update({
    ended_at: new Date().toISOString(),
    total_cases: cases.length,
    total_processes: processes.length,
  })
  .eq('id', barSessionId);
```

---

## Error Toast Pattern

Show errors inside the PiP window — not in the host page.

```js
function showPipToast(message, isError = true) {
  if (!pipWindow) return;
  const toast = pipWindow.document.createElement('div');
  toast.style.cssText = `
    position:fixed; bottom:8px; left:50%; transform:translateX(-50%);
    background:${isError ? '#dc2626' : '#16a34a'}; color:white;
    padding:6px 14px; border-radius:20px; font-size:11px; font-weight:700;
    z-index:9999; white-space:nowrap; pointer-events:none;
    font-family:"Segoe UI",sans-serif;
  `;
  toast.textContent = message;
  pipWindow.document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}
```

---

## Known Gotchas

- **PiP throttling:** Browser may throttle the PiP window's JS when not focused. Keep all `setInterval` timers in App.jsx (host page), not in PiP components.
- **ReactDOM.createRoot vs portals:** You cannot use React portals into a foreign document. Always use `createRoot` on a container inside the PiP document.
- **resizeTo on wrong object:** `window.resizeTo()` resizes the host tab. `pipWindow.resizeTo()` resizes the PiP window. Easy to mix up.
- **RLS + unauthenticated:** All Supabase queries will return empty (not error) if the user is not authenticated due to RLS. Check `supabase.auth.getUser()` returns a user before querying.
- **process_categories write blocked:** RLS only allows SELECT on this table. Never attempt INSERT/UPDATE from the client.
- **Supabase default limit:** Supabase returns max 1000 rows by default. For stats queries that could exceed this, use `.select('id', { count: 'exact', head: true })` for counts rather than fetching all rows.
- **Relay iframe origin:** The bookmarklet relay posts messages from the same origin as the host page. No cross-origin issues, but do not add an origin check that would block same-origin messages.
- **PiP window null after minimize:** The PiP window is NOT null when minimized via the bar's `—` button (that's a UI-only minimize). It IS null after the user clicks the browser's × on the PiP window title bar. Handle both states separately.

---

## User Settings

Settings are stored as a JSONB column (`settings`) on `platform_users`. Defaults are defined in `src/lib/constants.js` and merged at runtime — no defaults are stored in the DB.

### DEFAULT_SETTINGS (src/lib/constants.js)

```js
export const DEFAULT_SETTINGS = {
  stat_buttons: ['resolved', 'reclass', 'calls', 'processes', 'total'],
  total_includes: ['resolved', 'reclass', 'calls'],
  pip_position: 'bottom-right',   // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  team: null,                      // 'CH' | 'MH' — null means use profile.team
  theme: 'dark',                   // 'dark' only for now
  notifications: {
    toast_on_log: true,
    sound: false,
  },
}
```

### getUserSettings helper (src/lib/constants.js)

Always use this to merge stored settings with defaults. Handles null profile and missing keys.

```js
export function getUserSettings(profile) {
  const stored = profile?.settings || {}
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      ...(stored.notifications || {}),
    },
  }
}
```

Usage in App.jsx:
```js
import { getUserSettings } from './lib/constants';
// Derived from profile state — no new useState needed
const userSettings = getUserSettings(profile);
```

### platform_users.settings column

```sql
ALTER TABLE platform_users
ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT NULL;
```

Migration file: `supabase/migrations/002_user_settings.sql`

### STAT_BUTTON_CONFIG map (src/PipBar.jsx)

Defines the label, color, and stat key for each configurable button. `key: null` means computed (total).

```js
const STAT_BUTTON_CONFIG = {
  resolved:  { icon: '✓',  label: 'Resolved',  color: C.resolved,    key: 'resolved' },
  reclass:   { icon: '↩',  label: 'Reclass',   color: C.reclass,     key: 'reclass' },
  calls:     { icon: '☎',  label: 'Calls',      color: C.calls,       key: 'calls' },
  processes: { icon: '📋', label: 'Processes',  color: C.processNavy, key: 'processes' },
  total:     { icon: '',   label: 'Total',      color: C.process,     key: null },  // computed
}
```

Rendering only enabled buttons in order:
```js
{userSettings.stat_buttons.map(btnKey => {
  const cfg = STAT_BUTTON_CONFIG[btnKey];
  if (!cfg) return null;
  const value = cfg.key
    ? (stats[cfg.key] ?? 0)
    : userSettings.total_includes.reduce((sum, k) => sum + (stats[k] ?? 0), 0);
  return <StatButton key={btnKey} icon={cfg.icon} label={cfg.label} value={value} color={cfg.color} />;
})}
```

### pip_position values

| Value | moveTo x | moveTo y |
|-------|----------|----------|
| `bottom-right` | `screen.availWidth - width` | `screen.availHeight - height` |
| `bottom-left`  | `0` | `screen.availHeight - height` |
| `top-right`    | `screen.availWidth - width` | `0` |
| `top-left`     | `0` | `0` |

Pass `userSettings.pip_position` as the second argument to `resizeAndPin(mode, position)`.

---

## File Structure

```
src/
  App.jsx                       ← host page, all state, all Supabase writes
  PipBar.jsx                    ← rendered into PiP window via createRoot
  components/
    MButton.jsx
    PillZone.jsx
    CasePill.jsx
    ProcessPill.jsx
    StatButton.jsx
    MinimizeButton.jsx
    SwimlaneTray.jsx
    CasesLane.jsx
    CaseLaneRow.jsx
    ProcessesLane.jsx
    ProcessLaneRow.jsx
    overlays/
      RFCPrompt.jsx
      ProcessPicker.jsx
  hooks/
    usePipWindow.js
    useTimer.js
    useStats.js
    useContextFocus.js
  lib/
    supabase.js
    constants.js
public/
  relay.html                    ← DO NOT TOUCH
  meridian-mark-192.png
  meridian-mark-512.png
```
