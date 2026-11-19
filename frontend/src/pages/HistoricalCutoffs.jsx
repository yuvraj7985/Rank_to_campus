import { useEffect, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import api from '../services/api';

const emptyFilters = {
  year: '',
  examName: '',
  category: '',
  collegeCode: '',
  branchCode: '',
  rank: ''
};

const categories = ['OPEN', 'EWS', 'OBC-NCL', 'SC', 'ST'];

export default function HistoricalCutoffs() {
  const [filters, setFilters] = useState(emptyFilters);
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [profileNotice, setProfileNotice] = useState('');

  const load = async (targetPage = 1, activeFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const params = Object.fromEntries(
        Object.entries(activeFilters).filter(([, value]) => String(value).trim())
      );
      const response = await api.get('/predictor/history', {
        params: { ...params, page: targetPage, limit: 50 }
      });
      setRecords(Array.isArray(response.data) ? response.data : []);
      setTotal(response.count || 0);
      setPage(response.page || targetPage);
      setPages(response.pages || 0);
      setNotice(response.notice || '');
    } catch (requestError) {
      setError(requestError.message || 'Unable to load historical cutoff data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      let initialFilters = emptyFilters;
      try {
        const response = await api.get('/students/me');
        const profile = response.data?.data || response.data;
        initialFilters = {
          ...emptyFilters,
          ...(profile?.rank ? { rank: String(profile.rank) } : {}),
          ...(categories.includes(profile?.category) ? { category: profile.category } : {})
        };
      } catch {
        if (active) setProfileNotice('Your saved rank could not be loaded. Enter a rank below to compare it with historical closing ranks.');
      }
      if (active) {
        setFilters(initialFilters);
        await load(1, initialFilters);
      }
    };
    initialize();
    return () => { active = false; };
  }, []);

  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const applyFilters = async (event) => {
    event.preventDefault();
    await load(1);
  };
  const clearFilters = () => {
    setFilters(emptyFilters);
    load(1, emptyFilters);
  };
  const analysisCounts = records.reduce((counts, record) => {
    const chance = record.rankAnalysis?.chance;
    if (chance) counts[chance] += 1;
    return counts;
  }, { Safe: 0, Moderate: 0, Risky: 0 });

  return (
    <>
      <div className="welcome-row">
        <div>
          <span className="eyebrow">HISTORICAL ADMISSIONS DATA</span>
          <h1>Cutoff history</h1>
          <p className="muted">Explore previous admission cutoffs and compare your rank with published historical closing ranks.</p>
        </div>
      </div>
      <section className="panel student-history-panel">
        <div className="section-heading">
          <div>
            <h2>Search historical cutoffs</h2>
            <p className="muted">{total.toLocaleString()} matching records · Read-only reference data</p>
          </div>
          <button className="btn secondary" type="button" onClick={() => load(page)} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
        <form className="form-grid cutoff-filters" onSubmit={applyFilters}>
          <label>Admission year
            <input type="number" min="1990" max={new Date().getFullYear() + 2} value={filters.year} onChange={(event) => update('year', event.target.value)} />
          </label>
          <label>Entrance exam
            <input value={filters.examName} onChange={(event) => update('examName', event.target.value)} placeholder="e.g. JEE Main" />
          </label>
          <label>Category
            <select value={filters.category} onChange={(event) => update('category', event.target.value)}>
              <option value="">All categories</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label>College code
            <input value={filters.collegeCode} onChange={(event) => update('collegeCode', event.target.value)} placeholder="e.g. NVIT" />
          </label>
          <label>Branch code
            <input value={filters.branchCode} onChange={(event) => update('branchCode', event.target.value)} placeholder="e.g. CSE" />
          </label>
          <label>Compare with rank
            <input type="number" min="1" value={filters.rank} onChange={(event) => update('rank', event.target.value)} placeholder="Enter your rank" />
          </label>
          <div className="form-action row-actions">
            <button className="btn primary" type="submit" disabled={loading}><Search size={15} /> Apply filters</button>
            <button className="btn secondary" type="button" onClick={clearFilters} disabled={loading}>Clear</button>
          </div>
        </form>
        {error && <div className="alert error">{error}</div>}
        {(notice || profileNotice) && <p className="history-notice"><BarChart3 size={15} /> {[notice, profileNotice].filter(Boolean).join(' ')}</p>}
        {!!filters.rank && records.some((record) => record.rankAnalysis) && (
          <div className="history-analysis-summary" aria-label="Rank comparison summary for this page">
            <span>Rank comparison on this page</span>
            <b className="safe-text">{analysisCounts.Safe} safer</b>
            <b className="moderate-text">{analysisCounts.Moderate} moderate</b>
            <b className="risky-text">{analysisCounts.Risky} ambitious</b>
          </div>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Year / round</th><th>College</th><th>Branch</th><th>Exam</th>
                <th>Category</th><th>Opening rank</th><th>Closing rank</th><th>Rank comparison</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record._id}>
                  <td>{record.year} · {record.round}</td>
                  <td><b>{record.college}</b><small className="table-sub">{record.collegeCode}{record.location ? ` · ${record.location}` : ''}</small></td>
                  <td>{record.branch}<small className="table-sub">{record.branchCode}</small></td>
                  <td>{record.examName}</td>
                  <td>{record.category}</td>
                  <td>{record.openingRank?.toLocaleString() || '—'}</td>
                  <td>{record.closingRank.toLocaleString()}</td>
                  <td>{record.rankAnalysis
                    ? <span className={`badge ${record.rankAnalysis.chance.toLowerCase()}`}>{record.rankAnalysis.chance} · {record.rankAnalysis.matchScore}%</span>
                    : <span className="muted">Add rank to compare</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !records.length && !error && <div className="empty">No historical cutoffs match these filters.</div>}
          {loading && <div className="empty">Loading historical cutoffs…</div>}
        </div>
        {pages > 1 && (
          <div className="cutoff-pagination">
            <span>Page {page} of {pages}</span>
            <div className="row-actions">
              <button className="btn secondary" type="button" disabled={loading || page <= 1} onClick={() => load(page - 1)}><ChevronLeft size={15} /> Previous</button>
              <button className="btn secondary" type="button" disabled={loading || page >= pages} onClick={() => load(page + 1)}>Next <ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
