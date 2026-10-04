import { useState } from 'react';
import { FileSpreadsheet, Printer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import { downloadListReport } from '../api/listReports';

/**
 * Export the list on screen, with the filters on screen: Excel to work with the figures,
 * PDF for a printable copy. `dataset` is masterlist, scholars or grantees.
 */
export default function ExportButtons({ dataset, filters, compact = false }) {
  const { token } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState('');

  async function run(format) {
    setBusy(format);
    try {
      await downloadListReport(dataset, format, filters, token);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  }

  const cls = `clay-btn clay-btn-ghost ${compact ? 'text-xs px-3 py-1.5' : 'text-sm px-4'} flex items-center gap-2`;
  return (
    <div className="flex gap-2" role="group" aria-label="Export this list">
      <button type="button" onClick={() => run('xlsx')} disabled={!!busy} className={cls} title="Download as an Excel workbook">
        <FileSpreadsheet size={compact ? 13 : 15} /> {busy === 'xlsx' ? 'Exporting…' : 'Excel'}
      </button>
      <button type="button" onClick={() => run('pdf')} disabled={!!busy} className={cls} title="Download a printable PDF">
        <Printer size={compact ? 13 : 15} /> {busy === 'pdf' ? 'Preparing…' : 'Print / PDF'}
      </button>
    </div>
  );
}
