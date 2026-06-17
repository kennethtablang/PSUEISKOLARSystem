import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getRequirements, getSubmissions, uploadDocument, deleteSubmission, downloadFile } from '../api/documents';
import { getScholarProfile } from '../api/scholars';
import { getActiveSemester } from '../api/settings';
import { useTitle } from '../hooks/useTitle';

const STATUS_STYLE = {
  Pending:    'bg-amber-100 text-amber-700',
  Verified:   'bg-emerald-100 text-emerald-700',
  Incomplete: 'bg-red-100 text-red-700',
};

export default function MyDocumentsPage() {
  useTitle('My Documents');
  const { token, user } = useAuth();

  const [requirements, setRequirements] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);
  const [error, setError] = useState('');

  const [period, setPeriod] = useState({ academicYear: '', semester: 1 });
  const [periodReady, setPeriodReady] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const p = await getScholarProfile(user.id, token).catch(() => null);
      setProfile(p);
      const [reqs, subs] = await Promise.all([
        getRequirements(token, { scholarshipTypeId: p?.scholarshipTypeId }),
        getSubmissions(token, { academicYear: period.academicYear, semester: period.semester }),
      ]);
      setRequirements(reqs);
      setSubmissions(subs);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
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
    setUploading(requirementId);
    try {
      await uploadDocument(file, requirementId, period.academicYear, period.semester, token);
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setUploading(null);
    }
  }

  async function handleDelete(submissionId) {
    if (!confirm('Remove this submission?')) return;
    try {
      await deleteSubmission(submissionId, token);
      setSubmissions(prev => prev.filter(s => s.id !== submissionId));
    } catch (e) {
      alert(e.message);
    }
  }

  const verified = submissions.filter(s => s.status === 'Verified').length;
  const total = requirements.filter(r => r.isRequired).length;

  return (
    <Layout>
      <div className="p-8 max-w-3xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="page-title">My Documents</h1>
            <p className="page-subtitle">{profile?.scholarshipTypeName ?? 'No scholarship type set'} · {verified}/{total} required verified</p>
            <span className="page-title-bar" />
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={period.academicYear}
              onChange={e => setPeriod(p => ({ ...p, academicYear: e.target.value }))}
              className="clay-input w-28"
              placeholder="2025-2026"
            />
            <select
              value={period.semester}
              onChange={e => setPeriod(p => ({ ...p, semester: parseInt(e.target.value) }))}
              className="clay-input"
            >
              <option value={1}>Sem 1</option>
              <option value={2}>Sem 2</option>
            </select>
          </div>
        </div>

        {!profile && (
          <div className="clay-card p-4 mb-5 text-sm"
            style={{ background: '#fffbe8', border: '1.5px solid #f5d060', color: '#7a5500' }}>
            Your scholar profile is not set up yet. Contact your coordinator to complete your profile.
          </div>
        )}

        {error && <p className="text-sm mb-4" style={{ color: '#e03030' }}>{error}</p>}

        {loading ? (
          <p className="text-sm" style={{ color: '#7a8aaa' }}>Loading…</p>
        ) : requirements.length === 0 ? (
          <p className="text-sm" style={{ color: '#7a8aaa' }}>No document requirements found.</p>
        ) : (
          <div className="space-y-3">
            {requirements.map(req => {
              const sub = submissionFor(req.id);
              return (
                <RequirementRow
                  key={req.id}
                  requirement={req}
                  submission={sub}
                  uploading={uploading === req.id}
                  onUpload={file => handleUpload(req.id, file)}
                  onDelete={() => handleDelete(sub.id)}
                  token={token}
                />
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

function RequirementRow({ requirement, submission, uploading, onUpload, onDelete, token }) {
  const inputId = `file-${requirement.id}`;
  const canUpload = !submission || submission.status === 'Incomplete';

  return (
    <div className="clay-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold" style={{ color: '#0d1a33' }}>{requirement.name}</p>
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
            onClick={() => downloadFile(submission.id, submission.fileName, token).catch(e => alert(e.message))}
            className="hover:underline truncate max-w-xs text-left"
            style={{ color: '#003087' }}
          >
            {submission.fileName}
          </button>
          <span className="text-xs" style={{ color: '#7a8aaa' }}>{formatBytes(submission.fileSizeBytes)}</span>
        </div>
      )}

      {submission?.feedbackNote && (
        <div className="mt-2 p-2 rounded-xl text-xs"
          style={{ background: '#fff0f0', border: '1px solid #fcc', color: '#c03030' }}>
          <span className="font-medium">Feedback:</span> {submission.feedbackNote}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        {canUpload && (
          <>
            <label
              htmlFor={inputId}
              className={`clay-btn text-sm px-3 py-1.5 ${uploading ? '' : 'clay-btn-ghost'}`}
              style={uploading ? { opacity: 0.5, cursor: 'not-allowed', color: '#7a8aaa' } : { color: '#003087' }}
            >
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
        )}
        {submission && submission.status !== 'Verified' && (
          <button onClick={onDelete} className="text-xs hover:underline" style={{ color: '#e03030' }}>Remove</button>
        )}
      </div>
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
