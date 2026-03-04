import { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart, Bar,
  AreaChart, Area,
  XAxis, YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

const C = {
  textPri:    'rgba(255,255,255,0.93)',
  textSec:    'rgba(255,255,255,0.45)',
  textDim:    'rgba(255,255,255,0.25)',
  divider:    'rgba(255,255,255,0.08)',
  border:     'rgba(255,255,255,0.12)',
  cardBg:     'rgba(255,255,255,0.04)',
  mMark:      '#E8540A',
};

const METRIC_CONFIG = {
  resolved:      { label: 'Resolved',        color: '#16a34a' },
  reclass:       { label: 'Reclassified',     color: '#dc2626' },
  calls:         { label: 'Calls',            color: '#0284c7' },
  notACase:      { label: 'Not a Case',       color: '#6b7280' },
  processes:     { label: 'Processes',        color: '#60a5fa' },
  casesAndCalls: { label: 'Cases & Calls',    color: '#7c3aed' },
  totalActivity: { label: 'Total Activity',   color: '#f59e0b' },
};

export default function DashboardChart({ rows, activeMetric, chartType, onChartTypeChange }) {
  const config = METRIC_CONFIG[activeMetric] || METRIC_CONFIG.resolved;
  const metricColor = config.color;
  const metricLabel = config.label;

  const axisStyle = { fill: C.textDim, fontSize: 11 };

  const toggleBtnStyle = (active) => ({
    height: 30,
    padding: '0 12px',
    borderRadius: 6,
    border: active ? 'none' : `1px solid ${C.border}`,
    background: active ? C.mMark : C.cardBg,
    color: active ? '#fff' : C.textSec,
    fontSize: 12,
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
    transition: 'all 150ms',
  });

  const cardStyle = {
    background:   C.cardBg,
    border:       `1px solid ${C.border}`,
    borderRadius: 12,
    padding:      20,
    marginTop:    24,
  };

  const headerStyle = {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   12,
  };

  const titleStyle = {
    color:      '#fff',
    fontSize:   15,
    fontWeight: 700,
  };

  const chart = chartType === 'area' ? (
    <AreaChart data={rows}>
      <CartesianGrid strokeDasharray="3 3" stroke={C.divider} />
      <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} />
      <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
      <Tooltip
        contentStyle={{ background: '#1a1a2e', border: `1px solid ${C.border}`, borderRadius: 8, color: '#fff' }}
        labelStyle={{ color: C.textSec }}
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
      <CartesianGrid strokeDasharray="3 3" stroke={C.divider} />
      <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} />
      <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
      <Tooltip
        contentStyle={{ background: '#1a1a2e', border: `1px solid ${C.border}`, borderRadius: 8, color: '#fff' }}
        labelStyle={{ color: C.textSec }}
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
