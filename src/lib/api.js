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

// TODO(Track 2): replace team parameter with team_id once teams table exists
export async function fetchCategoriesForTeam(team) {
  return supabase
    .from('mpl_categories')
    .select('id, name, team, display_order, mpl_subcategories(id, name, display_order)')
    .eq('team', team)
    .eq('is_active', true)
    .order('display_order')
    .order('display_order', { referencedTable: 'mpl_subcategories' })
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
