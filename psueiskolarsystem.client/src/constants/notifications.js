// Notification category keys — must stay in sync with the server
// (PSUEISKOLARSystem.Server/Models/Enums/NotificationCategories.cs).
export const NOTIFICATION_CATEGORIES = {
  DocumentStatus: 'DocumentStatus',
  Announcement:   'Announcement',
  Deadline:       'Deadline',
  Message:        'Message',
  Account:        'Account',
};

// Categories exposed as filter chips on the notifications page.
export const NOTIFICATION_FILTER_CATEGORIES = [
  NOTIFICATION_CATEGORIES.DocumentStatus,
  NOTIFICATION_CATEGORIES.Announcement,
  NOTIFICATION_CATEGORIES.Deadline,
  NOTIFICATION_CATEGORIES.Message,
];
