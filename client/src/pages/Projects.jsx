import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Bookmark, BookmarkCheck, FolderGit2, Plus, Sparkles, Users } from 'lucide-react';
import { api } from '../lib/api';
import { useDebounce, useFetch } from '../lib/hooks';
import { useToast } from '../context/ToastContext';
import {
  Avatar, Badge, Button, CardSkeletons, EmptyState, ErrorState, PageHeader, Pagination, Select, Tabs,
} from '../components/ui';
import ProjectForm from '../components/ProjectForm';
import { fullName, titleCase } from '../lib/format';

const STATUS_TONE = { idea: 'info', 'in-progress': 'warning', completed: 'good' };

export function ProjectCard({ project, onToggleBookmark, extra }) {
  return (
    <article className="card card-hover card-body stack" style={{ gap: 10 }}>
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <Link to={`/projects/${project._id}`} style={{ color: 'inherit', minWidth: 0 }}>
          <h3 className="clamp-2">{project.title}</h3>
        </Link>
        {onToggleBookmark && (
          <Button variant="ghost" size="sm" icon={project.isBookmarked ? BookmarkCheck : Bookmark}
            onClick={() => onToggleBookmark(project)} aria-pressed={project.isBookmarked}
            aria-label={project.isBookmarked ? 'Remove bookmark' : 'Bookmark project'} />
        )}
      </div>
      <p className="muted clamp-2">{project.summary || project.description}</p>
      <div className="chips">{(project.techStack || []).slice(0, 5).map((t) => <span key={t} className="chip">{t}</span>)}</div>
      {extra}
      <div className="row-between subtle" style={{ marginTop: 'auto' }}>
        <span className="row" style={{ gap: 6 }}>
          {project.owner && <><Avatar user={project.owner} size={22} />{fullName(project.owner)}</>}
        </span>
        <span className="row" style={{ gap: 6 }}>
          <Badge tone={STATUS_TONE[project.status]}>{project.status}</Badge>
          <span className="row" style={{ gap: 3 }}><Users size={13} />{project.members?.length || 1}/{project.maxTeamSize}</span>
        </span>
      </div>
    </article>
  );
}

function useBookmarkToggle(setData) {
  const toast = useToast();
  return async (project) => {
    const next = !project.isBookmarked;
    const patch = (items) => items.map((p) => (p._id === project._id
      ? { ...p, isBookmarked: next, bookmarkCount: (p.bookmarkCount || 0) + (next ? 1 : -1) } : p));
    setData((d) => (d ? { ...d, items: patch(d.items) } : d));
    try {
      if (next) await api.post(`/projects/${project._id}/bookmark`);
      else await api.del(`/projects/${project._id}/bookmark`);
    } catch (e) {
      setData((d) => (d ? { ...d, items: d.items.map((p) => (p._id === project._id ? project : p)) } : d));
      toast.error(e);
    }
  };
}

function Discover() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [filters, setFilters] = useState({ category: '', status: '', sort: 'newest', lookingForMembers: '' });
  const [page, setPage] = useState(1);
  const dq = useDebounce(q, 300);
  const list = useFetch(() => api.get('/projects', { q: dq, ...filters, page, limit: 12 }), [dq, filters, page]);
  const toggle = useBookmarkToggle(list.setData);
  const setFilter = (k) => (e) => { setFilters({ ...filters, [k]: e.target.value }); setPage(1); };

  return (
    <div className="stack">
      <div className="grid-4" style={{ alignItems: 'end' }}>
        <div className="field">
          <label htmlFor="project-search">Search</label>
          <input id="project-search" className="input" placeholder="Title, tech, keyword…" value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); setParams(e.target.value ? { q: e.target.value } : {}, { replace: true }); }} />
        </div>
        <Select label="Category" value={filters.category} onChange={setFilter('category')}
          options={[{ value: '', label: 'All categories' }, ...['web', 'mobile', 'ai-ml', 'data', 'devops', 'security', 'game', 'iot', 'blockchain', 'other'].map((c) => ({ value: c, label: titleCase(c) }))]} />
        <Select label="Status" value={filters.status} onChange={setFilter('status')}
          options={[{ value: '', label: 'Any status' }, 'idea', 'in-progress', 'completed'].map((o) => (typeof o === 'string' ? { value: o, label: titleCase(o) } : o))} />
        <Select label="Sort" value={filters.sort} onChange={setFilter('sort')} options={[{ value: 'newest', label: 'Newest' }, { value: 'popular', label: 'Most bookmarked' }]} />
      </div>
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} />
        : list.loading && !list.data ? <CardSkeletons />
          : list.data.items.length === 0 ? <EmptyState icon={FolderGit2} title="No projects found">Try a different search or filter.</EmptyState>
            : (
              <>
                <div className="cards" aria-busy={list.loading}>{list.data.items.map((p) => <ProjectCard key={p._id} project={p} onToggleBookmark={toggle} />)}</div>
                <Pagination pagination={list.data.pagination} onPage={setPage} />
              </>
            )}
    </div>
  );
}

