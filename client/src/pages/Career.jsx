import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Bot, Lightbulb, Route, Send, Target, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Badge, Button, Card, Chips, EmptyState, ErrorState, Input, PageHeader, Progress, ScoreRing, Select, Skeleton, Tabs,
} from '../components/ui';

function useRoles() {
  return useFetch(() => api.get('/catalog/roles'));
}

function useDefaultRole() {
  const goals = useFetch(() => api.get('/goals'));
  return goals.data?.items.find((g) => g.status === 'active')?.targetRole || '';
}

function AiStatus() {
  const s = useFetch(() => api.get('/ai/status'));
  if (!s.data || s.data.available) return null;
  return <div className="alert alert-warning"><AlertTriangle size={16} /><div><strong>AI service unavailable.</strong> {s.data.message}</div></div>;
}

function RolePicker({ value, onChange, children }) {
  const roles = useRoles();
  return (
    <div className="row wrap" style={{ alignItems: 'end' }}>
      <div style={{ minWidth: 260 }}>
        <Select label="Target role" value={value} onChange={(e) => onChange(e.target.value)}
          options={[{ value: '', label: roles.loading ? 'Loading roles…' : 'Choose a role…' }, ...(roles.data?.roles || []).map((r) => r.title)]} />
      </div>
      {children}
    </div>
  );
}

function SkillGap() {
  const toast = useToast();
  const def = useDefaultRole();
  const [role, setRole] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (def && !role) setRole(def); }, [def, role]);

  const run = async () => {
    setBusy(true);
    try { setResult(await api.post('/ai/skill-gap', { targetRole: role })); } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  return (
    <div className="stack">
      <RolePicker value={role} onChange={setRole}><Button variant="primary" disabled={!role} loading={busy} onClick={run}>Analyse my gap</Button></RolePicker>
      {!result ? <EmptyState icon={Target} title="Compare yourself to a role">We weigh each skill in the role profile (core ×3, important ×2, useful ×1) and give partial credit by level.</EmptyState> : (
        <div className="stack-lg">
          <Card>
            <div className="row wrap" style={{ gap: 18 }}>
              <ScoreRing score={result.coverage} size={96} label="Role coverage" />
              <div style={{ flex: 1, minWidth: 240 }} className="stack">
                <div className="row"><h2>{result.role}</h2><Badge tone="accent">{result.readiness}</Badge></div>
                <p className="muted">{result.summary}</p>
                <p className="subtle">Based on your {result.basedOn === 'resume' ? 'profile skills + latest resume' : 'profile skills'} · {result.method}</p>
              </div>
            </div>
          </Card>
          <div className="grid-3">
            <Card title={`Missing (${result.missing.length})`}>
              {result.missing.length === 0 ? <p className="muted">Nothing missing!</p> : (
                <div className="stack" style={{ gap: 6 }}>{result.missing.map((m) => (
                  <div key={m.skill} className="row-between"><span>{m.skill}</span><Badge tone={m.weight === 3 ? 'danger' : m.weight === 2 ? 'warning' : undefined}>{m.weight === 3 ? 'core' : m.weight === 2 ? 'important' : 'useful'}</Badge></div>
                ))}</div>
              )}
            </Card>
            <Card title={`Strengthen (${result.weak.length})`}>
              {result.weak.length === 0 ? <p className="muted">No weak spots.</p> : (
                <div className="stack" style={{ gap: 6 }}>{result.weak.map((w) => <div key={w.skill} className="row-between"><span>{w.skill}</span><Badge>{w.level}</Badge></div>)}</div>
              )}
            </Card>
            <Card title={`You have (${result.matched.length})`}><Chips items={result.matched.map((m) => m.skill)} tone="match" /></Card>
          </div>
          <div className="row"><Link className="btn btn-primary" to={`/career?tab=roadmap&role=${encodeURIComponent(result.role)}`}><Route size={16} /> Build my roadmap</Link></div>
        </div>
      )}
    </div>
  );
}

