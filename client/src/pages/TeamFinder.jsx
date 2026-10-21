import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MessageSquare, Search, Sparkles, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useDebounce, useFetch } from '../lib/hooks';
import { useToast } from '../context/ToastContext';
import { useRealtime } from '../context/RealtimeContext';
import {
  Avatar, Badge, Button, Card, CardSkeletons, EmptyState, ErrorState, PageHeader, Pagination, Select, Skeleton,
} from '../components/ui';
import { fullName } from '../lib/format';

function useStartChat() {
  const navigate = useNavigate();
  const toast = useToast();
  return async (userId) => {
    try {
      const d = await api.post('/chat/conversations', { userId });
      navigate(`/chat?c=${d.conversation._id}`);
    } catch (e) { toast.error(e); }
  };
}

function PersonCard({ person, extra, highlight = [] }) {
  const startChat = useStartChat();
  const { online } = useRealtime();
  return (
    <div className="card card-body stack" style={{ gap: 10 }}>
      <div className="row">
        <Avatar user={person} size={40} online={online.has(String(person._id))} />
        <div style={{ minWidth: 0 }}>
          <Link to={`/profile/${person._id}`}><strong>{fullName(person)}</strong></Link>
          <div className="subtle clamp-2">{person.headline || 'No headline yet'}</div>
        </div>
      </div>
      <div className="chips">
        {(person.skills || []).slice(0, 8).map((s) => (
          <span key={s.name} className={`chip ${highlight.includes(s.name) ? 'chip-match' : ''}`}>{s.name}</span>
        ))}
      </div>
      {extra}
      <div className="row" style={{ marginTop: 'auto' }}>
        {person.lookingForTeam && <Badge tone="good">Looking for team</Badge>}
        {person.availability && <Badge>{person.availability}</Badge>}
        <Button size="sm" variant="outline" icon={MessageSquare} style={{ marginLeft: 'auto' }} onClick={() => startChat(person._id)}>Message</Button>
      </div>
    </div>
  );
}

function Recommendations() {
  const [params, setParams] = useSearchParams();
  const mine = useFetch(() => api.get('/projects/mine'));
  const projectId = params.get('project') || mine.data?.items[0]?._id || '';
  const recs = useFetch(() => (projectId ? api.get('/ai/recommendations/teammates', { projectId }) : Promise.resolve(null)), [projectId]);

  if (mine.loading) return <Skeleton h={120} />;
  if (mine.error) return <ErrorState error={mine.error} onRetry={mine.reload} />;
  if (!mine.data.items.length) {
    return <EmptyState icon={Users} title="Create or join a project first" action={<Link className="btn btn-primary" to="/projects?tab=mine">Go to projects</Link>}>
      Teammate recommendations are based on what your project still needs.</EmptyState>;
  }
  return (
    <div className="stack">
      <div style={{ maxWidth: 420 }}>
        <Select label="Recommend teammates for" value={projectId} onChange={(e) => setParams({ project: e.target.value })}
          options={mine.data.items.map((p) => ({ value: p._id, label: p.title }))} />
      </div>
      {recs.error ? <ErrorState error={recs.error} onRetry={recs.reload} /> : recs.loading || !recs.data ? <CardSkeletons count={3} /> : (
        <>
          <div className="alert alert-info"><Sparkles size={16} />
            <div>Project needs: <strong>{recs.data.needs?.join(', ') || '—'}</strong>.
              People are picked greedily so each new suggestion covers skills the previous ones don't.
              {recs.data.uncovered?.length > 0 && <> Still uncovered: {recs.data.uncovered.join(', ')}.</>}</div>
          </div>
          {recs.data.items.length === 0 ? <EmptyState icon={Users} title="No matching people right now">Nobody who is looking for a team has the skills this project needs yet.</EmptyState> : (
            <div className="cards">
              {recs.data.items.map((r) => (
                <PersonCard key={r.id} person={r.user} highlight={r.covers}
                  extra={<div className="panel" style={{ padding: 10 }}>
                    <div className="row-between"><span className="label">Fit score</span><Badge tone="accent">{r.score}</Badge></div>
                    <ul className="subtle" style={{ margin: '6px 0 0', paddingLeft: 18 }}>{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
                  </div>} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PeopleSearch() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [looking, setLooking] = useState('true');
  const [page, setPage] = useState(1);
  const dq = useDebounce(q, 300);
  const list = useFetch(() => api.get('/users', { q: dq, role, lookingForTeam: looking, page, limit: 12 }), [dq, role, looking, page]);
  return (
    <Card title={<h3 className="row"><Search size={16} /> Search people</h3>}>
      <div className="stack">
        <div className="grid-3" style={{ alignItems: 'end' }}>
          <div className="field"><label htmlFor="people-q">Name, skill or university</label>
            <input id="people-q" className="input" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="e.g. React, Docker" /></div>
          <Select label="Role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}
            options={[{ value: '', label: 'Anyone' }, { value: 'student', label: 'Students' }, { value: 'mentor', label: 'Mentors' }]} />
          <Select label="Team status" value={looking} onChange={(e) => { setLooking(e.target.value); setPage(1); }}
            options={[{ value: 'true', label: 'Looking for a team' }, { value: '', label: 'Everyone' }]} />
        </div>
        {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : list.loading && !list.data ? <CardSkeletons count={3} />
          : list.data.items.length === 0 ? <EmptyState icon={Users} title="No people match" />
            : <><div className="cards">{list.data.items.map((u) => <PersonCard key={u._id} person={u} />)}</div><Pagination pagination={list.data.pagination} onPage={setPage} /></>}
      </div>
    </Card>
  );
}

export default function TeamFinder() {
  return (
    <div className="stack-lg">
      <PageHeader title="Team finder" description="Find teammates whose skills complement your project." />
      <Recommendations />
      <PeopleSearch />
    </div>
  );
}
