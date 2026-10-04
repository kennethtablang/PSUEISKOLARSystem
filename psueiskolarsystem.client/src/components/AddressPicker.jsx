import { useEffect, useId, useMemo, useState } from 'react';

/* Complete address as dropdowns — Region → Province → City / Municipality → Barangay — with only
   the house number and street typed by hand. The lists are the PSA's Philippine Standard
   Geographic Code, shipped as static files under /psgc (regions.json holds every province and
   municipality; each region's barangays load only once that region is picked).

   The address is still stored as one line, written the same way every time:
     "<HOUSE NO. / STREET>, <BARANGAY>, <CITY / MUNICIPALITY>, <PROVINCE>, <REGION>"
   so an address saved here can be read back into the dropdowns. */

const LABEL = 'block text-xs font-bold mb-1.5 uppercase tracking-wider';

let regionsPromise = null;
const barangayCache = new Map();

function loadRegions() {
  regionsPromise ??= fetch('/psgc/regions.json')
    .then(r => { if (!r.ok) throw new Error('regions'); return r.json(); })
    .catch(err => { regionsPromise = null; throw err; });
  return regionsPromise;
}

function loadBarangays(regionCode) {
  if (!barangayCache.has(regionCode)) {
    barangayCache.set(regionCode, fetch(`/psgc/barangays/${regionCode}.json`)
      .then(r => { if (!r.ok) throw new Error('barangays'); return r.json(); })
      .catch(err => { barangayCache.delete(regionCode); throw err; }));
  }
  return barangayCache.get(regionCode);
}

const norm = s => String(s ?? '').trim().toUpperCase();

