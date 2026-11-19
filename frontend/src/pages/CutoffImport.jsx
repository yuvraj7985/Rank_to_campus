import { useEffect, useState } from 'react';
import { Download, RefreshCw, Search, Upload } from 'lucide-react';
import api from '../services/api';

const template = [
  'collegeCode,branchCode,examName,year,round,category,openingRank,closingRank',
  `NVIT,CSE,JEE Main,${new Date().getFullYear()},1,OPEN,1,5000`
].join('\r\n');
const emptyFilters = { year: '', examName: '', category: '', collegeCode: '', branchCode: '' };
const columns = ['collegeCode', 'collegeName', 'location', 'branchCode', 'branchName', 'examName', 'year', 'round', 'category', 'openingRank', 'closingRank'];
const csvCell = (value) => {
  const text = String(value ?? '');
  const safeText = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
};

function downloadCsv(rows, filename) {
  const contents = [
    columns.join(','),
    ...rows.map((row) => [
      row.collegeCode || row.branch?.college?.code,
      row.collegeName || row.branch?.college?.name,
      row.location || row.branch?.college?.location,
      row.branchCode || row.branch?.code,
      row.branchName || row.branch?.name,
      row.examName,
      row.year,
      row.round,
      row.category,
      row.openingRank,
      row.closingRank
    ].map(csvCell).join(','))
  ].join('\r\n');
  const url = window.URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
}

