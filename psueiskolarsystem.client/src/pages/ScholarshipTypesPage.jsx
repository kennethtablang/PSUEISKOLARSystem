import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import {
  getScholarshipTypes, createScholarshipType, updateScholarshipType,
  toggleScholarshipTypeActive, deleteScholarshipType,
} from '../api/scholarshipTypes';
import { getRequirements } from '../api/documents';
import { useTitle } from '../hooks/useTitle';
import { ErrorBox, Field, ModalButtons } from './UsersPage';

export default function ScholarshipTypesPage() {
  useTitle('Scholarship Types');
  const { token } = useAuth();
  const [types, setTypes] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const displayed = search
    ? types.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.category ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (t.description ?? '').toLowerCase().includes(search.toLowerCase()))
    : types;

  async function load() {
    setLoading(true);
    try {
      const [t, r] = await Promise.all([
        getScholarshipTypes(token),
        getRequirements(token),
      ]);
      setTypes(t);
      setRequirements(r);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(id) {
    try {
      const { isActive } = await toggleScholarshipTypeActive(id, token);
      setTypes(prev => prev.map(t => t.id === id ? { ...t, isActive } : t));
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this scholarship type? This cannot be undone.')) return;
    try {
      await deleteScholarshipType(id, token);
      setTypes(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      alert(e.message);
    }
  }

  function openCreate() { setEditing(null); setShowModal(true); }
  function openEdit(st) { setEditing(st); setShowModal(true); }

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">Scholarship Types</h1>
            <p className="page-subtitle">
              Define scholarship types and the documents each type requires.
            </p>
            <span className="page-title-bar" />
          </div>
          <button onClick={openCreate} className="clay-btn clay-btn-primary px-4 py-2.5 text-sm">
            + New Scholarship Type
          </button>
        </div>

        <div className="mb-4">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="clay-input"
            style={{ height: 36, minHeight: 36, fontSize: 12.5, padding: '0 10px', width: 240 }}
            placeholder="Search scholarship types…"
          />
        </div>

        <div className="clay-card overflow-hidden">
          {loading ? (
            <p className="text-center py-12 text-sm" style={{ color: '#7a8aaa' }}>Loading…</p>
          ) : displayed.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: '#7a8aaa' }}>No scholarship types found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="clay-table-head">
                <tr>
                  {['Scholarship Type', 'Min GWA', 'Required Documents', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: '#7a8aaa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(st => (
                  <tr key={st.id} className="clay-table-row">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold" style={{ color: '#0d1a33' }}>{st.name}</p>
                        {st.category && (
                          <span className="text-xs px-1.5 py-0.5 rounded-xl font-medium"
                            style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd' }}>
                            {st.category}
                          </span>
                        )}
                      </div>
                      {st.description && (
                        <p className="text-xs mt-0.5" style={{ color: '#7a8aaa' }}>{st.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-sm" style={{ color: '#0d1a33' }}>
                      {st.minimumGwa.toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5">
                      {st.requirements.length === 0 ? (
                        <span className="text-xs italic" style={{ color: '#b0bdd0' }}>All requirements (none configured)</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {st.requirements.slice(0, 3).map(r => (
                            <span key={r.requirementId} className="clay-badge text-xs"
                              style={{ background: '#dce8ff', color: '#003087', border: '1px solid #80aaee' }}>
                              {r.name}
                            </span>
                          ))}
                          {st.requirements.length > 3 && (
                            <span className="clay-badge text-xs"
                              style={{ background: '#e8edf5', color: '#7a8aaa', border: '1px solid rgba(0,0,0,0.08)' }}>
                              +{st.requirements.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {st.isActive ? (
                        <span className="clay-badge" style={{ background: '#d4f4e2', color: '#166534', border: '1px solid #86efac' }}>
                          Active
                        </span>
                      ) : (
                        <span className="clay-badge" style={{ background: '#f5e8e8', color: '#991b1b', border: '1px solid #fca5a5' }}>
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          onClick={() => openEdit(st)}
                          className="text-xs font-medium hover:underline"
                          style={{ color: '#003087' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggle(st.id)}
                          className="text-xs font-medium hover:underline"
                          style={{ color: st.isActive ? '#b45309' : '#166534' }}
                        >
                          {st.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDelete(st.id)}
                          className="text-xs font-medium hover:underline"
                          style={{ color: '#e03030' }}
                        >
                          Delete
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
        <ScholarshipTypeModal
          initial={editing}
          allRequirements={requirements}
          token={token}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </Layout>
  );
}

function ScholarshipTypeModal({ initial, allRequirements, token, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:           initial?.name ?? '',
    description:    initial?.description ?? '',
    category:       initial?.category ?? '',
    minimumGwa:     initial?.minimumGwa?.toString() ?? '2.50',
    requirementIds: initial?.requirementIds ?? [],
  });
  const [error, setError]           = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function toggleReq(id) {
    setForm(f => ({
      ...f,
      requirementIds: f.requirementIds.includes(id)
        ? f.requirementIds.filter(r => r !== id)
        : [...f.requirementIds, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const gwa = parseFloat(form.minimumGwa);
    if (isNaN(gwa) || gwa < 1 || gwa > 5) {
      setError('Minimum GWA must be between 1.00 and 5.00');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name:           form.name.trim(),
        description:    form.description.trim() || null,
        category:       form.category || null,
        minimumGwa:     gwa,
        requirementIds: form.requirementIds,
      };
      if (initial) {
        await updateScholarshipType(initial.id, payload, token);
      } else {
        await createScholarshipType(payload, token);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() { if (!submitting) onClose(); }

  const required = allRequirements.filter(r => r.isRequired);
  const optional = allRequirements.filter(r => !r.isRequired);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,20,60,0.45)' }}>
      <div className="clay-card-modal w-full p-7" style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 className="text-base font-black mb-5" style={{ color: '#0d1a33' }}>
          {initial ? `Edit: ${initial.name}` : 'New Scholarship Type'}
        </h2>
      {error && <ErrorBox>{error}</ErrorBox>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name">
          <input
            required
            value={form.name}
            onChange={e => set('name', e.target.value)}
            className="clay-input"
            placeholder="e.g. DOST-SEI Scholarship"
          />
        </Field>

        <Field label="Description (optional)">
          <textarea
            rows={2}
            value={form.description}
            onChange={e => set('description', e.target.value)}
            className="clay-input"
            placeholder="Brief description of this scholarship program…"
          />
        </Field>

        <Field label="Category">
          <select value={form.category} onChange={e => set('category', e.target.value)} className="clay-input">
            <option value="">— Uncategorized —</option>
            {['Government', 'Private', 'Institutional', 'Local (LGU)', 'International', 'Other'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>

        <Field label="Minimum GWA Requirement">
          <input
            required
            type="number"
            step="0.01"
            min="1.00"
            max="5.00"
            value={form.minimumGwa}
            onChange={e => set('minimumGwa', e.target.value)}
            className="clay-input"
            style={{ maxWidth: 120 }}
          />
          <p className="text-xs mt-1" style={{ color: '#7a8aaa' }}>
            Scholars below this GWA will be flagged. (1.00 = highest, 5.00 = lowest)
          </p>
        </Field>

        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: '#0d1a33' }}>
            Required Documents for this Scholarship
          </label>
          <p className="text-xs mb-3" style={{ color: '#7a8aaa' }}>
            Check each document that scholars under this scholarship type must submit.
            Leave all unchecked to show all documents.
          </p>

          {allRequirements.length === 0 ? (
            <p className="text-xs italic" style={{ color: '#b0bdd0' }}>
              No document requirements found. Add some in the Requirements page first.
            </p>
          ) : (
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(0,37,112,0.12)' }}>
              {required.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-xs font-bold uppercase tracking-wider" style={{ background: '#f0f4fb', color: '#7a8aaa' }}>
                    Mandatory Documents
                  </p>
                  {required.map(r => (
                    <RequirementCheckRow
                      key={r.id}
                      req={r}
                      checked={form.requirementIds.includes(r.id)}
                      onChange={() => toggleReq(r.id)}
                    />
                  ))}
                </div>
              )}
              {optional.length > 0 && (
                <div>
                  <p className="px-4 py-2 text-xs font-bold uppercase tracking-wider" style={{ background: '#f0f4fb', color: '#7a8aaa', borderTop: required.length > 0 ? '1px solid rgba(0,37,112,0.08)' : undefined }}>
                    Optional Documents
                  </p>
                  {optional.map(r => (
                    <RequirementCheckRow
                      key={r.id}
                      req={r}
                      checked={form.requirementIds.includes(r.id)}
                      onChange={() => toggleReq(r.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <ModalButtons
          onClose={onClose}
          submitting={submitting}
          label={initial ? 'Save Changes' : 'Create Scholarship Type'}
        />
      </form>
      </div>
    </div>
  );
}

function RequirementCheckRow({ req, checked, onChange }) {
  return (
    <label
      className="flex items-start gap-3 px-4 py-3 cursor-pointer select-none"
      style={{
        borderTop: '1px solid rgba(0,37,112,0.06)',
        background: checked ? 'rgba(0,37,112,0.03)' : 'transparent',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 w-4 h-4 rounded"
        style={{ accentColor: '#003087', flexShrink: 0 }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: '#0d1a33' }}>{req.name}</p>
        {req.description && (
          <p className="text-xs mt-0.5" style={{ color: '#7a8aaa' }}>{req.description}</p>
        )}
      </div>
    </label>
  );
}
