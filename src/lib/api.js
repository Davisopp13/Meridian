import { supabase } from './supabase.js'

export async function logCaseEvent({ userId, type, sessionId = null, excluded = false, rfc = false }) {
  return supabase.from('case_events').insert({
    user_id: userId,
    type,
    session_id: sessionId,
    excluded,
    rfc,
  })
}

export async function logMplEntry({ userId, categoryId, subcategoryId, minutes, source = 'mpl_widget' }) {
  return supabase.from('mpl_entries').insert({
    user_id: userId,
    category_id: categoryId,
    subcategory_id: subcategoryId,
    minutes,
    source,
  })
}

export async function fetchProfile(userId) {
  return supabase.from('platform_users').select('*').eq('id', userId).single()
}

// Preferred — resolves haulage_type from the teams table via team_id.
export async function fetchCategoriesForTeamId(teamId) {
  if (!teamId) return { data: [], error: null }
  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .select('haulage_type')
    .eq('id', teamId)
    .single()
  if (teamErr || !team) return { data: [], error: teamErr }

  return supabase
    .from('mpl_categories')
    .select('id, name, team, display_order, mpl_subcategories(id, name, display_order)')
    .eq('team', team.haulage_type)
    .eq('is_active', true)
    .order('display_order')
    .order('display_order', { referencedTable: 'mpl_subcategories' })
}

// DEPRECATED — kept until every call site passes team_id.
export async function fetchCategoriesForTeam(team) {
  if (!team) return { data: [], error: null }
  return supabase
    .from('mpl_categories')
    .select('id, name, team, display_order, mpl_subcategories(id, name, display_order)')
    .eq('team', team)
    .eq('is_active', true)
    .order('display_order')
    .order('display_order', { referencedTable: 'mpl_subcategories' })
}

/**
 * Fetch all MPL category names across all teams.
 * Returns { data: { [categoryId]: categoryName }, error }.
 * Used by useTeamInsights to resolve category_id keys into display names.
 */
export async function fetchAllCategoryNames() {
  const { data, error } = await supabase
    .from('mpl_categories')
    .select('id, name')
    .eq('is_active', true);

  if (error) return { data: null, error };

  const map = {};
  for (const row of (data || [])) {
    map[row.id] = row.name;
  }
  return { data: map, error: null };
}

export async function fetchSupervisedTeams(supervisorId) {
  return supabase
    .from('supervisor_teams')
    .select('team_id, teams!inner(id, name, department_id, haulage_type)')
    .eq('supervisor_id', supervisorId)
}

export async function createBarSession(userId) {
  return supabase.from('bar_sessions').insert({ user_id: userId }).select('id').single()
}

export async function endBarSession({ sessionId, totalCases, totalProcesses }) {
  return supabase
    .from('bar_sessions')
    .update({
      ended_at: new Date().toISOString(),
      total_cases: totalCases,
      total_processes: totalProcesses,
    })
    .eq('id', sessionId)
}

export async function createSuggestion({
  userId, type, title, body,
  haulageType = null, parentCategoryId = null,
}) {
  return supabase.from('suggestions').insert({
    user_id: userId,
    type,
    title,
    body,
    haulage_type: haulageType,
    parent_category_id: parentCategoryId,
  }).select('id').single();
}

export async function fetchMySuggestions(userId) {
  return supabase.from('suggestions')
    .select('id, type, title, body, status, created_at, updated_at, resolved_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
}

export async function fetchAllSuggestions({ statusFilter = null, typeFilter = null } = {}) {
  let q = supabase.from('suggestions')
    .select(`
      id, user_id, type, title, body,
      haulage_type, parent_category_id,
      status, admin_notes,
      created_at, updated_at, resolved_at,
      platform_users!inner (full_name, email)
    `)
    .order('created_at', { ascending: false });
  if (statusFilter) q = q.eq('status', statusFilter);
  if (typeFilter)   q = q.eq('type', typeFilter);
  return q;
}

export async function updateSuggestion({ id, status = null, adminNotes = null }) {
  const patch = {};
  if (status !== null) {
    patch.status = status;
    if (status === 'shipped' || status === 'wont_fix') {
      patch.resolved_at = new Date().toISOString();
    }
  }
  if (adminNotes !== null) patch.admin_notes = adminNotes;
  return supabase.from('suggestions').update(patch).eq('id', id);
}

export async function promoteSuggestion(suggestionId) {
  return supabase.rpc('promote_suggestion', { p_suggestion_id: suggestionId });
}

export async function uploadAttachmentBlob({ userId, suggestionId, blob, filename }) {
  const path = `${userId}/${suggestionId}/${filename}`;
  return supabase.storage
    .from('suggestion-attachments')
    .upload(path, blob, { contentType: blob.type, upsert: false });
}

export async function createAttachmentRow({ suggestionId, storagePath, mimeType, sizeBytes }) {
  return supabase.from('suggestion_attachments').insert({
    suggestion_id: suggestionId,
    storage_path: storagePath,
    mime_type: mimeType,
    size_bytes: sizeBytes,
  }).select('id').single();
}

export async function fetchAttachmentForSuggestion(suggestionId) {
  return supabase.from('suggestion_attachments')
    .select('id, storage_path, mime_type, size_bytes, created_at')
    .eq('suggestion_id', suggestionId)
    .maybeSingle();
}

export async function createSignedAttachmentUrl(storagePath, expiresSeconds = 300) {
  return supabase.storage
    .from('suggestion-attachments')
    .createSignedUrl(storagePath, expiresSeconds);
}

export async function fetchTeamAgents(teamIds) {
  if (!teamIds || teamIds.length === 0) return { data: [], error: null };
  return supabase
    .from('platform_users')
    .select('id, email, full_name, team_id')
    .in('team_id', teamIds)
    .eq('role', 'agent')
    .eq('onboarding_complete', true);
}

export async function fetchTeamCaseEvents({ userIds, from, to }) {
  if (!userIds || userIds.length === 0) return { data: [], error: null };
  return supabase
    .from('case_events')
    .select('type, excluded, timestamp, user_id')
    .in('user_id', userIds)
    .gte('timestamp', from)
    .lte('timestamp', to);
}

export async function fetchTeamMplEntries({ userIds, from, to }) {
  if (!userIds || userIds.length === 0) return { data: [], error: null };
  return supabase
    .from('mpl_entries')
    .select('created_at, minutes, category_id, user_id')
    .in('user_id', userIds)
    .gte('created_at', from)
    .lte('created_at', to);
}

export async function upsertMplActiveTimer({ userId, processId, categoryId, subcategoryId, startedAt, accumulatedSeconds, status }) {
  return supabase.from('mpl_active_timers').upsert({
    user_id: userId,
    process_id: processId,
    category_id: categoryId ?? null,
    subcategory_id: subcategoryId ?? null,
    started_at: startedAt,
    accumulated_seconds: accumulatedSeconds,
    status,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'process_id' })
}

export async function clearMplActiveTimer(processId) {
  return supabase.from('mpl_active_timers').delete().eq('process_id', processId)
}

export async function fetchMyActiveMplTimers(userId) {
  return supabase.from('mpl_active_timers').select('*').eq('user_id', userId).order('started_at', { ascending: false })
}
