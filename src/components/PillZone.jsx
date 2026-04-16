import { useState, useEffect } from 'react';
import { C } from '../lib/constants.js';
import CasePill from './CasePill.jsx';
import ProcessPill from './ProcessPill.jsx';

/**
 * PillZone — shows up to 2 Case pills + 2 Process pills inline, plus tray chevron.
 *
 * Props:
 *   cases            — full cases array (only first 2 rendered)
 *   processes        — full processes array (only first 2 rendered)
 *   focusedCaseId    — id of the focused case
 *   trayOpen         — bool, current tray state
 *   onFocusCase(id)
 *   onPauseCase(id)
 *   onResumeCase(id)
 *   onCloseCase(id)
 *   onLogProcess(id)
 *   onCloseProcess(id)
 *   onToggleTray()
 *   onAwaitingCase(id) — called when popover Awaiting button is tapped
 *   onNotACase(id)     — called when popover Not a Case button is tapped
 */
export default function PillZone({
  cases = [],
  processes = [],
  focusedCaseId,
  trayOpen,
  onFocusCase,
  onPauseCase,
  onResumeCase,
  onCloseCase,
  onLogProcess,
  onCloseProcess,
  onToggleTray,
  onAwaitingCase,
  onNotACase,
}) {
  const [popoverCaseId, setPopoverCaseId] = useState(null);

  const visibleCases = cases.slice(0, 2);
  const visibleProcesses = processes.slice(0, 2);

  // Close popover when focusedCaseId changes
  useEffect(() => {
    setPopoverCaseId(null);
  }, [focusedCaseId]);

  function handlePopoverOpen(id) {
    setPopoverCaseId(prev => (prev === id ? null : id));
  }

  function handleAwaitingFromPopover(id) {
    setPopoverCaseId(null);
    onAwaitingCase && onAwaitingCase(id);
  }

  function handleNotACaseFromPopover(id) {
    setPopoverCaseId(null);
    onNotACase && onNotACase(id);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      {visibleCases.map(c => (
        <CasePill
          key={c.id}
          caseNumber={c.caseNum}
          elapsed={c.elapsed}
          focused={c.id === focusedCaseId}
          awaiting={c.awaiting}
          onFocus={() => onFocusCase && onFocusCase(c.id)}
          onPause={() => onPauseCase && onPauseCase(c.id)}
          onResume={() => onResumeCase && onResumeCase(c.id)}
          onClose={() => onCloseCase && onCloseCase(c.id)}
          popoverOpen={c.id === popoverCaseId}
          onPopoverOpen={() => handlePopoverOpen(c.id)}
          onAwaiting={() => handleAwaitingFromPopover(c.id)}
          onNotACase={() => handleNotACaseFromPopover(c.id)}
        />
      ))}

      {visibleProcesses.map(p => (
        <ProcessPill
          key={p.id}
          elapsed={p.elapsed}
          onLog={() => onLogProcess && onLogProcess(p.id)}
          onClose={() => onCloseProcess && onCloseProcess(p.id)}
        />
      ))}

      {/* Tray chevron — always visible */}
      <button
        onClick={() => onToggleTray && onToggleTray()}
        style={{
          background: 'none',
          border: 'none',
          color: trayOpen ? C.process : C.textSec,
          fontSize: 10,
          cursor: 'pointer',
          padding: '0 4px',
          lineHeight: 1,
          transition: 'color 150ms',
          flexShrink: 0,
        }}
        title={trayOpen ? 'Close tray' : 'Open tray'}
      >
        {trayOpen ? '▲' : '▼'}
      </button>
    </div>
  );
}
