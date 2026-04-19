# Amendment to Track 3 PRD — Re-resolve metric panel

**Apply to:** `03-Ralph-PRD-Insights-Tab.md`
**When:** Before Ralph starts on Track 3. This is a pre-run edit to the PRD, not a follow-up task.
**Depends on:** Track 2b (`02b-CC-Reopen-Count-Migration.md`) having landed, so `ct_cases.reopen_count` exists and is backfilled.

This amendment adds a fifth panel to the Insights tab that surfaces case re-resolve patterns — cases that came back after being marked resolved. It&#x27;s one of the metrics supervisors genuinely care about (it signals chronic cases, unclear resolutions, or training opportunities) and the data exists because of Track 2b.

---

## Changes to `03-Ralph-PRD-Insights-Tab.md`

### Change 1 — File Structure

In the File Structure section, add one new file under `src/components/insights/`:

```
      CaseReopenPanel.jsx              NEW
```

The file list under `src/components/insights/` should read:

```
      TeamCaseVolumePanel.jsx
      AgentHandleTimePanel.jsx
      MplByCategoryPanel.jsx
      TrendComparisonPanel.jsx
      CaseReopenPanel.jsx              NEW
      AgentRow.jsx
      InsightsEmptyState.jsx
```

### Change 2 — Task 2 amendment (API layer)

In Task 2 (&quot;Add insights-scoped helpers to `src/lib/api.js`&quot;), add one more helper to the list:

- Add `fetchTeamReopenedCases({ userIds, from, to })` — returns rows from `ct_cases` where `user_id IN userIds`, `resolution = &#x27;resolved&#x27;`, `reopen_count &gt; 0`, and `created_at` within the period. Select `id, user_id, case_number, reopen_count, created_at`. Used by the re-resolve panel to drive both the distribution chart and the &quot;top chronic cases&quot; table.

Update the acceptance grep to expect **four** matches instead of three: `grep -n &quot;fetchTeamAgents\|fetchTeamCaseEvents\|fetchTeamMplEntries\|fetchTeamReopenedCases&quot; src/lib/api.js`.

### Change 3 — Task 3 amendment (useTeamInsights hook)

In Task 3, the hook&#x27;s return shape gains one new field:

```
{ loading, error, teams, agents, perAgentStats, teamTotals,
  byCategory, byDayByTeam,
  reopenDistribution   /* NEW */
}
```

Where `reopenDistribution` is:

```js
{
  totalReopenedCases: number,          // distinct case_numbers with reopen_count &gt; 0
  byCount: {                            // distribution
    &#x27;1&#x27;: number,  // cases resolved 2x (i.e. reopen_count = 1)
    &#x27;2&#x27;: number,  // cases resolved 3x
    &#x27;3plus&#x27;: number,
  },
  topChronic: [                         // descending by reopen_count, then recency
    { case_number, reopen_count, latest_resolved_at, agent_id },
    ...
  ]  // cap at 10 rows
}
```

The hook fetches this via the new `fetchTeamReopenedCases` helper. Aggregation is client-side — group by `case_number`, pick the max `reopen_count` per case, bucket and sort.

### Change 4 — New task between Task 10 and Task 11

Insert a new task immediately after Task 10 (AgentHandleTimePanel). Renumber the existing Tasks 11, 12, 13, 14 accordingly — OR keep them at their existing numbers and insert the new task as **Task 10a** to preserve the numbering that matches current progress.txt. Use 10a — it&#x27;s consistent with how Task 4a, 4b, 7a, 10a were inserted for attachments in the Suggestion Box PRD.

```markdown
- [ ] **Task 10a: Build `CaseReopenPanel.jsx`**

  Props: `{ reopenDistribution }` from `useTeamInsights`.

  Renders a card with two sections:

  - **Top:** a single large number — `totalReopenedCases` — with the label &quot;Cases resolved more than once in this period.&quot; Below it, a three-stop horizontal distribution bar showing the split between &quot;2×&quot;, &quot;3×&quot;, and &quot;4+ times.&quot; Use the same horizontal-bar pattern as TeamCaseVolumePanel.
  - **Bottom:** a compact table titled &quot;Most-resolved cases&quot; listing the top 10 entries from `topChronic`. Columns: Case number, Times resolved, Last resolved (relative time), Agent (looked up from the agents array in the parent hook if needed, otherwise just the user_id). If the list is empty, render &quot;No repeat resolves in this period. Clean sheet.&quot;

Small caption below the table: &quot;Based on resolves within the selected period. Historical duplicates from pre-alpha widget behavior are excluded when viewing current periods.&quot;

  If `totalReopenedCases` is 0, the card still renders with a celebratory empty state instead of a collapsed panel — supervisors should see that the number exists and that it&#x27;s currently zero.

  Sort of the top-chronic table: `reopen_count DESC, latest_resolved_at DESC`.

  Acceptance: builds. Panel renders. If no reopens in the period, shows the clean-sheet state. If reopens exist, shows the number + distribution + table.
```

### Change 5 — Task 11 (InsightsTab.jsx) amendment

The InsightsTab layout currently calls for a 2×2 grid of four panels. Change this to a three-column, two-row asymmetric layout:

- Row 1: TeamCaseVolumePanel (spans two columns) + CaseReopenPanel (one column).
- Row 2: AgentHandleTimePanel + MplByCategoryPanel + TrendComparisonPanel.

On mobile (&lt; 768px), all panels stack vertically in the same top-to-bottom order.

This visual priority change reflects that re-resolve data is a peer of case volume, not an afterthought. Putting it alongside the headline &quot;cases logged&quot; metric matches how supervisors will actually scan the page.

### Change 6 — Task 14 acceptance grep

In Task 14&#x27;s verification block, update the first two grep checks:

- `grep -rn &quot;useTeamInsights&quot; src/` — returns at least 2 matches (unchanged).
- `grep -rn &quot;aggregateStats&quot; src/` — returns matches in both `useDashboardStats.js` AND `useTeamInsights.js` (unchanged).
- **New:** `grep -rn &quot;CaseReopenPanel\|reopenDistribution&quot; src/` — returns at least 3 matches (the panel file, the hook, the InsightsTab import).

### Change 7 — Notes for Ralph

Add to the &quot;Gotchas&quot; section of Notes for Ralph:

&gt; 13. **`reopen_count` is stamped at case-start time, not resolve time.** An in-flight case session has a reopen_count that reflects the state of the world when it started, which may be stale if a teammate is resolving the same case concurrently. For the alpha this edge case is vanishing. Do not attempt to &quot;freshen&quot; the count at resolve time — that would defeat the immutability we rely on.
&gt; 14. **`reopen_count = 0` is the vast majority of rows.** Always filter aggregations with `reopen_count &gt; 0` when looking for repeat resolves; otherwise you&#x27;ll drown signal in noise.
&gt; 15. **Per-case, not per-session.** When computing &quot;how many cases came back,&quot; `GROUP BY case_number` and take `MAX(reopen_count)` per group. A case resolved three times produces three rows with reopen_counts 0, 1, 2 — the interesting number is 2 (the max), not 3 (the sum).

---

## Rollback

If `reopen_count` turns out to be wrong for any reason, the panel can be removed by reverting Change 4 (delete `CaseReopenPanel.jsx`) and Change 3 (delete the `reopenDistribution` field from the hook). The underlying schema column stays — it&#x27;s harmless to leave around.