import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';

const HEARTBEAT_INTERVAL_MS = 30000;

async function pingBarSession(userId, widgetMode) {
  const { error } = await supabase
    .from('bar_sessions')
    .upsert(
      { user_id: userId, widget_mode: widgetMode, last_seen_at: new Date().toISOString() },
      { onConflict: 'user_id,widget_mode' }
    );
  if (error) console.warn('[useBarHeartbeat] upsert failed:', error);
}

export default function useBarHeartbeat(userId, widgetMode) {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!userId || !widgetMode) return;

    pingBarSession(userId, widgetMode);
    intervalRef.current = setInterval(() => pingBarSession(userId, widgetMode), HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      pingBarSession(userId, widgetMode);
    };
  }, [userId, widgetMode]);
}
