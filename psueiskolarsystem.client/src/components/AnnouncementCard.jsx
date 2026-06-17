export default function AnnouncementCard({ announcement }) {
  const date = new Date(announcement.createdAt).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-gray-900">{announcement.title}</p>
          <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{announcement.content}</p>
        </div>
        {announcement.expiresAt && (
          <span className="shrink-0 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            Expires {new Date(announcement.expiresAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs text-gray-400">{date} · {announcement.createdBy}</span>
        {announcement.targetCampus && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{announcement.targetCampus}</span>
        )}
        {announcement.targetRole && (
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{announcement.targetRole}</span>
        )}
      </div>
    </div>
  );
}
