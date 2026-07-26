// Notification category keys — must stay in sync with the server
// (PSUEISKOLARSystem.Server/Models/Enums/NotificationCategories.cs).
export const NOTIFICATION_CATEGORIES = {
  DocumentStatus: 'DocumentStatus',
  Announcement:   'Announcement',
  Deadline:       'Deadline',
  Message:        'Message',
  Account:        'Account',
};

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
