import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ExternalLink, MapPin, MessageSquare, Plus, School, Star, Target, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRealtime } from '../context/RealtimeContext';
import {
  Avatar, Badge, Button, Card, Chips, EmptyState, ErrorState, Input, PageHeader, Select, Skeleton, Textarea, useConfirm,
} from '../components/ui';
import SkillInput from '../components/SkillInput';
import { date, fullName, timeAgo, titleCase } from '../lib/format';

const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];

function Stars({ value }) {
  return (
    <span className="row" style={{ gap: 2 }} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={14} fill={i <= Math.round(value) ? 'currentColor' : 'none'} style={{ color: 'var(--warning)' }} />)}
    </span>
  );
}

function SkillsEditor({ user, onSaved }) {
  const toast = useToast();
  const [skills, setSkills] = useState(user.skills || []);
  const [busy, setBusy] = useState(false);
  useEffect(() => setSkills(user.skills || []), [user.skills]);

  const names = skills.map((s) => s.name);
  const setNames = (list) => setSkills(list.map((n) => skills.find((s) => s.name === n) || { name: n, level: 'beginner', yearsOfExperience: 0 }));
  const update = (i, patch) => setSkills(skills.map((s, j) => (i === j ? { ...s, ...patch } : s)));

  const save = async () => {
    setBusy(true);
    try {
      const d = await api.put('/users/me/skills', { skills });
      onSaved(d.user);
      toast.success('Skills saved');
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };

  return (
    <Card title="Skills" actions={<Button variant="primary" size="sm" loading={busy} onClick={save}>Save skills</Button>}>
      <div className="stack">
        <SkillInput value={names} onChange={setNames} max={40} hint="Recommendations, matching and team finder all use these skills." />
        {skills.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Skill</th><th>Level</th><th>Years</th></tr></thead>
              <tbody>
                {skills.map((s, i) => (
                  <tr key={s.name}>
                    <td style={{ fontWeight: 550 }}>{s.name}</td>
                    <td>
                      <select className="select" style={{ height: 32 }} value={s.level} onChange={(e) => update(i, { level: e.target.value })} aria-label={`${s.name} level`}>
                        {LEVELS.map((l) => <option key={l} value={l}>{titleCase(l)}</option>)}
                      </select>
                    </td>
                    <td style={{ width: 110 }}>
                      <input className="input" style={{ height: 32 }} type="number" min="0" max="50" step="0.5" value={s.yearsOfExperience ?? 0}
                        onChange={(e) => update(i, { yearsOfExperience: Number(e.target.value) })} aria-label={`${s.name} years`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

function GoalsCard() {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const goals = useFetch(() => api.get('/goals'));
  const roles = useFetch(() => api.get('/catalog/roles'));
  const [form, setForm] = useState({ targetRole: '', targetDate: '', hoursPerWeek: 8 });

  const add = async (e) => {
    e.preventDefault();
    if (!form.targetRole) return;
    try {
      await api.post('/goals', { ...form, targetDate: form.targetDate || undefined });
      setForm({ targetRole: '', targetDate: '', hoursPerWeek: 8 });
      goals.reload();
      toast.success('Goal saved — it is now your active goal');
    } catch (err) { toast.error(err); }
  };
  const setStatus = async (g, status) => {
    try { await api.patch(`/goals/${g._id}`, { status }); goals.reload(); } catch (err) { toast.error(err); }
  };
  const remove = async (g) => {
    if (!(await confirm(`Delete the goal "${g.targetRole}"?`, { confirmLabel: 'Delete' }))) return;
    try { await api.del(`/goals/${g._id}`); goals.reload(); } catch (err) { toast.error(err); }
  };

  return (
    <Card title={<h3 className="row"><Target size={16} /> Career goals</h3>}>
      {confirmDialog}
      <form className="grid-3" onSubmit={add} style={{ alignItems: 'end' }}>
        <Select label="Target role" value={form.targetRole} onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
          options={[{ value: '', label: 'Choose a role…' }, ...(roles.data?.roles || []).map((r) => r.title)]} />
        <Input label="Target date" type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
        <div className="row" style={{ alignItems: 'end' }}>
          <Input label="Hours / week" type="number" min="1" max="60" value={form.hoursPerWeek} onChange={(e) => setForm({ ...form, hoursPerWeek: Number(e.target.value) })} />
          <Button variant="primary" icon={Plus} type="submit" disabled={!form.targetRole}>Add</Button>
        </div>
      </form>
      <div className="stack" style={{ marginTop: 16 }}>
        {goals.loading ? <Skeleton h={40} /> : goals.data?.items.length === 0 ? (
          <p className="muted">No goals yet. Your active goal powers the roadmap, skill recommendations and the AI coach.</p>
        ) : goals.data?.items.map((g) => (
          <div key={g._id} className="panel row-between wrap">
            <div>
              <div className="row"><strong>{g.targetRole}</strong><Badge tone={g.status === 'active' ? 'accent' : g.status === 'achieved' ? 'good' : undefined}>{g.status}</Badge></div>
              <div className="subtle">{g.hoursPerWeek} h/week{g.targetDate ? ` · by ${date(g.targetDate)}` : ''}</div>
            </div>
            <div className="row">
              {g.status !== 'active' && <Button size="sm" variant="outline" onClick={() => setStatus(g, 'active')}>Make active</Button>}
              {g.status === 'active' && <Button size="sm" variant="outline" onClick={() => setStatus(g, 'achieved')}>Mark achieved</Button>}
              <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(g)} aria-label="Delete goal" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function EditProfile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({
      firstName: user.firstName, lastName: user.lastName, headline: user.headline || '', bio: user.bio || '',
      location: user.location || '', university: user.university || '', graduationYear: user.graduationYear || '',
      role: user.role, availability: user.availability || 'part-time', lookingForTeam: Boolean(user.lookingForTeam),
      interests: user.interests || [], links: { github: '', linkedin: '', portfolio: '', ...user.links },
    });
  }, [user]);

  if (!form) return null;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setLink = (k) => (e) => setForm({ ...form, links: { ...form.links, [k]: e.target.value } });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const d = await api.patch('/users/me', { ...form, graduationYear: form.graduationYear ? Number(form.graduationYear) : null });
      setUser(d.user);
      toast.success('Profile updated');
    } catch (err) {
      setErrors(Object.fromEntries((err.errors || []).map((x) => [x.field, x.message])));
      toast.error(err);
    } finally { setBusy(false); }
  };

  return (
    <div className="stack-lg">
      <PageHeader title="My profile" description="This is what other students and mentors see."
        actions={<Link className="btn btn-outline" to={`/profile/${user._id}`}>View public profile</Link>} />
      {params.get('welcome') && (
        <div className="alert alert-info">Welcome to SkillBridge AI! Add a headline and your skills first — they power every recommendation.</div>
      )}
      <form className="card card-body stack" onSubmit={save} noValidate>
        <div className="row" style={{ gap: 14 }}>
          <Avatar user={user} size={56} />
          <div><h2>{fullName(user)}</h2><span className="subtle">{user.email}</span></div>
        </div>
        <div className="grid-2">
          <Input label="First name" value={form.firstName} onChange={set('firstName')} error={errors.firstName} />
          <Input label="Last name" value={form.lastName} onChange={set('lastName')} error={errors.lastName} />
        </div>
        <Input label="Headline" placeholder="e.g. CS student · Aspiring backend developer" value={form.headline} onChange={set('headline')} maxLength={120} />
        <Textarea label="About" value={form.bio} onChange={set('bio')} maxLength={1500} placeholder="What do you build? What are you learning?" />
        <div className="grid-3">
          <Input label="Location" value={form.location} onChange={set('location')} />
          <Input label="University" value={form.university} onChange={set('university')} />
          <Input label="Graduation year" type="number" min="1980" max="2040" value={form.graduationYear} onChange={set('graduationYear')} error={errors.graduationYear} />
        </div>
        <div className="grid-3">
          <Select label="Role" value={form.role} onChange={set('role')} options={[{ value: 'student', label: 'Student' }, { value: 'mentor', label: 'Mentor' }, { value: 'both', label: 'Student & mentor' }]} />
          <Select label="Availability" value={form.availability} onChange={set('availability')} options={['full-time', 'part-time', 'weekends', 'unavailable'].map((v) => ({ value: v, label: titleCase(v) }))} />
          <div className="field"><span className="label">Team finder</span>
            <label className="checkbox" style={{ height: 38 }}>
              <input type="checkbox" checked={form.lookingForTeam} onChange={(e) => setForm({ ...form, lookingForTeam: e.target.checked })} />
              I'm looking for a team
            </label>
          </div>
        </div>
        <div className="grid-3">
          <Input label="GitHub URL" placeholder="https://github.com/you" value={form.links.github} onChange={setLink('github')} error={errors['links.github']} />
          <Input label="LinkedIn URL" placeholder="https://linkedin.com/in/you" value={form.links.linkedin} onChange={setLink('linkedin')} error={errors['links.linkedin']} />
          <Input label="Portfolio URL" placeholder="https://you.dev" value={form.links.portfolio} onChange={setLink('portfolio')} error={errors['links.portfolio']} />
        </div>
        <SkillInput label="Interests" value={form.interests} onChange={(interests) => setForm({ ...form, interests })} max={20} placeholder="e.g. fintech, hackathons" />
        <div className="row" style={{ justifyContent: 'flex-end' }}><Button variant="primary" loading={busy} type="submit">Save profile</Button></div>
      </form>
      <SkillsEditor user={user} onSaved={setUser} />
      <GoalsCard />
    </div>
  );
}

function PublicProfile({ id }) {
  const { user: me } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { online } = useRealtime();
  const { data, loading, error, reload } = useFetch(() => api.get(`/users/${id}`), [id]);

  if (loading) return <div className="stack"><Skeleton h={120} /><Skeleton h={200} /></div>;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { user, projects, reviews, offers } = data;
  const isMe = String(user._id) === String(me._id);

  const message = async () => {
    try {
      const d = await api.post('/chat/conversations', { userId: user._id });
      navigate(`/chat?c=${d.conversation._id}`);
    } catch (e) { toast.error(e); }
  };

  return (
    <div className="stack-lg">
      <div className="card card-body row wrap" style={{ gap: 18, alignItems: 'flex-start' }}>
        <Avatar user={user} size={72} online={data.online || online.has(String(user._id))} />
        <div style={{ flex: 1, minWidth: 240 }} className="stack">
          <div>
            <div className="row wrap"><h1>{fullName(user)}</h1>{user.isSynthetic && <Badge>synthetic demo</Badge>}{user.lookingForTeam && <Badge tone="good">Looking for a team</Badge>}</div>
            <p className="muted">{user.headline}</p>
          </div>
          <div className="row wrap subtle" style={{ gap: 14 }}>
            {user.location && <span className="row" style={{ gap: 4 }}><MapPin size={14} />{user.location}</span>}
            {user.university && <span className="row" style={{ gap: 4 }}><School size={14} />{user.university}{user.graduationYear ? ` · ${user.graduationYear}` : ''}</span>}
            {user.ratingCount > 0 && <span className="row" style={{ gap: 4 }}><Stars value={user.ratingAverage} /> {user.ratingAverage} ({user.ratingCount})</span>}
          </div>
          {user.bio && <p className="prewrap">{user.bio}</p>}
          <div className="row wrap">
            {Object.entries(user.links || {}).filter(([, v]) => v).map(([k, v]) => (
              <a key={k} href={v} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm"><ExternalLink size={13} />{titleCase(k)}</a>
            ))}
          </div>
        </div>
        {isMe ? <Link to="/profile" className="btn btn-outline">Edit profile</Link> : <Button variant="primary" icon={MessageSquare} onClick={message}>Message</Button>}
      </div>

      <div className="grid-2">
        <Card title="Skills">
          {user.skills.length === 0 ? <p className="muted">No skills listed yet.</p> : (
            <div className="chips">{user.skills.map((s) => <span key={s.name} className="chip">{s.name} <span className="subtle">· {s.level}</span></span>)}</div>
          )}
          {user.interests?.length > 0 && <div style={{ marginTop: 14 }}><div className="label" style={{ marginBottom: 6 }}>Interests</div><Chips items={user.interests} /></div>}
        </Card>
        <Card title="Projects">
          {projects.length === 0 ? <p className="muted">No projects yet.</p> : (
            <div className="stack">
              {projects.map((p) => (
                <Link key={p._id} to={`/projects/${p._id}`} className="card-link panel">
                  <div className="row-between"><strong>{p.title}</strong><Badge>{p.status}</Badge></div>
                  <div className="subtle clamp-2">{p.summary}</div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {offers.length > 0 && (
        <Card title="Mentoring offers">
          <div className="cards">
            {offers.map((o) => (
              <Link key={o._id} to={`/mentoring?offer=${o._id}`} className="card-link panel">
                <strong>{o.title}</strong>
                <div className="subtle">{o.skill} · {o.level} · {o.sessionMinutes} min · {o.mode}</div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Card title={`Reviews (${user.ratingCount})`}>
        {reviews.length === 0 ? <EmptyState icon={Star} title="No reviews yet">Reviews appear after completed mentoring sessions.</EmptyState> : (
          <div className="stack">
            {reviews.map((r) => (
              <div key={r._id} className="row" style={{ alignItems: 'flex-start' }}>
                <Avatar user={r.reviewer} size={32} />
                <div>
                  <div className="row"><strong>{fullName(r.reviewer)}</strong><Stars value={r.rating} /><span className="subtle">{timeAgo(r.createdAt)}</span></div>
                  {r.comment && <p>{r.comment}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function Profile() {
  const { id } = useParams();
  return id ? <PublicProfile id={id} /> : <EditProfile />;
}

