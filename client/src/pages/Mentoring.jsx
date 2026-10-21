import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarClock, Pencil, Plus, Presentation, Star, Video } from 'lucide-react';
import { api } from '../lib/api';
import { useDebounce, useFetch } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Avatar, Badge, Button, CardSkeletons, EmptyState, ErrorState, Input, Modal, PageHeader, Pagination, Segmented, Select, Skeleton, Tabs, Textarea,
} from '../components/ui';
import { dateTime, fullName, toDateTimeInput } from '../lib/format';

const STATUS_TONE = { requested: 'warning', accepted: 'info', completed: 'good', declined: 'danger', cancelled: undefined };

function BookModal({ offer, onClose }) {
  const toast = useToast();
  const [when, setWhen] = useState(() => toDateTimeInput(Date.now() + 2 * 864e5));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/mentoring/offers/${offer._id}/sessions`, { scheduledAt: new Date(when).toISOString(), message });
      toast.success('Session requested — the mentor has been notified');
      onClose(true);
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={() => onClose(false)} title={`Book: ${offer.title}`}
      footer={<><Button variant="ghost" onClick={() => onClose(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={submit}>Request session</Button></>}>
      <div className="stack">
        <div className="row"><Avatar user={offer.mentor} size={32} /><div><strong>{fullName(offer.mentor)}</strong><div className="subtle">{offer.skill} · {offer.sessionMinutes} min · {offer.mode}</div></div></div>
        <Input label="Preferred date & time" type="datetime-local" value={when} min={toDateTimeInput(Date.now())} onChange={(e) => setWhen(e.target.value)} />
        <Textarea label="What do you want to work on?" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
      </div>
    </Modal>
  );
}

function OfferForm({ offer, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: offer?.title || '', skill: offer?.skill || '', description: offer?.description || '',
    level: offer?.level || 'beginner', sessionMinutes: offer?.sessionMinutes || 60, mode: offer?.mode || 'online',
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async () => {
    setBusy(true);
    try {
      const body = { ...form, sessionMinutes: Number(form.sessionMinutes) };
      if (offer) await api.patch(`/mentoring/offers/${offer._id}`, body); else await api.post('/mentoring/offers', body);
      toast.success(offer ? 'Offer updated' : 'Offer published');
      onClose(true);
    } catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={() => onClose(false)} title={offer ? 'Edit offer' : 'Offer mentoring'}
      footer={<><Button variant="ghost" onClick={() => onClose(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={submit}>{offer ? 'Save' : 'Publish'}</Button></>}>
      <div className="stack">
        <Input label="Title" value={form.title} onChange={set('title')} placeholder="e.g. Get unstuck with React hooks" />
        <Input label="Skill" value={form.skill} onChange={set('skill')} placeholder="e.g. React" />
        <Textarea label="Description" value={form.description} onChange={set('description')} maxLength={2000} />
        <div className="grid-3">
          <Select label="Learner level" value={form.level} onChange={set('level')} options={['beginner', 'intermediate', 'advanced']} />
          <Select label="Session length" value={form.sessionMinutes} onChange={set('sessionMinutes')} options={[30, 45, 60, 90].map((m) => ({ value: m, label: `${m} min` }))} />
          <Select label="Mode" value={form.mode} onChange={set('mode')} options={['online', 'in-person']} />
        </div>
      </div>
    </Modal>
  );
}

function FindMentor() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [booking, setBooking] = useState(null);
  const dq = useDebounce(q, 300);
  const list = useFetch(() => api.get('/mentoring/offers', { q: dq, page, limit: 12 }), [dq, page]);

  // Deep link: /mentoring?offer=<id> opens the booking dialog.
  useEffect(() => {
    const id = params.get('offer');
    if (id && list.data) {
      const found = list.data.items.find((o) => o._id === id);
      if (found) setBooking(found);
      else api.get('/mentoring/offers', { limit: 100 }).then((d) => setBooking(d.items.find((o) => o._id === id) || null)).catch(() => {});
    }
  }, [params, list.data]);

  return (
    <div className="stack">
      <input className="input" placeholder="Search by skill or topic…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search mentoring offers" />
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} />
        : list.loading && !list.data ? <CardSkeletons />
          : list.data.items.length === 0 ? <EmptyState icon={Presentation} title="No offers found" />
            : (
              <>
                <div className="cards">
                  {list.data.items.map((o) => (
                    <div key={o._id} className="card card-body stack" style={{ gap: 10 }}>
                      <div className="row"><Avatar user={o.mentor} size={36} />
                        <div style={{ minWidth: 0 }}>
                          <Link to={`/profile/${o.mentor._id}`}><strong>{fullName(o.mentor)}</strong></Link>
                          <div className="subtle row" style={{ gap: 4 }}>{o.mentor.ratingCount > 0 ? <><Star size={12} style={{ color: 'var(--warning)' }} fill="currentColor" />{o.mentor.ratingAverage} ({o.mentor.ratingCount})</> : 'New mentor'}</div>
                        </div>
                      </div>
                      <h3>{o.title}</h3>
                      <p className="muted clamp-3">{o.description}</p>
                      <div className="row wrap"><Badge tone="accent">{o.skill}</Badge><Badge>{o.level}</Badge><Badge>{o.sessionMinutes} min</Badge><Badge>{o.mode}</Badge></div>
                      {String(o.mentor._id) !== String(user._id)
                        ? <Button variant="primary" onClick={() => setBooking(o)}>Book a session</Button>
                        : <span className="subtle">This is your offer</span>}
                    </div>
                  ))}
                </div>
                <Pagination pagination={list.data.pagination} onPage={setPage} />
              </>
            )}
      {booking && <BookModal offer={booking} onClose={() => { setBooking(null); if (params.get('offer')) setParams({}); }} />}
    </div>
  );
}

function MyOffers() {
  const toast = useToast();
  const list = useFetch(() => api.get('/mentoring/offers/mine'));
  const [editing, setEditing] = useState(null);
  const archive = async (o) => {
    try { await api.patch(`/mentoring/offers/${o._id}`, { isActive: !o.isActive }); list.reload(); } catch (e) { toast.error(e); }
  };
  return (
    <div className="stack">
      <div><Button variant="primary" icon={Plus} onClick={() => setEditing({})}>New offer</Button></div>
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : list.loading ? <Skeleton h={120} />
        : list.data.items.length === 0 ? <EmptyState icon={Presentation} title="Share what you know">Publish an offer and learners can book sessions with you.</EmptyState>
          : (
            <div className="cards">
              {list.data.items.map((o) => (
                <div key={o._id} className="card card-body stack" style={{ gap: 8, opacity: o.isActive ? 1 : 0.6 }}>
                  <div className="row-between"><h3>{o.title}</h3>{!o.isActive && <Badge>archived</Badge>}</div>
                  <div className="row wrap"><Badge tone="accent">{o.skill}</Badge><Badge>{o.level}</Badge><Badge>{o.sessionMinutes} min</Badge></div>
                  <div className="row">
                    <Button size="sm" variant="outline" icon={Pencil} onClick={() => setEditing(o)}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => archive(o)}>{o.isActive ? 'Archive' : 'Re-activate'}</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
      {editing && <OfferForm offer={editing._id ? editing : null} onClose={(saved) => { setEditing(null); if (saved) list.reload(); }} />}
    </div>
  );
}

function ReviewModal({ session, onClose }) {
  const toast = useToast();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await api.post(`/mentoring/sessions/${session._id}/review`, { rating, comment }); toast.success('Thanks for your review!'); onClose(true); }
    catch (e) { toast.error(e); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={() => onClose(false)} title={`Review ${fullName(session.mentor)}`}
      footer={<><Button variant="ghost" onClick={() => onClose(false)}>Cancel</Button><Button variant="primary" loading={busy} onClick={submit}>Submit review</Button></>}>
      <div className="stack">
        <div className="field"><span className="label">Rating</span>
          <div className="row" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} type="button" className="btn btn-ghost btn-icon" role="radio" aria-checked={rating === i} aria-label={`${i} stars`} onClick={() => setRating(i)}>
                <Star size={22} style={{ color: 'var(--warning)' }} fill={i <= rating ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
        </div>
        <Textarea label="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
      </div>
    </Modal>
  );
}

function Sessions() {
  const { user } = useAuth();
  const toast = useToast();
  const [as, setAs] = useState('all');
  const list = useFetch(() => api.get('/mentoring/sessions', { as }), [as]);
  const [reviewing, setReviewing] = useState(null);
  const [accepting, setAccepting] = useState(null);
  const [meetingLink, setMeetingLink] = useState('');
  const update = async (s, status, link) => {
    try {
      await api.patch(`/mentoring/sessions/${s._id}`, { status, ...(link ? { meetingLink: link } : {}) });
      toast.success(`Session ${status}`);
      setAccepting(null);
      list.reload();
    } catch (e) { toast.error(e); }
  };

  return (
    <div className="stack">
      <Segmented label="Filter sessions" value={as} onChange={setAs} options={[{ value: 'all', label: 'All' }, { value: 'learner', label: 'As learner' }, { value: 'mentor', label: 'As mentor' }]} />
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : list.loading ? <Skeleton h={160} />
        : list.data.items.length === 0 ? <EmptyState icon={CalendarClock} title="No sessions yet">Book a mentor or publish an offer to get started.</EmptyState>
          : (
            <div className="stack">
              {list.data.items.map((s) => {
                const isMentor = String(s.mentor._id) === String(user._id);
                const other = isMentor ? s.learner : s.mentor;
                return (
                  <div key={s._id} className="card card-body row wrap" style={{ gap: 14, alignItems: 'flex-start' }}>
                    <Avatar user={other} size={38} />
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div className="row wrap"><strong>{s.offer?.title || s.skill}</strong><Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge><Badge>{isMentor ? 'You mentor' : 'You learn'}</Badge></div>
                      <div className="subtle">with <Link to={`/profile/${other._id}`}>{fullName(other)}</Link> · {dateTime(s.scheduledAt)} · {s.durationMinutes} min</div>
                      {s.message && <p style={{ marginTop: 4 }}>“{s.message}”</p>}
                      {s.meetingLink && s.status === 'accepted' && <a href={s.meetingLink} target="_blank" rel="noopener noreferrer" className="row" style={{ gap: 4, marginTop: 4 }}><Video size={14} /> Join meeting</a>}
                    </div>
                    <div className="row wrap">
                      {isMentor && s.status === 'requested' && <><Button size="sm" variant="primary" onClick={() => { setMeetingLink(''); setAccepting(s); }}>Accept</Button><Button size="sm" variant="ghost" onClick={() => update(s, 'declined')}>Decline</Button></>}
                      {s.status === 'accepted' && <Button size="sm" variant="outline" onClick={() => update(s, 'completed')}>Mark completed</Button>}
                      {['requested', 'accepted'].includes(s.status) && <Button size="sm" variant="ghost" onClick={() => update(s, 'cancelled')}>Cancel</Button>}
                      {!isMentor && s.status === 'completed' && !s.reviewed && <Button size="sm" variant="primary" icon={Star} onClick={() => setReviewing(s)}>Leave review</Button>}
                      {!isMentor && s.reviewed && <Badge tone="good">Reviewed</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      <Modal open={Boolean(accepting)} onClose={() => setAccepting(null)} title="Accept session"
        footer={<><Button variant="ghost" onClick={() => setAccepting(null)}>Cancel</Button><Button variant="primary" onClick={() => update(accepting, 'accepted', meetingLink.trim())}>Accept</Button></>}>
        <Input label="Meeting link (optional)" placeholder="https://meet.example.com/…" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)}
          hint="Shared with the learner once you accept." />
      </Modal>
      {reviewing && <ReviewModal session={reviewing} onClose={(done) => { setReviewing(null); if (done) list.reload(); }} />}
    </div>
  );
}

export default function Mentoring() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'find';
  return (
    <div className="stack-lg">
      <PageHeader title="Mentoring" description="Learn from peers who've been there — and teach what you know." />
      <Tabs value={tab} onChange={(v) => setParams(v === 'find' ? {} : { tab: v })}
        tabs={[{ value: 'find', label: 'Find a mentor' }, { value: 'offers', label: 'My offers' }, { value: 'sessions', label: 'Sessions' }]} />
      {tab === 'find' && <FindMentor />}
      {tab === 'offers' && <MyOffers />}
      {tab === 'sessions' && <Sessions />}
    </div>
  );
}
