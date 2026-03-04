import { useState, useEffect, useRef } from 'react';

export function useTimer() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (running) {
      ref.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(ref.current);
    }
    return () => clearInterval(ref.current);
  }, [running]);

  return {
    elapsed,
    isRunning: running,
    start:  () => { setElapsed(0); setRunning(true); },
    pause:  () => setRunning(false),
    resume: () => setRunning(true),
    reset:  () => { setElapsed(0); setRunning(false); },
  };
}
