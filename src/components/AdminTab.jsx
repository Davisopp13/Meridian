import { useState } from 'react';
import AdminTabs from './admin/AdminTabs.jsx';
import SuggestionsPanel from './admin/SuggestionsPanel.jsx';
import UsersPanel from './admin/UsersPanel.jsx';
import TeamsPanel from './admin/TeamsPanel.jsx';
import CategoriesPanel from './admin/CategoriesPanel.jsx';

const C = {
  textPri: 'var(--text-pri)',
  textSec: 'var(--text-sec)',
};

export default function AdminTab({ user, profile }) {
  const [activeTab, setActiveTab] = useState('users');

  if (profile?.role !== 'admin') {
    return (
      <div style={{ maxWidth: 560, margin: '80px auto', textAlign: 'center', padding: '0 20px' }}>
        <p style={{ color: C.textSec, fontSize: 15 }}>
          Not authorized. Admin access only.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
      <h2 style={{ color: C.textPri, fontSize: 22, fontWeight: 700, margin: '0 0 20px' }}>
        Admin
      </h2>

      <AdminTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div style={{ marginTop: 24 }}>
        {activeTab === 'users'       && <UsersPanel       user={user} profile={profile} />}
        {activeTab === 'teams'       && <TeamsPanel       user={user} profile={profile} />}
        {activeTab === 'suggestions' && <SuggestionsPanel user={user} profile={profile} />}
        {activeTab === 'categories'  && <CategoriesPanel  user={user} profile={profile} />}
      </div>
    </div>
  );
}