function Roadmap() {
  const toast = useToast();
  const [params] = useSearchParams();
  const def = useDefaultRole();
  const [role, setRole] = useState(params.get('role') || '');
  const [hours, setHours] = useState(8);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (def && !role) setRole(def); }, [def, role]);

  const run = async () => {
    setBusy(true);
    try { setPlan(await api.post('/ai/roadmap', { targetRole: role, hoursPerWeek: Number(hours) })); } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  return (
    <div className="stack">
      <RolePicker value={role} onChange={setRole}>
        <div style={{ width: 140 }}><Input label="Hours / week" type="number" min="1" max="60" value={hours} onChange={(e) => setHours(e.target.value)} /></div>
        <Button variant="primary" disabled={!role} loading={busy} onClick={run}>Generate roadmap</Button>
      </RolePicker>
      {!plan ? <EmptyState icon={Route} title="Your personalised learning path">Missing skills and their prerequisites are ordered with a topological sort, matched to courses, and scheduled by your weekly hours.</EmptyState>
        : plan.steps.length === 0 ? <EmptyState icon={Target} title="You already cover this role!">Consider a more advanced role or deepen your existing skills.</EmptyState> : (
          <Card title={`${plan.role}: ${plan.steps.length} steps · ~${plan.total_hours} h · ${plan.total_weeks} weeks at ${plan.hours_per_week} h/week`}>
            <div className="timeline">
              {plan.steps.map((s, i) => (
                <div key={s.skill} className="tl-item" data-n={i + 1}>
                  <div className="row-between wrap">
                    <strong>{s.skill}</strong>
                    <span className="subtle tnum">Week {s.week_start}{s.week_end !== s.week_start ? `–${s.week_end}` : ''} · ~{s.estimated_hours} h</span>
                  </div>
                  <div className="subtle">{s.reason}{s.prerequisites.length ? ` · needs ${s.prerequisites.join(', ')}` : ''}</div>
                  <div className="row wrap" style={{ marginTop: 4 }}>
                    {s.course ? <Link className="btn btn-outline btn-sm" to={`/learning/${s.course.id}`}>Course: {s.course.title}</Link>
                      : <span className="subtle">No course in the catalog yet — {s.milestone}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
    </div>
  );
}

function SkillRecs() {
  const recs = useFetch(() => api.get('/ai/recommendations/skills'));
  if (recs.error) return <ErrorState error={recs.error} onRetry={recs.reload} />;
  if (recs.loading) return <Skeleton h={200} />;
  return (
    <div className="stack">
      <p className="muted">{recs.data.targetRole ? `Tuned for your goal: ${recs.data.targetRole}.` : 'Set a career goal on your profile for role-specific suggestions.'} {recs.data.method}.</p>
      {recs.data.items.length === 0 ? <EmptyState icon={Lightbulb} title="No suggestions yet" action={<Link className="btn btn-primary" to="/profile">Add skills</Link>} /> : (
        <div className="cards">
          {recs.data.items.map((r) => (
            <div key={r.skill} className="card card-body stack" style={{ gap: 8 }}>
              <div className="row-between"><h3>{r.skill}</h3><Badge tone="accent">{r.score}</Badge></div>
              <Progress value={r.score} label={`${r.skill} recommendation score`} />
              <span className="subtle">{r.category}</span>
              <ul className="subtle" style={{ margin: 0, paddingLeft: 18 }}>{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
              <Link to={`/learning?q=${encodeURIComponent(r.skill)}`} className="subtle">Find a course →</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SUGGESTIONS = ['What skills am I missing?', 'Make me a study plan', 'How is my resume?', 'How are my applications going?', 'What should I learn next?'];

function Assistant() {
  const { user } = useAuth();
  const toast = useToast();
  const history = useFetch(() => api.get('/ai/assistant/history'));
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const bottom = useRef(null);
  const messages = history.data?.items || [];
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [messages.length, busy]);

  const send = async (msg) => {
    const message = (msg ?? text).trim();
    if (!message) return;
    setText('');
    setBusy(true);
    const temp = { _id: `tmp-${Date.now()}`, role: 'user', content: message };
    history.setData((d) => ({ items: [...(d?.items || []), temp] }));
    try {
      const d = await api.post('/ai/assistant', { message });
      history.setData((x) => ({ items: [...x.items, d.reply] }));
    } catch (e) {
      toast.error(e);
      history.setData((x) => ({ items: x.items.filter((m) => m._id !== temp._id) }));
      setText(message);
    } finally { setBusy(false); }
  };
  const clear = async () => {
    try { await api.del('/ai/assistant/history'); history.setData({ items: [] }); } catch (e) { toast.error(e); }
  };

  return (
    <Card bodyClass="" title={<h3 className="row"><Bot size={16} /> Career assistant</h3>}
      actions={messages.length > 0 && <Button size="sm" variant="ghost" icon={Trash2} onClick={clear}>Clear</Button>}>
      <div className="assistant">
        <div className="chat-messages" aria-live="polite">
          {history.loading ? <Skeleton h={80} /> : messages.length === 0 && (
            <EmptyState icon={Bot} title={`Hi ${user.firstName}! Ask me about your career`}>
              Answers are grounded in your profile, goals, resume, courses and applications.
            </EmptyState>
          )}
          {messages.map((m) => (
            <div key={m._id} className={`bubble ${m.role === 'user' ? 'mine' : 'theirs'}`}>
              {m.content}
              {m.role === 'assistant' && m.provider && <time>{m.provider === 'rules' ? 'grounded rule-based engine' : `via ${m.provider}`}{m.sources?.length ? ` · uses: ${m.sources.join(', ')}` : ''}</time>}
            </div>
          ))}
          {busy && <div className="bubble theirs"><span className="spinner" /></div>}
          <div ref={bottom} />
        </div>
        <div className="chips" style={{ padding: '0 12px 8px' }}>
          {SUGGESTIONS.map((s) => <button key={s} className="chip" style={{ cursor: 'pointer' }} onClick={() => send(s)} disabled={busy}>{s}</button>)}
        </div>
        <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask anything about your career…" maxLength={2000} aria-label="Message the assistant" />
          <Button variant="primary" icon={Send} type="submit" loading={busy} disabled={!text.trim()}>Send</Button>
        </form>
      </div>
    </Card>
  );
}

export default function Career() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'assistant';
  return (
    <div className="stack-lg">
      <PageHeader title="AI career coach" description="Explainable recommendations — every score shows how it was calculated." />
      <AiStatus />
      <Tabs value={tab} onChange={(v) => setParams(v === 'assistant' ? {} : { tab: v })} tabs={[
        { value: 'assistant', label: 'Assistant', icon: Bot },
        { value: 'gap', label: 'Skill gap', icon: Target },
        { value: 'roadmap', label: 'Roadmap', icon: Route },
        { value: 'skills', label: 'Skills to learn', icon: Lightbulb },
      ]} />
      {tab === 'assistant' && <Assistant />}
      {tab === 'gap' && <SkillGap />}
      {tab === 'roadmap' && <Roadmap />}
      {tab === 'skills' && <SkillRecs />}
    </div>
  );
}