export default function CutoffImport() {
  const [file, setFile] = useState(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState(emptyFilters);
  const [cutoffs, setCutoffs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadError, setLoadError] = useState('');

  const downloadTemplate = () => {
    const url = window.URL.createObjectURL(new Blob([template], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rank2campus-cutoff-template.csv';
    link.click();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
  };

  const loadCutoffs = async (targetPage = 1, activeFilters = filters) => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await api.get('/admin/cutoffs', {
        params: { ...activeFilters, page: targetPage, limit: 50 }
      });
      setCutoffs(response.data || []);
      setTotal(response.count || 0);
      setPage(response.page || targetPage);
      setPages(response.pages || 0);
    } catch (error) {
      setLoadError(error.message || 'Unable to load historical cutoff data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCutoffs(1, emptyFilters);
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    setErrors([]);
    if (!file) {
      setErrors(['Choose a CSV file first.']);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('replaceExisting', String(replaceExisting));
    setBusy(true);
    try {
      const response = await api.post('/admin/cutoffs/import', formData);
      setMessage(response.message);
      setErrors(response.data?.errors || []);
      if (response.data?.imported || response.data?.updated) {
        setFile(null);
        await loadCutoffs(1);
      }
    } catch (error) {
      setMessage(error.message || 'Unable to import cutoff data.');
      setErrors(error.errors || []);
    } finally {
      setBusy(false);
    }
  };

  const exportFiltered = async () => {
    setExporting(true);
    setLoadError('');
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value.trim())
      );
      const firstPage = await api.get('/admin/cutoffs', { params: { ...params, page: 1, limit: 100 } });
      const rows = [...(firstPage.data || [])];
      for (let currentPage = 2; currentPage <= (firstPage.pages || 0); currentPage += 1) {
        const response = await api.get('/admin/cutoffs', {
          params: { ...params, page: currentPage, limit: 100 }
        });
        rows.push(...(response.data || []));
      }
      downloadCsv(rows, 'rank2campus-historical-cutoffs.csv');
    } catch (error) {
      setLoadError(error.message || 'Unable to export historical cutoff data.');
    } finally {
      setExporting(false);
    }
  };

  const applyFilters = async (event) => {
    event.preventDefault();
    await loadCutoffs(1);
  };
  const clearFilters = () => {
    setFilters(emptyFilters);
    loadCutoffs(1, emptyFilters);
  };

  return (
    <>
      <div className="welcome-row">
        <div>
          <span className="eyebrow">HISTORICAL ADMISSIONS DATA</span>
          <h1>Cutoff data</h1>
          <p className="muted">Upload historical cutoffs, find imported records, and export the complete filtered dataset.</p>
        </div>
        <button className="btn secondary" type="button" onClick={downloadTemplate}>
          <Download size={15} /> Download template
        </button>
      </div>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Upload historical data</h2>
            <p className="muted">CSV files can contain up to 1,000 validated rows.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={submit}>
          <label className="file-label">CSV file (maximum 1 MB)
            <input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </label>
          <label className="import-option">
            <input type="checkbox" checked={replaceExisting} onChange={(event) => setReplaceExisting(event.target.checked)} />
            Update existing cutoffs with matching branch, year, round and category
          </label>
          <div className="form-action">
            <button className="btn primary" disabled={busy}>
              <Upload size={15} /> {busy ? 'Importing…' : 'Validate and import'}
            </button>
          </div>
        </form>
        <p className="muted">Required columns: collegeCode, branchCode, year, category, closingRank. Optional columns: collegeName, location, branchName, examName, round, openingRank. Categories accept OPEN/GENERAL/GEN/UR, EWS, OBC/OBC-NCL, SC, or ST; OBC is stored as OBC-NCL. Historical cutoffs are saved independently of the active college/branch catalog. When a matching branch exists, its catalog record is linked; otherwise the supplied codes and optional names are retained as historical snapshots.</p>
        {message && <div className={`alert ${errors.length ? 'error' : 'success'}`}>{message}</div>}
        {errors.length > 0 && <ul className="import-errors">{errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul>}
      </section>

      <section className="panel historical-cutoff-panel">
        <div className="section-heading">
          <div>
            <h2>Browse historical cutoffs</h2>
            <p className="muted">{total.toLocaleString()} matching records · Filter by exact year, exam, category, and catalog codes.</p>
          </div>
          <div className="row-actions">
            <button className="btn secondary" type="button" onClick={() => loadCutoffs(page)} disabled={loading}>
              <RefreshCw size={15} /> Refresh
            </button>
            <button className="btn secondary" type="button" onClick={exportFiltered} disabled={exporting || total === 0}>
              <Download size={15} /> {exporting ? 'Exporting…' : 'Export filtered data'}
            </button>
          </div>
        </div>
        <form className="form-grid cutoff-filters" onSubmit={applyFilters}>
          <label>Year<input type="number" min="1990" max={new Date().getFullYear() + 2} value={filters.year} onChange={(event) => setFilters({ ...filters, year: event.target.value })} /></label>
          <label>Exam<input value={filters.examName} onChange={(event) => setFilters({ ...filters, examName: event.target.value })} placeholder="JEE Main" /></label>
          <label>Category<select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">All categories</option>{['OPEN', 'EWS', 'OBC-NCL', 'SC', 'ST'].map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>College code<input value={filters.collegeCode} onChange={(event) => setFilters({ ...filters, collegeCode: event.target.value.trim() })} placeholder="NVIT" /></label>
          <label>Branch code<input value={filters.branchCode} onChange={(event) => setFilters({ ...filters, branchCode: event.target.value.trim() })} placeholder="CSE" /></label>
          <div className="form-action row-actions">
            <button className="btn primary" type="submit" disabled={loading}><Search size={15} /> Apply filters</button>
            <button className="btn secondary" type="button" onClick={clearFilters} disabled={loading}>Clear</button>
          </div>
        </form>
        {loadError && <div className="alert error">{loadError}</div>}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Year / Round</th><th>College</th><th>Branch</th><th>Exam</th><th>Category</th><th>Opening rank</th><th>Closing rank</th></tr></thead>
            <tbody>{cutoffs.map((cutoff) => (
              <tr key={cutoff._id}>
                <td>{cutoff.year} · {cutoff.round}</td>
                <td>{cutoff.branch?.college?.name || 'Unknown college'} <small>{cutoff.branch?.college?.code || ''}</small></td>
                <td>{cutoff.branch?.name || 'Unknown branch'} <small>{cutoff.branch?.code || ''}</small></td>
                <td>{cutoff.examName}</td>
                <td>{cutoff.category}</td>
                <td>{cutoff.openingRank ?? '—'}</td>
                <td>{cutoff.closingRank}</td>
              </tr>
            ))}</tbody>
          </table>
          {!loading && !cutoffs.length && !loadError && <div className="empty">No historical cutoffs match these filters.</div>}
          {loading && <div className="empty">Loading cutoff records…</div>}
        </div>
        {pages > 1 && <div className="cutoff-pagination">
          <span>Page {page} of {pages}</span>
          <div className="row-actions">
            <button className="btn secondary" type="button" disabled={loading || page <= 1} onClick={() => loadCutoffs(page - 1)}>Previous</button>
            <button className="btn secondary" type="button" disabled={loading || page >= pages} onClick={() => loadCutoffs(page + 1)}>Next</button>
          </div>
        </div>}
      </section>
    </>
  );
}
