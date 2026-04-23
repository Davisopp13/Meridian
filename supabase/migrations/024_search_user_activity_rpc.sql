-- Unified activity search across case_events and mpl_entries for a single user.
-- Matches ILIKE on case_number (from joined ct_cases), category name, and note.
-- Hard limit 50 rows. Ordered by timestamp desc.
create or replace function search_user_activity(
  p_user_id uuid,
  p_query   text,
  p_limit   int default 50
)
returns table (
  id            uuid,
  src           text,         -- 'case' | 'mpl'
  type          text,
  case_number   text,
  sf_case_id    text,
  category_id   uuid,
  category_name text,
  duration_s    int,
  minutes       int,
  rfc           boolean,
  note          text,
  ts            timestamptz
)
language sql
stable
security invoker
as $$
  with q as (select '%' || coalesce(p_query, '') || '%' as like_pat)
  -- Case events
  select
    ce.id,
    'case'::text as src,
    ce.type,
    cc.case_number,
    ce.sf_case_id,
    null::uuid as category_id,
    null::text as category_name,
    cc.duration_s,
    null::int as minutes,
    ce.rfc,
    ce.note,
    ce.timestamp as ts
  from case_events ce
  left join ct_cases cc on cc.id = ce.session_id
  cross join q
  where ce.user_id = p_user_id
    and (
      ce.note        ilike q.like_pat or
      cc.case_number ilike q.like_pat
    )

  union all

  -- MPL entries
  select
    me.id,
    'mpl'::text as src,
    'Process'::text as type,
    null::text as case_number,
    null::text as sf_case_id,
    me.category_id,
    mc.name as category_name,
    null::int as duration_s,
    me.minutes,
    false as rfc,
    me.note,
    me.created_at as ts
  from mpl_entries me
  left join mpl_categories mc on mc.id = me.category_id
  cross join q
  where me.user_id = p_user_id
    and (
      me.note ilike q.like_pat or
      mc.name ilike q.like_pat
    )

  order by ts desc
  limit p_limit
$$;

-- Lock down: only the authenticated user can search their own activity.
-- RLS on the underlying tables already restricts row visibility by user_id,
-- and security invoker means the RPC executes as the calling user.
grant execute on function search_user_activity(uuid, text, int) to authenticated;
