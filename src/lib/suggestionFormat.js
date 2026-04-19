/**
 * Format a single suggestion as a markdown block optimized for
 * pasting into a Claude conversation.
 *
 * Shape:
 *   ## [TYPE] Title
 *   Submitted 2026-04-19 14:22 ET by FullName (email@domain)
 *   Status: Label
 *   Has attachment: yes/no   (only for bug type)
 *
 *   ### Body
 *   ...body text...
 *
 *   ### Admin notes
 *   ...notes or "(none yet)"...
 */
export function formatSuggestionForClaude(suggestion, { hasAttachment = null } = {}) {
  const typeTag     = (suggestion.type || 'other').toUpperCase();
  const submitted   = formatETTimestamp(suggestion.created_at);
  const submitter   = suggestion.platform_users;
  const name        = submitter?.full_name ?? submitter?.email ?? 'Unknown';
  const email       = submitter?.email ?? '—';
  const statusLabel = formatStatusLabel(suggestion.status);

  const lines = [];
  lines.push(`## [${typeTag}] ${suggestion.title}`);
  lines.push(`Submitted ${submitted} ET by ${name} (${email})`);
  lines.push(`Status: ${statusLabel}`);

  // Only surface attachment info for bug type — for other types
  // the concept doesn't apply and mentioning it adds noise.
  if (suggestion.type === 'bug' && hasAttachment !== null) {
    lines.push(`Has attachment: ${hasAttachment ? 'yes' : 'no'}`);
  }

  // Extra metadata for category/subcategory so the type-specific
  // fields aren't lost.
  if (suggestion.type === 'category' || suggestion.type === 'subcategory') {
    if (suggestion.haulage_type) {
      lines.push(`Haulage: ${suggestion.haulage_type}`);
    }
    if (suggestion.type === 'subcategory' && suggestion.parent_category_id) {
      lines.push(`Parent category id: ${suggestion.parent_category_id}`);
    }
  }

  lines.push('');
  lines.push('### Body');
  lines.push(suggestion.body?.trim() || '(empty)');
  lines.push('');
  lines.push('### Admin notes');
  lines.push(suggestion.admin_notes?.trim() || '(none yet)');

  return lines.join('\n');
}

/**
 * Format a filtered list of suggestions as a compact markdown block
 * for bulk paste-to-Claude workflows.
 *
 * Each entry is a numbered H3 header + one metadata line + blockquoted body.
 * Bodies are truncated at 240 chars with an ellipsis marker to keep the
 * full list pasteable in a single message without blowing context.
 */
export function formatSuggestionListForClaude(suggestions, filterContext = {}) {
  const filterParts = [];
  if (filterContext.statusFilter && filterContext.statusFilter !== 'all') {
    filterParts.push(`status=${filterContext.statusFilter}`);
  }
  if (filterContext.typeFilter && filterContext.typeFilter !== 'all') {
    filterParts.push(`type=${filterContext.typeFilter}`);
  }
  const filterLine = filterParts.length
    ? filterParts.join(', ')
    : '(none — showing all)';

  const lines = [];
  lines.push('## Suggestions for Claude review');
  lines.push('');
  lines.push(`Filters: ${filterLine}`);
  lines.push(`Total: ${suggestions.length} ${suggestions.length === 1 ? 'suggestion' : 'suggestions'}`);
  lines.push('');

  suggestions.forEach((s, idx) => {
    const typeLabel = (s.type || 'other').charAt(0).toUpperCase() + (s.type || 'other').slice(1);
    const submitter = s.platform_users;
    const name      = submitter?.full_name ?? submitter?.email ?? 'Unknown';
    const ts        = formatETTimestamp(s.created_at);
    const hasAtt    = s.type === 'bug' ? ' · attachment' : '';
    const preview   = (s.body ?? '').trim().replace(/\s+/g, ' ').slice(0, 240);
    const truncated = (s.body ?? '').trim().length > 240 ? '…' : '';

    lines.push(`### ${idx + 1}. ${s.title}`);
    lines.push(`${typeLabel} · ${name} · ${ts} · status=${s.status}${hasAtt}`);
    lines.push(`> ${preview}${truncated}`);
    lines.push('');
  });

  return lines.join('\n').trimEnd();
}

// --- Internal helpers ---

/**
 * Format a timestamp as "YYYY-MM-DD HH:MM" in America/New_York timezone.
 * Uses Intl.DateTimeFormat for reliable timezone conversion.
 */
function formatETTimestamp(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day} ${lookup.hour}:${lookup.minute}`;
}

function formatStatusLabel(status) {
  switch (status) {
    case 'new':          return 'New';
    case 'acknowledged': return 'Acknowledged';
    case 'in_progress':  return 'In progress';
    case 'shipped':      return 'Shipped';
    case 'wont_fix':     return "Won't fix";
    default:             return status || 'Unknown';
  }
}
