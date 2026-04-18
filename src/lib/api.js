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
