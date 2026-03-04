# Meridian Phase 2 PRD — Bugs + Onboarding + Dashboard

## Project Overview

Existing Meridian PiP Bar React (Vite) app deployed on Vercel. Supabase backend with tables: `case_sessions`, `case_events`, `process_sessions`, `process_categories`, `bar_sessions`, `profiles`, `teams`. This run fixes 3 post-launch bugs and adds two major features: a 3-step onboarding flow and a stats dashboard (the host page). All new UI uses the same dark Meridian design language as the PiP bar. Recharts for the trend chart.

**Success:** Bugs fixed, new users can onboard and install the bookmarklet, dashboard shows correct stats with period tabs, stat cards, daily table, and trend chart matching the CT 1.0 reference layout.

---

## Architecture & Key Decisions

- React (Vite) — no TypeScript, no Tailwind
- All styles are inline CSS objects — no external stylesheets, no className for new components
- Supabase client lives in `src/lib/supabase.js` — import only from there, never create a second instance
- Color tokens in `src/lib/constants.js` as `C` — never hardcode hex values
- `America/New_York` timezone for all daily/weekly/monthly stat boundaries
- `process_categories` is read-only for authenticated users — never attempt INSERT/UPDATE on it
- Recharts is the only charting library — do not install others
- `public/relay.html` — do not touch
- Dashboard = host page (`App.jsx` or a dedicated `Dashboard.jsx` rendered by App) — not a separate route, single-page app

---

## Color Tokens (from `src/lib/constants.js`)

```js
const C = {
  bg:           '#1a1a2e',
  bgDeep:       '#0f0f1e',
  mBtn:         '#003087',
  mMark:        '#E8540A',
  resolved:     '#16a34a',
  reclass:      '#dc2626',
  calls:        '#0284c7',
  process:      '#60a5fa',
  notACase:     '#6b7280',
  awaiting:     '#d97706',
  textPri:      'rgba(255,255,255,0.93)',
  textSec:      'rgba(255,255,255,0.45)',
  textDim:      'rgba(255,255,255,0.25)',
  divider:      'rgba(255,255,255,0.08)',
  border:       'rgba(255,255,255,0.12)',
  cardBg:       'rgba(255,255,255,0.04)',
  cardBgHover:  'rgba(255,255,255,0.07)',
};
```

---

## Environment

```
VITE_SUPABASE_URL=        (already set)
VITE_SUPABASE_ANON_KEY=   (already set)
VITE_APP_URL=             (already set — production Vercel URL)
```

---

## File Structure (additions only)

```
src/
  App.jsx                          ← add auth gate + onboarding check + dashboard
  components/
    Dashboard.jsx                  ← new — main dashboard page
    DashboardStatCard.jsx          ← new — single stat card
    DashboardTable.jsx             ← new — daily breakdown table
    DashboardChart.jsx             ← new — recharts trend chart
    Onboarding.jsx                 ← new — 3-step onboarding shell
    onboarding/
      Step1Profile.jsx             ← new — name input
      Step2Team.jsx                ← new — CH / MH picker
      Step3Bookmarklet.jsx         ← new — bookmarklet install instructions
  hooks/
    useDashboardStats.js           ← new — period-aware data fetching
public/
  meridian-mark-192.png            ← already in folder, do not move
  meridian-mark-512.png            ← already in folder, do not move
```

---

## Tasks

### Phase 1: Bug Fixes

- [x] **Task 1: Fix MPL categories not populating**
  - The Process picker overlay and ProcessLaneRow inline picker fetch from `process_categories` but return empty
  - Diagnose: find the fetch call and confirm it matches exactly:
    ```js
    const { data, error } = await supabase
      .from('process_categories')
      .select('id, name, team, sort_order')
      .eq('active', true)
      .order('team')
      .order('sort_order');
    ```
  - If the query looks correct but data is still empty, the RLS policy may be missing. Add a comment to `progress.txt`: "process_categories RLS policy may need manual SQL — see AGENTS.md". Do NOT attempt to run SQL.
  - If data returns but components don't render, trace the prop chain: fetch result → state → ProcessPicker props → ProcessLaneRow props → render. Fix any broken link.
  - Test: `npm run build` passes; no console errors related to process_categories

