import { useEffect, useState } from 'react';
import {
  GraduationCap,
  Building2,
  FileClock,
  Target,
  ArrowUpRight,
  Sparkles,
  CalendarRange,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Link } from 'react-router-dom';

export default function Dashboard({ admin = false }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (admin) {
      api.get('/admin/dashboard')
        .then((response) => setData(response.data.data || response.data))
        .catch((error) => setErr(error.message || 'Unable to load dashboard data.'));
    }
  }, [admin]);

  const cards = admin
    ? [
      ['Registered students', data?.students ?? '—', GraduationCap],
      ['Active rounds', data?.activeRounds ?? '—', CalendarRange],
      ['Pending reviews', data?.pendingDocuments ?? '—', FileClock],
      ['Avg profile completion', data?.averageProfileCompletion !== undefined ? `${data.averageProfileCompletion}%` : '—', Target]
    ]
    : [
      ['Admission profile', 'Build profile', GraduationCap],
      ['College discovery', 'Explore options', Building2],
      ['Document status', 'Track verification', FileClock],
      ['Rank prediction', 'Check chances', Target]
    ];

  const metrics = admin
    ? [
      { label: 'Approved documents', value: data?.approvedDocuments ?? '—', icon: ShieldCheck },
      { label: 'Accepted allocations', value: data?.acceptedAllocations ?? '—', icon: CheckCircle2 },
      { label: 'Active colleges', value: data?.colleges ?? '—', icon: Building2 }
    ]
    : [];
  const shortcuts = admin
    ? [
      ['Manage students', 'Review registered applicants', '/admin/students'],
      ['Manage rounds', 'Create and monitor counselling cycles', '/admin/rounds'],
      ['Verify documents', 'Review pending submissions', '/admin/documents'],
      ['Manage colleges', 'Maintain institutions and branches', '/admin/colleges'],
      ['Run allocation', 'Process locked student preferences', '/admin/allocations']
    ]
    : [
      ['Rank predictor', 'Compare your rank with historical cutoffs', '/predictor'],
      ['Explore colleges', 'Discover colleges and available branches', '/colleges'],
      ['Cutoff history', 'Review past closing ranks and compare your rank', '/historical-cutoffs'],
      ['Complete preferences', 'Arrange and lock your choices', '/preferences'],
      ['Upload documents', 'Submit documents for admin review', '/documents']
    ];

  return (
    <>
      <div className="welcome-row">
        <div>
          <span className="eyebrow">{admin ? 'ROOT CONTROL CENTER' : 'STUDENT OVERVIEW'}</span>
          <h1>{admin ? 'Welcome, Administrator' : `Welcome back, ${user?.name?.split(' ')[0] || 'Student'}`}</h1>
          <p className="muted">{admin
            ? 'Monitor admissions, document readiness, and allocation momentum across the whole cycle.'
            : 'Your admission journey starts with a clear plan. Let’s make it happen.'}</p>
        </div>
        <div className="date-chip">● LIVE WORKSPACE</div>
      </div>
      <div className="stat-grid">
        {cards.map(([label, value, Icon]) => (
          <div className="stat-card" key={label}>
            <div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={19} /></span></div>
            <strong>{value}</strong>
            <small>{admin ? 'Current database count' : 'Your next step'}</small>
          </div>
        ))}
      </div>
      {admin && metrics.length > 0 && (
        <div className="panel" style={{ marginTop: '20px' }}>
          <div className="section-heading" style={{ marginTop: 0 }}>
            <div><span className="eyebrow">OPERATIONAL INSIGHTS</span><h2>Admission health snapshot</h2></div>
          </div>
          <div className="stat-grid">
            {metrics.map(({ label, value, icon: Icon }) => (
              <div className="stat-card" key={label}>
                <div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={19} /></span></div>
                <strong>{value}</strong>
                <small>Live operational metric</small>
              </div>
            ))}
          </div>
        </div>
      )}
      {err && <div className="alert error">{err}</div>}
      <div className="section-heading">
        <div><span className="eyebrow">GET STARTED</span><h2>{admin ? 'Management shortcuts' : 'Your admission toolkit'}</h2></div>
      </div>
      <div className="action-grid">
        {shortcuts.map(([title, desc, to]) => (
          <Link className="action-card" to={to} key={title}>
            <div><h3>{title}</h3><p>{desc}</p></div>
            <ArrowUpRight />
          </Link>
        ))}
      </div>
      <div className="info-banner">
        <div className="banner-icon"><Sparkles /></div>
        <div><b>Make informed decisions</b><p>Prediction results are estimates based on historical data, not guaranteed admission outcomes.</p></div>
      </div>
    </>
  );
}