function Recommended() {
  const list = useFetch(() => api.get('/ai/recommendations/projects'));
  const toggle = useBookmarkToggle((fn) => list.setData((d) => {
    if (!d) return d;
    const projects = fn({ items: d.items.map((r) => r.project) }).items;
    return { ...d, items: d.items.map((r, i) => ({ ...r, project: projects[i] })) };
  }));
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (list.loading) return <CardSkeletons count={3} />;
  if (!list.data.items.length) {
    return <EmptyState icon={Sparkles} title="No recommendations yet" action={<Link className="btn btn-primary" to="/profile">Add your skills</Link>}>
      {list.data.message || 'Add more skills to your profile so we can match you to projects.'}</EmptyState>;
  }
  return (
    <div className="stack">
      <div className="alert alert-info"><Sparkles size={16} /> Ranked by TF-IDF similarity to your profile, how much of each stack you know, and which open roles you can fill.</div>
      <div className="cards">
        {list.data.items.map((r) => (
          <ProjectCard key={r.id} project={r.project} onToggleBookmark={toggle}
            extra={<div className="panel" style={{ padding: 10 }}>
              <div className="row-between"><span className="label">Match</span><Badge tone="accent">{r.score}%</Badge></div>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }} className="subtle">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>} />
        ))}
      </div>
    </div>
  );
}

function SimpleList({ path, empty }) {
  const list = useFetch(() => api.get(path), [path]);
  const toggle = useBookmarkToggle(list.setData);
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  if (list.loading) return <CardSkeletons count={3} />;
  if (!list.data.items.length) return empty;
  return <div className="cards">{list.data.items.map((p) => <ProjectCard key={p._id} project={p} onToggleBookmark={path.endsWith('bookmarks') ? toggle : undefined} />)}</div>;
}

export default function Projects() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'discover';
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="stack-lg">
      <PageHeader title="Projects" description="Discover projects, find collaborators and showcase your work."
        actions={<Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>New project</Button>} />
      <Tabs value={tab} onChange={(v) => setParams(v === 'discover' ? {} : { tab: v })} tabs={[
        { value: 'discover', label: 'Discover' },
        { value: 'recommended', label: 'Recommended for you', icon: Sparkles },
        { value: 'mine', label: 'My projects' },
        { value: 'bookmarks', label: 'Bookmarks' },
      ]} />
      {tab === 'discover' && <Discover />}
      {tab === 'recommended' && <Recommended />}
      {tab === 'mine' && <SimpleList path="/projects/mine" empty={<EmptyState icon={FolderGit2} title="No projects yet" action={<Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>Create your first project</Button>}>Projects you own or join appear here.</EmptyState>} />}
      {tab === 'bookmarks' && <SimpleList path="/projects/bookmarks" empty={<EmptyState icon={Bookmark} title="No bookmarks yet">Bookmark projects to find them later.</EmptyState>} />}
      {creating && <ProjectForm open onClose={() => setCreating(false)} onSaved={(p) => navigate(`/projects/${p._id}`)} />}
    </div>
  );
}
