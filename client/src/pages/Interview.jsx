import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Mic, Play } from 'lucide-react';
import { api } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { useToast } from '../context/ToastContext';
import {
  Badge, Button, Card, EmptyState, ErrorState, Input, PageHeader, Progress, ScoreRing, Select, Skeleton, Textarea,
} from '../components/ui';
import { date, scoreTone } from '../lib/format';

function QuestionCard({ sessionId, q, index, onAnswered }) {
  const toast = useToast();
  const [answer, setAnswer] = useState(q.answer || '');
  const [busy, setBusy] = useState(false);
  const ev = q.evaluation?.score !== undefined && q.evaluation?.score !== null ? q.evaluation : null;

  const submit = async () => {
    setBusy(true);
    try {
      const d = await api.post(`/ai/interview/${sessionId}/answers`, { qid: q.qid, answer });
      onAnswered(d.session);
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  return (
    <Card title={<div className="row wrap"><strong>Q{index + 1}.</strong><Badge tone={q.type === 'behavioral' ? 'warning' : 'info'}>{q.type}</Badge>{q.skill !== 'Behavioral' && <Badge>{q.skill}</Badge>}</div>}
      actions={ev && <Badge tone={scoreTone(ev.score)}>{ev.score}/100</Badge>}>
      <div className="stack">
        <h3>{q.question}</h3>
        <Textarea label="Your answer" value={answer} onChange={(e) => setAnswer(e.target.value)} rows={5} maxLength={5000}
          hint={q.type === 'behavioral' ? 'Use STAR: Situation, Task, Action, Result.' : 'Explain the concept, give an example, and mention trade-offs.'} />
        <div><Button variant={ev ? 'outline' : 'primary'} loading={busy} disabled={!answer.trim()} onClick={submit}>{ev ? 'Re-evaluate' : 'Submit answer'}</Button></div>
        {ev && (
          <div className="panel stack">
            {ev.criteria.map((c) => (
              <div key={c.name}>
                <div className="row-between"><span>{c.name}</span><span className="tnum subtle">{c.score}/{c.max}</span></div>
                <Progress value={(c.score / c.max) * 100} tone={scoreTone((c.score / c.max) * 100)} label={c.name} />
                <div className="subtle">{c.detail}</div>
              </div>
            ))}
            {ev.coveredPoints?.length > 0 && <div><div className="label">Covered</div><div className="chips">{ev.coveredPoints.map((p) => <span key={p} className="chip chip-match">{p}</span>)}</div></div>}
            {ev.missedPoints?.length > 0 && <div><div className="label">Missed</div><div className="chips">{ev.missedPoints.map((p) => <span key={p} className="chip chip-missing">{p}</span>)}</div></div>}
            <ul style={{ margin: 0, paddingLeft: 18 }}>{ev.feedback.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
        )}
      </div>
    </Card>
  );
}

export function InterviewSession() {
  const { id } = useParams();
  const s = useFetch(() => api.get(`/ai/interview/${id}`), [id]);
  if (s.loading) return <Skeleton h={300} />;
  if (s.error) return <ErrorState error={s.error} onRetry={s.reload} />;
  const session = s.data.session;
  const answered = session.questions.filter((q) => typeof q.evaluation?.score === 'number').length;
  return (
    <div className="stack-lg">
      <Link to="/interview" className="row subtle"><ArrowLeft size={14} /> All sessions</Link>
      <div className="card card-body row wrap" style={{ gap: 18 }}>
        {session.status === 'completed' ? <ScoreRing score={session.overallScore} size={84} label="Overall score" /> : <Mic size={36} className="muted" />}
        <div style={{ flex: 1 }}>
          <h1>{session.role} mock interview</h1>
          <p className="muted">{answered}/{session.questions.length} answered{session.status === 'completed' ? ' · completed' : ''} · {date(session.createdAt)}</p>
          <div style={{ maxWidth: 360, marginTop: 8 }}><Progress value={(answered / session.questions.length) * 100} label="Interview progress" /></div>
        </div>
      </div>
      <div className="alert alert-info">Scoring is a transparent rubric (key points 60, depth 15, structure 15, specificity 10) — not a language model.</div>
      {session.questions.map((q, i) => (
        <QuestionCard key={q.qid} sessionId={session._id} q={q} index={i} onAnswered={(next) => s.setData({ session: next })} />
      ))}
    </div>
  );
}

export default function Interview() {
  const toast = useToast();
  const navigate = useNavigate();
  const roles = useFetch(() => api.get('/catalog/roles'));
  const sessions = useFetch(() => api.get('/ai/interview'));
  const [role, setRole] = useState('');
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const d = await api.post('/ai/interview', { role, count: Number(count) });
      navigate(`/interview/${d.session._id}`);
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  return (
    <div className="stack-lg">
      <PageHeader title="Interview prep" description="Practise role-specific technical and behavioural questions and get instant, explainable feedback." />
      <Card title="Start a mock interview">
        <div className="row wrap" style={{ alignItems: 'end' }}>
          <div style={{ minWidth: 260 }}>
            <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}
              options={[{ value: '', label: 'Choose a role…' }, ...(roles.data?.roles || []).map((r) => r.title)]} />
          </div>
          <div style={{ width: 120 }}><Input label="Questions" type="number" min="3" max="10" value={count} onChange={(e) => setCount(e.target.value)} /></div>
          <Button variant="primary" icon={Play} disabled={!role} loading={busy} onClick={start}>Start</Button>
        </div>
      </Card>
      <Card title="Past sessions">
        {sessions.error ? <ErrorState error={sessions.error} onRetry={sessions.reload} /> : sessions.loading ? <Skeleton h={80} />
          : sessions.data.items.length === 0 ? <EmptyState icon={Mic} title="No practice sessions yet" />
            : (
              <div className="stack">
                {sessions.data.items.map((s) => {
                  const answered = s.questions.filter((q) => typeof q.evaluation?.score === 'number').length;
                  return (
                    <Link key={s._id} to={`/interview/${s._id}`} className="card-link panel row-between">
                      <div className="row">{s.status === 'completed' ? <CheckCircle2 size={16} style={{ color: 'var(--good)' }} /> : <Mic size={16} className="muted" />}
                        <div><strong>{s.role}</strong><div className="subtle">{date(s.createdAt)} · {answered}/{s.questions.length} answered</div></div></div>
                      {s.status === 'completed' ? <Badge tone={scoreTone(s.overallScore)}>{s.overallScore}/100</Badge> : <Badge>in progress</Badge>}
                    </Link>
                  );
                })}
              </div>
            )}
      </Card>
    </div>
  );
}
