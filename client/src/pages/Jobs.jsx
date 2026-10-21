import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Building2, Info, MapPin, Wand2 } from 'lucide-react';
import { api } from '../lib/api';
import { useDebounce, useFetch } from '../lib/hooks';
import { useToast } from '../context/ToastContext';
import {
  Badge, Button, CardSkeletons, Chips, EmptyState, ErrorState, Modal, PageHeader, Pagination, Select, Skeleton,
} from '../components/ui';
import MatchResult from '../components/MatchResult';
import { money, timeAgo, titleCase } from '../lib/format';

function JobDetail({ id, onClose, onTracked }) {
  const toast = useToast();
  const job = useFetch(() => api.get(`/jobs/${id}`), [id]);
  const [match, setMatch] = useState(null);
  const [busy, setBusy] = useState(null);

  const runMatch = async () => {
    setBusy('match');
    try { setMatch(await api.get(`/jobs/${id}/match`)); } catch (e) { toast.error(e); } finally { setBusy(null); }
  };
  const track = async (status) => {
    setBusy(status);
    try {
      const d = await api.post('/applications', { jobId: id, status });
      toast.success(status === 'applied' ? 'Marked as applied' : 'Saved to your tracker');
      job.setData((x) => ({ job: { ...x.job, application: d.application } }));
      onTracked();
    } catch (e) { toast.error(e); } finally { setBusy(null); }
  };

  const j = job.data?.job;
  return (
    <Modal open onClose={onClose} size="lg" title={j ? j.title : 'Job'}
      footer={j && (j.application
        ? <Link className="btn btn-outline" to="/applications">In your tracker · {j.application.status} →</Link>
        : <><Button variant="outline" loading={busy === 'saved'} onClick={() => track('saved')}>Save</Button><Button variant="primary" loading={busy === 'applied'} onClick={() => track('applied')}>I applied</Button></>)}>
      {job.error ? <ErrorState error={job.error} onRetry={job.reload} /> : !j ? <Skeleton h={240} /> : (
        <div className="stack">
          <div className="row wrap subtle" style={{ gap: 14 }}>
            <span className="row" style={{ gap: 4 }}><Building2 size={14} />{j.company}</span>
            <span className="row" style={{ gap: 4 }}><MapPin size={14} />{j.location}</span>
            <span>{titleCase(j.employmentType)} · {titleCase(j.experienceLevel)}</span>
            {j.salaryMin && <span>{money(j.salaryMin, j.currency)}–{money(j.salaryMax, j.currency)}</span>}
            {j.isSynthetic && <Badge>synthetic demo</Badge>}
          </div>
          <div><div className="label" style={{ marginBottom: 6 }}>Required</div><Chips items={j.requiredSkills} /></div>
          <div><div className="label" style={{ marginBottom: 6 }}>Nice to have</div><Chips items={j.niceToHaveSkills} /></div>
          <p className="prewrap muted">{j.description}</p>
          <div className="card card-body stack">
            <div className="row-between">
              <h3 className="row"><Wand2 size={16} /> How well do you match?</h3>
              <Button variant="primary" size="sm" loading={busy === 'match'} onClick={runMatch}>{match ? 'Recalculate' : 'Calculate my match'}</Button>
            </div>
            {match ? (
              <>
                <p className="subtle">Based on your {match.basedOn === 'resume' ? 'latest resume' : 'profile skills (upload a resume for a more accurate score)'}.</p>
                <MatchResult match={match.match} />
              </>
            ) : <p className="subtle">Compares your skills and experience with this job’s requirements.</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Jobs() {
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({ remote: '', employmentType: '', experienceLevel: '' });
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const dq = useDebounce(q, 300);
  const list = useFetch(() => api.get('/jobs', { q: dq, ...filters, page, limit: 12 }), [dq, filters, page]);
  const setFilter = (k) => (e) => { setFilters({ ...filters, [k]: e.target.value }); setPage(1); };

  return (
    <div className="stack-lg">
      <PageHeader title="Jobs" description="Internships and early-career roles. Check your match before you apply."
        actions={<Link className="btn btn-outline" to="/applications">My applications</Link>} />
      <div className="grid-4" style={{ alignItems: 'end' }}>
        <div className="field"><label htmlFor="jobs-q">Search</label>
          <input id="jobs-q" className="input" placeholder="Title, company, skill…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
        <Select label="Work mode" value={filters.remote} onChange={setFilter('remote')} options={[{ value: '', label: 'Any' }, { value: 'true', label: 'Remote' }, { value: 'false', label: 'On-site' }]} />
        <Select label="Type" value={filters.employmentType} onChange={setFilter('employmentType')}
          options={[{ value: '', label: 'Any type' }, ...['internship', 'full-time', 'part-time', 'contract'].map((v) => ({ value: v, label: titleCase(v) }))]} />
        <Select label="Level" value={filters.experienceLevel} onChange={setFilter('experienceLevel')}
          options={[{ value: '', label: 'Any level' }, ...['internship', 'entry', 'mid', 'senior'].map((v) => ({ value: v, label: titleCase(v) }))]} />
      </div>
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} />
        : list.loading && !list.data ? <CardSkeletons />
          : list.data.items.length === 0 ? <EmptyState icon={Briefcase} title="No jobs match these filters" />
            : (
              <>
                <div className="cards">
                  {list.data.items.map((j) => (
                    <button key={j._id} className="card card-hover card-body stack" style={{ gap: 8, textAlign: 'left', cursor: 'pointer' }} onClick={() => setOpenId(j._id)}>
                      <div className="row-between"><Badge tone="info">{titleCase(j.experienceLevel)}</Badge>{j.application ? <Badge tone="accent">{j.application.status}</Badge> : j.remote && <Badge tone="good">Remote</Badge>}</div>
                      <h3>{j.title}</h3>
                      <div className="subtle">{j.company} · {j.location}</div>
                      <div className="chips">{j.requiredSkills.slice(0, 5).map((s) => <span key={s} className="chip">{s}</span>)}</div>
                      <div className="row-between subtle" style={{ marginTop: 'auto' }}><span>{titleCase(j.employmentType)}</span><span>{timeAgo(j.postedAt)}</span></div>
                    </button>
                  ))}
                </div>
                <Pagination pagination={list.data.pagination} onPage={setPage} />
              </>
            )}
      {openId && <JobDetail id={openId} onClose={() => setOpenId(null)} onTracked={list.reload} />}
      <p className="subtle row" style={{ gap: 6 }}><Info size={13} /> All listed companies and jobs are fictional demo data.</p>
    </div>
  );
}