/** Builds the one-line address from its parts; empty parts are left out. */
export function composeAddress({ street, barangay, city, province, region }) {
  return [street, barangay, city, province, region]
    .map(x => String(x ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * Reads a stored one-line address back into codes, matching from the end (region, province,
 * city) against the lists, then the barangay as a suffix of what is left — some barangay names
 * contain commas, so a plain split would cut them in two.
 */
async function parseAddress(text, regions) {
  const empty = { regionCode: '', provinceCode: '', cityCode: '', barangay: '', street: String(text ?? '') };
  const parts = String(text ?? '').split(',').map(x => x.trim());
  if (parts.length < 4) return empty;

  const region = regions.find(r => norm(r.short) === norm(parts.at(-1)) || norm(r.name) === norm(parts.at(-1)));
  if (!region) return empty;
  const province = region.provinces.find(p => norm(p.name) === norm(parts.at(-2)));
  if (!province) return { ...empty, regionCode: region.code };
  const city = province.cities.find(c => norm(c.name) === norm(parts.at(-3)));
  if (!city) return { ...empty, regionCode: region.code, provinceCode: province.code };

  const rest = parts.slice(0, -3).join(', ');
  let barangay = '';
  try {
    const list = (await loadBarangays(region.code))[city.code] ?? [];
    barangay = list
      .filter(b => norm(rest) === norm(b) || norm(rest).endsWith(', ' + norm(b)))
      .sort((a, b) => b.length - a.length)[0] ?? '';
  } catch { /* barangays unavailable — leave it unpicked */ }
  const street = barangay
    ? rest.slice(0, Math.max(0, rest.length - barangay.length)).replace(/,\s*$/, '').trim()
    : rest;
  return { regionCode: region.code, provinceCode: province.code, cityCode: city.code, barangay, street };
}

/**
 * Cascading address dropdowns. `value` / `onChange` carry the one-line address; `required`
 * marks every dropdown and the street line as required.
 */
export default function AddressPicker({ value, onChange, required = false, label = 'Complete Address' }) {
  const ids = { region: useId(), province: useId(), city: useId(), barangay: useId(), street: useId() };
  const [regions, setRegions] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [sel, setSel] = useState(null); // { regionCode, provinceCode, cityCode, barangay, street }
  const [barangays, setBarangays] = useState(null);

  useEffect(() => {
    let live = true;
    loadRegions().then(r => { if (live) setRegions(r); }).catch(() => { if (live) setLoadError(true); });
    return () => { live = false; };
  }, []);

  // Read the incoming address into the dropdowns once the lists are in.
  useEffect(() => {
    if (!regions || sel) return;
    let live = true;
    parseAddress(value, regions).then(p => { if (live) setSel(p); });
    return () => { live = false; };
  }, [regions, value, sel]);

  const region = useMemo(() => regions?.find(r => r.code === sel?.regionCode), [regions, sel?.regionCode]);
  const province = useMemo(() => region?.provinces.find(p => p.code === sel?.provinceCode), [region, sel?.provinceCode]);
  const city = useMemo(() => province?.cities.find(c => c.code === sel?.cityCode), [province, sel?.cityCode]);

  useEffect(() => {
    if (!region) { setBarangays(null); return; }
    let live = true;
    setBarangays(null);
    loadBarangays(region.code).then(b => { if (live) setBarangays(b); }).catch(() => { if (live) setLoadError(true); });
    return () => { live = false; };
  }, [region]);

  function update(next) {
    const merged = { ...sel, ...next };
    setSel(merged);
    const r = regions.find(x => x.code === merged.regionCode);
    const p = r?.provinces.find(x => x.code === merged.provinceCode);
    const c = p?.cities.find(x => x.code === merged.cityCode);
    onChange(composeAddress({
      street: merged.street.toUpperCase(),
      barangay: merged.barangay?.toUpperCase(),
      city: c?.name.toUpperCase(),
      province: p?.name.toUpperCase(),
      region: r?.short.toUpperCase(),
    }));
  }

  // The address lists could not be loaded (offline, blocked): fall back to typing it.
  if (loadError) {
    return (
      <div>
        <label htmlFor={ids.street} className={LABEL} style={{ color: 'var(--text)' }}>
          {label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}
        </label>
        <textarea id={ids.street} rows={2} required={required} maxLength={500} value={value ?? ''}
          onChange={e => onChange(e.target.value)} className="clay-input"
          placeholder="House no. / street, barangay, city / municipality, province, region" />
      </div>
    );
  }

  const loading = !regions || !sel;
  const cityBarangays = city && barangays ? (barangays[city.code] ?? []) : [];

  return (
    <fieldset className="space-y-3">
      <legend className={LABEL} style={{ color: 'var(--text)' }}>
        {label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </legend>
      <div className="grid sm:grid-cols-2 gap-3">
        <Pick id={ids.region} label="Region" required={required} disabled={loading}
          value={sel?.regionCode ?? ''} placeholder={loading ? 'Loading…' : '— Select region —'}
          options={(regions ?? []).map(r => ({ value: r.code, label: r.name }))}
          onChange={v => update({ regionCode: v, provinceCode: '', cityCode: '', barangay: '' })} />
        <Pick id={ids.province} label="Province" required={required} disabled={!region}
          value={sel?.provinceCode ?? ''} placeholder="— Select province —"
          options={(region?.provinces ?? []).map(p => ({ value: p.code, label: p.name }))}
          onChange={v => update({ provinceCode: v, cityCode: '', barangay: '' })} />
        <Pick id={ids.city} label="City / Municipality" required={required} disabled={!province}
          value={sel?.cityCode ?? ''} placeholder="— Select city / municipality —"
          options={(province?.cities ?? []).map(c => ({ value: c.code, label: c.name }))}
          onChange={v => update({ cityCode: v, barangay: '' })} />
        <Pick id={ids.barangay} label="Barangay" required={required} disabled={!city || !barangays}
          value={sel?.barangay ?? ''} placeholder={city && !barangays ? 'Loading…' : '— Select barangay —'}
          options={cityBarangays.map(b => ({ value: b, label: b }))}
          onChange={v => update({ barangay: v })} />
      </div>
      <div>
        <label htmlFor={ids.street} className="block text-[11px] font-bold mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          House No. / Street / Purok{required && <span style={{ color: 'var(--danger)' }}> *</span>}
        </label>
        <input id={ids.street} type="text" required={required} maxLength={150} disabled={loading}
          value={sel?.street ?? ''} onChange={e => update({ street: e.target.value.replace(/,/g, ' ') })}
          className="clay-input" style={{ textTransform: 'uppercase' }} placeholder="E.G. 123 RIZAL ST., PUROK 2" />
      </div>
    </fieldset>
  );
}

function Pick({ id, label, value, onChange, options, placeholder, required, disabled }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-bold mb-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)} required={required}
        disabled={disabled} className="clay-input">
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
