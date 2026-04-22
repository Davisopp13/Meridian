import { useState } from 'react';
import { formatElapsed } from '../lib/constants.js';

/**
 * CategoryChipStrip — horizontal scrollable chip strip for logging MPL processes.
 *
 * Two modes:
 *   Timed   (processElapsed is a number) — category/sub selection → onConfirm(catId, subId, null)
 *   Untimed (processElapsed is null)     — category/sub selection → duration step →
 *                                          onConfirm(catId, subId, minutes)
 *
 * Props:
 *   categories      — [{ id, name, team, mpl_subcategories[] }]
 *   processElapsed  — number | null — seconds from timer (null = untimed / Quick Log)
 *   onConfirm       — (categoryId, subcategoryId|null, minutes|null) => void
 *   onCancel        — () => void
 */
const DURATION_VALUES = [5, 10, 15, 20, 30, 45, 60];

export default function CategoryChipStrip({ categories = [], processElapsed = 0, onConfirm, onCancel, onStepChange }) {
  const [step, setStep] = useState('category'); // 'category' | 'subcategory' | 'duration'
  const [activeCat, setActiveCat] = useState(null);
  const [activeSub, setActiveSub] = useState(null);
  const [customInputActive, setCustomInputActive] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const isUntimed = processElapsed === null;

  // ── Shared back handler — always returns to category step ──────────────
  function handleBack() {
    goToStep('category');
    setActiveCat(null);
    setActiveSub(null);
    setCustomInputActive(false);
    setCustomValue('');
  }

  function goToStep(nextStep) {
    setStep(nextStep);
    onStepChange && onStepChange(nextStep);
  }

  // ── Final selection: timed → confirm immediately, untimed → duration step
  function handleFinalSelection(catId, subObj) {
    if (!isUntimed) {
      onConfirm && onConfirm(catId, subObj?.id ?? null, null);
    } else {
      setActiveSub(subObj ?? null);
      goToStep('duration');
    }
  }

  function handleCategoryTap(cat) {
    const subs = cat.mpl_subcategories || [];
    if (subs.length === 0) {
      if (!isUntimed) {
        onConfirm && onConfirm(cat.id, null, null);
      } else {
        setActiveCat(cat);
        setActiveSub(null);
        goToStep('duration');
      }
    } else if (subs.length === 1) {
      if (!isUntimed) {
        onConfirm && onConfirm(cat.id, subs[0].id, null);
      } else {
        setActiveCat(cat);
        setActiveSub(subs[0]);
        goToStep('duration');
      }
    } else {
      setActiveCat(cat);
      goToStep('subcategory');
    }
  }

  function handleSubcategoryTap(sub) {
    if (!isUntimed) {
      onConfirm && onConfirm(activeCat.id, sub.id, null);
    } else {
      setActiveSub(sub);
      goToStep('duration');
    }
  }

  function handleDurationTap(minutes) {
    onConfirm && onConfirm(activeCat.id, activeSub?.id ?? null, minutes);
  }

  function handleCustomConfirm() {
    const v = parseInt(customValue, 10);
    if (v > 0) {
      onConfirm && onConfirm(activeCat.id, activeSub?.id ?? null, v);
    }
  }

  // ── Chip style helpers ─────────────────────────────────────────────────
  function teamChipStyle(team) {
    if (team === 'CH') {
      return {
        background: 'rgba(251,191,36,0.12)',
        border: '1px solid rgba(251,191,36,0.3)',
        color: '#fbbf24',
      };
    }
    return {
      background: 'rgba(96,165,250,0.12)',
      border: '1px solid rgba(96,165,250,0.3)',
      color: '#60a5fa',
    };
  }

  function teamLabelColor(team) {
    return team === 'CH' ? '#fbbf24' : '#60a5fa';
  }

  const chipBase = {
    height: 28,
    padding: '0 12px',
    borderRadius: 14,
    fontSize: 11,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1,
  };

  const backChipStyle = {
    ...chipBase,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--border)',
    color: 'var(--text-sec)',
  };

  const durationChipStyle = {
    ...chipBase,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--border)',
    color: 'var(--text-pri)',
    padding: '0 10px',
  };

  const cancelChipStyle = {
    ...chipBase,
    background: 'none',
    border: 'none',
    color: 'var(--text-dim)',
    fontSize: 14,
    padding: '0 4px',
  };

  // ── Shared container ───────────────────────────────────────────────────
  const containerStyle = {
    height: 44,
    borderTop: '1px solid var(--divider)',
    padding: '0 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    overflowX: 'auto',
    overflowY: 'hidden',
    msOverflowStyle: 'none',
    scrollbarWidth: 'none',
    flexShrink: 0,
  };

  // ── Duration step (untimed only) ───────────────────────────────────────
  if (step === 'duration') {
    const selectionLabel = activeSub
      ? `${activeCat.name} › ${activeSub.name}`
      : activeCat?.name || '';
    const labelColor = teamLabelColor(activeCat?.team);
    const customValParsed = parseInt(customValue, 10);
    const customValValid = customValParsed > 0;

    return (
      <div style={containerStyle}>
        {/* Back chip */}
        <button onClick={handleBack} style={backChipStyle}>← Back</button>

        {/* Selection label */}
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: labelColor,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {selectionLabel}
        </span>

        {/* Vertical divider */}
        <div style={{ width: 1, height: 14, background: 'var(--divider)', flexShrink: 0 }} />

        {/* Duration chips */}
        {DURATION_VALUES.map(v => (
          <button
            key={v}
            onClick={() => handleDurationTap(v)}
            style={durationChipStyle}
          >
            {v}m
          </button>
        ))}

        {/* Custom chip or inline input */}
        {customInputActive ? (
          <>
            <input
              type="number"
              min="1"
              placeholder="min"
              autoFocus
              value={customValue}
              onChange={e => setCustomValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && customValValid) handleCustomConfirm();
                if (e.key === 'Escape') { setCustomInputActive(false); setCustomValue(''); }
              }}
              style={{
                width: 48,
                height: 28,
                padding: '0 6px',
                borderRadius: 14,
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.08)',
                color: 'var(--text-pri)',
                fontSize: 11,
                textAlign: 'center',
                outline: 'none',
                flexShrink: 0,
              }}
            />
            {customValValid && (
              <button
                onClick={handleCustomConfirm}
                style={{
                  ...chipBase,
                  background: 'rgba(96,165,250,0.15)',
                  border: '1px solid rgba(96,165,250,0.3)',
                  color: '#60a5fa',
                  padding: '0 10px',
                }}
              >
                Go
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => setCustomInputActive(true)}
            style={durationChipStyle}
          >
            Custom
          </button>
        )}

        {/* Spacer */}
        <div style={{ flex: 1, flexShrink: 0, minWidth: 6 }} />

        {/* Cancel */}
        <button onClick={() => onCancel && onCancel()} style={cancelChipStyle}>✕</button>
      </div>
    );
  }

  // ── Category / subcategory step ────────────────────────────────────────
  const chips = step === 'category' ? categories : (activeCat?.mpl_subcategories || []);
  const teamForSub = activeCat?.team;

  return (
    <div style={containerStyle}>
      {/* Elapsed label — only in timed mode */}
      {!isUntimed && (
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-dim)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          Log · {formatElapsed(processElapsed)}
        </span>
      )}

      {/* Back chip (subcategory step only) */}
      {step === 'subcategory' && (
        <button onClick={handleBack} style={backChipStyle}>← Back</button>
      )}

      {/* Category or subcategory chips */}
      {chips.map(chip => {
        const team = step === 'category' ? chip.team : teamForSub;
        return (
          <button
            key={chip.id}
            onClick={() => step === 'category' ? handleCategoryTap(chip) : handleSubcategoryTap(chip)}
            style={{ ...chipBase, ...teamChipStyle(team) }}
          >
            {chip.name}
          </button>
        );
      })}

      {/* Spacer */}
      <div style={{ flex: 1, flexShrink: 0, minWidth: 6 }} />

      {/* Cancel chip — always visible at far right */}
      <button onClick={() => onCancel && onCancel()} style={cancelChipStyle}>✕</button>
    </div>
  );
}
