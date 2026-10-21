import { useRef, useState } from 'react';
import { FileText, Trash2, Upload, Wand2 } from 'lucide-react';
import { api } from '../lib/api';
import { useDebounce, useFetch } from '../lib/hooks';
import { useToast } from '../context/ToastContext';
import {
  Badge, Button, Card, Chips, EmptyState, ErrorState, PageHeader, Progress, ScoreRing, Segmented, Skeleton, Textarea, useConfirm,
} from '../components/ui';
import MatchResult from '../components/MatchResult';
import { date, scoreTone } from '../lib/format';

const MAX_MB = 5;
const ACCEPT = '.pdf,.docx,.txt';

function Uploader({ onUploaded }) {
  const toast = useToast();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'txt'].includes(ext)) return toast.error('Please choose a PDF, DOCX or TXT file.');
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(`File is larger than ${MAX_MB} MB.`);
    const form = new FormData();
    form.append('resume', file);
    setBusy(true);
    try {
      const d = await api.upload('/resumes', form);
      toast.success('Resume analysed');
      onUploaded(d.resume);
    } catch (e) { toast.error(e); } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="card card-body"
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]); }}
      style={{ borderStyle: 'dashed', borderWidth: 2, borderColor: drag ? 'var(--accent)' : 'var(--border-strong)', background: drag ? 'var(--accent-soft)' : undefined }}>
      <div className="state" style={{ padding: 24 }}>
        <div className="state-icon">{busy ? <span className="spinner" /> : <Upload size={22} />}</div>
        <h3>{busy ? 'Analysing your resume…' : 'Upload your resume'}</h3>
        <p>PDF, DOCX or TXT, up to {MAX_MB} MB. We extract the text, detect skills and score it — the file itself is not stored.</p>
        <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => upload(e.target.files[0])} />
        <Button variant="primary" icon={Upload} loading={busy} onClick={() => input.current?.click()}>Choose file</Button>
      </div>
    </div>
  );
}