- [x] **Task 2: Fix logo not loading**
  - Find where the host page renders a placeholder M° or missing logo
  - Replace with `<img src="/meridian-mark-192.png" alt="Meridian" style={{ width: 40, height: 40, borderRadius: 8 }} />`
  - Check `index.html` — ensure ALL of these exist in `<head>`:
    ```html
    <!-- PWA manifest -->
    <link rel="manifest" href="/manifest.json" />

    <!-- Icons -->
    <link rel="icon" href="/meridian-mark-192.png" />
    <link rel="apple-touch-icon" href="/meridian-mark-192.png" />

    <!-- Theme -->
    <meta name="theme-color" content="#003087" />

    <!-- Standalone display — Safari requires these in addition to manifest -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Meridian" />

    <!-- Viewport -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    ```
  - The app is a single-page app (no router) — onboarding, dashboard, and PiP host are all state-driven views within the same `index.html`. This means `scope: "/"` in the manifest covers all three automatically. No routing config needed.
  - If `vite-plugin-pwa` is already in `package.json`, ensure its `vite.config.js` entry includes `manifest: false` (we supply our own) and `registerType: 'autoUpdate'`. If it is NOT installed, do not install it — the static manifest is sufficient for PWA installability on Chrome/Edge.
  - Create `public/manifest.json` if it doesn't exist:
    ```json
    {
      "name": "Meridian",
      "short_name": "Meridian",
      "description": "Meridian PiP Bar — Case and Process capture",
      "start_url": "/",
      "scope": "/",
      "display": "standalone",
      "orientation": "any",
      "background_color": "#1a1a2e",
      "theme_color": "#003087",
      "icons": [
        { "src": "/meridian-mark-192.png", "sizes": "192x192", "type": "image/png" },
        { "src": "/meridian-mark-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
      ]
    }
    ```
  - `"scope": "/"` is critical — it ensures onboarding, dashboard, and PiP host all stay inside the installed PWA window. Without it, state-driven renders can break out into a browser tab on some browsers.
  - Test: `npm run build` passes; `dist/manifest.json` exists; icon appears in browser tab on `npm run dev`

---

### Phase 2: Onboarding Flow

Onboarding runs once per user. After auth, check `profiles.onboarded`. If `false` or `null`, render `<Onboarding />` instead of the dashboard. On completion, set `onboarded = true` in Supabase and re-render to dashboard.

- [x] **Task 3: Auth gate in App.jsx**
  - Add auth state to App.jsx:
    ```js
    const [user, setUser]       = useState(null);
    const [profile, setProfile] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
      supabase.auth.getUser().then(({ data }) => {
        setUser(data.user ?? null);
        if (data.user) {
          supabase.from('profiles').select('*')
            .eq('id', data.user.id).single()
            .then(({ data: p }) => { setProfile(p); setAuthLoading(false); });
        } else {
          setAuthLoading(false);
        }
      });
    }, []);
    ```
  - Render logic:
    - `authLoading === true` → full-screen dark spinner (centered, `#E8540A` color)
    - `!user` → existing sign-in UI (do not change existing auth flow)
    - `user && (!profile?.onboarded)` → `<Onboarding user={user} onComplete={p => setProfile(p)} />`
    - `user && profile?.onboarded` → existing dashboard/PiP host page content
  - `handleOnboardingComplete(updatedProfile)` sets profile state → triggers re-render to dashboard
  - Test: `npm run build` passes

