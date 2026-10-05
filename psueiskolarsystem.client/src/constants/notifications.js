// Notification category keys — must stay in sync with the server
// (PSUEISKOLARSystem.Server/Models/Enums/NotificationCategories.cs).
export const NOTIFICATION_CATEGORIES = {
  DocumentStatus: 'DocumentStatus',
  Announcement:   'Announcement',
  Deadline:       'Deadline',
  Message:        'Message',
  Account:        'Account',
};

/** The announcement a notification is about: `?announcement=<id>` on its link, or null. */
export function announcementIdOf(n) {
  const m = /[?&]announcement=(\d+)/.exec(n?.linkUrl ?? '');
  return m ? Number(m[1]) : null;
}

/**
 * Whether clicking the notification should open it in full rather than follow its link: every
 * announcement, and anything at all for a grantee, whose account has no pages to send them to.
 */
export function opensInPlace(n, role) {
  return role === 'Grantee' || n?.category === NOTIFICATION_CATEGORIES.Announcement || announcementIdOf(n) != null;
}

// Categories a user may silence in the bell (server: NotificationMuting.Mutable).
// Account/security notices are deliberately absent — those always come through.
export const MUTABLE_IN_APP_CATEGORIES = [
  { key: NOTIFICATION_CATEGORIES.DocumentStatus, label: 'Document status updates' },
  { key: NOTIFICATION_CATEGORIES.Announcement,   label: 'Announcements' },
  { key: NOTIFICATION_CATEGORIES.Deadline,       label: 'Deadline reminders' },
  { key: NOTIFICATION_CATEGORIES.Message,        label: 'Messages from staff' },
];

// Categories exposed as filter chips on the notifications page.
export const NOTIFICATION_FILTER_CATEGORIES = [
  NOTIFICATION_CATEGORIES.DocumentStatus,
  NOTIFICATION_CATEGORIES.Announcement,
  NOTIFICATION_CATEGORIES.Deadline,
  NOTIFICATION_CATEGORIES.Message,
];
