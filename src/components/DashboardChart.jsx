import { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart, Bar,
  AreaChart, Area,
  XAxis, YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

const METRIC_CONFIG = {
  resolved: { label: 'Resolved', color: '#16a34a' },
  reclass: { label: 'Reclassified', color: '#dc2626' },
  calls: { label: 'Calls', color: '#0284c7' },
  notACase: { label: 'Not a Case', color: '#6b7280' },
  processes: { label: 'Processes', color: '#60a5fa' },
  casesAndCalls: { label: 'Cases & Calls', color: '#7c3aed' },
  totalActivity: { label: 'Total Activity', color: '#f59e0b' },
};

export default function DashboardChart({ rows, activeMetric, chartType, onChartTypeChange }) {
  const config = METRIC_CONFIG[activeMetric] || METRIC_CONFIG.resolved;
  const metricColor = config.color;
  const metricLabel = config.label;

  const axisStyle = { fill: 'var(--text-dim)', fontSize: 11 };

  const toggleBtnStyle = (active) => ({
    height: 30,
    padding: '0 12px',
    borderRadius: 6,
    border: active ? 'none' : '1px solid var(--border)',
    background: active ? 'var(--color-mmark)' : 'var(--card-bg-subtle)',
    color: active ? '#fff' : 'var(--text-sec)',
    fontSize: 12,
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
    transition: 'all var(--motion-fast)',
  });

  const cardStyle = {
    background: 'var(--card-bg-subtle)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
    boxShadow: 'var(--shadow-subtle)',
    animation: 'fade-in-up 0.6s ease-out forwards',
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  };

  const titleStyle = {
    color: 'var(--text-pri)',
    fontSize: 15,
    fontWeight: 700,
  };

  const chart = chartType === 'area' ? (
    <AreaChart data={rows}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
      <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} />
      <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
      <Tooltip
        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-pri)' }}
        labelStyle={{ color: 'var(--text-sec)' }}
      />
      <Area
        type="monotone"
        dataKey={activeMetric}
        stroke={metricColor}
        fill={metricColor}
        fillOpacity={0.2}
        strokeWidth={2}
      />
    </AreaChart>
  ) : (
    <BarChart data={rows}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" />
      <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} />
      <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
      <Tooltip
        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-pri)' }}
        labelStyle={{ color: 'var(--text-sec)' }}
      />
      <Bar dataKey={activeMetric} fill={metricColor} radius={[4, 4, 0, 0]} />
    </BarChart>
  );

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>Trend: {metricLabel}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={toggleBtnStyle(chartType === 'bar')} onClick={() => onChartTypeChange('bar')}>
            Bar
          </button>
          <button style={toggleBtnStyle(chartType === 'area')} onClick={() => onChartTypeChange('area')}>
            Line
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        {chart}
      </ResponsiveContainer>
    </div>
  );
}
