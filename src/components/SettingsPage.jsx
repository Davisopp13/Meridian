import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { getUserSettings } from '../lib/constants.js'
import { useTheme } from '../context/ThemeContext.jsx'

const C = {
  bg: 'var(--bg-deep)',
  card: 'var(--bg-card)',
  border: 'var(--border)',
  divider: 'var(--border)',
  textPri: 'var(--text-pri)',
  textSec: 'var(--text-sec)',
  textDim: 'var(--text-dim)',
  accent: 'var(--color-mmark)',
}

const STAT_OPTIONS = [
  { key: 'resolved',  label: '✓ Resolved' },
  { key: 'reclass',   label: '↩ Reclass' },
  { key: 'calls',     label: '☎ Calls' },
  { key: 'processes', label: '📋 Processes' },
  { key: 'total',     label: 'Total' },
]

const TOTAL_OPTIONS = [
  { key: 'resolved', label: 'Resolved' },
  { key: 'reclass',  label: 'Reclass' },
  { key: 'calls',    label: 'Calls' },
]

const PIP_POSITIONS = [
  { key: 'bottom-right', label: 'Bottom Right', col: 1, row: 1 },
  { key: 'bottom-left',  label: 'Bottom Left',  col: 0, row: 1 },
  { key: 'top-right',    label: 'Top Right',    col: 1, row: 0 },
  { key: 'top-left',     label: 'Top Left',     col: 0, row: 0 },
]

function SectionHeading({ title, description }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.textPri, marginBottom: 4 }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: 11, color: C.textSec, lineHeight: 1.5 }}>{description}</div>
      )}
    </div>
  )
}

function Section({ children }) {
  return (
    <div style={{
      padding: '24px 0',
      borderBottom: `1px solid ${C.divider}`,
    }}>
      {children}
    </div>
  )
}

function CheckRow({ label, checked, onChange, disabled }) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 0',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
    }}>
      <div style={{
        width: 18,
        height: 18,
        borderRadius: 4,
        border: `1.5px solid ${checked ? C.accent : 'rgba(255,255,255,0.2)'}`,
        background: checked ? C.accent : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.15s ease',
      }}>
        {checked && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        style={{ display: 'none' }}
      />
      <span style={{ fontSize: 13, color: C.textPri }}>{label}</span>
    </label>
  )
}

function RadioRow({ label, checked, onChange, disabled, badge }) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 0',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
    }}>
      <div style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        border: `1.5px solid ${checked ? C.accent : 'rgba(255,255,255,0.2)'}`,
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.15s ease',
      }}>
        {checked && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent }} />
        )}
      </div>
      <input
        type="radio"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        style={{ display: 'none' }}
      />
      <span style={{ fontSize: 13, color: C.textPri }}>{label}</span>
      {badge && (
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: C.textDim,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 4,
          padding: '1px 6px',
          marginLeft: 4,
        }}>{badge}</span>
      )}
    </label>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        background: checked ? C.accent : 'rgba(255,255,255,0.1)',
        border: `1.5px solid ${checked ? C.accent : 'rgba(255,255,255,0.15)'}`,
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.2s ease',
        flexShrink: 0,
      }}
    >
      <div style={{
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#fff',
        position: 'absolute',
        top: 1,
        left: checked ? 20 : 1,
        transition: 'left 0.2s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </div>
  )
}

