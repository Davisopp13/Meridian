# Meridian Suggestion Box PRD

## Project Overview

Ship the Meridian Suggestion Box — an in-app feedback channel that lets alpha agents submit bug reports, feature requests, new MPL category / subcategory proposals, and open-ended feedback, and lets Davis triage those suggestions through an admin view. The submitter surface lives at a new &quot;Feedback&quot; tab in the Meridian dashboard navbar, visible to all authenticated users. The admin surface lives at an &quot;Admin&quot; tab, visible only to users with `role = &#x27;admin&#x27;`. A status lifecycle (`new → acknowledged → in_progress → shipped / wont_fix`) plus private admin notes turns this from a complaints inbox into a tracked backlog. The payoff for category suggestions specifically: the admin view has a &quot;Promote to live categories&quot; action that inserts the approved suggestion directly into `mpl_categories` or `mpl_subcategories` and auto-marks the suggestion as `shipped`. Bug-type suggestions additionally allow a single image attachment (5MB cap, client-compressed) so agents can screenshot what they saw instead of describing it in prose.

Tech stack: Vite + React 18, Supabase (PostgreSQL + RLS), inline styles, same patterns as `src/components/Dashboard.jsx` and the Insights tab (Track 3). Optional Phase 5 uses a Supabase Edge Function for email notifications — Ralph writes it but Davis deploys it manually.

Success = an alpha agent can submit a suggestion, see it in their own &quot;My suggestions&quot; list with current status, and Davis can log in, open Admin, filter to `type = &#x27;category&#x27;` + `status = &#x27;new&#x27;`, review the suggestion, click Promote, and have the suggestion appear as a live MPL category in the next widget refresh — all without leaving the app.

Test command: `npx vite build 2&gt;&amp;1 | tail -8` — must show `✓ built in` with zero errors.

## Architecture &amp; Key Decisions