- [x] **Task 4: Step1Profile — name setup**
  - File: `src/components/onboarding/Step1Profile.jsx`
  - Props: `{ user, onNext }`
  - Full-screen dark layout (`background: '#0f0f1e'`), flex center both axes
  - Centered card: max-width 480px, `background: '#1a1a2e'`, border `1px solid rgba(255,255,255,0.12)`, border-radius 16px, padding 40px
  - Top: `<img src="/meridian-mark-192.png" />` 64px centered, margin-bottom 24px
  - Heading: "Welcome to Meridian" — white, 24px, 800 weight, center
  - Subheading: "Let's get you set up" — textSec, 14px, center, margin-bottom 32px
  - Label: "Your name" — textSec, 12px, uppercase, letter-spacing
  - Input: full width, 48px height, `background: rgba(255,255,255,0.06)`, border `1px solid rgba(255,255,255,0.12)`, border-radius 10px, white text 15px, padding 0 16px. Focus: border `#003087`
  - Pre-fill value with `user.email.split('@')[0]`
  - "Continue →" button: full width, 48px height, `background: #003087`, white text 15px 700 weight, border-radius 10px, border none, cursor pointer. Disabled (opacity 0.4) when input is empty.
  - On click: `onNext({ full_name: inputValue.trim() })`
  - Do NOT write to Supabase in this step
  - Test: `npm run build` passes

- [x] **Task 5: Step2Team — CH / MH selection**
  - File: `src/components/onboarding/Step2Team.jsx`
  - Props: `{ onNext, onBack }`
  - Same card layout as Step1
  - Heading: "Your Team" — same style
  - Subheading: "This determines which process categories you see"
  - Two team cards in a flex row, gap 16px, each flex:1:
    - **CH card**: label "CH", sublabel "Container Haulage", accent `#d97706` (amber)
    - **MH card**: label "MH", sublabel "Merchant Haulage", accent `#60a5fa` (blue)
    - Each card: height 110px, border-radius 12px, border 2px, cursor pointer, flex column center
    - Unselected: `background: rgba(255,255,255,0.04)`, border `rgba(255,255,255,0.12)`
    - Selected: `background: rgba({accent},0.12)`, border = accent color, label text = accent color
    - Large team letter ("CH"/"MH"): 32px, 800 weight
    - Sublabel: 12px, textSec
  - "Continue →" button: same style as Step1, disabled until a team is selected
  - Back link: `← Back` — textSec, 13px, cursor pointer, text-only, margin-top 16px, centered
  - On continue: `onNext({ team: selectedTeam })`
  - Do NOT write to Supabase
  - Test: `npm run build` passes

