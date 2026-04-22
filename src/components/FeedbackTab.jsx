import SuggestionForm from './feedback/SuggestionForm.jsx';
import SuggestionList from './feedback/SuggestionList.jsx';
import { useMySuggestions } from '../hooks/useMySuggestions.js';

export default function FeedbackTab({ user, profile }) {
  const { suggestions, loading, refetch } = useMySuggestions(user?.id);

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px' }}>
      <h2 style={{ color: 'var(--text-pri)', fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>
        Feedback
      </h2>
      <p style={{ color: 'var(--text-sec)', fontSize: 14, margin: '0 0 28px' }}>
        Submit a bug, request a feature, or suggest a new MPL category. We read everything.
      </p>

      <SuggestionForm
        user={user}
        profile={profile}
        onSubmitted={refetch}
      />

      <div style={{ marginTop: 36 }}>
        <h3 style={{ color: 'var(--text-pri)', fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>
          My suggestions
        </h3>
        {loading ? (
          <div style={{ color: 'var(--text-sec)', fontSize: 14, padding: '12px 0' }}>Loading…</div>
        ) : (
          <SuggestionList
            suggestions={suggestions}
            onRowClick={null}
            showSubmitter={false}
            emptyMessage="You haven't submitted anything yet."
          />
        )}
      </div>
    </div>
  );
}
