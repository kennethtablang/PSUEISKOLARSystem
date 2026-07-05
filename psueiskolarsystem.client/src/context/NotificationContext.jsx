import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { HubConnectionBuilder, HttpTransportType, LogLevel } from '@microsoft/signalr';
import { useAuth } from './AuthContext';
import { getNotifications, getUnreadCount, markRead, markAllRead } from '../api/notifications';
import { getMessageUnreadCount } from '../api/messages';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageUnread, setMessageUnread] = useState(0);
  const [connected, setConnected] = useState(false);
  const connectionRef = useRef(null);
  const messageListeners = useRef(new Set());

  // Let messaging screens subscribe to real-time "ReceiveMessage" events (FR-17.3).
  const subscribeToMessages = useCallback((fn) => {
    messageListeners.current.add(fn);
    return () => messageListeners.current.delete(fn);
  }, []);

  const refreshMessageUnread = useCallback(async () => {
    if (!token) return;
    try { setMessageUnread((await getMessageUnreadCount(token)).count); }
    catch { /* leave as-is */ }
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const [list, unread] = await Promise.all([
        getNotifications(token, { page: 1, pageSize: 30 }),
        getUnreadCount(token),
      ]);
      setItems(list.items);
      setUnreadCount(unread.count);
    } catch { /* offline or session expired — leave state as-is */ }
    refreshMessageUnread();
  }, [token, refreshMessageUnread]);

  // Initial load whenever auth changes
  useEffect(() => {
    if (!token) {
      setItems([]);
      setUnreadCount(0);
      setMessageUnread(0);
      return;
    }
    refresh();
  }, [token, refresh]);

  // Real-time hub connection (FR-13 / NFR-2.6)
  useEffect(() => {
    if (!token) return;

    const connection = new HubConnectionBuilder()
      .withUrl('/hubs/notifications', {
        accessTokenFactory: () => token,
        // Fall back gracefully if WebSockets are unavailable (FR-13.5)
        transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on('ReceiveNotification', (n) => {
      setItems(prev => [n, ...prev].slice(0, 50));
      setUnreadCount(prev => prev + 1);
    });

    connection.on('ReceiveMessage', (m) => {
      setMessageUnread(prev => prev + 1);
      messageListeners.current.forEach(fn => { try { fn(m); } catch { /* listener error */ } });
    });

    connection.onreconnected(() => { setConnected(true); refresh(); });
    connection.onreconnecting(() => setConnected(false));
    connection.onclose(() => setConnected(false));

    connection.start()
      .then(() => setConnected(true))
      .catch(() => setConnected(false));

    connectionRef.current = connection;

    return () => {
      connection.stop().catch(() => {});
      connectionRef.current = null;
    };
  }, [token, refresh]);

  const markOneRead = useCallback(async (id) => {
    setItems(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount(prev => Math.max(0, prev - 1));
    try { await markRead(id, token); } catch { /* best effort */ }
  }, [token]);

  const markEverythingRead = useCallback(async () => {
    setItems(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try { await markAllRead(token); } catch { /* best effort */ }
  }, [token]);

  return (
    <NotificationContext.Provider value={{ items, unreadCount, messageUnread, connected, refresh, refreshMessageUnread, markOneRead, markEverythingRead, subscribeToMessages }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