- [x] **Task 6: Step3Bookmarklet — bookmarklet install**
  - File: `src/components/onboarding/Step3Bookmarklet.jsx`
  - Props: `{ onComplete, onBack }`
  - Same card layout, max-width 520px
  - Heading: "Install the Bookmarklet"
  - Subheading: "One click to start tracking from anywhere"
  - Numbered instruction list (3 items), each row: number circle (`#003087` bg, white, 20px) + instruction text (textPri, 14px):
    1. "Show your bookmarks bar — press Ctrl+Shift+B (Windows) or Cmd+Shift+B (Mac)"
    2. "Drag the orange button below up to your bookmarks bar"
    3. "Click it on a Salesforce page to log a case, or any other page to log a process"
  - Draggable bookmarklet anchor — centered, margin 24px auto:
    ```jsx
    const host = import.meta.env.VITE_APP_URL || window.location.origin;
    const bmHref = `javascript:(function(){let cN='',aN='',typeVal='',subtypeVal='';try{let m=document.title.match(/\\d{8,}/);if(m&&m[0])cN=m[0].trim()}catch(e){}try{function w(n,d){if(d>50)return;if(!typeVal&&n.classList?.contains('slds-p-around_small')){let t=n.textContent?.trim()||'';if(t.startsWith('Type / Sub-Type')){let v=t.replace('Type / Sub-Type','').trim(),p=v.split(' / ');typeVal=p[0]||'';subtypeVal=p[1]||''}}if(!aN&&n.tagName==='A'){let h=n.getAttribute('href');if(h&&h.startsWith('/lightning/r/Account/001')){let i=h.match(/001[a-zA-Z0-9]{12,15}/);if(i&&i[0])aN=i[0]}}if(n.shadowRoot)for(let c of n.shadowRoot.children)w(c,d+1);for(let c of n.children)w(c,d+1)}w(document.body,0)}catch(e){}const isSF=!!cN,HOST='${host}',RELAY_ID='meridian-relay-iframe';const pl=isSF?{type:'MERIDIAN_CASE_START',caseNumber:cN,accountId:aN||null,caseType:typeVal||null,caseSubtype:subtypeVal||null,timestamp:Date.now()}:{type:'MERIDIAN_PROCESS_START',pageUrl:window.location.href,timestamp:Date.now()};let rf=document.getElementById(RELAY_ID);if(rf){rf.contentWindow.postMessage(pl,HOST)}else{rf=document.createElement('iframe');rf.id=RELAY_ID;rf.src=HOST+'/relay.html?t='+Date.now();rf.style.cssText='display:none;position:fixed;width:0;height:0;border:none;z-index:-1';document.body.appendChild(rf);function om(e){if(e.origin!==HOST)return;if(e.data&&e.data.type==='MERIDIAN_RELAY_READY'){window.removeEventListener('message',om);rf.contentWindow.postMessage(pl,HOST)}}window.addEventListener('message',om);setTimeout(function(){window.removeEventListener('message',om);try{rf.contentWindow.postMessage(pl,HOST)}catch(e){}},800)}try{const ex=document.getElementById('meridian-toast');if(ex)ex.remove();const t=document.createElement('div');t.id='meridian-toast';t.textContent=isSF?'✓ Meridian — Case '+cN:'✓ Meridian — Process timer started';t.style.cssText='position:fixed;bottom:24px;right:24px;background:#003087;color:#fff;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:700;font-family:"Segoe UI",sans-serif;z-index:2147483647;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.3);border-left:3px solid #E8540A;transition:opacity 300ms';document.body.appendChild(t);setTimeout(function(){t.style.opacity='0'},2200);setTimeout(function(){t.remove()},2500)}catch(e){}})();`;
    ```
    Style: `display:inline-block`, `background:#E8540A`, white text, `font-weight:700`, `font-size:14px`, padding `10px 24px`, border-radius 20px, cursor grab, `user-select:none`, text-decoration none. Label: "⚡ Meridian"
  - Info box below: `background: rgba(255,255,255,0.04)`, border `1px solid rgba(255,255,255,0.12)`, border-radius 10px, padding 14px 16px. Text (textSec, 13px): "Works on Chrome and Edge 116+. The bookmarklet never stores your passwords or personal data."
  - "All done — Launch Meridian →" button: same primary button style, always enabled
  - Back link same as Step2
  - On complete: `onComplete()`
  - Test: `npm run build` passes; `href` of anchor contains correct HOST value

- [x] **Task 7: Onboarding shell — wire steps + Supabase write**
  - File: `src/components/Onboarding.jsx`
  - Props: `{ user, onComplete }`
  - State: `step` (1|2|3), `formData` (accumulated object)
  - Progress dots: 3 dots centered at top of card area. Current = `#003087` filled 10px circle. Others = `C.border` outline 10px circle. Gap 8px.
  - `handleNext(data)`: merges data into formData, increments step
  - `handleComplete()`:
    ```js
    // 1. Get team_id
    const { data: teams } = await supabase.from('teams').select('id, name');
    const teamRow = teams.find(t => t.name === formData.team);
    // 2. Update profile
    const { data: updatedProfile } = await supabase
      .from('profiles')
      .update({
        full_name:  formData.full_name,
        team_id:    teamRow?.id || null,
        onboarded:  true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('*')
      .single();
    // 3. Notify parent
    props.onComplete(updatedProfile);
    ```
  - Renders: `step === 1` → `<Step1Profile>`, `step === 2` → `<Step2Team>`, `step === 3` → `<Step3Bookmarklet>`
  - Test: `npm run build` passes; flow moves 1→2→3; Supabase write triggered on complete