function JobMatcher({ resume }) {
  const toast = useToast();
  const [mode, setMode] = useState('list');
  const [jobQ, setJobQ] = useState('');
  const [jobId, setJobId] = useState('');
  const [jd, setJd] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const dq = useDebounce(jobQ, 300);
  const jobs = useFetch(() => api.get('/jobs', { q: dq, limit: 20 }), [dq]);

  const run = async () => {
    setBusy(true);
    try {
      const d = await api.post(`/resumes/${resume._id}/match`, mode === 'list' ? { jobId } : { jobDescription: jd });
      setResult(d.match);
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  return (
    <Card title={<h3 className="row"><Wand2 size={16} /> Match this resume to a job</h3>}>
      <div className="stack">
        <Segmented label="Job source" value={mode} onChange={(v) => { setMode(v); setResult(null); }}
          options={[{ value: 'list', label: 'Pick a listed job' }, { value: 'paste', label: 'Paste a job description' }]} />
        {mode === 'list' ? (
          <div className="grid-2" style={{ alignItems: 'end' }}>
            <div className="field"><label htmlFor="job-q">Search jobs</label><input id="job-q" className="input" value={jobQ} onChange={(e) => setJobQ(e.target.value)} placeholder="e.g. frontend, data" /></div>
            <div className="field"><label htmlFor="job-pick">Job</label>
              <select id="job-pick" className="select" value={jobId} onChange={(e) => setJobId(e.target.value)}>
                <option value="">{jobs.loading ? 'Loading…' : 'Choose a job…'}</option>
                {(jobs.data?.items || []).map((j) => <option key={j._id} value={j._id}>{j.title} — {j.company}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <Textarea label="Job description" value={jd} onChange={(e) => setJd(e.target.value)} rows={7}
            hint="Include the requirements section — skills are extracted automatically." maxLength={8000} />
        )}
        <div><Button variant="primary" loading={busy} disabled={mode === 'list' ? !jobId : jd.trim().length < 30} onClick={run}>Calculate match</Button></div>
        {result && <MatchResult match={result} />}
      </div>
    </Card>
  );
}

function Analysis({ resume }) {
  const a = resume.analysis;
  return (
    <div className="stack-lg">
      <div className="grid-2">
        <Card title="Resume score">
          <div className="row" style={{ gap: 18, alignItems: 'flex-start' }}>
            <ScoreRing score={a.score} size={96} label="Resume score" />
            <div className="stack" style={{ flex: 1, gap: 8 }}>
              {a.breakdown.map((b) => (
                <div key={b.criterion}>
                  <div className="row-between"><span>{b.criterion}</span><span className="tnum subtle">{b.score}/{b.max}</span></div>
                  <Progress value={(b.score / b.max) * 100} tone={scoreTone((b.score / b.max) * 100)} label={b.criterion} />
                  <div className="subtle">{b.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card title="Extracted details">
          <div className="stack">
            <div><div className="label">Skills detected ({resume.parsed.skills.length})</div><Chips items={resume.parsed.skills} /></div>
            <div className="row wrap" style={{ gap: 18 }}>
              <div><div className="label">Experience</div><strong>{resume.parsed.yearsOfExperience} yrs</strong></div>
              <div><div className="label">Words</div><strong>{resume.parsed.wordCount}</strong></div>
            </div>
            <div><div className="label">Sections found</div><Chips items={resume.parsed.sections} /></div>
            <div><div className="label">Education</div>{resume.parsed.education.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{resume.parsed.education.map((e) => <li key={e}>{e}</li>)}</ul> : <span className="subtle">Not detected</span>}</div>
          </div>
        </Card>
      </div>
      <div className="grid-2">
        <Card title="Strengths">{a.strengths.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{a.strengths.map((s) => <li key={s}>{s}</li>)}</ul> : <p className="muted">Keep improving — strengths will show here.</p>}</Card>
        <Card title="Suggestions">{a.suggestions.length ? <ul style={{ margin: 0, paddingLeft: 18 }}>{a.suggestions.map((s) => <li key={s}>{s}</li>)}</ul> : <p className="muted">No major issues found. 🎉</p>}</Card>
      </div>
      <JobMatcher resume={resume} />
    </div>
  );
}

export default function Resume() {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const list = useFetch(() => api.get('/resumes'));
  const [selectedId, setSelectedId] = useState(null);

  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  const items = list.data?.items || [];
  const selected = items.find((r) => r._id === selectedId) || items[0];

  const remove = async (r) => {
    if (!(await confirm(`Delete "${r.originalName}" and its analysis?`, { confirmLabel: 'Delete' }))) return;
    try { await api.del(`/resumes/${r._id}`); setSelectedId(null); list.reload(); } catch (e) { toast.error(e); }
  };

  return (
    <div className="stack-lg">
      {confirmDialog}
      <PageHeader title="Resume analyzer" description="Rule-based scoring with a transparent breakdown, skill extraction and job matching." />
      <Uploader onUploaded={(r) => { list.setData((d) => ({ items: [r, ...(d?.items || [])] })); setSelectedId(r._id); }} />
      {list.loading ? <Skeleton h={200} /> : items.length === 0 ? (
        <EmptyState icon={FileText} title="No resumes yet">Upload your first resume to see your score and personalised suggestions.</EmptyState>
      ) : (
        <>
          <div className="row wrap">
            {items.map((r) => (
              <div key={r._id} className="row" style={{ gap: 2 }}>
                <Button variant={r._id === selected._id ? 'primary' : 'outline'} size="sm" icon={FileText} onClick={() => setSelectedId(r._id)}>
                  {r.originalName.slice(0, 28)} · {date(r.createdAt, { month: 'short', day: 'numeric' })} <Badge>{r.analysis.score}</Badge>
                </Button>
                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => remove(r)} aria-label={`Delete ${r.originalName}`} />
              </div>
            ))}
          </div>
          <Analysis key={selected._id} resume={selected} />
        </>
      )}
    </div>
  );
}
