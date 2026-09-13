import { useEffect, useState } from 'react';

/**
 * The current time as a value that is stable within a render and refreshed on a tick.
 *
 * Calling `Date.now()` in the middle of render looks harmless and is not: render stops being
 * a pure function of props and state, so two renders of the same component can disagree, and
 * — the part users actually see — nothing ever re-renders when the clock moves. A "due in 3
 * days" badge on a page left open overnight keeps saying 3 until something unrelated happens
 * to re-render it.
 *
 * Pick the interval from the granularity being displayed: seconds for a live badge, an hour
 * for a day countdown. Passing 0 freezes the value at mount, which is what you want for a
 * timestamp that should not move while the user reads it.
 */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!intervalMs) return undefined;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

/** Whole days from `now` until `date`, rounded up. Negative once the date has passed. */
export function daysUntil(date, now) {
  return Math.ceil((new Date(date) - now) / 86_400_000);
}
