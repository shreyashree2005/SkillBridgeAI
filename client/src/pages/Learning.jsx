import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, CheckCircle2, Circle, Clock, GraduationCap, Star, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useDebounce, useFetch } from '../lib/hooks';
import { useToast } from '../context/ToastContext';
import {
  Badge, Button, Card, CardSkeletons, Chips, EmptyState, ErrorState, PageHeader, Pagination, Progress, Select, Skeleton, Tabs,
} from '../components/ui';
import { compact, timeAgo } from '../lib/format';

function CourseCard({ course }) {
  const e = course.enrollment;
  return (
    <Link to={`/learning/${course._id}`} className="card-link card card-hover card-body stack" style={{ gap: 10 }}>
      <div className="row-between"><Badge tone="info">{course.level}</Badge>{e && <Badge tone={e.status === 'completed' ? 'good' : 'accent'}>{e.status === 'completed' ? 'Completed' : `${e.progress}%`}</Badge>}</div>
      <h3>{course.title}</h3>
      <p className="muted clamp-2">{course.description}</p>
      <Chips items={course.skills} />
      <div className="row subtle" style={{ gap: 12, marginTop: 'auto' }}>
        <span className="row" style={{ gap: 4 }}><Clock size={13} />{course.durationHours} h</span>
        <span className="row" style={{ gap: 4 }}><Star size={13} />{course.ratingAverage}</span>
        <span className="row" style={{ gap: 4 }}><Users size={13} />{compact(course.enrolledCount)}</span>
      </div>
    </Link>
  );
}

function Catalog() {
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [level, setLevel] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounce(q, 300);
  const list = useFetch(() => api.get('/courses', { q: dq, level, page, limit: 12 }), [dq, level, page]);
  return (
    <div className="stack">
      <div className="grid-3" style={{ alignItems: 'end' }}>
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <label htmlFor="course-q">Search courses</label>
          <input id="course-q" className="input" placeholder="Skill or topic, e.g. React, SQL, Docker" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <Select label="Level" value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }}
          options={[{ value: '', label: 'All levels' }, 'beginner', 'intermediate', 'advanced'].map((o) => (typeof o === 'string' ? { value: o, label: o[0].toUpperCase() + o.slice(1) } : o))} />
      </div>
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} />
        : list.loading && !list.data ? <CardSkeletons />
          : list.data.items.length === 0 ? <EmptyState icon={BookOpen} title="No courses match">Try another skill or level.</EmptyState>
            : <><div className="cards">{list.data.items.map((c) => <CourseCard key={c._id} course={c} />)}</div><Pagination pagination={list.data.pagination} onPage={setPage} /></>}
    </div>
  );
}

function MyLearning() {
  const list = useFetch(() => api.get('/courses/enrollments/me'));
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (list.loading) return <Skeleton h={160} />;
  if (!list.data.items.length) return <EmptyState icon={GraduationCap} title="You haven't enrolled in anything yet">Browse the catalog and enroll in a course to track your progress.</EmptyState>;
  return (
    <div className="stack">
      {list.data.items.map((e) => (
        <Link key={e._id} to={`/learning/${e.course._id}`} className="card-link card card-hover card-body row wrap" style={{ gap: 16 }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="row"><strong>{e.course.title}</strong>{e.status === 'completed' && <Badge tone="good">Completed</Badge>}</div>
            <div className="subtle">{e.completedModules.length}/{e.course.modules.length} modules · last activity {timeAgo(e.lastActivityAt)}</div>
          </div>
          <div style={{ width: 240 }}><Progress value={e.progress} tone={e.status === 'completed' ? 'good' : undefined} label={`${e.course.title} progress`} /></div>
          <span className="tnum" style={{ width: 40, textAlign: 'right' }}>{e.progress}%</span>
        </Link>
      ))}
    </div>
  );
}

export function CourseDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useFetch(() => api.get(`/courses/${id}`), [id]);
  const [busy, setBusy] = useState(null);

  if (loading) return <Skeleton h={300} />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const c = data.course;
  const e = c.enrollment;

  const enroll = async () => {
    setBusy('enroll');
    try { const d = await api.post(`/courses/${c._id}/enroll`); setData({ course: { ...c, enrollment: d.enrollment } }); toast.success('Enrolled!'); }
    catch (err) { toast.error(err); } finally { setBusy(null); }
  };
  const toggle = async (i) => {
    const completed = !e.completedModules.includes(i);
    setBusy(i);
    try {
      const d = await api.patch(`/courses/${c._id}/progress`, { moduleIndex: i, completed });
      setData({ course: { ...c, enrollment: d.enrollment } });
      if (d.enrollment.status === 'completed' && e.status !== 'completed') toast.success('Course completed 🎓 Add the skill to your profile!');
    } catch (err) { toast.error(err); } finally { setBusy(null); }
  };

  return (
    <div className="stack-lg">
      <Link to="/learning" className="row subtle"><ArrowLeft size={14} /> All courses</Link>
      <div className="card card-body stack">
        <div className="row wrap"><Badge tone="info">{c.level}</Badge><span className="subtle">{c.provider}</span></div>
        <h1>{c.title}</h1>
        <p className="muted">{c.description}</p>
        <Chips items={c.skills} />
        <div className="row subtle wrap" style={{ gap: 14 }}>
          <span className="row" style={{ gap: 4 }}><Clock size={14} />{c.durationHours} hours</span>
          <span className="row" style={{ gap: 4 }}><Star size={14} />{c.ratingAverage} ({compact(c.ratingCount)} ratings)</span>
          <span className="row" style={{ gap: 4 }}><Users size={14} />{compact(c.enrolledCount)} learners</span>
        </div>
        {e ? (
          <div className="stack" style={{ gap: 6 }}>
            <div className="row-between"><span className="label">Your progress</span><span className="tnum">{e.progress}%</span></div>
            <Progress value={e.progress} tone={e.status === 'completed' ? 'good' : undefined} label="Course progress" />
          </div>
        ) : <div><Button variant="primary" loading={busy === 'enroll'} onClick={enroll}>Enroll for free</Button></div>}
      </div>
      <Card title={`Modules (${c.modules.length})`}>
        <ol className="stack" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {c.modules.map((m, i) => {
            const done = e?.completedModules.includes(i);
            return (
              <li key={i} className="panel row-between">
                <div className="row">
                  {done ? <CheckCircle2 size={18} style={{ color: 'var(--good)' }} /> : <Circle size={18} className="muted" />}
                  <div><strong>{i + 1}. {m.title}</strong><div className="subtle">{m.durationMinutes} min</div></div>
                </div>
                {e && <Button size="sm" variant={done ? 'ghost' : 'outline'} loading={busy === i} onClick={() => toggle(i)}>{done ? 'Mark incomplete' : 'Mark complete'}</Button>}
              </li>
            );
          })}
        </ol>
        {!e && <p className="subtle" style={{ marginTop: 10 }}>Enroll to track module progress.</p>}
      </Card>
    </div>
  );
}

export default function Learning() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'catalog';
  return (
    <div className="stack-lg">
      <PageHeader title="Learning" description="Short, skill-focused courses. Track progress module by module." />
      <Tabs value={tab} onChange={(v) => setParams(v === 'catalog' ? {} : { tab: v })}
        tabs={[{ value: 'catalog', label: 'Course catalog' }, { value: 'mine', label: 'My learning' }]} />
      {tab === 'catalog' ? <Catalog /> : <MyLearning />}
    </div>
  );
}
