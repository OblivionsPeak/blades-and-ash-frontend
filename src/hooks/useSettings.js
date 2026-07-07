import { useEffect, useState } from 'react';
import { api } from '../api';

// Business-info settings, fetched once per page load and shared by every
// consumer (Footer, SEO schema, etc.). Module-level cache — no context needed.
let cached = null;
let inflight = null;

export function fetchSettings() {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = api
      .getSettings()
      .then((s) => {
        cached = s && typeof s === 'object' ? s : {};
        return cached;
      })
      .catch(() => ({}))
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

// Call after the admin saves so the footer refreshes without a reload.
export function invalidateSettings(next) {
  cached = next && typeof next === 'object' ? next : null;
}

export function useSettings() {
  const [settings, setSettings] = useState(cached || {});
  useEffect(() => {
    let alive = true;
    fetchSettings().then((s) => {
      if (alive) setSettings(s);
    });
    return () => {
      alive = false;
    };
  }, []);
  return settings;
}

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_LABELS = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

// "17:30" -> "5:30 PM"
export function formatTime12(t) {
  if (!/^\d{2}:\d{2}$/.test(t || '')) return t || '';
  let [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return m === 0 ? `${h} ${ampm}` : `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Collapse hours into display rows, merging consecutive days with equal hours
// (e.g. "Tue – Fri  9 AM – 5 PM", "Sunday  Closed"). Days never set are omitted.
export function hoursToRows(hours) {
  if (!hours || typeof hours !== 'object') return [];
  const short = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
  const label = (d) =>
    hours[d]?.closed ? 'Closed' : `${formatTime12(hours[d].open)} – ${formatTime12(hours[d].close)}`;
  const rows = [];
  let run = null;
  for (const d of DAY_KEYS) {
    if (!hours[d]) {
      run = null;
      continue;
    }
    const text = label(d);
    if (run && run.text === text) {
      run.end = d;
    } else {
      run = { start: d, end: d, text };
      rows.push(run);
    }
  }
  return rows.map((r) => ({
    days: r.start === r.end ? short[r.start] : `${short[r.start]} – ${short[r.end]}`,
    text: r.text,
  }));
}
