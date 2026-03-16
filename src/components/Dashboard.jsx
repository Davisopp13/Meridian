import { useState } from 'react';
import Navbar from './Navbar.jsx';
import { useDashboardStats } from '../hooks/useDashboardStats.js';
import DashboardStatCard from './DashboardStatCard.jsx';
import DashboardTable from './DashboardTable.jsx';
import DashboardChart from './DashboardChart.jsx';
import BookmarkletModal from './BookmarkletModal.jsx';
import ActivityLog from './ActivityLog.jsx';
import { Check, CornerDownLeft, Phone, Minus, ClipboardList, Timer, Zap } from 'lucide-react';

const C = {
  bg: 'var(--bg-card)',
  bgDeep: 'var(--bg-deep)',
  mBtn: 'var(--color-mbtn)',
  mMark: 'var(--color-mmark)',
  divider: 'var(--divider)',
  border: 'var(--border)',
  cardBg: 'var(--card-bg-subtle)',
  textPri: 'var(--text-pri)',
  textSec: 'var(--text-sec)',
  textDim: 'var(--text-dim)',
};

const PERIODS = [
  { key: 'this_week', label: 'This Week' },
  { key: 'last_week', label: 'Last Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'ytd', label: 'Year To Date' },
];

const CHART_PERIODS = new Set(['this_month', 'last_month', 'ytd']);

const METRICS = [
  { key: 'resolved', label: 'Resolved', color: '#16a34a', icon: <Check size={18} strokeWidth={2.5} /> },
  { key: 'reclass', label: 'Reclassified', color: '#dc2626', icon: <CornerDownLeft size={18} strokeWidth={2.5} /> },
  { key: 'calls', label: 'Calls', color: '#0d9488', icon: <Phone size={18} strokeWidth={2.5} /> },
  { key: 'notACase', label: 'Not a Case', color: '#6b7280', icon: <Minus size={18} strokeWidth={2.5} /> },
  { key: 'casesAndCalls', label: 'Cases & Calls', color: '#003087', icon: <ClipboardList size={18} strokeWidth={2.5} /> },
  { key: 'processes', label: 'Processes', color: '#60a5fa', icon: <Timer size={18} strokeWidth={2.5} /> },
  { key: 'totalActivity', label: 'Total Activity', color: '#E8540A', icon: <Zap size={18} strokeWidth={2.5} /> },
];

export default function Dashboard({ user, profile, onLaunchPip }) {
  const [period, setPeriod] = useState('this_week');
  const [activeMetric, setActiveMetric] = useState('resolved');
  const [chartType, setChartType] = useState('bar');
  const [showBookmarkletModal, setShowBookmarkletModal] = useState(false);

  const stats = useDashboardStats({ userId: user.id, period });

  const bodyStyle = {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '32px 24px',
    boxSizing: 'border-box',
    width: '100%',
    animation: 'fade-in-up 0.4s ease-out forwards',
  };

  const periodTabsStyle = {
    display: 'flex',
    gap: 8,
    marginBottom: 24,
    flexWrap: 'wrap',
  };

  const statCardsStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  };

  function tabStyle(active) {
    return {
      height: 40,
      padding: '0 20px',
      borderRadius: 20,
      border: 'none',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: active ? 700 : 500,
      background: active ? C.mMark : 'rgba(255,255,255,0.06)',
      color: active ? '#fff' : C.textSec,
      transition: 'background 150ms, color 150ms',
    };
  }

  return (
    <div style={{ background: C.bgDeep, minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '"Segoe UI", system-ui, sans-serif' }}>
      <Navbar user={user} profile={profile} onLaunchPip={onLaunchPip} setShowBookmarkletModal={setShowBookmarkletModal} />


      {/* Body */}
      <div style={bodyStyle}>
        {/* Activity Log */}
        <div style={{ marginBottom: 20 }}>
          <ActivityLog userId={user.id} />
        </div>

        {/* Period tabs */}
        <div style={periodTabsStyle}>
          {PERIODS.map(p => (
            <button
              key={p.key}
              style={tabStyle(period === p.key)}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Stat cards */}
        <div style={statCardsStyle}>
          {METRICS.map(m => (
            <DashboardStatCard
              key={m.key}
              label={m.label}
              value={stats.loading ? '—' : stats[m.key]}
              color={m.color}
              icon={m.icon}
              active={activeMetric === m.key}
              onClick={() => setActiveMetric(m.key)}
            />
          ))}
        </div>

        {/* Table */}
        {stats.loading ? (
          <SkeletonTable />
        ) : (
          <DashboardTable rows={stats.dailyRows} />
        )}

        {/* Chart — only for monthly/YTD periods */}
        {CHART_PERIODS.has(period) && !stats.loading && (
          <div style={{ marginTop: 24 }}>
            <DashboardChart
              rows={stats.dailyRows}
              activeMetric={activeMetric}
              chartType={chartType}
              onChartTypeChange={setChartType}
            />
          </div>
        )}
      </div>
      {showBookmarkletModal && (
        <BookmarkletModal onClose={() => setShowBookmarkletModal(false)} user={user} />
      )}
    </div>
  );
}

function SkeletonTable() {
  const containerStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12,
    overflow: 'hidden',
  };

  const skeletonRowStyle = {
    height: 44,
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    gap: 12,
  };

  const skeletonBarStyle = (width) => ({
    height: 12,
    width,
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 4,
    animation: 'meridian-pulse 1.4s ease-in-out infinite',
  });

  return (
    <div style={containerStyle}>
      <style>{`
        @keyframes meridian-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fade-in-up { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
      `}</style>
      {[0, 1, 2].map(i => (
        <div key={i} style={skeletonRowStyle}>
          <div style={skeletonBarStyle('60px')} />
          <div style={skeletonBarStyle('40px')} />
          <div style={skeletonBarStyle('40px')} />
          <div style={skeletonBarStyle('40px')} />
          <div style={skeletonBarStyle('40px')} />
          <div style={skeletonBarStyle('40px')} />
          <div style={skeletonBarStyle('40px')} />
          <div style={skeletonBarStyle('40px')} />
        </div>
      ))}
    </div>
  );
}
