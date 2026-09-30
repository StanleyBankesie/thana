import { useEffect, useState, useMemo, useCallback } from "react";
import { onQueueUpdate, getQueueSnapshot } from "./syncEngine.js";

export default function useOfflineQueue() {
  const [snap, setSnap] = useState(() => getQueueSnapshot());
  const [lastEvent, setLastEvent] = useState(null);

  useEffect(() => {
    const off = onQueueUpdate(({ event, snapshot }) => {
      setSnap(snapshot);
      setLastEvent(event);
    });
    return () => off();
  }, []);

  const pending = useMemo(() => snap.pending || 0, [snap.pending]);
  const failed = useMemo(() => snap.failed || 0, [snap.failed]);
  const completed = useMemo(() => snap.completed || 0, [snap.completed]);
  const items = useMemo(() => snap.items || [], [snap.items]);

  return {
    lastEvent,
    pending,
    failed,
    completed,
    items,
  };
}
