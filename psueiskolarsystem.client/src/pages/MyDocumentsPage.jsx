import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast, useConfirm } from '../context/UIContext';
import { getRequirements, getSubmissions, uploadDocument, deleteSubmission, downloadFile, previewFile, getSubmissionHistory, getRequirementSample } from '../api/documents';
import { getScholarProfile, upsertScholarProfile } from '../api/scholars';
import { getScholarshipTypes } from '../api/lookups';
import { getActiveSemester } from '../api/settings';
import { getDeadlines } from '../api/deadlines';
import { useTitle } from '../hooks/useTitle';
import { Eye, X, Download, FileText, Image, FileX, Loader, BookOpen, ChevronDown, ChevronUp, CalendarClock, Lock } from 'lucide-react';
import ImageLightbox from '../components/ImageLightbox';
import InfoTip from '../components/InfoTip';

const STATUS_STYLE = {
  Pending:    'bg-amber-100 text-amber-700',
  Verified:   'bg-emerald-100 text-emerald-700',
  Incomplete: 'bg-red-100 text-red-700',
};

export default function MyDocumentsPage() {
  useTitle('My Documents');
  const { token, user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [requirements,    setRequirements]    = useState([]);
  const [submissions,     setSubmissions]     = useState([]);
  const [deadlineByReq,   setDeadlineByReq]   = useState({});
  const [profile,         setProfile]         = useState(null);
  const [scholarshipTypes, setScholarshipTypes] = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [uploading,       setUploading]       = useState(null);
  const [error,           setError]           = useState('');
  const [pickingType,     setPickingType]     = useState('');
  const [savingType,      setSavingType]      = useState(false);
  const [showTypePicker,  setShowTypePicker]  = useState(false);

  const [period,      setPeriod]      = useState({ academicYear: '', semester: 1 });
  const [periodReady, setPeriodReady] = useState(false);
  const [sampleUrl,   setSampleUrl]   = useState(null);

  // Registration verification state — uploads stay locked until the office approves.
  // Accounts that predate the approval flow have no status and are treated as approved.
  const approvalStatus = user?.approvalStatus ?? 'Approved';
  const isApproved = approvalStatus === 'Approved';

  async function handleViewSample(reqId) {
    try { setSampleUrl(await getRequirementSample(reqId, token)); }
    catch (e) { toast(e.message, 'error'); }
  }

  // preview state
  const [preview,        setPreview]        = useState(null);   // { url, contentType, fileName, submissionId }
  const [loadingPreview, setLoadingPreview] = useState(null);   // submissionId being loaded
  const [previewError,   setPreviewError]   = useState('');
  const prevUrlRef = useRef(null);

  function closePreview() {
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = null;
    }
    setPreview(null);
    setPreviewError('');
  }

  async function handlePreview(submission) {
    if (loadingPreview) return;
    // If same doc already open, close it
    if (preview?.submissionId === submission.id) { closePreview(); return; }

    setLoadingPreview(submission.id);
    setPreviewError('');
    try {
      const { url, contentType } = await previewFile(submission.id, token);
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
      prevUrlRef.current = url;
      setPreview({ url, contentType, fileName: submission.fileName, submissionId: submission.id });
    } catch (e) {
      setPreviewError(e.message);
    } finally {
      setLoadingPreview(null);
    }
  }

  // Clean up blob URL on unmount
  useEffect(() => () => { if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current); }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [p, types] = await Promise.all([
        getScholarProfile(user.id, token).catch(() => null),
        getScholarshipTypes(token).catch(() => []),
      ]);
      setProfile(p);
      setScholarshipTypes(types);
      setPickingType(p?.scholarshipTypeId?.toString() ?? '');
      const [reqs, subs, deadlines] = await Promise.all([
        getRequirements(token, { scholarshipTypeId: p?.scholarshipTypeId }),
        getSubmissions(token, { academicYear: period.academicYear, semester: period.semester }),
        getDeadlines(token, { academicYear: period.academicYear, semester: period.semester }).catch(() => []),
      ]);
      setRequirements(reqs);
      setSubmissions(subs);
      const map = {};
      deadlines.forEach(d => { map[d.requirementId] = d; });
      setDeadlineByReq(map);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveScholarshipType() {
    if (!pickingType) return;
    setSavingType(true);
    try {
      await upsertScholarProfile(user.id, {
        studentId:         profile?.studentId ?? '',
        programId:         profile?.programId ?? null,
        scholarshipTypeId: parseInt(pickingType),
        yearLevel:         profile?.yearLevel ?? 1,
        contactNumber:     profile?.contactNumber ?? null,
        birthDate:         profile?.birthDate ?? null,
        address:           profile?.address ?? null,
      }, token);
      setShowTypePicker(false);
      await load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSavingType(false);
    }
  }

  useEffect(() => {
    getActiveSemester(token)
      .then(data => setPeriod({ academicYear: data.academicYear, semester: data.semester }))
      .catch(() => {
        const m = new Date().getMonth() + 1, y = new Date().getFullYear(), s = m >= 8 ? y : y - 1;
        setPeriod({ academicYear: `${s}-${s + 1}`, semester: m >= 2 && m <= 7 ? 2 : 1 });
      })
      .finally(() => setPeriodReady(true));
  }, []);

  useEffect(() => { if (periodReady) load(); }, [period.academicYear, period.semester, periodReady]);

  function submissionFor(reqId) {
    return submissions.find(s => s.requirementId === reqId) ?? null;
  }

  async function handleUpload(requirementId, file) {
    // Client-side type/size feedback before hitting the server (mirrors server limits)
    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!allowedExts.includes(ext)) {
      toast(`Unsupported file type ".${ext}". Accepted: PDF, JPG, PNG, DOC, DOCX.`, 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast(`This file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the maximum is 10 MB.`, 'error');
      return;
    }
    setUploading(requirementId);
    try {
      await uploadDocument(file, requirementId, period.academicYear, period.semester, token);
      await load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUploading(null);
    }
  }

  async function handleDelete(submissionId) {
    if (!(await confirm({ title: 'Remove submission', message: 'Remove this submission?', confirmLabel: 'Remove', danger: true }))) return;
    if (preview?.submissionId === submissionId) closePreview();
    try {
      await deleteSubmission(submissionId, token);
      setSubmissions(prev => prev.filter(s => s.id !== submissionId));
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  const verified = submissions.filter(s => s.status === 'Verified').length;
  const total    = requirements.filter(r => r.isRequired).length;

  // The API returns requirements already sorted by group, so consecutive runs are the groups.
  const requirementGroups = [];
  for (const req of requirements) {
    const name = req.groupName ?? 'Other documents';
    if (requirementGroups.at(-1)?.name !== name) requirementGroups.push({ name, items: [] });
    requirementGroups.at(-1).items.push(req);
  }

  return (
    <Layout>
      <div className="flex h-full" style={{ minHeight: 0 }}>

        {/* ── Left: Document list ── */}
        <div
          className="flex flex-col overflow-y-auto"
          style={{
            width: preview ? '50%' : '100%',
            transition: 'width 0.25s ease',
            borderRight: preview ? '1.5px solid var(--surface-inset)' : 'none',
          }}
        >
          <div className="p-4 sm:p-8" style={{ maxWidth: preview ? undefined : '768px' }}>

            <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
              <div>
                <h1 className="page-title">My Documents</h1>
                <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {profile?.scholarshipTypeName
                    ? `${profile.scholarshipTypeName} · ${verified}/${total} required verified`
                    : 'Select your scholarship type below'}
                  {/* A student holds exactly one scholarship; once it's set only a
                      coordinator can change it, so we don't offer a "Change" action here. */}
                  {profile?.scholarshipTypeName && (
                    <span className="text-xs" style={{ color: '#9aaabb', marginLeft: 4 }}>
                      · one scholarship per student — contact your coordinator to change it
                    </span>
                  )}
                </p>
                <span className="page-title-bar" />
              </div>
              {/* The period is the one the scholarship office has set active — it is not the
                  scholar's to choose. It used to be a free-text box, which let submissions be
                  filed against arbitrary years that no deadline or report would ever match. */}
              <div className="clay-card-inner px-3.5 py-2 flex items-center gap-2 shrink-0">
                <CalendarClock size={14} strokeWidth={2.2} style={{ color: '#7a8aaa' }} />
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Submission period</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-strong)' }}>
                    {period.academicYear || '—'} · Sem {period.semester}
                  </p>
                </div>
                <InfoTip
                  align="end"
                  text="Set by the scholarship office. Documents you upload are filed against this period, which is how deadlines and compliance reports line up. Ask your coordinator if you need to submit for an earlier semester."
                />
              </div>
            </div>

            {/* Scholarship type picker — shown when no type set, or when changing */}
            {/* Registration must be verified by the scholarship office before anything
                can be submitted — the server enforces this too. */}
            {!isApproved && (
              <div className="clay-card p-5 mb-5"
                style={approvalStatus === 'Rejected'
                  ? { background: '#fff1f1', border: '1.5px solid #fca5a5' }
                  : { background: '#fffbe8', border: '1.5px solid #f5d060' }}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: approvalStatus === 'Rejected' ? 'rgba(192,32,32,0.10)' : 'rgba(192,120,0,0.12)' }}>
                    <Lock size={16} strokeWidth={2.2} style={{ color: approvalStatus === 'Rejected' ? '#c02020' : '#8a5a00' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold mb-0.5" style={{ color: 'var(--text-strong)' }}>
                      {approvalStatus === 'Rejected'
                        ? 'Document submission is locked'
                        : 'Waiting for the scholarship office to verify your registration'}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text)' }}>
                      {approvalStatus === 'Rejected'
                        ? 'Your registration was not approved, so uploads are disabled. Please contact the scholarship office to resolve this.'
                        : 'You can review your requirements now. Uploading unlocks as soon as your registration is approved — you will be notified by email.'}
                    </p>
                    {user?.approvalNote && (
                      <p className="text-xs mt-1.5 italic" style={{ color: '#7a5500' }}>“{user.approvalNote}”</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {(!profile?.scholarshipTypeId || showTypePicker) && (
              <div className="clay-card p-5 mb-5"
                style={{ background: '#f0f5ff', border: '1.5px solid #80aaee' }}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(0,37,112,0.10)', border: '1px solid rgba(0,37,112,0.15)' }}>
                    <BookOpen size={16} color="#002570" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold mb-0.5" style={{ color: '#002570' }}>
                      {showTypePicker && profile?.scholarshipTypeId
                        ? 'Change Scholarship Type'
                        : 'Select Your Scholarship Type'}
                    </p>
                    <p className="text-xs mb-3" style={{ color: 'var(--text)' }}>
                      {showTypePicker && profile?.scholarshipTypeId
                        ? `Currently: ${profile.scholarshipTypeName}. Changing this will update the required documents shown.`
                        : 'Choose the scholarship you are enrolled in to see your required documents.'}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={pickingType}
                        onChange={e => setPickingType(e.target.value)}
                        className="clay-input flex-1"
                        style={{ minWidth: 220 }}
                      >
                        <option value="">— Choose scholarship type —</option>
                        {scholarshipTypes.map(st => (
                          <option key={st.id} value={st.id}>{st.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleSaveScholarshipType}
                        disabled={!pickingType || savingType}
                        className="clay-btn clay-btn-primary px-4 py-2 text-sm shrink-0"
                        style={{ opacity: !pickingType || savingType ? 0.6 : 1 }}
                      >
                        {savingType ? 'Saving…' : 'Confirm'}
                      </button>
                      {showTypePicker && profile?.scholarshipTypeId && (
                        <button
                          onClick={() => setShowTypePicker(false)}
                          className="clay-btn clay-btn-ghost px-4 py-2 text-sm shrink-0"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-sm mb-4" style={{ color: '#e03030' }}>{error}</p>}

            {previewError && (
              <div className="mb-4 flex items-start gap-2.5 p-3.5 rounded-2xl text-sm"
                style={{ background: '#fff0f0', color: '#b03030', border: '1.5px solid #f5b0b0' }}>
                <span className="shrink-0 mt-px">⚠</span>
                <span>{previewError}</span>
                <button onClick={() => setPreviewError('')} className="ml-auto shrink-0 opacity-50 hover:opacity-100">✕</button>
              </div>
            )}

            {loading ? (
              <p className="text-sm" style={{ color: '#7a8aaa' }}>Loading…</p>
            ) : requirements.length === 0 ? (
              <p className="text-sm" style={{ color: '#7a8aaa' }}>No document requirements found.</p>
            ) : (
              <div className="space-y-3">
                {requirementGroups.map(group => (
                  <div key={group.name} className="space-y-3">
                    {/* Only worth a heading once the office has actually grouped things. */}
                    {requirementGroups.length > 1 && (
                      <p className="text-xs font-bold uppercase tracking-wider pt-1" style={{ color: '#7a8aaa' }}>
                        {group.name}
                      </p>
                    )}
                    {group.items.map(req => {
                      const sub = submissionFor(req.id);
                      return (
                        <RequirementRow
                          key={req.id}
                          requirement={req}
                          submission={sub}
                          deadline={deadlineByReq[req.id]}
                          uploading={uploading === req.id}
                          loadingPreview={loadingPreview === sub?.id}
                          isPreviewing={preview?.submissionId === sub?.id}
                          onUpload={file => handleUpload(req.id, file)}
                          onDelete={() => handleDelete(sub.id)}
                          onPreview={() => handlePreview(sub)}
                          onViewSample={() => handleViewSample(req.id)}
                          uploadLocked={!isApproved}
                          token={token}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Preview panel ── */}
        {preview && (
          <div
            className="flex flex-col"
            style={{ width: '50%', minHeight: 0, background: 'var(--bg)' }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between gap-3 px-5 py-3 shrink-0"
              style={{
                background: 'var(--surface-modal)',
                borderBottom: '1.5px solid rgba(0,48,135,0.12)',
                boxShadow: '0 2px 0 rgba(0,37,112,0.04)',
              }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(0,37,112,0.08)', border: '1px solid rgba(0,37,112,0.12)' }}>
                  <Eye size={13} color="#002570" strokeWidth={2} />
                </div>
                <span className="text-sm font-bold truncate" style={{ color: 'var(--text-strong)' }}>
                  {preview.fileName}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => downloadFile(preview.submissionId, preview.fileName, token).catch(e => toast(e.message, 'error'))}
                  className="clay-btn clay-btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5"
                  style={{ color: '#003087' }}>
                  <Download size={12} strokeWidth={2.5} />
                  Download
                </button>
                <button
                  onClick={closePreview}
                  className="w-7 h-7 rounded-xl flex items-center justify-center hover:bg-black/5 transition-colors shrink-0">
                  <X size={15} color="#7a8aaa" strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Preview content */}
            <div className="flex-1 overflow-hidden">
              <PreviewContent preview={preview} />
            </div>
          </div>
        )}
      </div>

      {sampleUrl && (
        <ImageLightbox
          url={sampleUrl}
          alt="Document sample"
          caption="Example of a valid document"
          onClose={() => { URL.revokeObjectURL(sampleUrl); setSampleUrl(null); }}
        />
      )}
    </Layout>
  );
}

function PreviewContent({ preview }) {
  const { url, contentType, fileName } = preview;
  const isPdf   = contentType === 'application/pdf';
  const isImage = contentType?.startsWith('image/');

  if (isPdf) {
    return (
      <iframe
        src={url}
        title={fileName}
        className="w-full h-full"
        style={{ border: 'none', display: 'block' }}
      />
    );
  }

  if (isImage) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6 overflow-auto">
        <img
          src={url}
          alt={fileName}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 12,
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
        />
      </div>
    );
  }

  // Word docs and other unsupported types
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(0,37,112,0.07)', border: '1.5px solid rgba(0,37,112,0.12)' }}>
        <FileX size={28} color="#7a8aaa" strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <p className="font-bold text-sm mb-1" style={{ color: 'var(--text-strong)' }}>Preview Not Available</p>
        <p className="text-xs leading-relaxed" style={{ color: '#7a8aaa', maxWidth: 240 }}>
          This file type cannot be previewed in the browser. Use the Download button to open it.
        </p>
      </div>
    </div>
  );
}

const STATUS_DOT = { Pending: '#c07800', Verified: '#0a7a50', Incomplete: '#c03010' };

function DeadlineBadge({ deadline, submission }) {
  if (!deadline) return null;
  const due = new Date(deadline.dueDate);

  // If already submitted, reflect on-time vs late against the deadline.
  if (submission) {
    if (submission.isLate)
      return <Badge color="#c2410c" bg="#ffedd5">Submitted late</Badge>;
    return <Badge color="#0a7d43" bg="#d1fae5">On time</Badge>;
  }

  const msPerDay = 86400000;
  const days = Math.ceil((due - new Date()) / msPerDay);
  const dueLabel = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  if (days < 0) return <Badge color="#c0342c" bg="#fee2e2">Overdue · was due {dueLabel}</Badge>;
  if (days === 0) return <Badge color="#c0342c" bg="#fee2e2">Due today</Badge>;
  if (days <= 3) return <Badge color="#c2410c" bg="#ffedd5">Due in {days} day{days > 1 ? 's' : ''}</Badge>;
  return <Badge color="#4a5a7a" bg="#eef2f9">Due {dueLabel}</Badge>;
}

function Badge({ color, bg, children }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ color, background: bg }}>
      <CalendarClock size={11} strokeWidth={2.4} /> {children}
    </span>
  );
}

function RequirementRow({ requirement, submission, deadline, uploading, loadingPreview, isPreviewing, onUpload, onDelete, onPreview, onViewSample, uploadLocked, token }) {
  const toast = useToast();
  const inputId  = `file-${requirement.id}`;
  const canUpload = !submission || submission.status === 'Incomplete';
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(null);

  async function toggleHistory() {
    if (!showHistory && history === null) {
      try { setHistory(await getSubmissionHistory(submission.id, token)); }
      catch { setHistory([]); }
    }
    setShowHistory(v => !v);
  }

  return (
    <div className="clay-card p-5"
      style={isPreviewing ? { border: '1.5px solid rgba(0,37,112,0.35)', background: 'rgba(0,37,112,0.025)' } : {}}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold" style={{ color: 'var(--text-strong)' }}>{requirement.name}</p>
            {requirement.isRequired && (
              <span className="text-xs px-1.5 py-0.5 rounded-xl font-medium"
                style={{ background: '#dce8ff', color: '#003087', border: '1px solid #80aaee' }}>
                Required
              </span>
            )}
          </div>
          {requirement.description && (
            <p className="text-xs mt-0.5" style={{ color: '#7a8aaa' }}>{requirement.description}</p>
          )}
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <DeadlineBadge deadline={deadline} submission={submission} />
            {requirement.hasSample && (
              <button onClick={onViewSample} className="inline-flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: '#003087' }}>
                <Image size={11} strokeWidth={2.4} /> View sample
              </button>
            )}
          </div>
        </div>

        {submission ? (
          <span className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[submission.status]}`}>
            {submission.status}
          </span>
        ) : (
          <span className="shrink-0 text-xs" style={{ color: '#7a8aaa' }}>Not submitted</span>
        )}
      </div>

      {submission && (
        <div className="mt-3 flex items-center gap-3 text-sm">
          <button
            onClick={() => downloadFile(submission.id, submission.fileName, token).catch(e => toast(e.message, 'error'))}
            className="hover:underline truncate max-w-xs text-left"
            style={{ color: '#003087' }}>
            {submission.fileName}
          </button>
          <span className="text-xs shrink-0" style={{ color: '#7a8aaa' }}>{formatBytes(submission.fileSizeBytes)}</span>
        </div>
      )}

      {submission?.feedbackNote && (
        <div className="mt-2 p-2 rounded-xl text-xs"
          style={{ background: '#fff0f0', border: '1px solid #fcc', color: '#c03030' }}>
          <span className="font-medium">Feedback:</span> {submission.feedbackNote}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {/* Preview button — only when there's a submission */}
        {submission && (
          <button
            onClick={onPreview}
            disabled={!!loadingPreview}
            className="clay-btn text-sm px-3 py-1.5 flex items-center gap-1.5"
            style={{
              color: isPreviewing ? '#002570' : '#003087',
              background: isPreviewing ? 'rgba(0,37,112,0.10)' : undefined,
              border: isPreviewing ? '1.5px solid rgba(0,37,112,0.25)' : undefined,
              opacity: loadingPreview ? 0.6 : 1,
            }}>
            {loadingPreview
              ? <Loader size={13} strokeWidth={2.5} className="animate-spin" />
              : <Eye size={13} strokeWidth={2.5} />}
            {isPreviewing ? 'Close Preview' : 'Preview'}
          </button>
        )}

        {canUpload && (uploadLocked ? (
          <span
            className="clay-btn text-sm px-3 py-1.5 inline-flex items-center gap-1.5"
            title="Uploading unlocks once the scholarship office approves your registration."
            style={{ opacity: 0.55, cursor: 'not-allowed', color: '#7a8aaa' }}>
            <Lock size={12} strokeWidth={2.5} />
            Upload locked
          </span>
        ) : (
          <>
            <label
              htmlFor={inputId}
              className={`clay-btn text-sm px-3 py-1.5 ${uploading ? '' : 'clay-btn-ghost'}`}
              style={uploading
                ? { opacity: 0.5, cursor: 'not-allowed', color: '#7a8aaa' }
                : { color: '#003087' }}>
              {uploading ? 'Uploading…' : submission ? 'Resubmit' : 'Upload'}
            </label>
            <input
              id={inputId}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              className="hidden"
              disabled={uploading}
              onChange={e => { if (e.target.files?.[0]) onUpload(e.target.files[0]); e.target.value = ''; }}
            />
          </>
        ))}

        {submission && submission.status !== 'Verified' && (
          <button onClick={onDelete} className="text-xs hover:underline ml-auto" style={{ color: '#e03030' }}>
            Remove
          </button>
        )}

        {submission && (
          <button
            onClick={toggleHistory}
            className="text-xs flex items-center gap-1 ml-auto hover:underline"
            style={{ color: '#7a8aaa' }}>
            {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            History
          </button>
        )}
      </div>

      {showHistory && history !== null && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
          {history.length === 0 ? (
            <p className="text-xs" style={{ color: '#9aaabb' }}>No history yet.</p>
          ) : (
            <ol className="space-y-2.5">
              {history.map((h, i) => (
                <li key={h.id} className="flex items-start gap-2.5">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-2 h-2 rounded-full mt-0.5" style={{ background: STATUS_DOT[h.status] ?? '#7a8aaa' }} />
                    {i < history.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: 'rgba(0,0,0,0.1)', minHeight: 12 }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-strong)' }}>{h.status}</p>
                    {h.note && <p className="text-xs" style={{ color: 'var(--text)' }}>{h.note}</p>}
                    <p className="text-xs mt-0.5" style={{ color: '#9aaabb' }}>
                      {new Date(h.changedAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
