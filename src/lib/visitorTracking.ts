import { doc, getDoc, setDoc, onSnapshot, increment } from 'firebase/firestore';
import { db } from './firebase';

const ANALYTICS_COLLECTION = 'system_analytics';
const VISITOR_DOC_ID = 'visitorStats';
const LOCAL_STORAGE_KEY = 'risda_visitor_count_cache';
const SESSION_FLAG = 'risda_session_visited_v1';
const BASELINE_COUNT = 1420; // Realistic baseline counter for RISDA portal

export interface VisitorStats {
  totalVisitors: number;
  lastVisit?: string;
}

/**
 * Records a visitor session if not already counted in this browser session,
 * and calls the listener with the latest total visitor count.
 */
export function recordAndSubscribeVisitorCount(onUpdate: (count: number) => void): () => void {
  const statRef = doc(db, ANALYTICS_COLLECTION, VISITOR_DOC_ID);

  // Check cached count first for immediate UI display
  const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (cached) {
    const num = parseInt(cached, 10);
    if (!isNaN(num) && num > 0) {
      onUpdate(num);
    }
  }

  // Check if this browser session has already been counted
  const hasVisitedSession = sessionStorage.getItem(SESSION_FLAG);

  const performVisitRecording = async () => {
    try {
      if (!hasVisitedSession) {
        sessionStorage.setItem(SESSION_FLAG, 'true');
        
        // Fetch current document to check if it exists
        const snap = await getDoc(statRef);
        if (!snap.exists()) {
          const initialCount = BASELINE_COUNT + 1;
          await setDoc(statRef, {
            totalVisitors: initialCount,
            lastVisit: new Date().toISOString(),
            createdAt: new Date().toISOString()
          });
          localStorage.setItem(LOCAL_STORAGE_KEY, initialCount.toString());
          onUpdate(initialCount);
        } else {
          // Increment counter
          await setDoc(statRef, {
            totalVisitors: increment(1),
            lastVisit: new Date().toISOString()
          }, { merge: true });
        }
      }
    } catch (err) {
      console.warn('Visitor counter tracking note (using cached/fallback):', err);
      // If Firestore fails due to any reason, provide cached/baseline count
      const current = parseInt(localStorage.getItem(LOCAL_STORAGE_KEY) || `${BASELINE_COUNT}`, 10);
      onUpdate(current);
    }
  };

  performVisitRecording();

  // Subscribe to real-time updates of visitor stats
  const unsubscribe = onSnapshot(statRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data() as VisitorStats;
      const total = Number(data.totalVisitors) || BASELINE_COUNT;
      localStorage.setItem(LOCAL_STORAGE_KEY, total.toString());
      onUpdate(total);
    } else {
      onUpdate(BASELINE_COUNT);
    }
  }, (error) => {
    console.warn('Real-time visitor count listener error:', error);
    const fallback = parseInt(localStorage.getItem(LOCAL_STORAGE_KEY) || `${BASELINE_COUNT}`, 10);
    onUpdate(fallback);
  });

  return unsubscribe;
}
