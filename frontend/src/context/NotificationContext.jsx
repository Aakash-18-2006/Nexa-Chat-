import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { notificationApi } from '../api/endpoints';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { sound } from '../utils/sound';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { token, user } = useAuth();
  const { socket } = useSocket();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await notificationApi.getNotifications();
      if (res.data?.success) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setIsOpen(false);
    }
  }, [token, fetchNotifications]);

  // Real-time socket listener for incoming notifications
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notification) => {
      if (!notification || !notification._id) return;

      setNotifications((prev) => {
        // Prevent duplicate notifications
        if (prev.some((n) => n._id === notification._id)) return prev;
        return [notification, ...prev];
      });

      setUnreadCount((prev) => prev + 1);

      // Audio notification if sound is enabled
      if (user?.settings?.notifications?.sound !== false) {
        sound.playMessageReceived();
      }
    };

    const handleFollowUpdated = ({ requestId, status }) => {
      if (!requestId) return;
      setNotifications((prev) =>
        prev.map((n) => {
          const rId = n.followRequest?._id || n.followRequest;
          if (rId && rId.toString() === requestId.toString()) {
            return {
              ...n,
              followRequest:
                typeof n.followRequest === 'object'
                  ? { ...n.followRequest, status }
                  : { _id: rId, status }
            };
          }
          return n;
        })
      );
    };

    socket.on('new_notification', handleNewNotification);
    socket.on('follow_request_updated', handleFollowUpdated);

    return () => {
      socket.off('new_notification', handleNewNotification);
      socket.off('follow_request_updated', handleFollowUpdated);
    };
  }, [socket, user]);

  const markAsRead = useCallback(async (id) => {
    try {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      await notificationApi.markRead(id);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      // Revert if needed by refetching
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const markAllAsRead = useCallback(async () => {
    try {
      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);

      await notificationApi.markAllRead();
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const deleteNotification = useCallback(async (id) => {
    try {
      // Optimistic delete
      setNotifications((prev) => {
        const target = prev.find((n) => n._id === id);
        if (target && !target.read) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
        return prev.filter((n) => n._id !== id);
      });

      await notificationApi.deleteNotification(id);
    } catch (err) {
      console.error('Failed to delete notification:', err);
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const clearAll = useCallback(async () => {
    try {
      setNotifications([]);
      setUnreadCount(0);
      await notificationApi.clearAll();
    } catch (err) {
      console.error('Failed to clear all notifications:', err);
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const toggleNotifications = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const contextValue = React.useMemo(() => ({
    notifications,
    unreadCount,
    loading,
    isOpen,
    setIsOpen,
    toggleNotifications,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll
  }), [
    notifications,
    unreadCount,
    loading,
    isOpen,
    toggleNotifications,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll
  ]);

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
