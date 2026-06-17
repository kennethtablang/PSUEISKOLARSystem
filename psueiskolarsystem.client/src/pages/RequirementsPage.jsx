import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getRequirements, createRequirement, updateRequirement, deleteRequirement } from '../api/documents';
import { getScholarshipTypes } from '../api/lookups';
import { useTitle } from '../hooks/useTitle';
import { ClayModal, ErrorBox, Field, ModalButtons } from './UsersPage';

export default function RequirementsPage() {
  useTitle('Document Requirements');
  const { token } = useAuth();
  const [requirements, setRequirements] = useState([]);
  const [scholarshipTypes, setScholarshipTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [reqs, types] = await Promise.all([
        getRequirements(token),
        getScholarshipTypes(token),
      ]);
      setRequirements(reqs);
      setScholarshipTypes(types);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!confirm('Remove this requirement? Scholars will no longer see it.')) return;
    try {
      await deleteRequirement(id, token);
      setRequirements(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      alert(e.message);
    }
  }

  function openEdit(r) { setEditing(r); setShowModal(true); }
  function openCreate() { setEditing(null); setShowModal(true); }

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">Document Requirements</h1>
            <p className="page-subtitle">
              {requirements.length} active requirement{requirements.length !== 1 ? 's' : ''}
            </p>
            <span className="page-title-bar" />
          </div>
          <button onClick={openCreate} className="clay-btn clay-btn-primary px-4 py-2.5 text-sm">
            + New Requirement
          </button>
        </div>

        <div className="clay-card overflow-hidden">
          {loading ? (
            <p className="text-center py-12 text-sm" style={{ color: '#7a8aaa' }}>Loading…</p>
          ) : requirements.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: '#7a8aaa' }}>No requirements set up yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="clay-table-head">
                <tr>
                  {['Requirement', 'Applies To', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: '#7a8aaa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {requirements.map(r => (
                  <tr key={r.id} className="clay-table-row">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold" style={{ color: '#0d1a33' }}>{r.name}</p>
                      {r.description && (
                        <p className="text-xs mt-0.5" style={{ color: '#7a8aaa' }}>{r.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm" style={{ color: '#4a5a7a' }}>
                      {r.scholarshipTypeName
                        ? r.scholarshipTypeName
                        : <span style={{ color: '#b0bdd0', fontStyle: 'italic' }}>All scholars</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      {r.isRequired ? (
                        <span className="clay-badge" style={{ background: '#dce8ff', color: '#003087', border: '1px solid #80aaee' }}>
                          Required
                        </span>
                      ) : (
                        <span className="clay-badge" style={{ background: '#e8edf5', color: '#7a8aaa', border: '1px solid rgba(0,0,0,0.08)' }}>
                          Optional
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          onClick={() => openEdit(r)}
                          className="text-xs font-medium hover:underline"
                          style={{ color: '#003087' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="text-xs font-medium hover:underline"
                          style={{ color: '#e03030' }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <RequirementModal
          initial={editing}
          scholarshipTypes={scholarshipTypes}
          token={token}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </Layout>
  );
}

function RequirementModal({ initial, scholarshipTypes, token, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:             initial?.name ?? '',
    description:      initial?.description ?? '',
    isRequired:       initial?.isRequired ?? true,
    scholarshipTypeId: initial?.scholarshipTypeId?.toString() ?? '',
  });
  const [error, setError]         = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        name:             form.name.trim(),
        description:      form.description.trim() || null,
        isRequired:       form.isRequired,
        scholarshipTypeId: form.scholarshipTypeId ? parseInt(form.scholarshipTypeId) : null,
      };
      if (initial) {
        await updateRequirement(initial.id, payload, token);
      } else {
        await createRequirement(payload, token);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ClayModal title={initial ? 'Edit Requirement' : 'New Requirement'} onClose={onClose}>
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Requirement Name">
          <input
            required
            value={form.name}
            onChange={e => set('name', e.target.value)}
            className="clay-input"
            placeholder="e.g. Certificate of Registration (COR)"
          />
        </Field>

        <Field label="Description (optional)">
          <textarea
            rows={2}
            value={form.description}
            onChange={e => set('description', e.target.value)}
            className="clay-input"
            placeholder="Brief note on what the scholar should submit…"
          />
        </Field>

        <Field label="Applies To">
          <select
            value={form.scholarshipTypeId}
            onChange={e => set('scholarshipTypeId', e.target.value)}
            className="clay-input"
          >
            <option value="">All scholars (no restriction)</option>
            {scholarshipTypes.map(st => (
              <option key={st.id} value={st.id}>{st.name}</option>
            ))}
          </select>
        </Field>

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.isRequired}
            onChange={e => set('isRequired', e.target.checked)}
            className="w-4 h-4 rounded"
            style={{ accentColor: '#003087' }}
          />
          <span className="text-sm font-medium" style={{ color: '#0d1a33' }}>
            Mark as required
          </span>
          <span className="text-xs" style={{ color: '#7a8aaa' }}>
            (required docs block compliance if missing)
          </span>
        </label>

        <ModalButtons
          onClose={onClose}
          submitting={submitting}
          label={initial ? 'Save Changes' : 'Create Requirement'}
        />
      </form>
    </ClayModal>
  );
}
