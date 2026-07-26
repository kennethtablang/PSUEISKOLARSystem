// Release states of a one-time grant — must stay in sync with the server
// (PSUEISKOLARSystem.Server/Models/Enums/GrantReleaseStatuses.cs).
export const GRANT_RELEASE_STATUSES = ['Pending', 'Released', 'Cancelled'];

export const GRANT_STATUS_COLORS = {
  Pending:   { bg: '#fff3cd', color: '#7d5a00', border: '#f5d060' },
  Released:  { bg: '#d4f4e2', color: '#166534', border: '#86efac' },
  Cancelled: { bg: '#e5e7eb', color: '#4b5563', border: '#d1d5db' },
};

/** Formats an amount as Philippine pesos with two decimals. */
export const peso = n =>
  `₱${Number(n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