- **Schema is defined in this track.** One new table `suggestions` created by migration `006_suggestion_box.sql`. The track also uses `platform_users.role` which was updated in Track 2 (after amendment `02a`) to include `&#x27;admin&#x27;`.
- **Two views, one component tree.** `FeedbackTab.jsx` is the submitter surface (form + own-suggestions list). `AdminTab.jsx` is the admin surface (full triage list + detail panel). Both live in `src/components/`. They share `SuggestionRow.jsx` and `SuggestionStatusBadge.jsx` for row rendering and status pills.
- **Role gating at two levels.** `Navbar.jsx` hides the Admin tab for non-admins. `AdminTab.jsx` also re-checks — defense in depth, same pattern as Insights. The Feedback tab is visible to everyone.
- **Category and subcategory suggestions have extra fields.** When `type = &#x27;category&#x27;` or `type = &#x27;subcategory&#x27;`, the form reveals a `haulage_type` picker (CH / MH) and, for subcategory only, a parent-category dropdown populated from `mpl_categories` filtered by the selected haulage type. The schema carries `haulage_type` and `parent_category_id` as nullable columns populated only for those types.
- **Promotion writes directly to live taxonomy.** The &quot;Promote to live categories&quot; admin action performs a real INSERT into `mpl_categories` or `mpl_subcategories` and updates the suggestion row to `status = &#x27;shipped&#x27;` in the same operation. Both writes go through a single Supabase RPC function `promote_suggestion(suggestion_id)` defined in migration `006` — this guarantees atomicity and avoids a half-applied state if the client drops mid-call.
- **RLS separates submitter vs admin.** Agents can INSERT their own suggestions, SELECT only their own suggestions, never UPDATE or DELETE. Admins can SELECT all, UPDATE status and admin_notes on any, and INSERT via the promotion RPC. No DELETE policy at all — suggestions are append-only history.
- **No voting, no comments, no public roadmap view in MVP.** These are explicitly out of scope even though they&#x27;d be nice. The goal is a clean submit + triage loop.
- **Email notifications are Phase 5 and optional.** A Supabase Edge Function that listens to inserts on `suggestions` and sends Davis an email. Uses Resend (or whichever SMTP provider is already configured for Supabase — Ralph checks). Ralph writes the function file but does NOT deploy; Davis runs `supabase functions deploy` manually. If Phase 5 is deemed out of scope at run time, Ralph stops cleanly after Phase 4 and the product is complete.
- **Styling matches the Insights tab.** Same inline-style + CSS-variable pattern. No new design tokens. No new dependencies.
- **Attachments are scoped to bugs only.** Only `type = &#x27;bug&#x27;` suggestions accept an image. The form does not show the upload control for any other type. Zero images, or one image — never more. This is enforced in the UI, in a DB check constraint on a new `suggestion_attachments` table, and in Storage RLS.
- **Attachments live in a private Supabase Storage bucket** named `suggestion-attachments`. The bucket is NOT public. Reads are RLS-gated: the submitter can read their own files, admins can read all, nobody else. Writes are RLS-gated: an agent can only upload to paths prefixed with their own user_id. No direct URLs ever reach a non-admin, non-submitter.
- **Attachments are referenced, not embedded.** A new `suggestion_attachments` table holds `{ id, suggestion_id, storage_path, mime_type, size_bytes, created_at }` — one row per uploaded file, with a FK to `suggestions` and `ON DELETE CASCADE`. The `suggestions` table is not modified. Display of the attachment happens via a short-lived signed URL generated by the client at view time — never a persistent public URL.
- **Client does the heavy lifting for safety.** Before upload: file type check (reject anything that isn&#x27;t `image/jpeg`, `image/png`, `image/webp`, `image/gif`), size check (reject over 5MB before any processing — the limit is pre-compression), canvas resize to max 1920px on the longest edge, re-encode as JPEG at quality 0.85 which strips EXIF as a side effect, re-check size after compression. Rejections show inline error text — no silent failures.
- **Nothing blocks form submission on attachment failure.** If the upload fails mid-submit, the suggestion still lands with the text content and an inline error &quot;image failed to upload, you can add it later&quot; is shown. Re-upload from the submitter&#x27;s own-suggestions list is explicitly out of scope for this MVP — if an agent&#x27;s upload fails, they just submit a new suggestion. Reliability is more important than a polished retry flow for alpha.

## File Structure

```
src/
  components/
    FeedbackTab.jsx                      NEW — submitter surface
    AdminTab.jsx                         NEW — admin surface
    feedback/
      SuggestionForm.jsx                 NEW — the submit form
      SuggestionList.jsx                 NEW — list of rows (used by both tabs)
      SuggestionRow.jsx                  NEW — single row
      SuggestionStatusBadge.jsx          NEW — status pill
      SuggestionDetailPanel.jsx          NEW — admin expanded view with status picker + notes
      CategoryPromotionModal.jsx         NEW — admin &quot;Promote to live categories&quot; confirm
      AttachmentUploader.jsx             NEW — image picker + client compression (bugs only)
      AttachmentPreview.jsx              NEW — signed-URL image render with open-in-tab
    Navbar.jsx                           EDIT — add Feedback + Admin tabs
    Dashboard.jsx                        EDIT — add &#x27;feedback&#x27; and &#x27;admin&#x27; views
  hooks/
    useMySuggestions.js                  NEW — fetches own suggestions
    useAllSuggestions.js                 NEW — admin-scoped fetch
    useSignedAttachmentUrl.js            NEW — short-lived signed URL for render
  lib/
    api.js                               EDIT — add suggestion CRUD wrappers
    attachments.js                       NEW — upload + compression + validation helpers

supabase/
  migrations/
    006_suggestion_box.sql               NEW — table, RLS, promote_suggestion RPC
    007_suggestion_notifications.sql     NEW (Phase 5 only) — pg_net + trigger
  functions/
    suggestion-notify/                   NEW (Phase 5 only)
      index.ts                           NEW
      README.md                          NEW
```

## Environment &amp; Setup

- Supabase URL and anon key already wired in `src/lib/supabase.js`.
- Track 2&#x27;s migration (`003_teams_and_roles.sql`, amended to include `&#x27;admin&#x27;` role per `02a`) is already applied. Davis has `role = &#x27;admin&#x27;`.
- Track 3&#x27;s Insights work may or may not be merged — this PRD does not depend on it.
- Track 1&#x27;s data layer (`src/lib/api.js`) and dashboard refactor are merged.
- Phase 5 only: the Supabase project has email sending enabled. If not, Ralph logs a flag in progress.txt and skips Phase 5 gracefully.

## Tasks

### Phase 1 — Schema and RLS

- [x] **Task 1: Write `supabase/migrations/006_suggestion_box.sql`**

  Create the file with the exact contents below. Do not run it — Davis applies manually after review.

  ```sql
  -- 1. suggestions table
  CREATE TABLE IF NOT EXISTS suggestions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
    type                text NOT NULL
                        CHECK (type IN (&#x27;bug&#x27;,&#x27;feature&#x27;,&#x27;category&#x27;,&#x27;subcategory&#x27;,&#x27;other&#x27;)),
    title               text NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
    body                text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
    haulage_type        text NULL CHECK (haulage_type IS NULL OR haulage_type IN (&#x27;CH&#x27;,&#x27;MH&#x27;)),
    parent_category_id  uuid NULL REFERENCES mpl_categories(id) ON DELETE SET NULL,
    status              text NOT NULL DEFAULT &#x27;new&#x27;
                        CHECK (status IN (&#x27;new&#x27;,&#x27;acknowledged&#x27;,&#x27;in_progress&#x27;,&#x27;shipped&#x27;,&#x27;wont_fix&#x27;)),
    admin_notes         text NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    resolved_at         timestamptz NULL,
    -- Shape constraint: category/subcategory suggestions must have a haulage_type.
    CONSTRAINT category_needs_haulage CHECK (
      type NOT IN (&#x27;category&#x27;,&#x27;subcategory&#x27;) OR haulage_type IS NOT NULL
    ),
    -- Shape constraint: subcategory suggestions must reference a parent category.
    CONSTRAINT subcategory_needs_parent CHECK (
      type &lt;&gt; &#x27;subcategory&#x27; OR parent_category_id IS NOT NULL
    )
  );

  CREATE INDEX IF NOT EXISTS suggestions_user_id_idx    ON suggestions(user_id);
  CREATE INDEX IF NOT EXISTS suggestions_status_idx     ON suggestions(status);
  CREATE INDEX IF NOT EXISTS suggestions_type_idx       ON suggestions(type);
  CREATE INDEX IF NOT EXISTS suggestions_created_at_idx ON suggestions(created_at DESC);

  -- 2. updated_at trigger
  CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
  BEGIN NEW.updated_at = now(); RETURN NEW; END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trg_suggestions_updated_at ON suggestions;
  CREATE TRIGGER trg_suggestions_updated_at
    BEFORE UPDATE ON suggestions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

  -- 3. RLS
  ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

  -- Agents can insert their own suggestions.
  CREATE POLICY &quot;users insert own suggestions&quot; ON suggestions
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

  -- Agents can read their own suggestions.
  CREATE POLICY &quot;users read own suggestions&quot; ON suggestions
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

  -- Admins can read all suggestions.
  CREATE POLICY &quot;admins read all suggestions&quot; ON suggestions
    FOR SELECT TO authenticated
    USING (
      EXISTS (SELECT 1 FROM platform_users pu
              WHERE pu.id = auth.uid() AND pu.role = &#x27;admin&#x27;)
    );

  -- Admins can update status / admin_notes / resolved_at.
  CREATE POLICY &quot;admins update suggestions&quot; ON suggestions
    FOR UPDATE TO authenticated
    USING (
      EXISTS (SELECT 1 FROM platform_users pu
              WHERE pu.id = auth.uid() AND pu.role = &#x27;admin&#x27;)
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM platform_users pu
              WHERE pu.id = auth.uid() AND pu.role = &#x27;admin&#x27;)
    );

  -- No DELETE policy: suggestions are append-only.

  GRANT SELECT, INSERT         ON suggestions TO authenticated;
  GRANT UPDATE                 ON suggestions TO authenticated;

  -- 4. Promotion RPC — atomically promote a category/subcategory suggestion
  -- into live mpl_categories / mpl_subcategories and mark it shipped.
  CREATE OR REPLACE FUNCTION promote_suggestion(p_suggestion_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
    s             suggestions%ROWTYPE;
    new_cat_id    uuid;
    new_subcat_id uuid;
    caller_role   text;
  BEGIN
    -- Must be admin
    SELECT role INTO caller_role FROM platform_users WHERE id = auth.uid();
    IF caller_role &lt;&gt; &#x27;admin&#x27; THEN
      RAISE EXCEPTION &#x27;not authorized&#x27;;
    END IF;

    SELECT * INTO s FROM suggestions WHERE id = p_suggestion_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION &#x27;suggestion not found&#x27;;
    END IF;

    IF s.type = &#x27;category&#x27; THEN
      INSERT INTO mpl_categories (name, team, display_order)
      VALUES (
        s.title,
        s.haulage_type,
        COALESCE((SELECT MAX(display_order) + 1 FROM mpl_categories WHERE team = s.haulage_type), 1)
      )
      RETURNING id INTO new_cat_id;
    ELSIF s.type = &#x27;subcategory&#x27; THEN
      INSERT INTO mpl_subcategories (category_id, name, display_order)
      VALUES (
        s.parent_category_id,
        s.title,
        COALESCE((SELECT MAX(display_order) + 1 FROM mpl_subcategories WHERE category_id = s.parent_category_id), 1)
      )
      RETURNING id INTO new_subcat_id;
    ELSE
      RAISE EXCEPTION &#x27;only category/subcategory suggestions can be promoted&#x27;;
    END IF;

    UPDATE suggestions
      SET status = &#x27;shipped&#x27;,
          resolved_at = now(),
          admin_notes = COALESCE(admin_notes, &#x27;&#x27;) ||
                        CASE WHEN admin_notes IS NULL OR admin_notes = &#x27;&#x27; THEN &#x27;&#x27; ELSE E&#x27;\n\n&#x27; END ||
                        &#x27;[Promoted to live taxonomy at &#x27; || now()::text || &#x27;]&#x27;
      WHERE id = p_suggestion_id;

    RETURN jsonb_build_object(
      &#x27;suggestion_id&#x27;, p_suggestion_id,
      &#x27;promoted_type&#x27;, s.type,
      &#x27;new_category_id&#x27;, new_cat_id,
      &#x27;new_subcategory_id&#x27;, new_subcat_id
    );
  END;
  $$;

  GRANT EXECUTE ON FUNCTION promote_suggestion(uuid) TO authenticated;

  -- 5. suggestion_attachments — one image per bug, referenced by suggestion_id.
  CREATE TABLE IF NOT EXISTS suggestion_attachments (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_id  uuid NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
    storage_path   text NOT NULL,
    mime_type      text NOT NULL CHECK (mime_type IN (&#x27;image/jpeg&#x27;,&#x27;image/png&#x27;,&#x27;image/webp&#x27;,&#x27;image/gif&#x27;)),
    size_bytes     integer NOT NULL CHECK (size_bytes &gt; 0 AND size_bytes &lt;= 5242880),
    created_at     timestamptz NOT NULL DEFAULT now(),
    -- Enforce one image per suggestion.
    CONSTRAINT one_attachment_per_suggestion UNIQUE (suggestion_id)
  );

  CREATE INDEX IF NOT EXISTS suggestion_attachments_suggestion_id_idx
    ON suggestion_attachments(suggestion_id);

  ALTER TABLE suggestion_attachments ENABLE ROW LEVEL SECURITY;

  -- Submitter can INSERT an attachment for their own bug suggestions only.
  CREATE POLICY &quot;users insert own bug attachment&quot; ON suggestion_attachments
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM suggestions s
        WHERE s.id = suggestion_attachments.suggestion_id
          AND s.user_id = auth.uid()
          AND s.type = &#x27;bug&#x27;
      )
    );

  -- Submitter can SELECT their own attachment rows.
  CREATE POLICY &quot;users read own attachments&quot; ON suggestion_attachments
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM suggestions s
        WHERE s.id = suggestion_attachments.suggestion_id
          AND s.user_id = auth.uid()
      )
    );

  -- Admins can SELECT all attachment rows.
  CREATE POLICY &quot;admins read all attachments&quot; ON suggestion_attachments
    FOR SELECT TO authenticated
    USING (
      EXISTS (SELECT 1 FROM platform_users pu
              WHERE pu.id = auth.uid() AND pu.role = &#x27;admin&#x27;)
    );

  -- No UPDATE policy — attachments are immutable.
  -- No DELETE policy on this table — ON DELETE CASCADE from suggestions
  -- never fires anyway (suggestions themselves have no DELETE policy).

  GRANT SELECT, INSERT ON suggestion_attachments TO authenticated;

  -- 6. Storage bucket — private, with RLS policies on storage.objects
  --    scoped to the &#x27;suggestion-attachments&#x27; bucket.
  INSERT INTO storage.buckets (id, name, public)
  VALUES (&#x27;suggestion-attachments&#x27;, &#x27;suggestion-attachments&#x27;, false)
  ON CONFLICT (id) DO NOTHING;

  -- Upload policy: authenticated users can upload to a path starting with their own user_id.
  -- Client convention: `${user_id}/${suggestion_id}/${filename}`.
  CREATE POLICY &quot;users upload to own path&quot; ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = &#x27;suggestion-attachments&#x27;
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

  -- Read policy: submitter reads their own files, admins read all.
  CREATE POLICY &quot;users read own storage files&quot; ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = &#x27;suggestion-attachments&#x27;
      AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR EXISTS (SELECT 1 FROM platform_users pu
                   WHERE pu.id = auth.uid() AND pu.role = &#x27;admin&#x27;)
      )
    );

  -- No UPDATE / DELETE policies on storage.objects for this bucket.
  -- Admins who need to prune can use service-role manually.

  -- 7. Summary output
  SELECT
    (SELECT COUNT(*) FROM suggestions)                         AS total_suggestions,
    (SELECT COUNT(*) FROM suggestion_attachments)              AS total_attachments,
    (SELECT COUNT(*) FROM platform_users WHERE role = &#x27;admin&#x27;) AS admin_count;
  ```

  Acceptance: file exists, `grep -c &quot;CREATE POLICY&quot; supabase/migrations/006_suggestion_box.sql` returns at least 8.

### Phase 2 — Data layer

- [x] **Task 2: Add suggestion CRUD wrappers to `src/lib/api.js`**

  Append (do not replace — keep all existing exports):

  ```js
  export async function createSuggestion({
    userId, type, title, body,
    haulageType = null, parentCategoryId = null,
  }) {
    return supabase.from(&#x27;suggestions&#x27;).insert({
      user_id: userId,
      type,
      title,
      body,
      haulage_type: haulageType,
      parent_category_id: parentCategoryId,
    }).select(&#x27;id&#x27;).single();
  }

  export async function fetchMySuggestions(userId) {
    return supabase.from(&#x27;suggestions&#x27;)
      .select(&#x27;id, type, title, body, status, created_at, updated_at, resolved_at&#x27;)
      .eq(&#x27;user_id&#x27;, userId)
      .order(&#x27;created_at&#x27;, { ascending: false });
  }

  export async function fetchAllSuggestions({ statusFilter = null, typeFilter = null } = {}) {
    let q = supabase.from(&#x27;suggestions&#x27;)
      .select(`
        id, user_id, type, title, body,
        haulage_type, parent_category_id,
        status, admin_notes,
        created_at, updated_at, resolved_at,
        platform_users!inner (full_name, email)
      `)
      .order(&#x27;created_at&#x27;, { ascending: false });
    if (statusFilter) q = q.eq(&#x27;status&#x27;, statusFilter);
    if (typeFilter)   q = q.eq(&#x27;type&#x27;, typeFilter);
    return q;
  }

  export async function updateSuggestion({ id, status = null, adminNotes = null }) {
    const patch = {};
    if (status !== null) {
      patch.status = status;
      if (status === &#x27;shipped&#x27; || status === &#x27;wont_fix&#x27;) {
        patch.resolved_at = new Date().toISOString();
      }
    }
    if (adminNotes !== null) patch.admin_notes = adminNotes;
    return supabase.from(&#x27;suggestions&#x27;).update(patch).eq(&#x27;id&#x27;, id);
  }

  export async function promoteSuggestion(suggestionId) {
    return supabase.rpc(&#x27;promote_suggestion&#x27;, { p_suggestion_id: suggestionId });
  }

  // ── Attachments (bugs only) ────────────────────────────────────────────────
  //
  // Upload flow:
  //   1. client compresses + validates via lib/attachments.js
  //   2. upload the blob to Storage at `${userId}/${suggestionId}/${filename}`
  //   3. insert a row into suggestion_attachments
  //
  // Both steps are RLS-gated. A failed Storage upload means the DB row
  // never gets written, so there are no dangling rows. A failed DB insert
  // after a successful Storage upload DOES leave a storage file — the
  // next run&#x27;s uniqueness constraint on suggestion_id will block the DB
  // row anyway. Admins can prune stray files via service-role if needed.

  export async function uploadAttachmentBlob({ userId, suggestionId, blob, filename }) {
    const path = `${userId}/${suggestionId}/${filename}`;
    return supabase.storage
      .from(&#x27;suggestion-attachments&#x27;)
      .upload(path, blob, { contentType: blob.type, upsert: false });
  }

  export async function createAttachmentRow({ suggestionId, storagePath, mimeType, sizeBytes }) {
    return supabase.from(&#x27;suggestion_attachments&#x27;).insert({
      suggestion_id: suggestionId,
      storage_path: storagePath,
      mime_type: mimeType,
      size_bytes: sizeBytes,
    }).select(&#x27;id&#x27;).single();
  }

  export async function fetchAttachmentForSuggestion(suggestionId) {
    return supabase.from(&#x27;suggestion_attachments&#x27;)
      .select(&#x27;id, storage_path, mime_type, size_bytes, created_at&#x27;)
      .eq(&#x27;suggestion_id&#x27;, suggestionId)
      .maybeSingle();
  }

  export async function createSignedAttachmentUrl(storagePath, expiresSeconds = 300) {
    return supabase.storage
      .from(&#x27;suggestion-attachments&#x27;)
      .createSignedUrl(storagePath, expiresSeconds);
  }
  ```

  Acceptance: `grep -n &quot;createSuggestion\|fetchMySuggestions\|fetchAllSuggestions\|updateSuggestion\|promoteSuggestion\|uploadAttachmentBlob\|createAttachmentRow\|fetchAttachmentForSuggestion\|createSignedAttachmentUrl&quot; src/lib/api.js` returns nine matches.

- [x] **Task 3: Write `src/hooks/useMySuggestions.js`**

  Hook signature: `useMySuggestions(userId)` returns `{ suggestions, loading, error, refetch }`. Uses `fetchMySuggestions`. Follows the cancellation pattern from `useDashboardStats`.

  Acceptance: builds, importable.

- [x] **Task 4: Write `src/hooks/useAllSuggestions.js`**

  Hook signature: `useAllSuggestions({ statusFilter, typeFilter })` returns `{ suggestions, loading, error, refetch }`. Uses `fetchAllSuggestions`. Same cancellation pattern. `refetch` is critical — the admin view updates it after every status change or promotion so the UI stays fresh.

  Acceptance: builds.

- [x] **Task 4a: Write `src/lib/attachments.js`**

  Pure utility module. No Supabase, no React. Exports these named functions:

  ```js
  export const ALLOWED_TYPES = [&#x27;image/jpeg&#x27;,&#x27;image/png&#x27;,&#x27;image/webp&#x27;,&#x27;image/gif&#x27;];
  export const MAX_BYTES     = 5 * 1024 * 1024;       // 5MB pre-compression
  export const MAX_EDGE_PX   = 1920;                  // longest edge after resize
  export const OUT_QUALITY   = 0.85;                  // JPEG quality after recompress

  // validateFile({ file }) → { ok: true } | { ok: false, reason }
  // - Rejects non-image/* mime.
  // - Rejects pre-compression size over MAX_BYTES.
  // - Rejects types outside ALLOWED_TYPES.
  export function validateFile(file) { ... }

  // compressImage(file) → Promise&lt;Blob&gt;
  // - Reads into an Image via an object URL.
  // - Draws to a canvas resized so max(width, height) ≤ MAX_EDGE_PX.
  // - Exports as image/jpeg at OUT_QUALITY.
  // - Revokes the object URL before returning.
  // - Throws on decode failure — caller handles.
  export async function compressImage(file) { ... }

  // sanitizeFilename(name) → string
  // - Strips path separators, lowercases, keeps [a-z0-9._-], truncates to 60 chars.
  // - Appends a short random suffix so two uploads with the same name don&#x27;t collide.
  export function sanitizeFilename(name) { ... }
  ```

  Compression must run on the main thread (no web worker — keep it simple). EXIF is stripped as a side effect of the canvas re-encode. Do NOT use any image library — Canvas API is sufficient.

  Acceptance: file builds; a quick inline test at the bottom of the file (commented out, for manual verification) demonstrates that a 4000x3000 6MB JPEG input produces a blob under 600KB with dimensions at most 1920 on the long edge.

- [x] **Task 4b: Write `src/hooks/useSignedAttachmentUrl.js`**

  Hook signature: `useSignedAttachmentUrl(storagePath)` → `{ url, loading, error }`. Calls `createSignedAttachmentUrl` with a 5-minute expiry. Does NOT auto-refresh — the hook is called fresh each time the attachment is rendered. If the user leaves a detail panel open for more than 5 minutes the signed URL will expire; that&#x27;s fine, they can re-open the panel to regenerate.

  Standard cancellation pattern. Return `{ url: null, loading: false, error: &#x27;no path&#x27; }` if `storagePath` is null.

  Acceptance: builds.

### Phase 3 — Submitter surface

- [x] **Task 5: Build `SuggestionStatusBadge.jsx`**

  Props: `{ status }`. Renders a pill with one of five colors (match conventions: new = blue, acknowledged = amber, in_progress = navy, shipped = green, wont_fix = gray). Reuses CSS variables where possible; hardcoded hex is acceptable for badge colors if a semantic variable doesn&#x27;t exist. Sentence-case labels (&quot;In progress&quot; not &quot;in_progress&quot;).

  Acceptance: builds, all 5 statuses render with distinct colors.

- [ ] **Task 6: Build `SuggestionRow.jsx`**

  Props: `{ suggestion, onClick, showSubmitter }`. Renders one row: type icon + title + relative timestamp + `&lt;SuggestionStatusBadge&gt;`. If `showSubmitter` is true (admin view), also show the submitter&#x27;s full_name. Clickable — calls `onClick(suggestion)`.

  Acceptance: builds, reusable from both tab views.

- [ ] **Task 7: Build `SuggestionForm.jsx`**

  Stateful form with these fields:
  - **Type** — radio or select with 5 options (Bug / Feature request / New category / New subcategory / Other). Drives which extra fields appear below.
  - **Title** — single line, 3–120 chars.
  - **Body** — textarea, 1–4000 chars. Placeholder text varies by type (Bug: &quot;Steps to reproduce, what happened, what you expected.&quot; Feature: &quot;What problem does this solve?&quot; Category/subcategory: &quot;When would an agent pick this? Give a short description.&quot;).
  - **Haulage type** — only shown when type is `category` or `subcategory`. Select with CH / MH.
  - **Parent category** — only shown when type is `subcategory`. Dropdown populated from `mpl_categories` filtered by the selected haulage type. Must use `fetchCategoriesForTeam` from `api.js`.
  - **Attachment** — only shown when type is `bug`. Renders `&lt;AttachmentUploader&gt;` (Task 7a). The component surfaces a currently-selected blob + filename via `onAttachmentChange(blob, filename)` — or null when cleared.
  - **Submit button** — disabled while submitting. On submit:
    1. `createSuggestion(...)` → `{ data: { id } }`. If this fails, show error, stop.
    2. If type is `bug` AND there is an attachment blob: run `uploadAttachmentBlob(...)` then `createAttachmentRow(...)`. If either fails, the suggestion still submitted successfully — show an inline warning &quot;Suggestion posted, but image upload failed&quot; and proceed to `onSubmitted()`. Do NOT roll back the suggestion.
    3. Clear the form and call `onSubmitted()`.

  Storage path convention: `${user.id}/${suggestion.id}/${sanitizeFilename(originalName)}`.

  Client-side validation matches the DB constraints so we don&#x27;t rely on the DB to reject bad input.

  Acceptance: builds, form submits cleanly, category/subcategory fields reveal correctly, parent-category dropdown repopulates when haulage type changes, attachment uploader only renders when type is `bug`, a 6MB input compresses to a blob under 1MB before upload.

- [ ] **Task 7a: Build `AttachmentUploader.jsx`**

  Self-contained image picker. Props: `{ onChange(blob, filename) }`.

  UI states:
  - **Empty** — a single button &quot;Attach screenshot (optional)&quot; with a small hint line &quot;JPEG, PNG, WebP, or GIF. Up to 5MB. One image per bug.&quot;
  - **Validating / compressing** — disabled state with spinner, &quot;Preparing image...&quot;.
  - **Ready** — preview thumbnail (use `URL.createObjectURL` on the compressed blob), filename, compressed size, and a &quot;Remove&quot; button.
  - **Error** — red inline message with the reason from `validateFile` or a compression exception. Leaves the uploader in empty state so the user can try again.

  Flow:
  1. User picks a file via a hidden `&lt;input type=&quot;file&quot; accept=&quot;image/*&quot;&gt;`.
  2. Run `validateFile(file)`. On fail, set error state.
  3. Run `compressImage(file)`. On throw, set error state &quot;Could not read image — try a different file.&quot;
  4. On success, store the blob in local state and call `onChange(blob, sanitizeFilename(file.name))`.

  The uploader does NOT touch Supabase. Upload happens in `SuggestionForm` on submit. That separation means the user can back out before submitting without leaving orphan Storage files.

  `URL.createObjectURL` calls must be `URL.revokeObjectURL`&#x27;d on unmount and when the file changes — otherwise the browser leaks memory. Use a ref.

  Acceptance: builds. Picking a valid image shows a preview. Picking a 10MB file shows &quot;File too large&quot; error. Picking a PDF shows &quot;Image only&quot; error.

- [ ] **Task 8: Build `FeedbackTab.jsx`**

  Props: `{ user, profile }`. Layout:
  - Page title &quot;Feedback&quot; + short sentence &quot;Submit a bug, request a feature, or suggest a new MPL category. We read everything.&quot;
  - `&lt;SuggestionForm /&gt;` at the top.
  - Below: &quot;My suggestions&quot; section with `&lt;SuggestionList&gt;` rendering rows from `useMySuggestions(user.id)`. Empty state when the list is empty: &quot;You haven&#x27;t submitted anything yet.&quot;
  - Rows are NOT clickable in this view — agents can&#x27;t edit suggestions once submitted. They just see the current status.

  After submit, call `refetch()` on the useMySuggestions hook so the new suggestion appears in &quot;My suggestions&quot; immediately.

  Acceptance: builds. Davis can submit a suggestion and see it appear in his list.

- [ ] **Task 9: Build `SuggestionList.jsx`**

  Dumb component. Props: `{ suggestions, onRowClick, showSubmitter, emptyMessage }`. Renders `&lt;SuggestionRow&gt;` for each, or the empty message. No data fetching inside.

  Acceptance: builds, used by both tabs.

### Phase 4 — Admin surface

- [ ] **Task 10: Build `SuggestionDetailPanel.jsx`**

  Props: `{ suggestion, onClose, onUpdated }`. Rendered inline (not modal) below the row that was clicked — expand/collapse pattern, simpler than a modal.

  Contents:
  - Full title and body.
  - Submitter: display name + email.
  - Submitted at / updated at.
  - For category/subcategory: haulage_type and (for subcategory) parent category name.
  - **For bug suggestions: attachment preview** — if `fetchAttachmentForSuggestion(suggestion.id)` returns a row, render `&lt;AttachmentPreview storagePath={row.storage_path} /&gt;`. If none, render nothing (no &quot;no attachment&quot; placeholder).
  - **Status picker** — select with 5 options. Changing it calls `updateSuggestion({ id, status })` and then `onUpdated()` to trigger a refetch.
  - **Admin notes** — textarea with a Save button (not auto-save; admin may type drafts).
  - **Promote to live categories** button — only shown if `type ∈ { &#x27;category&#x27;, &#x27;subcategory&#x27; }` AND status is NOT already `shipped`. Clicking opens `&lt;CategoryPromotionModal&gt;`.

  Acceptance: builds, status changes persist, notes save, bug suggestions with an image show the preview.

- [ ] **Task 10a: Build `AttachmentPreview.jsx`**

  Props: `{ storagePath }`. Uses `useSignedAttachmentUrl(storagePath)` to fetch a 5-minute signed URL.

  States:
  - **Loading** — fixed-size placeholder box (max 320px wide, auto height) with &quot;Loading image...&quot;.
  - **Error** — placeholder with error text.
  - **Loaded** — render `&lt;img&gt;` at `max-width: 320px`, auto height, with a small &quot;Open full size in new tab&quot; link below that uses `openLink(url)` or a plain `target=&quot;_blank&quot;` anchor. The link opens the same signed URL.

  No download button — admins who want to archive an image can open-in-tab and save-as from the browser. Keeps the UI minimal.

  Signed URL expiry is 5 minutes; no refresh logic. If the admin stays on the panel past expiry and the image breaks, re-clicking the row regenerates the URL.

  Acceptance: builds. Admin clicking a bug suggestion with an attached image sees the image inline.

- [ ] **Task 11: Build `CategoryPromotionModal.jsx`**

  Props: `{ suggestion, onConfirm, onCancel }`. Simple confirmation dialog: &quot;Promote &#x27;{title}&#x27; to live {categories|subcategories} under {haulage_type}? This will insert it into the live taxonomy. Agents will see it in their widget on next refresh.&quot;

  On confirm, call `promoteSuggestion(suggestion.id)`, handle success/error, close. On error, display the error — do NOT auto-retry.

  Acceptance: builds. On confirm with a real category suggestion, a new row appears in `mpl_categories` and the suggestion row flips to `shipped` status.

- [ ] **Task 12: Build `AdminTab.jsx`**

  Props: `{ user, profile }`. Layout:
  - If `profile.role !== &#x27;admin&#x27;` → render a graceful &quot;Not authorized&quot; state (shouldn&#x27;t happen — navbar hides the tab — but defense in depth).
  - Two filter controls at the top: status filter (all / new / acknowledged / in_progress / shipped / wont_fix) and type filter (all / bug / feature / category / subcategory / other).
  - Counts at top: &quot;12 new · 3 in progress · 47 total&quot; computed from the unfiltered set (a second lightweight fetch or a `count` head query is fine).
  - `&lt;SuggestionList&gt;` with rows that expand into `&lt;SuggestionDetailPanel&gt;` when clicked.
  - `showSubmitter` = true (admin sees who submitted).

  Acceptance: builds. Davis can filter, click a row, change status, add notes, and promote a category suggestion.

- [ ] **Task 13: Wire Feedback + Admin tabs into `Dashboard.jsx` and `Navbar.jsx`**

  - Add `&#x27;feedback&#x27;` and `&#x27;admin&#x27;` to the `view` states in `Dashboard.jsx`. When `view === &#x27;feedback&#x27;` render `&lt;FeedbackTab&gt;`, when `view === &#x27;admin&#x27;` render `&lt;AdminTab&gt;`.
  - In `Navbar.jsx`, add a &quot;Feedback&quot; button visible to all authenticated users.
  - Add an &quot;Admin&quot; button visible only when `profile?.role === &#x27;admin&#x27;`.
  - Match the existing tab-highlight pattern from Dashboard / Activity / Settings tabs.

  Acceptance: an agent sees Feedback but not Admin. Davis sees both.

- [ ] **Task 14: Build and verify**
  - `npx vite build 2&gt;&amp;1 | tail -8` passes.
  - `grep -rn &quot;FeedbackTab\|AdminTab&quot; src/` returns matches in both Navbar and Dashboard.
  - `grep -rn &quot;promoteSuggestion\|promote_suggestion&quot; src/` returns at least 2 matches (api.js + CategoryPromotionModal).
  - `grep -rn &quot;AttachmentUploader\|AttachmentPreview&quot; src/` returns at least 3 matches (the two files themselves + SuggestionForm uses Uploader + SuggestionDetailPanel uses Preview).
  - `grep -rn &quot;compressImage\|validateFile\|sanitizeFilename&quot; src/` returns matches in both `src/lib/attachments.js` (definitions) and `src/components/feedback/AttachmentUploader.jsx` (usage).
  - `grep -rn &quot;suggestion-attachments&quot; src/` returns matches only in `src/lib/api.js` (bucket name lives there, nowhere else — if another file references the literal bucket string, move it to a shared constant).
  - Bundle size: if total jump is over 60KB, lazy-load `AdminTab` the same way `DashboardChart` is lazy-loaded.
  - Log findings in progress.txt.

### Phase 5 — Email notifications (OPTIONAL)

Phase 5 only runs if Davis opts in at run time. Before starting Phase 5, check `progress.txt` for a line `phase_5_enabled: true`. If absent, Ralph stops after Task 14 and outputs `&lt;promise&gt;COMPLETE&lt;/promise&gt;`.

- [ ] **Task 15: Write the Edge Function scaffold**

  Create `supabase/functions/suggestion-notify/index.ts`:

  ```ts
  import { serve } from &#x27;https://deno.land/std@0.177.0/http/server.ts&#x27;;

  const RESEND_API_KEY = Deno.env.get(&#x27;RESEND_API_KEY&#x27;);
  const ADMIN_EMAIL    = Deno.env.get(&#x27;ADMIN_EMAIL&#x27;);

  serve(async (req) =&gt; {
    if (req.method !== &#x27;POST&#x27;) return new Response(&#x27;method not allowed&#x27;, { status: 405 });

    const { record } = await req.json();
    if (!record) return new Response(&#x27;no record&#x27;, { status: 400 });

    const subject = `[Meridian] New ${record.type} suggestion: ${record.title}`;
    const bodyText =
      `Type: ${record.type}\n` +
      `Status: ${record.status}\n` +
      `Submitted at: ${record.created_at}\n\n` +
      `Title: ${record.title}\n\n` +
      `${record.body}\n\n` +
      `Open Meridian to triage: https://meridian-hlag.vercel.app`;

    const resp = await fetch(&#x27;https://api.resend.com/emails&#x27;, {
      method: &#x27;POST&#x27;,
      headers: {
        &#x27;Authorization&#x27;: `Bearer ${RESEND_API_KEY}`,
        &#x27;Content-Type&#x27;:  &#x27;application/json&#x27;,
      },
      body: JSON.stringify({
        from:    &#x27;Meridian &lt;no-reply@meridian-hlag.vercel.app&gt;&#x27;,
        to:      [ADMIN_EMAIL],
        subject,
        text:    bodyText,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return new Response(`resend error: ${err}`, { status: 502 });
    }
    return new Response(&#x27;ok&#x27;);
  });
  ```

  Also write `supabase/functions/suggestion-notify/README.md` with deploy instructions for Davis:
  - `supabase secrets set RESEND_API_KEY=... ADMIN_EMAIL=davis@...`
  - `supabase functions deploy suggestion-notify`
  - Note that Resend requires a verified sender domain; if `meridian-hlag.vercel.app` isn&#x27;t verified, Davis may need to use a different `from` address or set up domain verification.

  Acceptance: both files exist.

- [ ] **Task 16: Write `supabase/migrations/007_suggestion_notifications.sql`**

  ```sql
  -- Database webhook: fire the suggestion-notify function on every INSERT.
  -- Uses pg_net (Supabase built-in) to POST to the function URL.
  -- Davis must set the setting before running:
  --   ALTER DATABASE postgres SET &quot;app.suggestion_notify_url&quot; = &#x27;&lt;function URL&gt;&#x27;;
  -- Get the URL from Supabase dashboard → Edge Functions → suggestion-notify.

  CREATE OR REPLACE FUNCTION notify_new_suggestion()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  DECLARE
    notify_url text;
  BEGIN
    notify_url := current_setting(&#x27;app.suggestion_notify_url&#x27;, true);
    IF notify_url IS NULL OR notify_url = &#x27;&#x27; THEN
      RETURN NEW; -- misconfig: skip silently, don&#x27;t block the insert
    END IF;

    PERFORM net.http_post(
      url := notify_url,
      body := jsonb_build_object(&#x27;record&#x27;, row_to_json(NEW)),
      headers := &#x27;{&quot;Content-Type&quot;:&quot;application/json&quot;}&#x27;::jsonb
    );
    RETURN NEW;
  END;
  $$;

  DROP TRIGGER IF EXISTS trg_notify_new_suggestion ON suggestions;
  CREATE TRIGGER trg_notify_new_suggestion
    AFTER INSERT ON suggestions
    FOR EACH ROW EXECUTE FUNCTION notify_new_suggestion();
  ```

  Note in progress.txt that Davis must (1) deploy the Edge Function, (2) set the `app.suggestion_notify_url` database setting to the deployed function URL, (3) run this migration. The trigger fails silently if the setting isn&#x27;t present, so the order of operations doesn&#x27;t matter much — but email delivery won&#x27;t start until all three are done.

  Acceptance: file exists, Ralph logs a line to progress.txt saying &quot;Phase 5 complete; Davis must deploy + configure to activate.&quot;

## Testing Strategy

- Primary: `npx vite build 2&gt;&amp;1 | tail -8` after every task.
- Secondary: grep checks noted in each task.
- Manual smoke: after Phase 4, Davis logs in as an agent (or impersonates via SQL), submits a suggestion, switches to admin view, changes status, promotes a category. Log the outcome in progress.txt.
- No automated test suite. Do not add one in this task.

## Out of Scope

- Voting / upvoting on suggestions.
- Comments or replies on suggestions.
- Public roadmap view showing `in_progress` suggestions to all agents.
- Email notifications to the submitter when their status changes (only Davis-facing notifications in Phase 5).
- Slack or Teams notifications.
- More than one attachment per suggestion.
- Attachments on non-bug suggestion types.
- Video, PDF, or document attachments (images only).
- Attachment retry UI — if the upload fails, the suggestion still submits and the agent can submit a new one if they care enough.
- Attachment editing or replacement after submission.
- Automatic deletion of orphan Storage objects — admins prune via service-role if needed.
- Editing suggestions after submission.
- Deleting suggestions (append-only by design).
- Bulk status updates in admin view.
- Export to CSV / spreadsheet.
- Touching CT or MPL widgets.

## Notes for Ralph

### Patterns to follow

1. **Inline styles + CSS variables.** Match `Dashboard.jsx`&#x27;s `const C = { bg: &#x27;var(--bg-card)&#x27;, ... }` pattern. No Tailwind, no CSS modules, no styled-components.
2. **Cancellation in effects.** `let cancelled = false; ... if (cancelled) return; ... return () =&gt; { cancelled = true }`. Mandatory in both hooks.
3. **Sentence case everywhere.** &quot;New suggestion&quot; not &quot;New Suggestion&quot; or &quot;NEW SUGGESTION&quot;. Applies to button labels, badge text, headings.
4. **Form validation mirrors DB constraints.** If the DB says title 3–120 chars, the form enforces the same — don&#x27;t rely on DB errors to guide users.
5. **Error handling through inline messages.** Don&#x27;t use `alert()`. Show errors inside the form or near the action button.
6. **No new dependencies.** Everything in this track ships with the existing package.json.

### Gotchas

7. **RLS on INSERT uses `WITH CHECK (user_id = auth.uid())`.** If the form writes with `return=representation` instead of `return=minimal`, anon-style 401s can appear. Use `.select(&#x27;id&#x27;).single()` which is fine — the authenticated role is allowed to SELECT its own inserts.
8. **The `promote_suggestion` RPC is `SECURITY DEFINER`.** It bypasses RLS to write to `mpl_categories`, which is why the role check inside the function is critical. Do NOT remove that check.
9. **`display_order` on `mpl_categories` may have gaps.** The `COALESCE(MAX(display_order) + 1, 1)` pattern is intentional — don&#x27;t &quot;fix&quot; it by trying to reindex.
10. **`parent_category_id` in subcategory suggestions** references `mpl_categories.id`, not `mpl_subcategories.id`. Name it consistently across UI and DB.
11. **The admin&#x27;s own suggestions are still visible to him as an agent.** If Davis submits a test suggestion, it appears in his Feedback tab&#x27;s &quot;My suggestions&quot; list AND in the Admin tab. This is correct behavior — not a bug.
12. **Role gating lives in Navbar.jsx first.** If the Admin tab button is mistakenly rendered for non-admins, the RLS policy still blocks writes, but the UI is broken. Test this by temporarily setting your own role to &#x27;agent&#x27; via SQL and confirming the tab disappears.
13. **Phase 5 is optional.** Look for `phase_5_enabled: true` in progress.txt before running Task 15. If absent, stop after Task 14 and output `&lt;promise&gt;COMPLETE&lt;/promise&gt;`.

### Attachment gotchas

14. **Storage RLS is a separate policy system from table RLS.** The `suggestion_attachments` table has its own policies (via `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`). The Storage bucket has policies on `storage.objects`. Both must be present. If uploads fail with a 403 but DB inserts succeed, the Storage policy is missing or the path doesn&#x27;t start with `auth.uid()::text`.
15. **`storage.foldername(name)[1]` returns the first path segment.** The upload path convention is `${user_id}/${suggestion_id}/${filename}`, so the first segment IS the user_id. Do not change this path shape without also updating the Storage RLS policy.
16. **`URL.createObjectURL` leaks memory if not revoked.** Every `createObjectURL` needs a matching `revokeObjectURL` when the image changes or the component unmounts. Use `useEffect` cleanup in `AttachmentUploader` and `AttachmentPreview`.
17. **Signed URLs are time-limited.** 5-minute expiry on `AttachmentPreview`. If the admin keeps a detail panel open longer than that, the image will 403. This is acceptable — closing and re-opening the panel regenerates the URL.
18. **Canvas `toBlob` is async and can return null on failure.** Handle the null case by showing an error, not by silently leaving the uploader in &quot;ready&quot; state.
19. **`image/gif` is allowed but canvas re-encode destroys animation.** A GIF will end up as a static JPEG after compression. This is the right tradeoff for the MVP (consistent format, stripped EXIF, reliable size). If it ever matters, a future iteration can short-circuit GIF uploads past the canvas step — but not in this one.
20. **DB insert order matters for orphan prevention.** Upload first, then insert the row. If you flip the order and the Storage upload fails, you leave a DB row pointing at nothing. The flow in `SuggestionForm` must be: `createSuggestion` → `uploadAttachmentBlob` → `createAttachmentRow`. If upload succeeds but the final DB insert fails, the Storage file is orphaned — acceptable because (a) it&#x27;s bounded to 5MB, (b) the unique constraint on `suggestion_id` blocks re-inserts, (c) Davis can prune via service-role. Do NOT attempt to roll back the Storage upload automatically.
21. **The bucket must exist before any upload.** The `INSERT INTO storage.buckets` in migration 006 creates it. If Davis runs the migration in pieces and skips that block, uploads will fail with a nonspecific error. Verify bucket presence on startup if it helps debugging.

### When something breaks

- Build fails after Task 13: the most likely cause is a missing import of the new tabs in Dashboard.jsx. Re-read the task, add the import, continue.
- `promote_suggestion` returns `not authorized`: your session isn&#x27;t `admin`. Either your role is wrong in `platform_users`, or you&#x27;re hitting the function from a service-role context where `auth.uid()` is null.
- `promote_suggestion` returns `suggestion not found`: the row exists but the RLS SELECT policy is blocking the `FOR UPDATE` lookup. The `SECURITY DEFINER` setting should bypass this — if it doesn&#x27;t, verify the function was created with `SECURITY DEFINER`.
- Categories don&#x27;t show up in the MPL widget after promotion: agents need to refresh / reload their categories. This is expected — the widget caches on mount. Do NOT add realtime category updates in this track; that&#x27;s a separate concern.
- Attachment upload returns `403 new row violates row-level security policy`: the path doesn&#x27;t start with the user&#x27;s UUID. Check that `SuggestionForm` is building the path as `${user.id}/${suggestion.id}/${filename}`, not `${suggestion.id}/...` or anything else.
- Attachment upload returns `400 Bucket not found`: migration 006&#x27;s `INSERT INTO storage.buckets` block didn&#x27;t run. Have Davis re-run just that block.
- `createAttachmentRow` returns a unique-constraint violation: a prior submit left a row for this `suggestion_id`. This shouldn&#x27;t happen because `suggestion_id` is generated fresh per submit — if it does, there&#x27;s a bug in the form resubmitting with the same suggestion id. Log it, do not retry.
- `AttachmentPreview` renders but the image is broken: the signed URL expired (5-minute TTL). Admin closing and re-opening the row regenerates. Not a code bug.
- Compressed blob is larger than the original: this can happen on already-optimized PNGs with transparency, because the re-encode to JPEG adds overhead. The 5MB cap is enforced pre-compression so this doesn&#x27;t create a validation failure, but the user may notice the size display. Acceptable for MVP — don&#x27;t add &quot;use original if smaller&quot; logic.