---

### Phase 3: Dashboard

The dashboard is the host page — what users see when the PiP bar is not open. Shows personal productivity stats and the Launch PiP Bar button.

**Reference:** CT 1.0 layout — 5 period tabs, stat cards, daily table, trend chart. Meridian adds Not a Case and Processes to everything.

- [x] **Task 8: useDashboardStats hook**
  - File: `src/hooks/useDashboardStats.js`
  - Accepts `{ userId, period }` where period = `'this_week' | 'last_week' | 'this_month' | 'last_month' | 'ytd'`
  - Date range logic in `America/New_York` (do NOT use moment.js or date-fns):
    ```js
    function getDateRange(period) {
      const now = new Date();
      const toNYDate = d => new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const ny = toNYDate(now);

      const startOfDay = d => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
      const endOfDay   = d => { const x = new Date(d); x.setHours(23,59,59,999); return x; };

      // Monday of current week
      const dayOfWeek = ny.getDay(); // 0=Sun
      const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const thisMonday = new Date(ny); thisMonday.setDate(ny.getDate() - diffToMon);

      if (period === 'this_week') {
        return { from: startOfDay(thisMonday), to: now };
      }
      if (period === 'last_week') {
        const lastMon = new Date(thisMonday); lastMon.setDate(thisMonday.getDate() - 7);
        const lastSun = new Date(lastMon); lastSun.setDate(lastMon.getDate() + 6);
        return { from: startOfDay(lastMon), to: endOfDay(lastSun) };
      }
      if (period === 'this_month') {
        const start = new Date(ny.getFullYear(), ny.getMonth(), 1);
        return { from: startOfDay(start), to: now };
      }
      if (period === 'last_month') {
        const start = new Date(ny.getFullYear(), ny.getMonth() - 1, 1);
        const end   = new Date(ny.getFullYear(), ny.getMonth(), 0);
        return { from: startOfDay(start), to: endOfDay(end) };
      }
      if (period === 'ytd') {
        const start = new Date(ny.getFullYear(), 0, 1);
        return { from: startOfDay(start), to: now };
      }
    }
    ```
  - Fetches:
    ```js
    // Case events
    const { data: events } = await supabase
      .from('case_events')
      .select('type, excluded, timestamp')
      .eq('user_id', userId)
      .gte('timestamp', range.from.toISOString())
      .lte('timestamp', range.to.toISOString());

    // Process sessions
    const { data: procs } = await supabase
      .from('process_sessions')
      .select('logged_at, duration_s, category')
      .eq('user_id', userId)
      .gte('logged_at', range.from.toISOString())
      .lte('logged_at', range.to.toISOString());
    ```
  - Aggregates totals and `dailyRows` (group by date `MM/DD` in NY timezone)
  - Returns: `{ resolved, reclass, calls, notACase, processes, casesAndCalls, totalActivity, dailyRows, loading, error }`
  - `dailyRows`: `[{ date: 'MM/DD', resolved, reclass, calls, notACase, processes, total, totalActivity }]` sorted ascending
  - Test: `npm run build` passes

- [x] **Task 9: DashboardStatCard component**
  - File: `src/components/DashboardStatCard.jsx`
  - Props: `{ label, value, period, color, icon, active, onClick }`
  - Inline styles only
  - Card: min-width 150px, flex 1, height 130px, border-radius 12px, background = `color` prop, padding 16px, cursor pointer, position relative, overflow hidden
  - Top row: label (white, 10px, 800 weight, uppercase, letter-spacing 0.08em, max 2 lines) left + icon (18px) right
  - Bottom: value (white, 42px, 800 weight, line-height 1)
  - Active state: `box-shadow: inset 0 0 0 3px rgba(255,255,255,0.5)`
  - Hover: `filter: brightness(1.08)`, transition 150ms
  - Icons: Resolved=`✓`, Reclassified=`↩`, Calls=`📞`, Not a Case=`—`, Cases & Calls=`📋`, Processes=`⏱`, Total Activity=`⚡`
  - Test: `npm run build` passes

