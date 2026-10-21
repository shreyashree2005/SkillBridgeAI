import { useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Button, Input, Modal, Select, Textarea } from './ui';
import SkillInput from './SkillInput';

const CATEGORIES = ['web', 'mobile', 'ai-ml', 'data', 'devops', 'security', 'game', 'iot', 'blockchain', 'other'];

export default function ProjectForm({ open, onClose, project, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    title: project?.title || '', summary: project?.summary || '', description: project?.description || '',
    category: project?.category || 'web', status: project?.status || 'idea', difficulty: project?.difficulty || 'intermediate',
    techStack: project?.techStack || [], rolesNeeded: project?.rolesNeeded || [],
    repoUrl: project?.repoUrl || '', demoUrl: project?.demoUrl || '',
    maxTeamSize: project?.maxTeamSize || 4, lookingForMembers: project?.lookingForMembers ?? true,
  }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const body = { ...form, maxTeamSize: Number(form.maxTeamSize) };
      const d = project ? await api.patch(`/projects/${project._id}`, body) : await api.post('/projects', body);
      toast.success(project ? 'Project updated' : 'Project created');
      onSaved(d.project);
    } catch (err) {
      setErrors(Object.fromEntries((err.errors || []).map((x) => [x.field, x.message])));
      toast.error(err);
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title={project ? 'Edit project' : 'New project'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" loading={busy} onClick={submit}>{project ? 'Save changes' : 'Create project'}</Button></>}>
      <form className="stack" onSubmit={submit} noValidate>
        <Input label="Title" value={form.title} onChange={set('title')} error={errors.title} maxLength={120} />
        <Input label="One-line summary" value={form.summary} onChange={set('summary')} maxLength={200} />
        <Textarea label="Description" value={form.description} onChange={set('description')} error={errors.description}
          hint="What are you building, for whom, and what help do you need? (20+ characters)" rows={5} />
        <div className="grid-3">
          <Select label="Category" value={form.category} onChange={set('category')} options={CATEGORIES} />
          <Select label="Status" value={form.status} onChange={set('status')} options={['idea', 'in-progress', 'completed']} />
          <Select label="Difficulty" value={form.difficulty} onChange={set('difficulty')} options={['beginner', 'intermediate', 'advanced']} />
        </div>
        <SkillInput label="Tech stack" value={form.techStack} onChange={(techStack) => setForm({ ...form, techStack })} />
        <SkillInput label="Skills still needed" value={form.rolesNeeded} onChange={(rolesNeeded) => setForm({ ...form, rolesNeeded })}
          hint="Used to recommend complementary teammates." />
        <div className="grid-2">
          <Input label="Repository URL" value={form.repoUrl} onChange={set('repoUrl')} error={errors.repoUrl} placeholder="https://github.com/…" />
          <Input label="Demo URL" value={form.demoUrl} onChange={set('demoUrl')} error={errors.demoUrl} placeholder="https://…" />
        </div>
        <div className="grid-2" style={{ alignItems: 'end' }}>
          <Input label="Max team size" type="number" min="1" max="20" value={form.maxTeamSize} onChange={set('maxTeamSize')} />
          <label className="checkbox" style={{ height: 38 }}>
            <input type="checkbox" checked={form.lookingForMembers} onChange={(e) => setForm({ ...form, lookingForMembers: e.target.checked })} />
            Accepting new members
          </label>
        </div>
      </form>
    </Modal>
  );
}
