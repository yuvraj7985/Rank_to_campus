import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Download, FileCheck2, RefreshCw, Search, ShieldCheck, Upload } from 'lucide-react';
import api from '../services/api';

const requiredDocuments = [
  { type: 'marksheet_10', title: 'Class 10 marksheet', description: 'Upload your official Class 10 marksheet.' },
  { type: 'marksheet_12', title: 'Class 12 marksheet', description: 'Upload your official Class 12 marksheet.' },
  { type: 'rank_card', title: 'Entrance exam scorecard', description: 'Upload the scorecard or rank card for your entrance examination.' }
];
const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);

function PageHeader({ tag, title, description, children }) {
  return (
    <div className="welcome-row">
      <div>
        <span className="eyebrow">{tag}</span>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

function latestByType(documents) {
  const latest = new Map();
  for (const document of documents) {
    const current = latest.get(document.type);
    const documentTime = new Date(document.createdAt || 0).getTime();
    const currentTime = current ? new Date(current.createdAt || 0).getTime() : -1;
    const newerId = current && String(document._id || '') > String(current._id || '');
    if (!current || documentTime > currentTime || (documentTime === currentTime && newerId)) {
      latest.set(document.type, document);
    }
  }
  return latest;
}

async function downloadDocument(document) {
  const blob = await api.get(`/documents/${document._id}/file`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = document.originalName || document.fileName || 'admission-document';
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
}

export function StudentDocuments() {
  const [documents, setDocuments] = useState([]);
  const [files, setFiles] = useState({});
  const [inputVersion, setInputVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const currentDocuments = useMemo(() => latestByType(documents), [documents]);
  const allApproved = requiredDocuments.every((item) => currentDocuments.get(item.type)?.status === 'approved');
  const reviewInProgress = requiredDocuments.some((item) => currentDocuments.get(item.type)?.status === 'pending');

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const response = await api.get('/documents/mine');
      setDocuments(response.data || []);
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Unable to load your submitted documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    const missing = requiredDocuments.filter((item) => !files[item.type]);
    if (missing.length) {
      setError(`Select all three documents before submitting: ${missing.map((item) => item.title).join(', ')}.`);
      return;
    }
    const invalidFile = requiredDocuments.find(({ type }) => {
      const file = files[type];
      return file.size > 5 * 1024 * 1024 || !allowedTypes.has(file.type);
    });
    if (invalidFile) {
      setError(`${invalidFile.title} must be a PDF, JPG or PNG no larger than 5 MB.`);
      return;
    }

    const formData = new FormData();
    requiredDocuments.forEach(({ type }) => formData.append(type, files[type]));
    setBusy(true);
    try {
      const response = await api.post('/documents/required', formData);
      setMessage(response.message || 'All three documents were submitted for separate verification.');
      setFiles({});
      setInputVersion((version) => version + 1);
      await loadDocuments();
    } catch (uploadError) {
      setError(uploadError.message || 'Unable to submit the documents.');
    } finally {
      setBusy(false);
    }
  };

  const download = async (document) => {
    try {
      setError('');
      await downloadDocument(document);
    } catch (downloadError) {
      setError(downloadError.message || 'Unable to download this document.');
    }
  };

  return (
    <>
      <PageHeader
        tag="DOCUMENT VERIFICATION"
        title="Submit your admission documents"
        description="Choose all three required files and submit them together. Administrators review each document separately."
      />
      {message && <div className="workflow-message success"><CheckCircle2 size={18} />{message}</div>}
      {error && <div className="workflow-message error">{error}</div>}
      <form className="panel document-submit-panel" onSubmit={submit}>
        <div className="document-requirements">
          <div>
            <span className="eyebrow">REQUIRED FOR COUNSELLING</span>
            <h2>Three documents, one submission</h2>
          </div>
          <span className="document-format-note">PDF, JPG or PNG · up to 5 MB each</span>
        </div>
        <div className="required-document-grid">
          {requiredDocuments.map((item, index) => {
            const current = currentDocuments.get(item.type);
            return (
              <article className="required-document-card" key={item.type}>
                <div className="required-document-heading">
                  <span className="document-step">{String(index + 1).padStart(2, '0')}</span>
                  <span className={`badge ${current?.status || 'missing'}`}>{current?.status || 'not submitted'}</span>
                </div>
                <FileCheck2 className="required-document-icon" size={23} />
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <label className="document-file-picker">
                  <span>{files[item.type]?.name || 'Choose file'}</span>
                  <input
                    key={`${item.type}-${inputVersion}`}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    disabled={allApproved || reviewInProgress}
                    onChange={(event) => setFiles((currentFiles) => ({
                      ...currentFiles,
                      [item.type]: event.target.files?.[0] || null
                    }))}
                  />
                </label>
                {current?.reviewNote && <small className="document-review-note">Review note: {current.reviewNote}</small>}
                {current && <button className="document-download-link" type="button" onClick={() => download(current)}>View submitted file</button>}
              </article>
            );
          })}
        </div>
        {reviewInProgress && <p className="workflow-hint">Your submission is being reviewed. You can submit a new set after the current review is complete.</p>}
        {allApproved && <p className="workflow-hint approved-hint">All three required documents have been approved.</p>}
        <div className="document-submit-footer">
          <p className="muted">Each file is checked and receives its own approval or rejection status.</p>
          <button className="btn primary" type="submit" disabled={busy || reviewInProgress || allApproved}>
            <Upload size={16} /> {busy ? 'Submitting all three…' : 'Submit all three for review'}
          </button>
        </div>
      </form>
      <section className="panel document-process-panel">
        <ShieldCheck size={19} />
        <p><b>What happens next?</b> The verification team reviews your Class 10, Class 12, and entrance scorecard individually. If any file is rejected, read the review note and submit a complete new set of three documents.</p>
      </section>
      {loading && <div className="empty">Loading your document status…</div>}
    </>
  );
}

export function AdminDocuments() {
  const [students, setStudents] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reviewNotes, setReviewNotes] = useState({});
  const [busyDocument, setBusyDocument] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [studentResponse, documentResponse] = await Promise.all([
        api.get('/admin/students'),
        api.get('/documents')
      ]);
      setStudents(studentResponse.data || []);
      setDocuments(documentResponse.data || []);
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Unable to load the verification queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const documentsByStudent = useMemo(() => {
    const grouped = new Map();
    for (const document of documents) {
      const studentId = document.student?._id;
      if (!studentId) continue;
      const items = grouped.get(String(studentId)) || [];
      items.push(document);
      grouped.set(String(studentId), items);
    }
    return grouped;
  }, [documents]);

  const studentRows = students.map((student) => {
    const latest = latestByType(documentsByStudent.get(String(student._id)) || []);
    const required = requiredDocuments.map((item) => ({ ...item, document: latest.get(item.type) }));
    const pending = required.filter((item) => item.document?.status === 'pending').length;
    const verified = required.every((item) => item.document?.status === 'approved');
    return { student, required, pending, verified };
  });
  const normalizedSearch = search.trim().toLowerCase();
  const filteredRows = studentRows.filter(({ student, required }) => {
    const name = student.fullName || student.user?.name || '';
    const identity = `${name} ${student.user?.email || ''} ${student.applicationNumber || ''}`.toLowerCase();
    const matchesSearch = !normalizedSearch || identity.includes(normalizedSearch);
    const statuses = required.map((item) => item.document?.status || 'missing');
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'pending' && statuses.includes('pending')) ||
      (statusFilter === 'incomplete' && statuses.some((status) => status === 'missing' || status === 'rejected'));
    return matchesSearch && matchesStatus;
  });
  const pendingCount = studentRows.reduce((total, row) => total + row.pending, 0);
  const verifiedCount = studentRows.filter(({ verified }) => verified).length;

  const review = async (document, status) => {
    const reviewNote = status === 'approved'
      ? 'Verified by administrator.'
      : (reviewNotes[document._id] || '').trim();
    if (status === 'rejected' && !reviewNote) {
      setError('Add a rejection note explaining what the student needs to correct.');
      return;
    }
    setError('');
    setMessage('');
    setBusyDocument(document._id);
    try {
      await api.patch(`/documents/${document._id}/review`, { status, reviewNote });
      setMessage(`${requiredDocuments.find((item) => item.type === document.type)?.title || 'Document'} ${status}.`);
      await load();
    } catch (reviewError) {
      setError(reviewError.message || 'Unable to save the verification decision.');
    } finally {
      setBusyDocument('');
    }
  };

  const viewDocument = async (document) => {
    try {
      setError('');
      await downloadDocument(document);
    } catch (downloadError) {
      setError(downloadError.message || 'Unable to open the submitted document.');
    }
  };

  return (
    <>
      <PageHeader
        tag="STUDENT SERVICES"
        title="Document verification"
        description="Review each student’s three required admission documents and record a separate decision for each."
      />
      <div className="verification-summary">
        <div><span>Students</span><b>{students.length}</b></div>
        <div><span>Documents awaiting review</span><b>{pendingCount}</b></div>
        <div><span>Fully verified</span><b>{verifiedCount}</b></div>
      </div>
      {message && <div className="workflow-message success"><CheckCircle2 size={18} />{message}</div>}
      {error && <div className="workflow-message error">{error}</div>}
      <div className="panel verification-toolbar">
        <label className="verification-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student, email, or application number" /></label>
        <label>Show<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All students</option><option value="pending">Awaiting review</option><option value="incomplete">Missing or rejected</option></select></label>
        <button className="btn secondary" type="button" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh queue</button>
      </div>
      {loading && <div className="empty">Loading verification records…</div>}
      {!loading && filteredRows.length === 0 && <div className="empty">No students match this verification filter.</div>}
      <div className="student-verification-list">
        {filteredRows.map(({ student, required, pending, verified }) => (
          <article className="panel student-verification-card" key={student._id}>
            <header className="student-verification-header">
              <div>
                <span className="eyebrow">{student.applicationNumber || 'STUDENT RECORD'}</span>
                <h2>{student.fullName || student.user?.name || 'Student'}</h2>
                <p>{student.user?.email || 'No email'}{student.examName ? ` · ${student.examName}` : ''}</p>
              </div>
              <div className="student-verification-actions">
                <span className={`badge ${verified ? 'approved' : pending ? 'pending' : 'neutral'}`}>{verified ? 'Fully verified' : pending ? `${pending} awaiting review` : 'Incomplete'}</span>
                <Link className="btn secondary tiny" to={`/admin/students/${student._id}`}>View student profile</Link>
              </div>
            </header>
            <div className="verification-document-grid">
              {required.map((item) => {
                const document = item.document;
                const status = document?.status || 'missing';
                return (
                  <section className={`verification-document-card ${status}`} key={item.type}>
                    <div className="verification-document-heading">
                      <h3>{item.title}</h3>
                      <span className={`badge ${status}`}>{status}</span>
                    </div>
                    {document ? (
                      <>
                        <p className="verification-file-name">{document.originalName || 'Uploaded file'}</p>
                        <p className="verification-file-date">Submitted {new Date(document.createdAt).toLocaleString()}</p>
                        {document.reviewNote && <p className="document-review-note">Review note: {document.reviewNote}</p>}
                        <button className="btn secondary tiny" type="button" onClick={() => viewDocument(document)}><Download size={14} /> Open file</button>
                        {status === 'pending' && (
                          <div className="verification-decision">
                            <label>Rejection note (required to reject)<textarea rows="2" value={reviewNotes[document._id] || ''} onChange={(event) => setReviewNotes((current) => ({ ...current, [document._id]: event.target.value }))} placeholder="Explain what needs correction" /></label>
                            <div className="row-actions">
                              <button className="btn tiny success-btn" type="button" disabled={busyDocument === document._id} onClick={() => review(document, 'approved')}>Approve</button>
                              <button className="btn tiny danger-btn" type="button" disabled={busyDocument === document._id} onClick={() => review(document, 'rejected')}>Reject</button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : <p className="muted">This required document has not been submitted.</p>}
                  </section>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
