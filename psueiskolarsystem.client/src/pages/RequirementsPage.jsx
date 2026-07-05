import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { getRequirements, createRequirement, updateRequirement, deleteRequirement,
  uploadRequirementSample, getRequirementSample, deleteRequirementSample } from '../api/documents';
import { useTitle } from '../hooks/useTitle';
import { ClayModal, ErrorBox, Field, ModalButtons } from './UsersPage';
import { ImageIcon, X } from 'lucide-react';

export default function RequirementsPage() {
  useTitle('Document Requirements');
  const { token } = useAuth();
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewSample, setViewSample] = useState(null); // object URL being previewed
  const [busySample, setBusySample] = useState(null); // requirement id uploading
  const [search, setSearch] = useState('');

  const displayed = search
    ? requirements.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.description ?? '').toLowerCase().includes(search.toLowerCase()))
    : requirements;

  async function handleUploadSample(id, file) {
    if (!file) return;
    setBusySample(id);
    try { await uploadRequirementSample(id, file, token); await load(); }
    catch (e) { alert(e.message); }
    finally { setBusySample(null); }
  }
  async function handleViewSample(id) {
    try { setViewSample(await getRequirementSample(id, token)); }
    catch (e) { alert(e.message); }
  }
  async function handleRemoveSample(id) {
    if (!confirm('Remove the sample image for this requirement?')) return;
    try { await deleteRequirementSample(id, token); await load(); }
    catch (e) { alert(e.message); }
  }

  async function load() {
    setLoading(true);
    try {
      setRequirements(await getRequirements(token));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    if (!confirm('Remove this requirement? Scholars with this requirement assigned will no longer see it.')) return;
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
              {requirements.length} active requirement{requirements.length !== 1 ? 's' : ''} — assign them to scholarship types on the Scholarship Types page.
            </p>
            <span className="page-title-bar" />
          </div>
          <button onClick={openCreate} className="clay-btn clay-btn-primary px-4 py-2.5 text-sm">
            + New Requirement
          </button>
        </div>

        <div className="mb-4">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="clay-input"
            style={{ height: 36, minHeight: 36, fontSize: 12.5, padding: '0 10px', width: 240 }}
            placeholder="Search requirements…"
          />
        </div>

        <div className="clay-card overflow-hidden">
          {loading ? (
            <p className="text-center py-12 text-sm" style={{ color: '#7a8aaa' }}>Loading…</p>
          ) : displayed.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: '#7a8aaa' }}>No requirements found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="clay-table-head">
                <tr>
                  {['Requirement', 'Status', 'Sample', ''].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: '#7a8aaa' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map(r => (
                  <tr key={r.id} className="clay-table-row">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold" style={{ color: '#0d1a33' }}>{r.name}</p>
                      {r.description && (
                        <p className="text-xs mt-0.5" style={{ color: '#7a8aaa' }}>{r.description}</p>
                      )}
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
                    <td className="px-5 py-3.5">
                      {r.hasSample ? (
                        <div className="flex items-center gap-2.5 text-xs">
                          <button onClick={() => handleViewSample(r.id)} className="font-medium hover:underline flex items-center gap-1" style={{ color: '#003087' }}>
                            <ImageIcon size={12} /> View
                          </button>
                          <label className="font-medium hover:underline cursor-pointer" style={{ color: '#1a3a7a' }}>
                            {busySample === r.id ? 'Uploading…' : 'Replace'}
                            <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden"
                              onChange={e => { if (e.target.files?.[0]) handleUploadSample(r.id, e.target.files[0]); e.target.value = ''; }} />
                          </label>
                          <button onClick={() => handleRemoveSample(r.id)} className="font-medium hover:underline" style={{ color: '#e03030' }}>Remove</button>
                        </div>
                      ) : (
                        <label className="text-xs font-medium hover:underline cursor-pointer flex items-center gap-1" style={{ color: '#7a8aaa' }}>
                          <ImageIcon size={12} /> {busySample === r.id ? 'Uploading…' : 'Add sample'}
                          <input type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden"
                            onChange={e => { if (e.target.files?.[0]) handleUploadSample(r.id, e.target.files[0]); e.target.value = ''; }} />
                        </label>
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
          token={token}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}

      {viewSample && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-6" style={{ background: 'rgba(0,20,60,0.6)' }}
          onClick={() => { URL.revokeObjectURL(viewSample); setViewSample(null); }}>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => { URL.revokeObjectURL(viewSample); setViewSample(null); }}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
              <X size={16} color="#0d1a33" strokeWidth={2.5} />
            </button>
            <img src={viewSample} alt="Document sample" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }} />
          </div>
        </div>
      )}
    </Layout>
  );
}

function RequirementModal({ initial, token, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:        initial?.name ?? '',
    description: initial?.description ?? '',
    isRequired:  initial?.isRequired ?? true,
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
        name:        form.name.trim(),
        description: form.description.trim() || null,
        isRequired:  form.isRequired,
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
