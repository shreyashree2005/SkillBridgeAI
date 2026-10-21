// One Socket.IO connection per logged-in session. Exposes live unread counts
// and lets pages subscribe to events (new messages, typing, presence).
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, SOCKET_URL } from '../lib/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const RealtimeContext = createContext(null);

export function RealtimeProvider({ children }) {
  const { token, user } = useAuth();
  const toast = useToast();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [online, setOnline] = useState(() => new Set());
  const activeConversation = useRef(null);

  const refreshCounts = useCallback(async () => {
    try {
      const [n, m] = await Promise.all([api.get('/notifications/unread-count'), api.get('/chat/unread-count')]);
      setUnreadNotifications(n.count);
      setUnreadMessages(m.count);
    } catch { /* counts are best-effort */ }
  }, []);

  useEffect(() => {
    if (!token || !user) return undefined;
    refreshCounts();
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('notification:new', (n) => {
      setUnreadNotifications((c) => c + 1);
      if (n.type !== 'message') toast.info(n.title);
    });
    socket.on('message:new', (m) => {
      if (String(m.sender) !== String(user._id) && String(m.conversation) !== activeConversation.current) {
        setUnreadMessages((c) => c + 1);
      }
    });
    socket.on('presence:update', ({ userId, online: isOnline }) => {
      setOnline((prev) => {
        const next = new Set(prev);
        if (isOnline) next.add(userId); else next.delete(userId);
        return next;
      });
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?._id]);

  const subscribe = useCallback((event, handler) => {
    const socket = socketRef.current;
    if (!socket) return () => {};
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }, []);

  const emit = useCallback((event, payload) => new Promise((resolve) => {
    const socket = socketRef.current;
    if (!socket?.connected) return resolve({ ok: false, error: 'offline' });
    socket.timeout(8000).emit(event, payload, (err, res) => resolve(err ? { ok: false, error: 'timeout' } : res));
  }), []);

  const value = {
    connected, online, subscribe, emit, refreshCounts,
    unreadNotifications, setUnreadNotifications, unreadMessages, setUnreadMessages,
    setActiveConversation: (id) => { activeConversation.current = id; },
  };
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = () => useContext(RealtimeContext);