- [x] **Task 10: DashboardTable component**
  - File: `src/components/DashboardTable.jsx`
  - Props: `{ rows }`
  - Inline styles only. Dark bg `C.cardBg`, border `C.border`, border-radius 12px, overflow hidden
  - Header: 10px uppercase, 700 weight, textSec, `C.cardBg` bg, 40px height, columns: DATE | RESOLVED | RECLASSIFIED | CALLS | NOT A CASE | PROCESSES | TOTAL | TOTAL ACTIVITY
  - Rows: 44px height, `C.divider` bottom border, alternating `transparent`/`rgba(255,255,255,0.02)`
  - Date: white, 700 weight
  - Resolved: `#16a34a`, Reclassified: `#dc2626`, Calls: `#0284c7`, Not a Case: `#6b7280`, Processes: `#60a5fa`
  - Zero values: textDim
  - Total + Total Activity: textPri, 700 weight
  - Empty state: "No activity for this period" — 60px height, textSec, centered
  - Test: `npm run build` passes

- [x] **Task 11: DashboardChart component**
  - File: `src/components/DashboardChart.jsx`
  - Props: `{ rows, activeMetric, chartType, onChartTypeChange }`
  - Install recharts if not in package.json: `npm install recharts`
  - Only renders on `this_month`, `last_month`, `ytd` periods — parent controls visibility
  - `activeMetric` maps to: `resolved | reclass | calls | notACase | processes | casesAndCalls | totalActivity`
  - Metric color map matches stat card colors
  - Bar chart: `<BarChart>` + `<Bar>` fill = metric color
  - Area chart (line mode): `<AreaChart>` + `<Area>` stroke = metric color, fill = metric color at 20% opacity, `type="monotone"`
  - Shared: `<ResponsiveContainer width="100%" height={300}>`, `<XAxis dataKey="date">` (textDim, no axis line), `<YAxis>` (textDim, no axis line), `<CartesianGrid strokeDasharray="3 3" stroke={C.divider}>`
  - Chart title: "Trend: {metricLabel}" — white, 15px, 700 weight, margin-bottom 12px
  - Line/Bar toggle: top-right, two buttons. Active: `background:#E8540A`, white text. Inactive: `background:C.cardBg`, `border:C.border`, textSec
  - Wrap in dark card: `background: C.cardBg`, border `C.border`, border-radius 12px, padding 20px
  - Test: `npm run build` passes — recharts in package.json

- [x] **Task 12: Dashboard.jsx — wire everything together**
  - File: `src/components/Dashboard.jsx`
  - Props: `{ user, profile, onLaunchPip }`
  - State: `period` (default `'this_week'`), `activeMetric` (default `'resolved'`), `chartType` (default `'bar'`)
  - Uses `useDashboardStats({ userId: user.id, period })`
  - Top bar (64px, `#1a1a2e`, border-bottom `C.border`):
    - Left: `<img src="/meridian-mark-192.png" style={{width:32,height:32,borderRadius:6}} />` + "Meridian" (white, 17px, 800) + profile.full_name (textSec, 13px)
    - Right: "🚀 Launch PiP Bar" button (`#003087` bg, `border-left: 3px solid #E8540A`, white, 14px 700, height 40px, padding 0 20px, border-radius 10px, border none) → calls `onLaunchPip()`
  - Body: max-width 1200px, margin auto, padding 28px 24px
  - Period tabs row: flex, gap 8px, margin-bottom 24px
    - 5 tabs: This Week | Last Week | This Month | Last Month | Year To Date
    - Active: `background: #E8540A`, white, 700. Inactive: `background: rgba(255,255,255,0.06)`, textSec
    - Each tab: height 40px, padding 0 20px, border-radius 20px, border none, cursor pointer, font-size 13px, transition 150ms
  - Stat cards row: `display:flex`, `flexWrap:wrap`, gap 10px, margin-bottom 24px
    - 7 cards using `<DashboardStatCard>` in order: Resolved, Reclassified, Calls, Not a Case, Cases & Calls, Processes, Total Activity
    - `active` prop = `activeMetric === metricKey`
    - `onClick` = `() => setActiveMetric(metricKey)`
  - Loading state: cards show `—` as value, table shows 3 skeleton rows (`background: rgba(255,255,255,0.06)`, border-radius 4px, animated pulse via CSS)
  - `<DashboardTable rows={stats.dailyRows} />` — always shown
  - `<DashboardChart>` — only shown when period is `this_month`, `last_month`, or `ytd`
  - Test: `npm run build` passes; `npm run dev` shows full dashboard with correct layout

