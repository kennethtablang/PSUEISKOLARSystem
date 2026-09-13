import { apiGet } from './_client';

/**
 * The whole dashboard in one request.
 *
 * The page used to assemble this from eleven calls — analytics, scholars, submissions,
 * requirements, users, announcements, deadlines, activity, approvals, grants, active
 * semester — which made the first screen every user sees the slowest one, and left it with
 * partial states where some cards rendered and others showed errors.
 *
 * The role is read from the token server-side, so there is nothing to pass: you get your own
 * dashboard. Exactly one of `scholar` and `staff` comes back populated.
 */
export async function getDashboard(token) {
  return apiGet('/api/dashboard', token, 'Failed to load the dashboard.');
}
