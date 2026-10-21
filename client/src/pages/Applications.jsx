import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, StickyNote, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { useToast } from '../context/ToastContext';
import { Badge, Button, EmptyState, ErrorState, Modal, PageHeader, Skeleton, Textarea, useConfirm } from '../components/ui';
import { date, titleCase } from '../lib/format';

const COLUMNS = ['saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn'];

export default function Applications() {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const list = useFetch(() => api.get('/applications'));
  const [noteFor, setNoteFor] = useState(null);
  const [note, setNote] = useState('');

  const update = async (a, patch) => {
    try {
      const d = await api.patch(`/applications/${a._id}`, patch);
      list.setData((x) => ({ items: x.items.map((i) => (i._id === a._id ? d.application : i)) }));
      return true;
    } catch (e) { toast.error(e); return false; }
  };
  const remove = async (a) => {
    if (!(await confirm(`Remove "${a.job.title}" from your tracker?`, { confirmLabel: 'Remove' }))) return;
    try { await api.del(`/applications/${a._id}`); list.setData((x) => ({ items: x.items.filter((i) => i._id !== a._id) })); } catch (e) { toast.error(e); }
  };

  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;
  const items = list.data?.items || [];

  return (
    <div className="stack-lg">
      {confirmDialog}
      <PageHeader title="Applications" description="Track every job from saved to offer. Move cards by changing their status."
        actions={<Link className="btn btn-primary" to="/jobs">Find jobs</Link>} />
      {list.loading ? <Skeleton h={260} /> : items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Your tracker is empty" action={<Link className="btn btn-primary" to="/jobs">Browse jobs</Link>}>
          Save jobs you like and update their status as you progress.</EmptyState>
      ) : (
        <div className="board">
          {COLUMNS.map((col) => {
            const cards = items.filter((a) => a.status === col);
            return (
              <section key={col} className="board-col" aria-label={titleCase(col)}>
                <h3><span>{titleCase(col)}</span><span className="tnum">{cards.length}</span></h3>
                <div className="stack" style={{ gap: 8 }}>
                  {cards.map((a) => (
                    <article key={a._id} className="card card-body stack" style={{ padding: 12, gap: 6 }}>
                      <strong className="clamp-2">{a.job.title}</strong>
                      <span className="subtle">{a.job.company}</span>
                      {typeof a.matchScore === 'number' && <Badge tone="accent">Match {a.matchScore}%</Badge>}
                      {a.notes && <p className="subtle clamp-3">{a.notes}</p>}
                      <span className="subtle">{a.appliedAt ? `Applied ${date(a.appliedAt)}` : `Saved ${date(a.createdAt)}`}</span>
                      <select className="select" style={{ height: 30 }} value={a.status} aria-label="Status" onChange={(e) => update(a, { status: e.target.value })}>
                        {COLUMNS.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                      </select>
                      <div className="row">
                        <Button size="sm" variant="ghost" icon={StickyNote} onClick={() => { setNoteFor(a); setNote(a.notes || ''); }}>Notes</Button>
                        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(a)} aria-label="Remove" />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <Modal open={Boolean(noteFor)} onClose={() => setNoteFor(null)} title={noteFor ? `Notes · ${noteFor.job.title}` : ''}
        footer={<><Button variant="ghost" onClick={() => setNoteFor(null)}>Cancel</Button>
          <Button variant="primary" onClick={async () => { if (await update(noteFor, { notes: note })) setNoteFor(null); }}>Save notes</Button></>}>
        <Textarea label="Notes" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Recruiter name, interview dates, follow-ups…" />
        {noteFor?.statusHistory?.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="label">History</div>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{noteFor.statusHistory.map((h, i) => <li key={i}>{titleCase(h.status)} — {date(h.at)}</li>)}</ul>
          </div>
        )}
      </Modal>
    </div>
  );
}
