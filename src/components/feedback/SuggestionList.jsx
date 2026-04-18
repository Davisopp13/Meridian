import SuggestionRow from './SuggestionRow.jsx';

export default function SuggestionList({ suggestions, onRowClick, showSubmitter, emptyMessage }) {
  if (!suggestions || suggestions.length === 0) {
    return (
      <div style={{
        color: 'var(--text-dim)',
        fontSize: 14,
        textAlign: 'center',
        padding: '24px 0',
      }}>
        {emptyMessage || 'No suggestions.'}
      </div>
    );
  }

  return (
    <div>
      {suggestions.map(s => (
        <SuggestionRow
          key={s.id}
          suggestion={s}
          onClick={onRowClick}
          showSubmitter={showSubmitter}
        />
      ))}
    </div>
  );
}
