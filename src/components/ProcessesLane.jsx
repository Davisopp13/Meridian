import { C } from '../lib/constants'
import ProcessLaneRow from './ProcessLaneRow'

export default function ProcessesLane({
  processes,      // [{ id, elapsed, categoryName }]
  categories,     // [{ id, name, team, sort_order }]
  onConfirm,      // (id, category, durationSeconds)
  onCancel,       // (id)
  onNewProcess,   // () — starts a new process session
}) {
  const headingStyle = {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: C.textSec,
    textTransform: 'uppercase',
    padding: '0 8px 6px',
  }

  const emptyStyle = {
    fontSize: 10,
    color: C.textSec,
    padding: '12px 8px',
    textAlign: 'center',
  }

  const scrollStyle = {
    overflowY: 'auto',
    flex: 1,
  }

  const newBtnStyle = {
    width: '100%',
    padding: '6px 8px',
    background: 'transparent',
    border: `1px dashed ${C.border}`,
    borderRadius: 6,
    color: C.process,
    fontSize: 10,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
    marginTop: 4,
    transition: 'background 150ms',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={headingStyle}>Processes</div>
      <div style={scrollStyle}>
        {processes.length === 0 ? (
          <div style={emptyStyle}>No active processes</div>
        ) : (
          processes.map(p => (
            <ProcessLaneRow
              key={p.id}
              process={p}
              categories={categories}
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          ))
        )}
        <button style={newBtnStyle} onClick={onNewProcess}>
          + New Process
        </button>
      </div>
    </div>
  )
}
