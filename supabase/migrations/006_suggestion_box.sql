-- 1. suggestions table
CREATE TABLE IF NOT EXISTS suggestions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  type                text NOT NULL
                      CHECK (type IN ('bug','feature','category','subcategory','other')),
  title               text NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  body                text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  haulage_type        text NULL CHECK (haulage_type IS NULL OR haulage_type IN ('CH','MH')),
  parent_category_id  uuid NULL REFERENCES mpl_categories(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'new'
                      CHECK (status IN ('new','acknowledged','in_progress','shipped','wont_fix')),
  admin_notes         text NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz NULL,
  -- Shape constraint: category/subcategory suggestions must have a haulage_type.
  CONSTRAINT category_needs_haulage CHECK (
    type NOT IN ('category','subcategory') OR haulage_type IS NOT NULL
  ),
  -- Shape constraint: subcategory suggestions must reference a parent category.
  CONSTRAINT subcategory_needs_parent CHECK (
    type <> 'subcategory' OR parent_category_id IS NOT NULL
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
CREATE POLICY "users insert own suggestions" ON suggestions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Agents can read their own suggestions.
CREATE POLICY "users read own suggestions" ON suggestions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all suggestions.
CREATE POLICY "admins read all suggestions" ON suggestions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  );

-- Admins can update status / admin_notes / resolved_at.
CREATE POLICY "admins update suggestions" ON suggestions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
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
  IF caller_role <> 'admin' THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO s FROM suggestions WHERE id = p_suggestion_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'suggestion not found';
  END IF;

  IF s.type = 'category' THEN
    INSERT INTO mpl_categories (name, team, display_order)
    VALUES (
      s.title,
      s.haulage_type,
      COALESCE((SELECT MAX(display_order) + 1 FROM mpl_categories WHERE team = s.haulage_type), 1)
    )
    RETURNING id INTO new_cat_id;
  ELSIF s.type = 'subcategory' THEN
    INSERT INTO mpl_subcategories (category_id, name, display_order)
    VALUES (
      s.parent_category_id,
      s.title,
      COALESCE((SELECT MAX(display_order) + 1 FROM mpl_subcategories WHERE category_id = s.parent_category_id), 1)
    )
    RETURNING id INTO new_subcat_id;
  ELSE
    RAISE EXCEPTION 'only category/subcategory suggestions can be promoted';
  END IF;

  UPDATE suggestions
    SET status = 'shipped',
        resolved_at = now(),
        admin_notes = COALESCE(admin_notes, '') ||
                      CASE WHEN admin_notes IS NULL OR admin_notes = '' THEN '' ELSE E'\n\n' END ||
                      '[Promoted to live taxonomy at ' || now()::text || ']'
    WHERE id = p_suggestion_id;

  RETURN jsonb_build_object(
    'suggestion_id', p_suggestion_id,
    'promoted_type', s.type,
    'new_category_id', new_cat_id,
    'new_subcategory_id', new_subcat_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION promote_suggestion(uuid) TO authenticated;

-- 5. suggestion_attachments — one image per bug, referenced by suggestion_id.
CREATE TABLE IF NOT EXISTS suggestion_attachments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id  uuid NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
  storage_path   text NOT NULL,
  mime_type      text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp','image/gif')),
  size_bytes     integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- Enforce one image per suggestion.
  CONSTRAINT one_attachment_per_suggestion UNIQUE (suggestion_id)
);

CREATE INDEX IF NOT EXISTS suggestion_attachments_suggestion_id_idx
  ON suggestion_attachments(suggestion_id);

ALTER TABLE suggestion_attachments ENABLE ROW LEVEL SECURITY;

-- Submitter can INSERT an attachment for their own bug suggestions only.
CREATE POLICY "users insert own bug attachment" ON suggestion_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM suggestions s
      WHERE s.id = suggestion_attachments.suggestion_id
        AND s.user_id = auth.uid()
        AND s.type = 'bug'
    )
  );

-- Submitter can SELECT their own attachment rows.
CREATE POLICY "users read own attachments" ON suggestion_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM suggestions s
      WHERE s.id = suggestion_attachments.suggestion_id
        AND s.user_id = auth.uid()
    )
  );

-- Admins can SELECT all attachment rows.
CREATE POLICY "admins read all attachments" ON suggestion_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM platform_users pu
            WHERE pu.id = auth.uid() AND pu.role = 'admin')
  );

-- No UPDATE policy — attachments are immutable.
-- No DELETE policy on this table — ON DELETE CASCADE from suggestions
-- never fires anyway (suggestions themselves have no DELETE policy).

GRANT SELECT, INSERT ON suggestion_attachments TO authenticated;

-- 6. Storage bucket — private, with RLS policies on storage.objects
--    scoped to the 'suggestion-attachments' bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('suggestion-attachments', 'suggestion-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Upload policy: authenticated users can upload to a path starting with their own user_id.
-- Client convention: `${user_id}/${suggestion_id}/${filename}`.
CREATE POLICY "users upload to own path" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'suggestion-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read policy: submitter reads their own files, admins read all.
CREATE POLICY "users read own storage files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'suggestion-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM platform_users pu
                 WHERE pu.id = auth.uid() AND pu.role = 'admin')
    )
  );

-- No UPDATE / DELETE policies on storage.objects for this bucket.
-- Admins who need to prune can use service-role manually.

-- 7. Summary output
SELECT
  (SELECT COUNT(*) FROM suggestions)                         AS total_suggestions,
  (SELECT COUNT(*) FROM suggestion_attachments)              AS total_attachments,
  (SELECT COUNT(*) FROM platform_users WHERE role = 'admin') AS admin_count;
