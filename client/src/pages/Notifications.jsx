import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useFetch } from '../lib/hooks';
import { useRealtime } from '../context/RealtimeContext';
import { useToast } from '../context/ToastContext';
import { Badge, Button, EmptyState, ErrorState, PageHeader, Pagination, Segmented, Skeleton } from '../components/ui';
import { timeAgo, titleCase } from '../lib/format';

export default function Notifications() {
  const toast = useToast();
  const { setUnreadNotifications } = useRealtime();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const list = useFetch(() => api.get('/notifications', { unread: filter === 'unread' ? 'true' : undefined, page, limit: 20 }), [filter, page]);

  const unread = list.data?.unread;
  useEffect(() => { if (unread !== undefined) setUnreadNotifications(unread); }, [unread, setUnreadNotifications]);

  const markRead = async (n) => {
    try {
      await api.patch(`/notifications/${n._id}/read`);
      list.setData((d) => ({ ...d, unread: Math.max(0, d.unread - 1), items: d.items.map((x) => (x._id === n._id ? { ...x, read: true } : x)) }));
    } catch (e) { toast.error(e); }
  };
  const markAll = async () => {
    try { await api.patch('/notifications/read-all'); list.reload(); } catch (e) { toast.error(e); }
  };
  const remove = async (n) => {
    try { await api.del(`/notifications/${n._id}`); list.reload(); } catch (e) { toast.error(e); }
  };

  return (
    <div className="stack-lg">
      <PageHeader title="Notifications" description="Join requests, sessions, reviews and course milestones."
        actions={<Button variant="outline" icon={CheckCheck} onClick={markAll} disabled={!list.data?.unread}>Mark all as read</Button>} />
      <Segmented label="Filter" value={filter} onChange={(v) => { setFilter(v); setPage(1); }}
        options={[{ value: 'all', label: 'All' }, { value: 'unread', label: `Unread${list.data ? ` (${list.data.unread})` : ''}` }]} />
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : list.loading && !list.data ? <Skeleton h={200} />
        : list.data.items.length === 0 ? <EmptyState icon={Bell} title={filter === 'unread' ? "You're all caught up" : 'No notifications yet'} />
          : (
            <div className="card">
              {list.data.items.map((n) => (
                <div key={n._id} className="row" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', alignItems: 'flex-start', background: n.read ? 'transparent' : 'var(--accent-soft)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row wrap">
                      <Link to={n.link || '#'} onClick={() => !n.read && markRead(n)} style={{ color: 'var(--text)', fontWeight: n.read ? 400 : 600 }}>{n.title}</Link>
                      <Badge>{titleCase(n.type)}</Badge>
                    </div>
                    {n.body && <p className="muted">{n.body}</p>}
                    <span className="subtle">{timeAgo(n.createdAt)}</span>
                  </div>
                  {!n.read && <Button variant="ghost" size="sm" icon={Check} onClick={() => markRead(n)} aria-label="Mark as read" />}
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => remove(n)} aria-label="Delete notification" />
                </div>
              ))}
            </div>
          )}
      {list.data && <Pagination pagination={list.data.pagination} onPage={setPage} />}
    </div>
  );
}
