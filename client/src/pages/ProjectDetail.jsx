import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, BookmarkCheck, Check, ExternalLink, LogOut, Pencil, Trash2, UserMinus, Users, X } from 'lucide-react';
import { api } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Avatar, Badge, Button, Card, Chips, EmptyState, ErrorState, Modal, Skeleton, Textarea, useConfirm,
} from '../components/ui';
import ProjectForm from '../components/ProjectForm';
import { date, fullName, timeAgo } from '../lib/format';

function JoinRequests({ projectId, onChanged }) {
  const toast = useToast();
  const list = useFetch(() => api.get(`/projects/${projectId}/join-requests`), [projectId]);
  const decide = async (r, status) => {
    try {
      await api.patch(`/projects/${projectId}/join-requests/${r._id}`, { status });
      toast.success(`Request ${status}`);
      list.reload();
      onChanged();
    } catch (e) { toast.error(e); }
  };
  if (list.loading) return <Skeleton h={60} />;
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  const pending = list.data.items.filter((r) => r.status === 'pending');
  if (!pending.length) return <p className="muted">No pending requests.</p>;
  return (
    <div className="stack">
      {pending.map((r) => (
        <div key={r._id} className="panel row-between wrap" style={{ alignItems: 'flex-start' }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Avatar user={r.user} size={34} />
            <div>
              <Link to={`/profile/${r.user._id}`}><strong>{fullName(r.user)}</strong></Link>
              <div className="subtle">{r.user.headline}</div>
              {r.message && <p style={{ marginTop: 4 }}>“{r.message}”</p>}
              <div className="chips" style={{ marginTop: 6 }}>{(r.user.skills || []).slice(0, 6).map((s) => <span className="chip" key={s.name}>{s.name}</span>)}</div>
            </div>
          </div>
          <div className="row">
            <Button size="sm" variant="primary" icon={Check} onClick={() => decide(r, 'accepted')}>Accept</Button>
            <Button size="sm" variant="ghost" icon={X} onClick={() => decide(r, 'declined')}>Decline</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirm, confirmDialog] = useConfirm();
  const { data, loading, error, reload, setData } = useFetch(() => api.get(`/projects/${id}`), [id]);
  const [editing, setEditing] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinMsg, setJoinMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="stack"><Skeleton h={40} w="50%" /><Skeleton h={200} /></div>;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const p = data.project;

  const toggleBookmark = async () => {
    try {
      if (p.isBookmarked) await api.del(`/projects/${p._id}/bookmark`);
      else await api.post(`/projects/${p._id}/bookmark`);
      setData({ project: { ...p, isBookmarked: !p.isBookmarked, bookmarkCount: p.bookmarkCount + (p.isBookmarked ? -1 : 1) } });
    } catch (e) { toast.error(e); }
  };
  const join = async () => {
    setBusy(true);
    try {
      await api.post(`/projects/${p._id}/join-requests`, { message: joinMsg });
      toast.success('Request sent to the project owner');
      setJoinOpen(false);
      reload();
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!(await confirm('This permanently deletes the project, its bookmarks and join requests.', { title: 'Delete project?', confirmLabel: 'Delete' }))) return;
    try { await api.del(`/projects/${p._id}`); toast.success('Project deleted'); navigate('/projects?tab=mine'); } catch (e) { toast.error(e); }
  };
  const removeMember = async (m) => {
    const self = String(m._id) === String(user._id);
    if (!(await confirm(self ? 'Leave this project?' : `Remove ${fullName(m)} from the team?`, { confirmLabel: self ? 'Leave' : 'Remove' }))) return;
    try {
      await api.del(`/projects/${p._id}/members/${m._id}`);
      toast.success(self ? 'You left the project' : 'Member removed');
      reload();
    } catch (e) { toast.error(e); }
  };

  const canJoin = !p.isMember && p.lookingForMembers && p.members.length < p.maxTeamSize && p.myJoinRequest?.status !== 'pending';

  return (
    <div className="stack-lg">
      {confirmDialog}
      <Link to="/projects" className="row subtle"><ArrowLeft size={14} /> All projects</Link>
      <div className="card card-body stack">
        <div className="row-between wrap" style={{ alignItems: 'flex-start' }}>
          <div className="stack" style={{ gap: 6 }}>
            <div className="row wrap"><h1>{p.title}</h1><Badge>{p.status}</Badge><Badge>{p.category}</Badge><Badge>{p.difficulty}</Badge>{p.isSynthetic && <Badge>synthetic demo</Badge>}</div>
            {p.summary && <p className="muted">{p.summary}</p>}
            <div className="subtle row" style={{ gap: 6 }}>
              <Avatar user={p.owner} size={20} /> <Link to={`/profile/${p.owner._id}`}>{fullName(p.owner)}</Link> · created {date(p.createdAt)} · {p.bookmarkCount} bookmark(s)
            </div>
          </div>
          <div className="row wrap">
            <Button variant="outline" icon={p.isBookmarked ? BookmarkCheck : Bookmark} onClick={toggleBookmark}>{p.isBookmarked ? 'Bookmarked' : 'Bookmark'}</Button>
            {p.isOwner && <Button variant="outline" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>}
            {p.isOwner && <Button variant="danger" icon={Trash2} onClick={remove}>Delete</Button>}
            {canJoin && <Button variant="primary" icon={Users} onClick={() => setJoinOpen(true)}>Request to join</Button>}
            {p.myJoinRequest?.status === 'pending' && <Badge tone="warning">Join request pending</Badge>}
            {p.isMember && !p.isOwner && <Button variant="ghost" icon={LogOut} onClick={() => removeMember(user)}>Leave</Button>}
          </div>
        </div>
        <p className="prewrap">{p.description}</p>
        <div className="grid-2">
          <div><div className="label" style={{ marginBottom: 6 }}>Tech stack</div><Chips items={p.techStack} /></div>
          <div><div className="label" style={{ marginBottom: 6 }}>Skills needed</div><Chips items={p.rolesNeeded} empty="Not looking for specific skills" /></div>
        </div>
        <div className="row wrap">
          {p.repoUrl && <a className="btn btn-outline btn-sm" href={p.repoUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> Repository</a>}
          {p.demoUrl && <a className="btn btn-outline btn-sm" href={p.demoUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> Live demo</a>}
        </div>
      </div>

      <div className="grid-2">
        <Card title={`Team (${p.members.length}/${p.maxTeamSize})`}
          actions={p.isMember && <Link className="btn btn-outline btn-sm" to={`/team-finder?project=${p._id}`}>Find teammates</Link>}>
          <div className="stack">
            {p.members.map((m) => (
              <div key={m._id} className="row-between">
                <Link to={`/profile/${m._id}`} className="row" style={{ color: 'inherit' }}>
                  <Avatar user={m} size={32} />
                  <div><strong>{fullName(m)}</strong>{String(m._id) === String(p.owner._id) && <Badge tone="accent" style={{ marginLeft: 6 }}>owner</Badge>}
                    <div className="subtle">{m.headline}</div></div>
                </Link>
                {p.isOwner && String(m._id) !== String(p.owner._id) && <Button size="sm" variant="ghost" icon={UserMinus} onClick={() => removeMember(m)} aria-label={`Remove ${fullName(m)}`} />}
              </div>
            ))}
          </div>
        </Card>
        {p.isOwner ? (
          <Card title="Join requests"><JoinRequests projectId={p._id} onChanged={reload} /></Card>
        ) : (
          <Card title="Your status">
            {p.isMember ? <p>You're on this team. 🎉</p>
              : p.myJoinRequest ? <p>Your request was <strong>{p.myJoinRequest.status}</strong> {timeAgo(p.myJoinRequest.createdAt)}.</p>
                : !p.lookingForMembers ? <EmptyState title="Not recruiting">This project isn't accepting new members right now.</EmptyState>
                  : <p className="muted">Interested? Send a short note about what you'd contribute.</p>}
          </Card>
        )}
      </div>

      {editing && <ProjectForm open project={p} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
      <Modal open={joinOpen} onClose={() => setJoinOpen(false)} title={`Join "${p.title}"`}
        footer={<><Button variant="ghost" onClick={() => setJoinOpen(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={join}>Send request</Button></>}>
        <Textarea label="Message to the owner (optional)" value={joinMsg} onChange={(e) => setJoinMsg(e.target.value)} maxLength={500}
          placeholder="Hi! I know Docker and would love to help with deployment." />
      </Modal>
    </div>
  );
}
