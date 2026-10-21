import { Link } from 'react-router-dom';
import {
  Bell, Bookmark, Briefcase, CalendarClock, CheckCircle2, Clock, FileText, FolderGit2, GraduationCap, Mic, Target,
} from 'lucide-react';
import { api } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { Badge, Card, EmptyState, ErrorState, PageHeader, Progress, ScoreRing, Skeleton } from '../components/ui';
import { GroupedBars, HBars, LineChart } from '../components/charts';
import { date, dateTime, fullName, timeAgo, titleCase } from '../lib/format';

const STATUS_ORDER = ['saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn'];

function Stat({ icon: Icon, label, value, sub, to }) {
  const body = (
    <div className="card stat card-hover">
      <div className="stat-label"><Icon size={15} /> {label}</div>
      <div className="stat-value tnum">{value ?? '—'}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
  return to ? <Link to={to} className="card-link">{body}</Link> : body;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(() => api.get('/dashboard'));

  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div className="stack-lg">
      <PageHeader title={`Welcome back, ${user.firstName} 👋`}
        description={data?.goal ? `Working towards: ${data.goal.targetRole}` : 'Set a career goal to get a personalised plan.'}
        actions={<Link className="btn btn-primary" to="/career"><Target size={16} /> Open AI career coach</Link>} />

      {loading ? (
        <div className="grid-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="card stat stack"><Skeleton h={14} w="50%" /><Skeleton h={26} w="40%" /></div>)}</div>
      ) : (
        <>
          <div className="grid-4">
            <Stat icon={FolderGit2} label="Projects" value={data.stats.projectsOwned + data.stats.projectsJoined}
              sub={`${data.stats.projectsOwned} owned · ${data.stats.projectsJoined} joined`} to="/projects?tab=mine" />
            <Stat icon={GraduationCap} label="Learning hours" value={data.stats.learningHours}
              sub={`${data.stats.coursesCompleted} completed · ${data.stats.coursesInProgress} in progress`} to="/learning?tab=mine" />
            <Stat icon={Briefcase} label="Applications" value={data.stats.applications}
              sub={`${data.applicationsByStatus.interviewing} interviewing · ${data.applicationsByStatus.offer} offers`} to="/applications" />
            <Stat icon={CheckCircle2} label="Mentor sessions" value={data.stats.mentorSessionsCompleted} sub="completed" to="/mentoring?tab=sessions" />
            <Stat icon={FileText} label="Resume score" value={data.stats.resumeScore ?? '—'} sub={data.stats.resumeScore == null ? 'Upload a resume' : 'latest upload'} to="/resume" />
            <Stat icon={Mic} label="Avg. interview score" value={data.stats.averageInterviewScore ?? '—'} sub={`${data.interviewTrend.length} practice session(s)`} to="/interview" />
            <Stat icon={Bookmark} label="Bookmarks" value={data.stats.bookmarks} sub="saved projects" to="/projects?tab=bookmarks" />
            <Stat icon={Bell} label="Unread notifications" value={data.stats.unreadNotifications} to="/notifications" />
          </div>

          <div className="grid-2">
            <Card title="Profile strength">
              <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
                <ScoreRing score={data.profile.score} label="Profile completeness" />
                <div className="stack" style={{ flex: 1, gap: 6 }}>
                  {data.profile.todo.length === 0 ? <p>Your profile is complete — nice work!</p> : (
                    <>
                      <p className="muted">Complete these to improve recommendations:</p>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>{data.profile.todo.slice(0, 4).map((t) => <li key={t}>{t}</li>)}</ul>
                      <Link to="/profile">Edit profile →</Link>
                    </>
                  )}
                </div>
              </div>
            </Card>
            <Card title="Weekly activity" actions={<span className="subtle">Last 8 weeks</span>}>
              <GroupedBars data={data.weeklyActivity} xKey="week" caption="Applications sent and courses active per week"
                formatX={(w) => date(w, { month: 'short', day: 'numeric' })}
                series={[
                  { key: 'applications', label: 'Applications sent', color: 'var(--series-1)' },
                  { key: 'learning', label: 'Courses active', color: 'var(--series-2)' },
                ]} />
            </Card>
          </div>

          <div className="grid-3">
            <Card title="Application pipeline" actions={<Link to="/applications" className="subtle">Tracker →</Link>}>
              {data.stats.applications === 0 ? (
                <EmptyState icon={Briefcase} title="No applications yet" action={<Link className="btn btn-outline btn-sm" to="/jobs">Browse jobs</Link>} />
              ) : (
                <HBars caption="Applications by status" colors={['var(--ord-1)', 'var(--ord-2)', 'var(--ord-3)', 'var(--ord-4)', 'var(--ord-5)', 'var(--ord-6)']}
                  items={STATUS_ORDER.map((s) => ({ label: titleCase(s), value: data.applicationsByStatus[s] || 0 }))} />
              )}
            </Card>
            <Card title="Skills by level" actions={<Link to="/profile" className="subtle">Edit →</Link>}>
              {data.stats.skills === 0 ? (
                <EmptyState icon={Target} title="No skills yet" action={<Link className="btn btn-outline btn-sm" to="/profile">Add skills</Link>} />
              ) : (
                <HBars caption="Number of skills at each level" colors={['var(--ord-2)', 'var(--ord-3)', 'var(--ord-4)', 'var(--ord-5)']}
                  items={['beginner', 'intermediate', 'advanced', 'expert'].map((l) => ({ label: titleCase(l), value: data.skillLevels[l] || 0 }))} />
              )}
            </Card>
            <Card title="Interview scores">
              {data.interviewTrend.length === 0 ? (
                <EmptyState icon={Mic} title="No practice yet" action={<Link className="btn btn-outline btn-sm" to="/interview">Start a mock interview</Link>} />
              ) : (
                <LineChart caption="Overall score of completed mock interviews" height={160}
                  points={data.interviewTrend.map((t) => ({ x: date(t.date, { month: 'short', day: 'numeric' }), y: t.score, detail: t.role }))} />
              )}
            </Card>
          </div>

          <div className="grid-3">
            <Card title="Continue learning" actions={<Link to="/learning" className="subtle">All courses →</Link>}>
              {data.courses.length === 0 ? (
                <EmptyState icon={GraduationCap} title="No courses yet" action={<Link className="btn btn-outline btn-sm" to="/learning">Find a course</Link>} />
              ) : (
                <div className="stack">
                  {data.courses.map((c) => (
                    <Link key={c.id} to={`/learning/${c.id}`} className="card-link stack" style={{ gap: 6 }}>
                      <div className="row-between"><span className="truncate" style={{ fontWeight: 550 }}>{c.title}</span><span className="subtle tnum">{c.progress}%</span></div>
                      <Progress value={c.progress} tone={c.status === 'completed' ? 'good' : undefined} label={`${c.title} progress`} />
                    </Link>
                  ))}
                </div>
              )}
            </Card>
            <Card title="Upcoming sessions" actions={<Link to="/mentoring?tab=sessions" className="subtle">Mentoring →</Link>}>
              {data.upcomingSessions.length === 0 ? (
                <EmptyState icon={CalendarClock} title="Nothing scheduled" action={<Link className="btn btn-outline btn-sm" to="/mentoring">Find a mentor</Link>} />
              ) : (
                <div className="stack">
                  {data.upcomingSessions.map((s) => (
                    <div key={s._id} className="row" style={{ alignItems: 'flex-start' }}>
                      <Clock size={16} className="muted" style={{ marginTop: 3 }} />
                      <div>
                        <div style={{ fontWeight: 550 }}>{s.skill} with {fullName(String(s.mentor._id) === String(user._id) ? s.learner : s.mentor)}</div>
                        <div className="subtle">{dateTime(s.scheduledAt)} · {s.durationMinutes} min</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card title="Recent activity" actions={<Link to="/notifications" className="subtle">All →</Link>}>
              {data.recentNotifications.length === 0 ? <EmptyState icon={Bell} title="All quiet" /> : (
                <div className="stack">
                  {data.recentNotifications.map((n) => (
                    <Link key={n._id} to={n.link || '/notifications'} className="card-link row" style={{ alignItems: 'flex-start' }}>
                      {!n.read && <Badge tone="accent">new</Badge>}
                      <div style={{ minWidth: 0 }}>
                        <div className="clamp-2">{n.title}</div>
                        <div className="subtle">{timeAgo(n.createdAt)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
