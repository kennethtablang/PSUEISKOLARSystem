// Scholarship types are either government-funded or privately funded — nothing finer.
export const CATEGORIES = ['Government', 'Private'];

/**
 * Whether the signed-in staff member may change a scholarship type. The administrator manages
 * every type; a coordinator manages only the types created for their own campus — types the
 * administrator made apply to every campus and stay the administrator's.
 */
export function canManageType(user, type) {
  if (!user || !type) return false;
  if (typeof type.canManage === 'boolean') return type.canManage;   // the server's verdict
  if (user.role === 'Administrator') return true;
  return user.role === 'ScholarshipCoordinator' && type.campusId != null && type.campusId === user.campusId;
}
