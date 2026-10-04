// Release states of a one-time grant — must stay in sync with the server
// (PSUEISKOLARSystem.Server/Models/Enums/GrantReleaseStatuses.cs).
export const GRANT_RELEASE_STATUSES = ['Pending', 'Released', 'Cancelled'];

/* Release-state colours used to live here as hex triples. They are now tones on
   components/StatusBadge.jsx, which resolves them through CSS custom properties so dark
   mode reaches them. `NotRecorded` is produced only by the release monitor: the scholar
   holds the scholarship but nobody has scheduled their payout for the period at all. */

/** Formats an amount as Philippine pesos with two decimals. */
export const peso = n =>
  `₱${Number(n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ── Payout frequency ─────────────────────────────────────
   Mirrors PSUEISKOLARSystem.Server/Models/Enums/ScholarshipFrequencies.cs. A recurring
   scholarship is the one tracked release-by-release on the Scholarship Releases page;
   a one-time type has nothing per-period to monitor. */

export const SCHOLARSHIP_FREQUENCIES = [
  { value: 'PerSemester', label: 'Per semester', hint: 'Paid twice an academic year — one release per semester.' },
  { value: 'PerYear',     label: 'Per year',     hint: 'Paid once an academic year, covering both semesters.' },
  { value: 'OneTime',     label: 'One-time',     hint: 'Paid once for the whole scholarship — nothing recurring to track.' },
];

export const FREQUENCY_LABELS = Object.fromEntries(
  SCHOLARSHIP_FREQUENCIES.map(f => [f.value, f.label])
);

/** Semester 0 marks a whole-academic-year release; per-semester types use 1 and 2. */
export const WHOLE_YEAR_SEMESTER = 0;

export const isRecurring = frequency => frequency === 'PerSemester' || frequency === 'PerYear';

/**
 * Not a semester of its own: "semesters 1 and 2 together", for when both semesters are
 * released on one day. Matches ScholarshipFrequencies.BothSemesters on the server.
 */
export const BOTH_SEMESTERS = 12;

/** The semesters a scholarship on this frequency is expected to pay out in. */
export const semestersFor = frequency =>
  frequency === 'PerSemester' ? [1, 2]
  : frequency === 'PerYear' ? [WHOLE_YEAR_SEMESTER]
  : [];

/** The period choices for a frequency: per-semester types may also pick both at once. */
export const periodChoicesFor = frequency =>
  frequency === 'PerSemester' ? [1, 2, BOTH_SEMESTERS] : semestersFor(frequency);

export const semesterLabel = semester =>
  semester === WHOLE_YEAR_SEMESTER ? 'Whole year'
  : semester === BOTH_SEMESTERS ? 'Semesters 1 & 2'
  : `Semester ${semester}`;

export const periodLabel = (academicYear, semester) =>
  semester === WHOLE_YEAR_SEMESTER
    ? `${academicYear} (whole year)`
    : semester === BOTH_SEMESTERS
      ? `${academicYear} · Sem 1 & 2`
      : `${academicYear} · Sem ${semester}`;

/**
 * The academic year an unset picker should start on — the one that began in the current
 * calendar year if we are past June, otherwise the one that began last year.
 */
export function currentAcademicYear(now = new Date()) {
  const start = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}
