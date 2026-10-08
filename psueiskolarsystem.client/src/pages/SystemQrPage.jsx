import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Printer, Copy, LogIn, UserPlus, Home } from 'lucide-react';
import Layout from '../components/Layout';
import Field from '../components/Field';
import { useToast } from '../context/UIContext';
import { useTitle } from '../hooks/useTitle';
import logoPsu from '../assets/logo-psu.png';

// Where the code can send a scholar. The address is this site's own, so a code made on the
// deployed system points at the deployed system.
const TARGETS = [
  { path: '/login',    label: 'Sign in',        Icon: LogIn,    caption: 'Scan to sign in to PSU e-Iskolar' },
  { path: '/register', label: 'Create account', Icon: UserPlus, caption: 'Scan to create your PSU e-Iskolar account' },
  { path: '/',         label: 'Home page',      Icon: Home,     caption: 'Scan to open PSU e-Iskolar' },
];

/**
 * A QR code for the system itself, made by the administrator to post at the scholarship
 * office or hand out at orientation: a scholar scans it instead of typing the address.
 */
export default function SystemQrPage() {
  useTitle('System QR Code');
  const toast = useToast();
  const canvasRef = useRef(null);
  const [target, setTarget] = useState(TARGETS[0]);
  const [url, setUrl] = useState(window.location.origin + TARGETS[0].path);

  function pick(t) {
    setTarget(t);
    setUrl(window.location.origin + t.path);
  }

  const valid = /^https?:\/\/\S+$/i.test(url.trim());
  const pngData = () => canvasRef.current?.toDataURL('image/png');

  function download() {
    const data = pngData();
    if (!data) return;
    const a = document.createElement('a');
    a.href = data;
    a.download = `psu-e-iskolar-qr-${target.label.toLowerCase().replace(/\s+/g, '-')}.png`;
    a.click();
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(url.trim()); toast('Link copied.', 'success'); }
    catch { toast('Could not copy the link — select it and copy it instead.', 'error'); }
  }

  // A one-page poster: logo, title, the code and the address underneath for anyone without a camera.
  function print() {
    const data = pngData();
    if (!data) return;
    const esc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
    const w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups to print the QR code.', 'error'); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>PSU e-Iskolar QR Code</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;color:#0d1a33;text-align:center;padding:48px 24px;}
      .logo{width:90px;height:90px;object-fit:contain;} h1{color:#002570;font-size:30px;margin:14px 0 4px;}
      .sub{color:#556;font-size:15px;margin:0 0 28px;} .qr{width:340px;height:340px;border:10px solid #f5b800;border-radius:18px;padding:12px;}
      .cap{font-size:20px;font-weight:bold;margin:24px 0 6px;} .url{color:#556;font-size:14px;word-break:break-all;}</style></head><body>
      <img class="logo" src="${window.location.origin}${logoPsu}" alt="">
      <h1>PSU e-Iskolar</h1>
      <p class="sub">Pangasinan State University · Scholar Management System</p>
      <img class="qr" src="${data}" alt="QR code">
      <p class="cap">${esc(target.caption)}</p>
      <p class="url">${esc(url.trim())}</p>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  return (
    <Layout>
      <div className="page-shell">
        <div className="page-head">
          <div>
            <h1 className="page-title">System QR Code</h1>
            <p className="page-subtitle">
              A QR code that opens PSU e-Iskolar. Print it for the scholarship office or orientation — scholars scan it
              with their phone camera instead of typing the address.
            </p>
            <span className="page-title-bar" />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
          <div className="clay-card p-6 space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Opens</p>
              <div className="flex gap-2 flex-wrap" role="group" aria-label="Where the QR code opens">
                {TARGETS.map(t => (
                  <button key={t.path} onClick={() => pick(t)} aria-pressed={target.path === t.path}
                    className="px-3 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-1.5"
                    style={target.path === t.path ? { background: '#002570', color: '#fff' } : { background: 'var(--surface-inset)', color: 'var(--text)' }}>
                    <t.Icon size={14} strokeWidth={2.4} /> {t.label}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Address" hint="Filled in with this system's address. Change it only if scholars reach the system through a different address (e.g. the public domain).">
              <input value={url} onChange={e => setUrl(e.target.value)} className="clay-input" spellCheck={false}
                aria-invalid={!valid} />
            </Field>
            {!valid && (
              <p role="alert" className="text-xs" style={{ color: 'var(--danger)' }}>Enter a full address starting with http:// or https://.</p>
            )}
            {valid && /localhost|127\.0\.0\.1/i.test(url) && (
              <p className="text-xs p-3 rounded-xl" style={{ background: 'var(--tone-warn-bg)', color: 'var(--tone-warn-fg)' }}>
                This address only works on this computer. Generate the code from the deployed system (or type its public
                address above) before printing it for scholars.
              </p>
            )}

            <div className="flex gap-2 flex-wrap pt-1">
              <button onClick={download} disabled={!valid} className="clay-btn clay-btn-primary px-4 py-2.5 text-sm flex items-center gap-1.5"
                style={{ opacity: valid ? 1 : 0.6 }}>
                <Download size={15} strokeWidth={2.4} /> Download PNG
              </button>
              <button onClick={print} disabled={!valid} className="clay-btn px-4 py-2.5 text-sm flex items-center gap-1.5"
                style={{ color: 'var(--accent)', opacity: valid ? 1 : 0.6 }}>
                <Printer size={15} strokeWidth={2.4} /> Print Poster
              </button>
              <button onClick={copyLink} disabled={!valid} className="clay-btn clay-btn-ghost px-4 py-2.5 text-sm flex items-center gap-1.5">
                <Copy size={15} strokeWidth={2.4} /> Copy Link
              </button>
            </div>
          </div>

          <div className="clay-card p-6 flex flex-col items-center text-center">
            <div className="rounded-2xl p-3" style={{ background: '#fff', border: '6px solid #f5b800' }}>
              {/* Always drawn black on white: an inverted code in dark mode won't scan reliably. */}
              <QRCodeCanvas
                ref={canvasRef}
                value={valid ? url.trim() : window.location.origin}
                size={280}
                marginSize={1}
                level="H"
                bgColor="#ffffff"
                fgColor="#002570"
                imageSettings={{ src: logoPsu, height: 56, width: 56, excavate: true }}
                title="PSU e-Iskolar QR code"
              />
            </div>
            <p className="text-sm font-bold mt-4" style={{ color: 'var(--text-strong)' }}>{target.caption}</p>
            <p className="text-xs mt-1 break-all" style={{ color: 'var(--text-muted)' }}>{url.trim()}</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
