import { ExternalLink } from 'lucide-react';
import { caseUrl } from '../lib/salesforce.js';

export default function CaseLink({ sfCaseId, showOnHover = true, size = 12 }) {
  const href = caseUrl(sfCaseId);
  if (!href) return null;

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    marginLeft: 6,
    borderRadius: 3,
    color: 'var(--text-dim)',
    opacity: showOnHover ? 0 : 1,
    transition: 'opacity var(--motion-fast), color var(--motion-fast), background var(--motion-fast)',
    flexShrink: 0,
    cursor: 'pointer',
    textDecoration: 'none',
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="case-link-icon"
      title="Open in Salesforce"
      aria-label="Open case in Salesforce"
      style={baseStyle}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--color-mmark)';
        e.currentTarget.style.background = 'var(--hover-surface)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--text-dim)';
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <ExternalLink size={size} strokeWidth={2} />
    </a>
  );
}
