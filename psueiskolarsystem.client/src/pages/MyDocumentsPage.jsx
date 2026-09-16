import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useToast, useConfirm } from '../context/UIContext';
import { getRequirements, getSubmissions, uploadDocument, deleteSubmission, downloadFile, previewFile, getSubmissionHistory, getRequirementSample } from '../api/documents';
import { getScholarProfile, upsertScholarProfile } from '../api/scholars';
import { getScholarshipTypes } from '../api/lookups';
import { getActiveSemester } from '../api/settings';
import { getDeadlines } from '../api/deadlines';
import { getUploadPolicy, acceptAttribute, validateUpload, FALLBACK_UPLOAD_POLICY } from '../api/uploadPolicy';
import { useTitle } from '../hooks/useTitle';
import DocumentPreview from '../components/DocumentPreview';
import { Eye, X, Download, Image, Loader, BookOpen, ChevronDown, ChevronUp, CalendarClock, Lock } from 'lucide-react';
import ImageLightbox from '../components/ImageLightbox';
import InfoTip from '../components/InfoTip';
import StatusBadge from '../components/StatusBadge';
import { statusDot } from '../constants/statusTones';
import { useMediaQuery } from '../hooks/useMediaQuery';

export default function MyDocumentsPage() {
  useTitle('My Documents');
  const { token, user, refreshUser } = useAuth();
  // Below this the preview opens as a full-screen sheet; a 50/50 split on a phone left
  // two unreadable 200px columns.
  const isWide = useMediaQuery('(min-width: 1024px)');
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

  // Size cap and accepted extensions, from the server's System Settings rather than a copy
  // kept here — the two used to disagree. Falls back to the shipped defaults until it loads.
  const [uploadPolicy, setUploadPolicy] = useState(FALLBACK_UPLOAD_POLICY);

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
    // The approval gate reads the signed-in user, which is otherwise only fetched at sign-in.
    // A scholar approved mid-session followed the "Registration approved" notification here
    // and still found every upload locked until they reloaded the browser.
    refreshUser();
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
      toast('Scholarship type saved.', 'success');
      await load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSavingType(false);
    }
  }

  useEffect(() => { getUploadPolicy().then(setUploadPolicy); }, []);

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
    // Immediate feedback before hitting the server; the server re-checks the same policy.
    const problem = validateUpload(file, uploadPolicy);
    if (problem) {
      toast(problem, 'error');
      return;
    }
    setUploading(requirementId);
    try {
      await uploadDocument(file, requirementId, period.academicYear, period.semester, token);
      toast(`${file.name} uploaded. It will be reviewed by the scholarship office.`, 'success');
      await load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUploading(null);
    }
  }

  const [removing, setRemoving] = useState(null);

  async function handleDelete(submissionId) {
    if (removing) return;
    if (!(await confirm({ title: 'Remove submission', message: 'Remove this submission?', confirmLabel: 'Remove', danger: true }))) return;
    if (preview?.submissionId === submissionId) closePreview();
    setRemoving(submissionId);
    try {
      await deleteSubmission(submissionId, token);
      setSubmissions(prev => prev.filter(s => s.id !== submissionId));
      toast('Submission removed.', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setRemoving(null);
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
            width: preview && isWide ? '50%' : '100%',
            transition: 'width 0.25s ease',
            borderRight: preview && isWide ? '1.5px solid var(--surface-inset)' : 'none',
          }}
        >
          {/* A checklist is a single-column reading task, so it keeps a readable measure —
              but centred in the pane rather than pinned to the left with a void beside it.
              With the preview open the pane is already half-width, so it fills instead. */}
          <div className={`page-shell${preview && isWide ? '' : ' page-shell-narrow'}`}>

            <div className="page-head">
              <div>
                <h1 className="page-title">My Documents</h1>
                <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {profile?.scholarshipTypeName
                    ? `${profile.scholarshipTypeName} · ${verified}/${total} required verified`
                    : 'Select your scholarship type below'}
                  {/* A student holds exactly one scholarship; once it's set only a
                      coordinator can change it, so we don't offer a "Change" action here. */}
                  {profile?.scholarshipTypeName && (
                    <span className="text-xs" style={{ color: 'var(--text-faint)', marginLeft: 4 }}>
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
                <CalendarClock size={14} strokeWidth={2.2} style={{ color: 'var(--text-muted)' }} />
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
                  ? { background: 'var(--tone-bad-bg)', border: '1.5px solid var(--tone-bad-border)' }
                  : { background: 'var(--tone-warn-bg)', border: '1.5px solid var(--tone-warn-border)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'var(--surface-2)' }}>
                    <Lock size={16} strokeWidth={2.2} style={{ color: approvalStatus === 'Rejected' ? 'var(--tone-bad-fg)' : 'var(--tone-warn-fg)' }} />
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
                      <p className="text-xs mt-1.5 italic" style={{ color: 'var(--text)' }}>“{user.approvalNote}”</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {(!profile?.scholarshipTypeId || showTypePicker) && (
              <div className="clay-card p-5 mb-5"
                style={{ background: 'var(--accent-soft-bg)', border: '1.5px solid var(--accent-soft-border)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(0,37,112,0.10)', border: '1px solid rgba(0,37,112,0.15)' }}>
                    <BookOpen size={16} style={{ color: 'var(--accent-strong)' }} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold mb-0.5" style={{ color: 'var(--accent-strong)' }}>
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

            {error && <p role="alert" className="text-sm mb-4" style={{ color: 'var(--danger)' }}>{error}</p>}

            {previewError && (
              <div className="mb-4 flex items-start gap-2.5 p-3.5 rounded-2xl text-sm"
                style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1.5px solid var(--danger-border)' }}>
                <span className="shrink-0 mt-px">⚠</span>
                <span>{previewError}</span>
                <button onClick={() => setPreviewError('')} aria-label="Dismiss" className="ml-auto shrink-0 opacity-50 hover:opacity-100">✕</button>
              </div>
            )}

            {loading ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
            ) : requirements.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No document requirements found.</p>
            ) : (
              <div className="space-y-3">
                {requirementGroups.map(group => (
                  <div key={group.name} className="space-y-3">
                    {/* Only worth a heading once the office has actually grouped things. */}
                    {requirementGroups.length > 1 && (
                      <p className="text-xs font-bold uppercase tracking-wider pt-1" style={{ color: 'var(--text-muted)' }}>
                        {group.name}
                      </p>
                    )}
                    {group.items.map(req => {
                      const sub = submissionFor(req.id);
                      return (
                        <RequirementRow
                          key={`${req.id}-${sub?.id ?? 'none'}-${sub?.status ?? ''}`}
                          requirement={req}
                          submission={sub}
                          deadline={deadlineByReq[req.id]}
                          uploading={uploading === req.id}
                          loadingPreview={loadingPreview === sub?.id}
                          isPreviewing={preview?.submissionId === sub?.id}
                          onUpload={file => handleUpload(req.id, file)}
                          onDelete={() => handleDelete(sub.id)}
                          removing={removing === sub?.id}
                          onPreview={() => handlePreview(sub)}
                          onViewSample={() => handleViewSample(req.id)}
                          uploadLocked={!isApproved}
                          accept={acceptAttribute(uploadPolicy)}
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
          /* Desktop: a side panel pinned under the top bar, sized to the viewport so a PDF
             gets a real height instead of the iframe's 150px default. Narrow screens: a
             full-screen sheet above the top bar. */
          <div
            className="flex flex-col"
            role={isWide ? undefined : 'dialog'}
            aria-label={isWide ? undefined : `Preview of ${preview.fileName}`}
            style={isWide
              ? { width: '50%', position: 'sticky', top: 58, height: 'calc(100dvh - 58px)', background: 'var(--bg)' }
              : { position: 'fixed', inset: 0, zIndex: 60, background: 'var(--bg)' }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between gap-3 px-5 py-3 shrink-0"
              style={{
                background: 'var(--surface-modal)',
                borderBottom: '1.5px solid var(--hairline-strong)',
                boxShadow: '0 2px 0 rgba(0,37,112,0.04)',
              }}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(0,37,112,0.08)', border: '1px solid rgba(0,37,112,0.12)' }}>
                  <Eye size={13} style={{ color: 'var(--accent-strong)' }} strokeWidth={2} />
                </div>
                <span className="text-sm font-bold truncate" style={{ color: 'var(--text-strong)' }}>
                  {preview.fileName}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => downloadFile(preview.submissionId, preview.fileName, token).catch(e => toast(e.message, 'error'))}
                  className="clay-btn clay-btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5"
                  style={{ color: 'var(--accent)' }}>
                  <Download size={12} strokeWidth={2.5} />
                  Download
                </button>
                <button
                  onClick={closePreview}
                  aria-label="Close preview"
                  className="modal-close shrink-0">
                  <X size={15} style={{ color: 'var(--text-muted)' }} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Preview content */}
            <div className="flex-1 overflow-hidden">
              <DocumentPreview preview={preview} />
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

function DeadlineBadge({ deadline, submission }) {
  if (!deadline) return null;
  const due = new Date(deadline.dueDate);

  // If already submitted, reflect on-time vs late against the deadline.
  if (submission) {
    if (submission.isLate)
      return <Badge tone="attention">Submitted late</Badge>;
    return <Badge tone="ok">On time</Badge>;
  }

  const msPerDay = 86400000;
  const days = Math.ceil((due - new Date()) / msPerDay);
  const dueLabel = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  if (days < 0) return <Badge tone="bad">Overdue · was due {dueLabel}</Badge>;
  if (days === 0) return <Badge tone="bad">Due today</Badge>;
  if (days <= 3) return <Badge tone="attention">Due in {days} day{days > 1 ? 's' : ''}</Badge>;
  return <Badge tone="neutral">Due {dueLabel}</Badge>;
}

function Badge({ tone, children }) {
  return (
    <span className={`status-badge tone-${tone}`} style={{ fontWeight: 500 }}>
      <CalendarClock size={11} strokeWidth={2.4} /> {children}
    </span>
  );
}

function RequirementRow({ requirement, submission, deadline, uploading, removing, loadingPreview, isPreviewing, onUpload, onDelete, onPreview, onViewSample, uploadLocked, accept, token }) {
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
                style={{ background: 'var(--accent-soft-bg)', color: 'var(--accent)', border: '1px solid var(--accent-soft-border)' }}>
                Required
              </span>
            )}
          </div>
          {requirement.description && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{requirement.description}</p>
          )}
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <DeadlineBadge deadline={deadline} submission={submission} />
            {requirement.hasSample && (
              <button onClick={onViewSample} className="inline-flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                <Image size={11} strokeWidth={2.4} /> View sample
              </button>
            )}
          </div>
        </div>

        {submission ? (
          <StatusBadge status={submission.status} className="shrink-0" />
        ) : (
          <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>Not submitted</span>
        )}
      </div>

      {submission && (
        <div className="mt-3 flex items-center gap-3 text-sm">
          <button
            onClick={() => downloadFile(submission.id, submission.fileName, token).catch(e => toast(e.message, 'error'))}
            className="hover:underline truncate max-w-xs text-left"
            style={{ color: 'var(--accent)' }}>
            {submission.fileName}
          </button>
          <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{formatBytes(submission.fileSizeBytes)}</span>
        </div>
      )}

      {submission?.feedbackNote && (
        <div className="mt-2 p-2 rounded-xl text-xs"
          style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)' }}>
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
              color: isPreviewing ? 'var(--accent-strong)' : 'var(--accent)',
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
            style={{ opacity: 0.55, cursor: 'not-allowed', color: 'var(--text-muted)' }}>
            <Lock size={12} strokeWidth={2.5} />
            Upload locked
          </span>
        ) : (
          <>
            <label
              htmlFor={inputId}
              className={`clay-btn text-sm px-3 py-1.5 ${uploading ? '' : 'clay-btn-ghost'}`}
              style={uploading
                ? { opacity: 0.5, cursor: 'not-allowed', color: 'var(--text-muted)' }
                : { color: 'var(--accent)' }}>
              {uploading ? 'Uploading…' : submission ? 'Resubmit' : 'Upload'}
            </label>
            <input
              id={inputId}
              type="file"
              accept={accept}
              className="hidden"
              disabled={uploading}
              onChange={e => { if (e.target.files?.[0]) onUpload(e.target.files[0]); e.target.value = ''; }}
            />
          </>
        ))}

        {submission && submission.status !== 'Verified' && (
          <button onClick={onDelete} disabled={removing} className="text-xs hover:underline ml-auto" style={{ color: 'var(--danger)', opacity: removing ? 0.6 : 1 }}>
            {removing ? 'Removing…' : 'Remove'}
          </button>
        )}

        {submission && (
          <button
            onClick={toggleHistory}
            className={`text-xs flex items-center gap-1 hover:underline ${submission.status === 'Verified' ? 'ml-auto' : ''}`}
            style={{ color: 'var(--text-muted)' }}>
            {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            History
          </button>
        )}
      </div>

      {showHistory && history !== null && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--hairline)' }}>
          {history.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>No history yet.</p>
          ) : (
            <ol className="space-y-2.5">
              {history.map((h, i) => (
                <li key={h.id} className="flex items-start gap-2.5">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="w-2 h-2 rounded-full mt-0.5" style={{ background: statusDot(h.status) }} />
                    {i < history.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: 'var(--hairline-strong)', minHeight: 12 }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-strong)' }}>{h.status}</p>
                    {h.note && <p className="text-xs" style={{ color: 'var(--text)' }}>{h.note}</p>}
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
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
