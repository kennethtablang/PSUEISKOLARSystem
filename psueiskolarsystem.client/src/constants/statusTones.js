/**
 * Status → tone.
 *
 * Six meanings cover every status vocabulary in the app, because "Verified", "Approved",
 * "Released" and "Active" all mean the same thing to the eye. Each tone resolves to a set of
 * CSS custom properties defined once in index.css and overridden once for dark mode — which is
 * the point: the six hand-written badge implementations this replaced each had their own
 * hardcoded pale-green and pale-amber, and none of them had a dark variant.
 *
 * Lives apart from StatusBadge.jsx so that file exports a component and nothing else (Fast
 * Refresh gives up on a module that mixes the two).
 */
const TONE = {
  // Documents (Incomplete is the old name for Rejected, kept for older history rows)
  Verified: 'ok',
  Pending: 'warn',
  UnderReview: 'info',
  Incomplete: 'bad',

  // Scholar approval
  Approved: 'ok',
  Rejected: 'bad',

  // Money — grants and recurring releases
  Released: 'ok',
  Cancelled: 'neutral',
  NotRecorded: 'bad',

  // Scholarship lifecycle
  Active: 'ok',
  Renewed: 'info',
  Lapsed: 'bad',
  Suspended: 'attention',
  Graduated: 'neutral',
};

/** The tone a status resolves to. Unknown statuses read as neutral rather than throwing. */
export const toneOf = status => TONE[status] ?? 'neutral';

/**
 * The dot colour for a status, as a CSS value.
 *
 * The status-history timelines each carried their own
 * `const STATUS_DOT = { Pending: '#c07800', … }` — the same three literals written twice, with
 * no dark variant, so the dots kept their light-mode colours on a dark card. Reading the tone's
 * foreground keeps them in step with the badge beside them.
 */
export const statusDot = status => `var(--tone-${toneOf(status)}-fg)`;
