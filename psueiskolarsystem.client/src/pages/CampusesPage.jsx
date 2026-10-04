import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import Field from '../components/Field';
import { TableSkeleton } from '../components/ListState';
import { useAuth } from '../context/AuthContext';
import { useToast, useConfirm } from '../context/UIContext';
import { useTitle } from '../hooks/useTitle';
import {
  getCampuses, createCampus, updateCampus, setCampusPrograms, deleteCampus,
  createProgram, updateProgram, deleteProgram,
} from '../api/campuses';
import { getPrograms } from '../api/lookups';
import { Building2, BookOpen, Plus, Pencil, Trash2, Check } from 'lucide-react';

/**
 * Campuses and the courses each one offers. This is what narrows the course list on the
 * sign-up form and the program filter on the Scholars page to the chosen campus.
 */
export default function CampusesPage() {
  useTitle('Campuses & Programs');
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [campuses, setCampuses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [offered, setOffered] = useState(new Set());
  const [dirty, setDirty] = useState(false);
  const [savingPrograms, setSavingPrograms] = useState(false);

  const [campusForm, setCampusForm] = useState(null);
  const [programForm, setProgramForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function load(keepSelection = true) {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([getCampuses(token, { includeInactive: true }), getPrograms(token)]);
      setCampuses(c);
      setPrograms(p);
      const sel = (keepSelection && c.find(x => x.id === selectedId)) || c[0];
      if (sel) { setSelectedId(sel.id); setOffered(new Set(sel.programIds)); setDirty(false); }
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(false); }, []);

  const selected = useMemo(() => campuses.find(c => c.id === selectedId), [campuses, selectedId]);

  async function pickCampus(c) {
    if (dirty && !(await confirm({ title: 'Discard changes?', message: `Your program changes for ${selected?.name} are not saved.`, confirmLabel: 'Discard' }))) return;
    setSelectedId(c.id);
    setOffered(new Set(c.programIds));
    setDirty(false);
  }

  function toggle(id) {
    setOffered(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
    setDirty(true);
  }

  async function savePrograms() {
    setSavingPrograms(true);
    try {
      await setCampusPrograms(selectedId, [...offered], token);
      toast(`${selected.name} now offers ${offered.size} program${offered.size === 1 ? '' : 's'}.`, 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSavingPrograms(false);
    }
  }

  async function saveCampus(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const body = { name: campusForm.name.trim(), code: campusForm.code.trim(), isActive: campusForm.isActive };
      if (campusForm.id) await updateCampus(campusForm.id, body, token);
      else await createCampus(body, token);
      toast('Campus saved.', 'success');
      setCampusForm(null);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveProgram(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const body = { name: programForm.name.trim(), code: programForm.code.trim(), major: programForm.major?.trim() || null, campusIds: programForm.id ? null : (selectedId ? [selectedId] : []) };
      if (programForm.id) await updateProgram(programForm.id, body, token);
      else await createProgram(body, token);
      toast('Program saved.', 'success');
      setProgramForm(null);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeCampus(c) {
    if (!(await confirm({ title: `Delete ${c.name}?`, message: 'Only a campus with no scholars or grantees can be deleted.', confirmLabel: 'Delete', danger: true }))) return;
    try { await deleteCampus(c.id, token); toast('Campus deleted.', 'success'); load(false); }
    catch (e) { toast(e.message, 'error'); }
  }

  async function removeProgram(p) {
    if (!(await confirm({ title: `Delete ${p.code}?`, message: 'Only a program not recorded on any profile can be deleted.', confirmLabel: 'Delete', danger: true }))) return;
    try { await deleteProgram(p.id, token); toast('Program deleted.', 'success'); load(); }
    catch (e) { toast(e.message, 'error'); }
  }

  return (
    <Layout>
      <div className="page-shell">
        <div className="page-head">
          <div>
            <h1 className="page-title">Campuses &amp; Programs</h1>
            <p className="page-subtitle">Choose a campus, then tick the courses it offers. Sign-up only shows these courses for that campus.</p>
            <span className="page-title-bar" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setFormError(''); setProgramForm({ name: '', code: '', major: '' }); }} className="clay-btn clay-btn-ghost text-sm px-4 flex items-center gap-2">
              <BookOpen size={15} /> Add Program
            </button>
            <button onClick={() => { setFormError(''); setCampusForm({ name: '', code: '', isActive: true }); }} className="clay-btn clay-btn-primary text-sm px-4 flex items-center gap-2">
              <Plus size={15} /> Add Campus
            </button>
          </div>
        </div>

        {loading && campuses.length === 0 ? <div className="clay-card"><TableSkeleton /></div> : (
          <div className="grid lg:grid-cols-[300px_1fr] gap-5">
            <div className="clay-card p-2 h-fit">
              {campuses.map(c => (
                <div key={c.id}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer"
                  onClick={() => pickCampus(c)}
                  style={{ background: c.id === selectedId ? 'rgba(0,48,135,0.08)' : 'transparent' }}>
                  <Building2 size={15} style={{ color: c.isActive ? 'var(--accent-strong)' : 'var(--text-faint)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-strong)' }}>{c.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {c.code} · {c.programIds.length} programs · {c.scholarCount} scholars{c.granteeCount ? ` · ${c.granteeCount} grantees` : ''}
                      {!c.isActive && ' · inactive'}
                    </p>
                  </div>
                  <button className="p-1.5 rounded-lg" aria-label={`Edit ${c.name}`} title="Edit"
                    onClick={e => { e.stopPropagation(); setFormError(''); setCampusForm({ id: c.id, name: c.name, code: c.code, isActive: c.isActive }); }}>
                    <Pencil size={13} style={{ color: 'var(--accent)' }} />
                  </button>
                  {c.scholarCount === 0 && c.granteeCount === 0 && (
                    <button className="p-1.5 rounded-lg" aria-label={`Delete ${c.name}`} title="Delete"
                      onClick={e => { e.stopPropagation(); removeCampus(c); }}>
                      <Trash2 size={13} style={{ color: 'var(--danger)' }} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {selected && (
              <div className="clay-card p-5">
                <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                  <div>
                    <p className="font-black" style={{ color: 'var(--text-strong)' }}>Programs offered at {selected.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{offered.size} of {programs.length} selected</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="clay-btn clay-btn-ghost text-xs px-3" onClick={() => { setOffered(new Set(programs.map(p => p.id))); setDirty(true); }}>Select all</button>
                    <button className="clay-btn clay-btn-ghost text-xs px-3" onClick={() => { setOffered(new Set()); setDirty(true); }}>Clear</button>
                    <button className="clay-btn clay-btn-primary text-xs px-4" disabled={!dirty || savingPrograms} onClick={savePrograms}
                      style={{ opacity: !dirty || savingPrograms ? 0.6 : 1 }}>
                      {savingPrograms ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {programs.map(p => {
                    const on = offered.has(p.id);
                    return (
                      <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                        style={{ background: on ? 'rgba(0,48,135,0.06)' : 'var(--surface-inset)', border: `1.5px solid ${on ? 'var(--accent-strong)' : 'transparent'}` }}>
                        <button type="button" onClick={() => toggle(p.id)} className="flex items-center gap-2 flex-1 text-left min-w-0"
                          role="checkbox" aria-checked={on}>
                          <span className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                            style={{ background: on ? 'var(--accent-strong)' : 'var(--input-bg)', border: `1.5px solid ${on ? 'var(--accent-strong)' : 'var(--text-faint)'}` }}>
                            {on && <Check size={11} color="#fff" strokeWidth={3.5} />}
                          </span>
                          <span className="text-sm truncate" style={{ color: 'var(--text-strong)' }}>
                            <strong>{p.code}</strong> · {p.name}
                          </span>
                        </button>
                        <button className="p-1 rounded" aria-label={`Edit ${p.code}`} title="Edit program"
                          onClick={() => { setFormError(''); setProgramForm({ id: p.id, name: p.baseName ?? p.name, code: p.code, major: p.major ?? '' }); }}>
                          <Pencil size={12} style={{ color: 'var(--accent)' }} />
                        </button>
                        <button className="p-1 rounded" aria-label={`Delete ${p.code}`} title="Delete program" onClick={() => removeProgram(p)}>
                          <Trash2 size={12} style={{ color: 'var(--danger)' }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {campusForm && (
        <Modal title={campusForm.id ? 'Edit Campus' : 'Add Campus'} onClose={() => setCampusForm(null)} dismissible={!saving}>
          <form onSubmit={saveCampus} className="space-y-4">
            {formError && <p role="alert" className="text-sm p-3 rounded-2xl" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{formError}</p>}
            <Field label="Campus Name"><input required maxLength={100} value={campusForm.name} onChange={e => setCampusForm(v => ({ ...v, name: e.target.value }))} className="clay-input" /></Field>
            <Field label="Code"><input required maxLength={20} value={campusForm.code} onChange={e => setCampusForm(v => ({ ...v, code: e.target.value.toUpperCase() }))} className="clay-input" /></Field>
            <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-strong)' }}>
              <input type="checkbox" checked={campusForm.isActive} onChange={e => setCampusForm(v => ({ ...v, isActive: e.target.checked }))} />
              Active (shown on the sign-up form)
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setCampusForm(null)} className="clay-btn clay-btn-ghost text-sm px-4">Cancel</button>
              <button type="submit" disabled={saving} className="clay-btn clay-btn-primary text-sm px-5">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {programForm && (
        <Modal title={programForm.id ? 'Edit Program' : 'Add Program'}
          subtitle={!programForm.id && selected ? `It will be offered at ${selected.name}; tick it for other campuses afterwards.` : undefined}
          onClose={() => setProgramForm(null)} dismissible={!saving}>
          <form onSubmit={saveProgram} className="space-y-4">
            {formError && <p role="alert" className="text-sm p-3 rounded-2xl" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{formError}</p>}
            <Field label="Program Name"><input required maxLength={200} value={programForm.name} onChange={e => setProgramForm(v => ({ ...v, name: e.target.value }))} className="clay-input" placeholder="BS Information Technology" /></Field>
            <Field label="Major (optional)">
              <input maxLength={150} value={programForm.major ?? ''} onChange={e => setProgramForm(v => ({ ...v, major: e.target.value }))} className="clay-input" placeholder="Operations Management" />
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                Only for programs offered in several majors. It is shown as
                {' '}<strong>{(programForm.name || 'BS Business Administration').trim()} (Major in {(programForm.major || 'Operations Management').trim()})</strong>.
                Add each major as its own program with its own code, e.g. BSBA-OM.
              </p>
            </Field>
            <Field label="Code"><input required maxLength={20} value={programForm.code} onChange={e => setProgramForm(v => ({ ...v, code: e.target.value.toUpperCase() }))} className="clay-input" placeholder="BSIT" /></Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setProgramForm(null)} className="clay-btn clay-btn-ghost text-sm px-4">Cancel</button>
              <button type="submit" disabled={saving} className="clay-btn clay-btn-primary text-sm px-5">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
}
