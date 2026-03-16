import { C } from '../lib/constants'
import CasesLane from './CasesLane'
import ProcessesLane from './ProcessesLane'

export default function SwimlaneTray({
  // layout
  laneSplit,        // { cases: '60%', processes: '40%' } from useContextFocus
  // cases props
  cases,
  focusedCaseId,
  onFocusCase,
  onResolveCase,
  onReclassCase,
  onCallCase,
  onAwaitingCase,
  onResumeCase,
  onNotACase,
  onRFC,
  onCloseSession,
  onRFCRequired,
  // processes props
  processes,
  categories,
  onConfirmProcess,
  onCancelProcess,
  onNewProcess,
}) {
  const trayStyle = {
    display: 'flex',
    height: 296,
    overflow: 'hidden',
    borderTop: `1px solid ${C.divider}`,
    fontFamily: '"Segoe UI", sans-serif',
  }

  const casesColStyle = {
    width: laneSplit.cases,
    transition: 'width 300ms cubic-bezier(0.4,0,0.2,1)',
    overflow: 'hidden',
    padding: '8px 0',
    display: 'flex',
    flexDirection: 'column',
  }

  const dividerStyle = {
    width: 1,
    background: C.divider,
    flexShrink: 0,
    alignSelf: 'stretch',
  }

  const processesColStyle = {
    flex: 1,
    overflow: 'hidden',
    padding: '8px 0',
    display: 'flex',
    flexDirection: 'column',
  }

  return (
    <div style={trayStyle}>
      <div style={casesColStyle}>
        <CasesLane
          cases={cases}
          focusedCaseId={focusedCaseId}
          onFocus={onFocusCase}
          onResolve={onResolveCase}
          onReclass={onReclassCase}
          onCall={onCallCase}
          onAwaiting={onAwaitingCase}
          onResume={onResumeCase}
          onNotACase={onNotACase}
          onRFC={onRFC}
          onCloseSession={onCloseSession}
          onRFCRequired={onRFCRequired}
        />
      </div>
      <div style={dividerStyle} />
      <div style={processesColStyle}>
        <ProcessesLane
          processes={processes}
          categories={categories}
          onConfirm={onConfirmProcess}
          onCancel={onCancelProcess}
          onNewProcess={onNewProcess}
        />
      </div>
    </div>
  )
}
