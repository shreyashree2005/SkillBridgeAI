import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Send } from 'lucide-react';
import { api } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useToast } from '../context/ToastContext';
import { Avatar, Button, EmptyState, ErrorState, Skeleton } from '../components/ui';
import { fullName, timeAgo } from '../lib/format';

function Thread({ conversation, onSent, onBack }) {
  const { user } = useAuth();
  const { subscribe, emit, online, setActiveConversation, refreshCounts } = useRealtime();
  const toast = useToast();
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const bottom = useRef(null);
  const lastTyping = useRef(0);
  const id = conversation._id;

  useEffect(() => {
    let cancelled = false;
    setMessages(null);
    setError(null);
    setActiveConversation(id);
    api.get(`/chat/conversations/${id}/messages`)
      .then((d) => { if (!cancelled) { setMessages(d.items); setHasMore(d.hasMore); } })
      .catch((e) => !cancelled && setError(e));
    api.post(`/chat/conversations/${id}/read`).then(refreshCounts).catch(() => {});

    const offMsg = subscribe('message:new', (m) => {
      if (String(m.conversation) !== id) return;
      setMessages((prev) => (prev && !prev.some((x) => x._id === m._id) ? [...prev, m] : prev));
      setTyping(false);
      if (String(m.sender) !== String(user._id)) api.post(`/chat/conversations/${id}/read`).catch(() => {});
    });
    let typingTimer;
    const offTyping = subscribe('typing', (t) => {
      if (t.conversationId !== id) return;
      setTyping(true);
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => setTyping(false), 2500);
    });
    return () => { cancelled = true; offMsg(); offTyping(); clearTimeout(typingTimer); setActiveConversation(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [messages?.length, typing]);

  const loadOlder = async () => {
    const d = await api.get(`/chat/conversations/${id}/messages`, { before: messages[0].createdAt });
    setMessages((prev) => [...d.items, ...prev]);
    setHasMore(d.hasMore);
  };

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    // Prefer the socket; fall back to REST if the socket is unavailable.
    let res = await emit('message:send', { conversationId: id, body });
    if (!res?.ok && (res?.error === 'offline' || res?.error === 'timeout')) {
      try { res = { ok: true, message: (await api.post(`/chat/conversations/${id}/messages`, { body })).message }; }
      catch (err) { res = { ok: false, error: err.message }; }
    }
    setSending(false);
    if (!res.ok) return toast.error(res.error || 'Could not send message');
    setMessages((prev) => (prev.some((x) => x._id === res.message._id) ? prev : [...prev, res.message]));
    setText('');
    onSent(res.message);
  };

  const onType = (e) => {
    setText(e.target.value);
    if (Date.now() - lastTyping.current > 1500) {
      lastTyping.current = Date.now();
      emit('typing', { conversationId: id });
    }
  };

  const other = conversation.other;
  return (
    <div className="chat-thread">
      <div className="card-header">
        <div className="row">
          <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack} aria-label="Back to conversations" className="menu-btn" />
          <Avatar user={other} size={32} online={online.has(String(other._id)) || other.online} />
          <div><Link to={`/profile/${other._id}`}><strong>{fullName(other)}</strong></Link>
            <div className="subtle">{typing ? 'typing…' : other.headline}</div></div>
        </div>
      </div>
      <div className="chat-messages" aria-live="polite">
        {error ? <ErrorState error={error} /> : !messages ? <Skeleton h={120} /> : (
          <>
            {hasMore && <Button variant="ghost" size="sm" onClick={loadOlder} style={{ alignSelf: 'center' }}>Load older messages</Button>}
            {messages.length === 0 && <p className="subtle" style={{ textAlign: 'center' }}>Say hi 👋</p>}
            {messages.map((m) => {
              const mine = String(m.sender) === String(user._id);
              return (
                <div key={m._id} className={`bubble ${mine ? 'mine' : 'theirs'}`}>
                  {m.body}
                  <time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
                </div>
              );
            })}
            {typing && <div className="bubble theirs subtle">…</div>}
            <div ref={bottom} />
          </>
        )}
      </div>
      <form className="chat-compose" onSubmit={send}>
        <input className="input" value={text} onChange={onType} placeholder="Write a message…" maxLength={2000} aria-label="Message" />
        <Button variant="primary" icon={Send} loading={sending} type="submit" disabled={!text.trim()}>Send</Button>
      </form>
    </div>
  );
}

export default function Chat() {
  const [params, setParams] = useSearchParams();
  const { subscribe, online } = useRealtime();
  const list = useFetch(() => api.get('/chat/conversations'));
  const activeId = params.get('c');

  // Keep the conversation list fresh as messages arrive.
  useEffect(() => subscribe('message:new', (m) => {
    list.setData((d) => {
      if (!d) return d;
      const found = d.items.find((c) => c._id === String(m.conversation));
      if (!found) { list.reload(); return d; }
      const updated = { ...found, lastMessageAt: m.createdAt, lastMessagePreview: m.body,
        unread: String(m.conversation) === activeId ? 0 : found.unread + (String(m.sender) === String(found.other._id) ? 1 : 0) };
      return { ...d, items: [updated, ...d.items.filter((c) => c._id !== found._id)] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [subscribe, activeId]);

  const active = useMemo(() => list.data?.items.find((c) => c._id === activeId), [list.data, activeId]);

  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />;

  return (
    <div className="card chat" data-open={Boolean(active)}>
      <div className="chat-list">
        <div className="card-header"><h3>Messages</h3></div>
        {list.loading ? <div className="card-body stack"><Skeleton h={40} /><Skeleton h={40} /></div>
          : list.data.items.length === 0 ? <EmptyState icon={MessageSquare} title="No conversations yet">Message someone from their profile or the team finder.</EmptyState>
            : list.data.items.map((c) => (
              <button key={c._id} className="chat-item" aria-current={c._id === activeId}
                onClick={() => { setParams({ c: c._id }); list.setData((d) => ({ ...d, items: d.items.map((x) => (x._id === c._id ? { ...x, unread: 0 } : x)) })); }}>
                <Avatar user={c.other} size={38} online={online.has(String(c.other._id)) || c.other.online} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="row-between"><strong className="truncate">{fullName(c.other)}</strong><span className="subtle">{timeAgo(c.lastMessageAt)}</span></div>
                  <div className="row-between"><span className="subtle truncate">{c.lastMessagePreview || 'No messages yet'}</span>
                    {c.unread > 0 && <span className="badge badge-accent">{c.unread}</span>}</div>
                </div>
              </button>
            ))}
      </div>
      {active ? (
        <Thread key={active._id} conversation={active} onBack={() => setParams({})}
          onSent={(m) => list.setData((d) => ({ ...d, items: [{ ...active, lastMessageAt: m.createdAt, lastMessagePreview: m.body }, ...d.items.filter((c) => c._id !== active._id)] }))} />
      ) : (
        <div className="chat-thread"><EmptyState icon={MessageSquare} title="Select a conversation">Messages are delivered instantly over a secure WebSocket.</EmptyState></div>
      )}
    </div>
  );
}