function PipPositionDiagram({ selected, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* Mini screen diagram */}
      <div style={{
        width: 96,
        height: 64,
        border: '1.5px solid rgba(255,255,255,0.2)',
        borderRadius: 6,
        background: 'rgba(255,255,255,0.03)',
        position: 'relative',
        flexShrink: 0,
      }}>
        {PIP_POSITIONS.map(p => (
          <div
            key={p.key}
            onClick={() => onSelect(p.key)}
            style={{
              width: 14,
              height: 10,
              borderRadius: 2,
              background: selected === p.key ? C.accent : 'rgba(255,255,255,0.15)',
              position: 'absolute',
              [p.row === 0 ? 'top' : 'bottom']: 5,
              [p.col === 0 ? 'left' : 'right']: 5,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          />
        ))}
      </div>

      {/* Radio options */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
        {PIP_POSITIONS.map(p => (
          <RadioRow
            key={p.key}
            label={p.label}
            checked={selected === p.key}
            onChange={() => onSelect(p.key)}
          />
        ))}
      </div>
    </div>
  )
}

export default function SettingsPage({ user, profile, onBack, onRefreshProfile }) {
  const initial = getUserSettings(profile)
  const { theme, setTheme } = useTheme()

  const [statButtons, setStatButtons] = useState(initial.stat_buttons)
  const [totalIncludes, setTotalIncludes] = useState(initial.total_includes)
  const [pipPosition, setPipPosition] = useState(initial.pip_position)
  const [team, setTeam] = useState(initial.team || profile?.team || 'CH')
  const [toastOnLog, setToastOnLog] = useState(initial.notifications.toast_on_log)
  const [sound, setSound] = useState(initial.notifications.sound)

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null) // 'success' | 'error'
  const [themeToast, setThemeToast] = useState(false)

  function showToast(type) {
    setToast(type)
    setTimeout(() => setToast(null), 2500)
  }

  async function handleThemeChange(value) {
    setTheme(value)
    const existingSettings = profile?.settings || {}
    await supabase
      .from('platform_users')
      .update({ settings: { ...existingSettings, theme: value } })
      .eq('id', user.id)
    setThemeToast(true)
    setTimeout(() => setThemeToast(false), 2000)
  }

  function toggleStatButton(key) {
    setStatButtons(prev => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev // enforce minimum 1
        return prev.filter(k => k !== key)
      }
      // preserve canonical order
      const order = ['resolved', 'reclass', 'calls', 'processes', 'total']
      return order.filter(k => [...prev, key].includes(k))
    })
  }

  function toggleTotalIncludes(key) {
    setTotalIncludes(prev => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev // enforce minimum 1
        return prev.filter(k => k !== key)
      }
      return [...prev, key]
    })
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)

    const settings = {
      stat_buttons: statButtons,
      total_includes: totalIncludes,
      pip_position: pipPosition,
      team,
      theme,
      notifications: { toast_on_log: toastOnLog, sound },
    }

    try {
      // Write settings to platform_users
      const { error: settingsErr } = await supabase
        .from('platform_users')
        .update({ settings })
        .eq('id', user.id)

      if (settingsErr) throw settingsErr

      // If team changed, also update platform_users.team
      if (team !== profile?.team) {
        const { error: teamErr } = await supabase
          .from('platform_users')
          .update({ team })
          .eq('id', user.id)

        if (teamErr) throw teamErr
      }

      if (onRefreshProfile) await onRefreshProfile()
      showToast('success')
    } catch {
      showToast('error')
    } finally {
      setSaving(false)
    }
  }

  const pageStyle = {
    minHeight: '100vh',
    background: C.bg,
  }

  const containerStyle = {
    maxWidth: 640,
    margin: '0 auto',
    padding: '40px 24px 80px',
    boxSizing: 'border-box',
  }

  const pageTitleStyle = {
    fontSize: 22,
    fontWeight: 700,
    color: C.textPri,
    marginBottom: 4,
    letterSpacing: '-0.02em',
  }

  const pageSubtitleStyle = {
    fontSize: 13,
    color: C.textSec,
    marginBottom: 32,
  }

  const saveBtnStyle = {
    marginTop: 32,
    height: 44,
    padding: '0 32px',
    borderRadius: 10,
    border: 'none',
    background: saving ? 'rgba(232,84,10,0.5)' : C.accent,
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: saving ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: C.textSec,
              fontSize: 13,
              cursor: 'pointer',
              padding: '0 0 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ← Dashboard
          </button>
        )}
        <div style={pageTitleStyle}>Settings</div>
        <div style={pageSubtitleStyle}>Configure your PiP widget behavior. Changes take effect on next launch.</div>

        {/* Section 1: Stat Buttons */}
        <Section>
          <SectionHeading
            title="Stat Buttons"
            description="Choose which counters appear in the PiP bar. At least one must be selected."
          />
          {STAT_OPTIONS.map(opt => (
            <CheckRow
              key={opt.key}
              label={opt.label}
              checked={statButtons.includes(opt.key)}
              onChange={() => toggleStatButton(opt.key)}
              disabled={statButtons.includes(opt.key) && statButtons.length <= 1}
            />
          ))}
        </Section>

        {/* Section 2: Total Formula (only if 'total' is selected) */}
        {statButtons.includes('total') && (
          <Section>
            <SectionHeading
              title="Total Formula"
              description="Choose which stats contribute to the Total counter."
            />
            {TOTAL_OPTIONS.map(opt => (
              <CheckRow
                key={opt.key}
                label={opt.label}
                checked={totalIncludes.includes(opt.key)}
                onChange={() => toggleTotalIncludes(opt.key)}
                disabled={totalIncludes.includes(opt.key) && totalIncludes.length <= 1}
              />
            ))}
          </Section>
        )}

        {/* Section 3: PiP Position */}
        {false && (
        <Section>
          <SectionHeading
            title="PiP Position"
            description="Where the widget pins when launched."
          />
          <PipPositionDiagram selected={pipPosition} onSelect={setPipPosition} />
        </Section>
        )}

        {/* Section 4: Team Assignment */}
        <Section>
          <SectionHeading
            title="Team Assignment"
            description="Sets your default team for category filtering."
          />
          <RadioRow label="CH" checked={team === 'CH'} onChange={() => setTeam('CH')} />
          <RadioRow label="MH" checked={team === 'MH'} onChange={() => setTeam('MH')} />
        </Section>

        {/* Section 5: Theme */}
        <Section>
          <SectionHeading
            title="Theme"
            description="Widget and dashboard appearance."
          />
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { value: 'dark',  label: 'Dark',  previewBg: '#1a1a2e', previewBorder: undefined },
              { value: 'light', label: 'Light', previewBg: '#f1f5f9', previewBorder: '1px solid rgba(0,0,0,0.1)' },
            ].map(({ value, label, previewBg, previewBorder }) => {
              const active = theme === value
              return (
                <div
                  key={value}
                  onClick={() => handleThemeChange(value)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    padding: '12px 16px',
                    borderRadius: 10,
                    border: active ? `2px solid ${C.accent}` : '2px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                    background: C.card,
                    minWidth: 80,
                  }}
                >
                  <div style={{
                    width: 48,
                    height: 32,
                    borderRadius: 6,
                    background: previewBg,
                    border: previewBorder,
                  }} />
                  <span style={{ fontSize: 12, color: C.textPri }}>{label}</span>
                </div>
              )
            })}
          </div>
          {themeToast && (
            <div style={{ fontSize: 11, color: '#22c55e', marginTop: 8 }}>
              ✓ Saved
            </div>
          )}
        </Section>

        {/* Section 6: Notifications */}
        <Section>
          <SectionHeading
            title="Notifications"
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, color: C.textPri }}>Show confirmation toast after logging</div>
                <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>Brief overlay confirms when a case or process is logged</div>
              </div>
              <Toggle checked={toastOnLog} onChange={() => setToastOnLog(v => !v)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, color: C.textPri }}>Play sound on bookmarklet trigger</div>
                <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>Audio cue when a new case or process starts</div>
              </div>
              <Toggle checked={sound} onChange={() => setSound(v => !v)} />
            </div>
          </div>
        </Section>

        {/* Save Button */}
        <button style={saveBtnStyle} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            background: toast === 'success' ? '#16a34a' : '#dc2626',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            padding: '10px 20px',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 999,
          }}>
            {toast === 'success' ? '✓ Settings saved' : '✗ Failed to save — try again'}
          </div>
        )}
      </div>
    </div>
  )
}
