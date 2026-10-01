import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { sound } from '../utils/sound';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({}); // { conversationId: [ { _id, name } ] }
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const socketServerUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/\/api$/, '').replace(/\/$/, '')
      : window.location.origin;

    const newSocket = io(socketServerUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      const uid = (user?._id || user?.id)?.toString();
      console.log('[NEXA CALL DEBUG] Socket connected:', newSocket.id);
      console.log('[NEXA CALL DEBUG] User ID:', uid);
      console.log('[NEXA CALL DEBUG] User registered:', user?.username || user?.name || uid);
      console.log('[NEXA CALL DEBUG] Joined room: user:' + uid);
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('[NEXA CALL DEBUG] Socket disconnected:', reason);
    });

    newSocket.on('online_users_list', (userIds = []) => {
      setOnlineUsers(new Set(userIds));
    });

    newSocket.on('user_online', ({ userId }) => {
      setOnlineUsers((prev) => new Set([...prev, userId]));
    });

    newSocket.on('user_offline', ({ userId }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    // Real-time typing indicators
    newSocket.on('typing_start', ({ conversationId, user: typingUser }) => {
      setTypingUsers((prev) => {
        const current = prev[conversationId] || [];
        if (!current.some((u) => u._id === typingUser._id)) {
          return { ...prev, [conversationId]: [...current, typingUser] };
        }
        return prev;
      });
    });

    newSocket.on('typing_stop', ({ conversationId, userId }) => {
      setTypingUsers((prev) => {
        const current = prev[conversationId] || [];
        return {
          ...prev,
          [conversationId]: current.filter((u) => u._id !== userId)
        };
      });
    });

    // In-app alert sounds
    newSocket.on('new_message_notification', ({ message }) => {
      if (user?.settings?.notifications?.sound !== false) {
        sound.playMessageReceived();
      }
      // Browser notification if permitted
      if (window.Notification && Notification.permission === 'granted') {
        new Notification(`New message from ${message.sender?.name || 'NEXA'}`, {
          body: message.content || 'Sent an attachment',
          icon: '/favicon.ico'
        });
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [token, user?._id]);

  const joinConversation = React.useCallback((conversationId) => {
    if (socketRef.current && conversationId) {
      socketRef.current.emit('join_conversation', conversationId);
    }
  }, []);

  const leaveConversation = React.useCallback((conversationId) => {
    if (socketRef.current && conversationId) {
      socketRef.current.emit('leave_conversation', conversationId);
    }
  }, []);

  const startTyping = React.useCallback((conversationId) => {
    if (socketRef.current && conversationId) {
      socketRef.current.emit('typing_start', { conversationId });
    }
  }, []);

  const stopTyping = React.useCallback((conversationId) => {
    if (socketRef.current && conversationId) {
      socketRef.current.emit('typing_stop', { conversationId });
    }
  }, []);

  const contextValue = React.useMemo(() => ({
    socket,
    isConnected,
    onlineUsers,
    typingUsers,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping
  }), [
    socket,
    isConnected,
    onlineUsers,
    typingUsers,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping
  ]);

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
