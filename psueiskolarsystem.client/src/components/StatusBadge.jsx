import {
  ShieldCheck, ShieldX, Clock, CircleCheckBig, Ban, AlertTriangle,
  GraduationCap, RefreshCw, PauseCircle, FileQuestion,
} from 'lucide-react';
import { toneOf } from '../constants/statusTones';

/**
 * The one status pill.
 *
 * There were six of these — `STATUS_STYLE` in DocumentReviewPage, another in MyDocumentsPage,
 * a third in ScholarApprovalsPage, plus `GrantStatusBadge`, `ReleaseStatusBadge` and
 * `LifecycleBadge` — each with its own hardcoded pale-green and pale-amber literals and none
 * with a dark variant. That duplication is the mechanism behind the repeated dark-mode
 * regressions: a fix pass repaints the badges it can see and the other four keep their light
 * palette. Two of those maps were even Tailwind classes (`bg-amber-100 text-amber-700`), which
 * cannot follow a theme at all.
 *
 * Colour comes from a *tone*, not a status — see constants/statusTones.js.
 */
const ICON = {
  Verified: CircleCheckBig,
  Pending: Clock,
  Incomplete: AlertTriangle,
  Approved: ShieldCheck,
  Rejected: ShieldX,
  Released: CircleCheckBig,
  Cancelled: Ban,
  NotRecorded: FileQuestion,
  Active: CircleCheckBig,
  Renewed: RefreshCw,
  Lapsed: AlertTriangle,
  Suspended: PauseCircle,
  Graduated: GraduationCap,
};

/**
 * @param {string}  status    the raw status value; also the default label
 * @param {string}  [label]   display text when it differs from the status (release monitor)
 * @param {boolean} [icon]    set false where the row is already dense with glyphs
 * @param {string}  [tone]    override for a status the tone map does not know
 */
export default function StatusBadge({ status, label, icon = true, tone, className = '' }) {
  const resolved = tone ?? toneOf(status);
  const Icon = ICON[status];

  return (
    <span className={`status-badge tone-${resolved} ${className}`}>
      {icon && Icon && <Icon size={11} strokeWidth={2.6} aria-hidden="true" />}
      {label ?? status}
    </span>
  );
}