---

## Testing Strategy

- Primary: `npm run build` — zero errors after every task
- Secondary: `npm run dev` — visual check for Tasks 8, 11, 12
- No automated test suite

---

## Out of Scope

- No supervisor/team views — personal stats only
- No CSV/Excel export
- No settings page
- No push notifications
- No changes to PiP bar components (PipBar.jsx, CasePill, ProcessPill, SwimlaneTray, overlays, etc.)
- No changes to bookmarklet or relay.html
- No new Supabase tables or schema changes

---

## Notes for Ralph

- **process_categories RLS** — if categories still don't load after fixing the fetch query (Task 1), the Supabase RLS policy may be missing. Leave a note in `progress.txt` — Davis will run the SQL manually:
  ```sql
  CREATE POLICY "process_categories_read"
    ON public.process_categories FOR SELECT
    USING (auth.role() = 'authenticated');
  ```
- **Recharts install** — check `package.json` before installing. If recharts is already there, skip `npm install recharts`.
- **Inline styles only** — all new components use inline style objects. No new `.css` files. No `className` additions unless targeting existing styles.
- **Bookmarklet href in Step3** — the `host` variable must use `import.meta.env.VITE_APP_URL` at runtime so the correct production URL is embedded. The template literal approach in Task 6 handles this correctly.
- **Week starts Monday** — `getDay()` returns 0 for Sunday. `diffToMon = day === 0 ? 6 : day - 1`.
- **`profiles.onboarded` null safety** — treat `null` same as `false`. Check `!profile?.onboarded` not `profile?.onboarded === false`.
- **onLaunchPip wiring** — `Dashboard.jsx` receives `onLaunchPip` as a prop from App.jsx. App.jsx already has `openPip()` from `usePipWindow` — pass it down: `<Dashboard onLaunchPip={openPip} ... />`.
- **Logo files exist** — `public/meridian-mark-192.png` and `public/meridian-mark-512.png` are already there. Reference as `/meridian-mark-192.png`. Do not copy or recreate them.
- **Dark theme throughout** — all new screens use `background: '#0f0f1e'` for page bg and `'#1a1a2e'` for cards/bars. White text on dark. Same visual language as the PiP bar.
- **PWA scope — critical** — because the app is single-page (state-driven, no router), all views (onboarding, dashboard, PiP host) live inside the same `index.html`. The manifest `"scope": "/"` and `"start_url": "/"` ensure the installed PWA window never breaks out to a browser tab regardless of which state the app is in. Do not add any `window.location` navigation or `<a href>` links that point outside the app — use state changes only.
- **No new browser windows from dashboard** — the "Launch PiP Bar" button calls `openPip()` which uses the Document PiP API to spawn the floating window. It does NOT open a new browser tab. Keep it this way.
- **PWA install prompt** — Meridian will show an install prompt in Chrome/Edge once the manifest and a service worker (or at minimum the manifest + HTTPS) are in place. The `display: standalone` setting is what removes the browser chrome when installed. Onboarding and dashboard must look correct in standalone mode (no browser address bar visible).
