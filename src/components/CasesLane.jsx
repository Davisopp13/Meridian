import { C } from '../lib/constants'
import CaseLaneRow from './CaseLaneRow'

export default function CasesLane({
  cases,          // [{ id, caseNum, elapsed, paused, awaiting }]
  focusedCaseId,
  onFocus,
  onResolve,
  onReclass,
  onCall,
  onAwaiting,
  onResume,
  onNotACase,
  onRFC,
  onCloseSession,
}) {
  const headingStyle = {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: C.textSec,
    textTransform: 'uppercase',
    fontFamily: '"Segoe UI", sans-serif',
    padding: '0 8px 6px',
  }

  const emptyStyle = {
    fontSize: 10,
    color: C.textSec,
    fontFamily: '"Segoe UI", sans-serif',
    padding: '12px 8px',
    textAlign: 'center',
  }

  const scrollStyle = {
    overflowY: 'auto',
    flex: 1,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={headingStyle}>Cases</div>
      <div style={scrollStyle}>
        {cases.length === 0 ? (
          <div style={emptyStyle}>No active cases</div>
        ) : (
          cases.map(c => (
            <CaseLaneRow
              key={c.id}
              caseSession={c}
              isFocused={c.id === focusedCaseId}
              onFocus={onFocus}
              onResolve={onResolve}
              onReclass={onReclass}
              onCall={onCall}
              onAwaiting={onAwaiting}
              onResume={onResume}
              onNotACase={onNotACase}
              onRFC={onRFC}
              onCloseSession={onCloseSession}
            />
          ))
        )}
      </div>
    </div>
  )
}
