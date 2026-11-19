import { useEffect, useState } from 'react';
import { BarChart3, FileText, CalendarRange, UserCheck, Download } from 'lucide-react';
import api from '../services/api';

export default function AdminReports() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/admin/reports')
      .then((response) => setData(response.data?.data || response.data || {}))
      .catch((e) => setError(e.message || 'Unable to load report data.'));
  }, []);

  const statCards = [
    { label: 'Students by category', value: data?.studentsByCategory?.reduce((sum, item) => sum + (item.count || 0), 0) ?? '—', icon: UserCheck },
    { label: 'Documents in review', value: data?.documentStatus?.find((item) => item._id === 'pending')?.count ?? '—', icon: FileText },
    { label: 'Open rounds', value: data?.roundStatus?.find((item) => item._id === 'open')?.count ?? '—', icon: CalendarRange },
    { label: 'Locked preferences', value: data?.lockedPreferenceBreakdown?.reduce((sum, item) => sum + (item.count || 0), 0) ?? '—', icon: BarChart3 }
  ];

  const exportCsv = async () => {
    setError('');
    try {
      const reportBlob = await api.get('/admin/reports/export', { responseType: 'blob' });
      if (!(reportBlob instanceof Blob)) {
        throw new Error('The server did not return a CSV file.');
      }

      const url = window.URL.createObjectURL(reportBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'rank2campus-report.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(e.message || 'Unable to export report CSV.');
    }
  };

  return (
    <>
      <div className="welcome-row">
        <div>
          <span className="eyebrow">REPORTS</span>
          <h1>Operational reporting dashboard</h1>
          <p className="muted">Monitor student readiness, preference momentum, and allocation activity across the current admission cycle.</p>
        </div>
        <button className="btn primary" onClick={exportCsv}>
          <Download size={15} /> Export CSV
        </button>
      </div>

      <div className="stat-grid">
        {statCards.map(({ label, value, icon: Icon }) => (
          <div className="stat-card" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <span className="stat-icon"><Icon size={19} /></span>
            </div>
            <strong>{value}</strong>
            <small>Live reporting metric</small>
          </div>
        ))}
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="panel">
        <div className="section-heading" style={{ marginTop: 0 }}>
          <div>
            <span className="eyebrow">CATEGORY MIX</span>
            <h2>Student distribution</h2>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Students</th>
              </tr>
            </thead>
            <tbody>
              {(data?.studentsByCategory || []).map((item) => (
                <tr key={item._id || 'unknown'}>
                  <td>{item._id || 'Unspecified'}</td>
                  <td>{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="section-heading" style={{ marginTop: 0 }}>
          <div>
            <span className="eyebrow">DOCUMENT FLOW</span>
            <h2>Verification pipeline</h2>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {(data?.documentStatus || []).map((item) => (
                <tr key={item._id || 'unknown'}>
                  <td>{item._id || 'Unknown'}</td>
                  <td>{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="section-heading" style={{ marginTop: 0 }}>
          <div>
            <span className="eyebrow">ROUND ACTIVITY</span>
            <h2>Preference momentum</h2>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Round</th>
                <th>Locked preferences</th>
                <th>Total preferences</th>
              </tr>
            </thead>
            <tbody>
              {(data?.preferenceActivity || []).map((item, index) => {
                const locked = data?.lockedPreferenceBreakdown?.find((entry) => entry.roundName === item.roundName)?.count || 0;
                return (
                  <tr key={`${item.roundName}-${index}`}>
                    <td>{item.roundName}</td>
                    <td>{locked}</td>
                    <td>{item.totalPreferences}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="section-heading" style={{ marginTop: 0 }}>
          <div>
            <span className="eyebrow">SEAT DEMAND</span>
            <h2>Top institutions by seat capacity</h2>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Institution</th>
                <th>Total seats</th>
                <th>Branches</th>
              </tr>
            </thead>
            <tbody>
              {(data?.topColleges || []).map((item) => (
                <tr key={item._id || 'unknown'}>
                  <td>{item._id || 'Unknown institution'}</td>
                  <td>{item.totalSeats}</td>
                  <td>{item.branchCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="section-heading" style={{ marginTop: 0 }}>
          <div>
            <span className="eyebrow">LATEST OFFERS</span>
            <h2>Recent allocation activity</h2>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Round</th>
                <th>College</th>
                <th>Branch</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentAllocations || []).map((item, index) => (
                <tr key={`${item.round}-${item.college}-${item.branch}-${index}`}>
                  <td>{item.round}</td>
                  <td>{item.college}</td>
                  <td>{item.branch}</td>
                  <td><span className={`badge ${String(item.status || 'pending').toLowerCase()}`}>{item.status || 'pending'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
