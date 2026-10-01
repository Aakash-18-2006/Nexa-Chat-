import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { chatApi, tempRoomApi } from '../api/endpoints';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { sound } from '../utils/sound';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket, joinConversation, leaveConversation } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesPage, setMessagesPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);

  // Temporary Room State
  const [activeTempRoom, setActiveTempRoom] = useState(null);
  const [tempMessages, setTempMessages] = useState([]);

  // Right Drawer view state: null | 'info' | 'media' | 'pinned' | 'ai'
  const [rightPanelTab, setRightPanelTab] = useState(null);

  // Sound effects state
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('nexa_sound_enabled') !== 'false';
  });

  // Per-conversation / per-user chat background themes
  // Stored as: { [targetKey]: { light?: string, dark?: string } }
  const [chatThemes, setChatThemes] = useState(() => {
    try {
      const saved = localStorage.getItem('nexa_chat_themes');
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      const normalized = {};
      Object.entries(parsed).forEach(([key, val]) => {
        if (typeof val === 'string') {
          normalized[key] = { light: val, dark: val };
        } else if (val && typeof val === 'object') {
          normalized[key] = { ...val };
        }
      });
      return normalized;
    } catch {
      return {};
    }
  });

  const setChatTheme = useCallback((targetKey, modeOrThemeId, themeId) => {
    if (!targetKey) return;

    let mode = 'dark';
    let newThemeId = themeId;
    if (themeId === undefined) {
      newThemeId = modeOrThemeId;
      mode = 'dark';
    } else {
      mode = modeOrThemeId;
    }

    setChatThemes((prev) => {
      const next = { ...prev };
      const currentEntry =
        next[targetKey] && typeof next[targetKey] === 'object'
          ? { ...next[targetKey] }
          : {};

      if (!newThemeId || newThemeId === 'default') {
        delete currentEntry[mode];
      } else {
        currentEntry[mode] = newThemeId;
      }

      if (Object.keys(currentEntry).length === 0) {
        delete next[targetKey];
      } else {
        next[targetKey] = currentEntry;
      }

      try {
        localStorage.setItem('nexa_chat_themes', JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save chat theme:', e);
      }
      return next;
    });
  }, []);

  const getChatTheme = useCallback((targetKey, mode) => {
    if (!targetKey) return null;
    const entry = chatThemes[targetKey];
    if (!entry) return null;
    if (typeof entry === 'string') {
      return entry;
    }
    if (mode) {
      return entry[mode] || null;
    }
    return entry;
  }, [chatThemes]);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('nexa_sound_enabled', String(next));
      return next;
    });
  };

  // Load conversations - memoized on user?._id to prevent duplicate fetches
  const fetchConversations = useCallback(async () => {
    if (!user?._id) return;
    try {
      const res = await chatApi.getConversations();
      if (res.data.success) {
        setConversations(res.data.conversations);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, [user?._id]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load messages when activeConversation changes
  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      setMessagesPage(1);
      setHasMoreMessages(false);
      return;
    }

    const convId = activeConversation._id;
    let isCancelled = false;

    const loadMessages = async () => {
      setLoadingMessages(true);
      setMessagesPage(1);
      try {
        const res = await chatApi.getMessages(convId, 1, 40);
        if (!isCancelled && res.data.success) {
          setMessages(res.data.messages || []);
          setHasMoreMessages(Boolean(res.data.pagination?.hasMore));
        }

        // Non-blocking mark as read in background via socket or HTTP
        if (socket?.connected) {
          socket.emit('message_read', { conversationId: convId });
        } else {
          chatApi.markAsRead(convId).catch(() => {});
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to load messages:', err);
        }
      } finally {
        if (!isCancelled) {
          setLoadingMessages(false);
        }
      }
    };

    joinConversation(convId);
    loadMessages();

    return () => {
      isCancelled = true;
      leaveConversation(convId);
    };
  }, [activeConversation?._id]);

  // Load older messages (infinite scroll up)
  const loadOlderMessages = useCallback(async () => {
    if (!activeConversation || !hasMoreMessages || loadingOlder) return;

    try {
      setLoadingOlder(true);
      const nextPage = messagesPage + 1;
      const res = await chatApi.getMessages(activeConversation._id, nextPage, 40);
      if (res.data?.success) {
        const older = res.data.messages || [];
        setMessages((prev) => {
          // Avoid prepending duplicates
          const existingIds = new Set(prev.map((m) => m._id));
          const freshOlder = older.filter((m) => !existingIds.has(m._id));
          return [...freshOlder, ...prev];
        });
        setMessagesPage(nextPage);
        setHasMoreMessages(Boolean(res.data.pagination?.hasMore));
      }
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setLoadingOlder(false);
    }
  }, [activeConversation, hasMoreMessages, loadingOlder, messagesPage]);

  // Real-time socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Incoming new message
    const handleReceiveMessage = (message) => {
      if (activeConversation && message.conversation === activeConversation._id) {
        setMessages((prev) => {
          // If message is already present by ID, ignore
          if (prev.some((m) => m._id === message._id)) return prev;

          // Reconcile optimistic message sent by current user
          const optimisticIndex = prev.findIndex(
            (m) =>
              m.isOptimistic &&
              (m.sender?._id === message.sender?._id || m.sender === message.sender?._id) &&
              m.content === message.content
          );

          if (optimisticIndex !== -1) {
            const updated = [...prev];
            updated[optimisticIndex] = message;
            return updated;
          }

          return [...prev, message];
        });

        // Mark as read immediately if chat is open
        if (message.sender?._id !== user?._id && message.sender !== user?._id) {
          if (socket.connected) {
            socket.emit('message_read', { conversationId: activeConversation._id });
          } else {
            chatApi.markAsRead(activeConversation._id).catch(() => {});
          }
          if (soundEnabled) {
            sound.playMessageReceived();
          }
        }
      } else if (message.sender?._id !== user?._id && message.sender !== user?._id && soundEnabled) {
        sound.playMessageReceived();
      }

      // Update conversations list preview
      setConversations((prev) => {
        return prev
          .map((conv) => {
            if (conv._id === message.conversation) {
              return {
                ...conv,
                lastMessage: message,
                updatedAt: new Date().toISOString()
              };
            }
            return conv;
          })
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      });
    };

    // Reaction updated
    const handleReactionUpdated = ({ messageId, reactions, conversationId }) => {
      if (activeConversation && activeConversation._id === conversationId) {
        setMessages((prev) =>
          prev.map((m) => (m._id === messageId ? { ...m, reactions } : m))
        );
      }
    };

    // Message edited
    const handleMessageEdited = ({ message, conversationId }) => {
      if (activeConversation && activeConversation._id === conversationId) {
        setMessages((prev) =>
          prev.map((m) => (m._id === message._id ? message : m))
        );
      }
    };

    // Message deleted
    const handleMessageDeleted = ({ messageId, conversationId }) => {
      if (activeConversation && activeConversation._id === conversationId) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === messageId
              ? { ...m, isDeleted: true, content: 'This message was deleted', attachments: [] }
              : m
          )
        );
      }
    };

    // Read receipts
    const handleMessagesMarkedRead = ({ conversationId, userId, readAt }) => {
      if (activeConversation && activeConversation._id === conversationId) {
        setMessages((prev) =>
          prev.map((m) => {
            const alreadyRead = m.readBy?.some((r) => r.user === userId || r.user?._id === userId);
            if (!alreadyRead) {
              return {
                ...m,
                readBy: [...(m.readBy || []), { user: userId, readAt }]
              };
            }
            return m;
          })
        );
      }
    };

    // Temporary room messages
    const handleTempRoomMessage = (msg) => {
      setTempMessages((prev) => [...prev, msg]);
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_reaction_updated', handleReactionUpdated);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('messages_marked_read', handleMessagesMarkedRead);
    socket.on('temp_room_receive_message', handleTempRoomMessage);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_reaction_updated', handleReactionUpdated);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('messages_marked_read', handleMessagesMarkedRead);
      socket.off('temp_room_receive_message', handleTempRoomMessage);
    };
  }, [socket, activeConversation, user?._id]);

  // Send message helper with instant optimistic UI update
  const sendMessage = async ({ content, type = 'text', attachments = [] }) => {
    if (!activeConversation) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const currentReplyTo = replyingTo;

    // Optimistic local message representation
    const optimisticMessage = {
      _id: tempId,
      tempId,
      conversation: activeConversation._id,
      content: content || '',
      type,
      attachments,
      replyTo: currentReplyTo ? {
        _id: currentReplyTo._id,
        content: currentReplyTo.content,
        sender: currentReplyTo.sender
      } : null,
      sender: {
        _id: user?._id,
        name: user?.name || 'You',
        username: user?.username || 'you',
        avatar: user?.avatar || ''
      },
      createdAt: new Date().toISOString(),
      readBy: [{ user: user?._id, readAt: new Date() }],
      deliveredTo: [{ user: user?._id, deliveredAt: new Date() }],
      reactions: [],
      isOptimistic: true
    };

    // Immediately display the message in the UI (< 5ms)
    setMessages((prev) => [...prev, optimisticMessage]);

    if (soundEnabled) {
      sound.playMessageSent();
    }
    setReplyingTo(null);

    try {
      const payload = {
        conversationId: activeConversation._id,
        content,
        type,
        attachments,
        replyTo: currentReplyTo ? currentReplyTo._id : null
      };

      if (socket && socket.connected) {
        socket.emit('send_message', payload);
      } else {
        const res = await chatApi.sendMessage(payload);
        if (res.data?.success) {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m._id === tempId);
            if (idx !== -1) {
              const next = [...prev];
              next[idx] = res.data.message;
              return next;
            }
            return [...prev, res.data.message];
          });
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      // Remove or mark failed optimistic message
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
    }
  };

  // Select a conversation
  const selectConversation = (conv) => {
    setActiveTempRoom(null);
    setActiveConversation(conv);
    setReplyingTo(null);
    setEditingMessage(null);
  };

  // Open temporary room
  const openTempRoom = (room) => {
    setActiveConversation(null);
    setActiveTempRoom(room);
    setTempMessages(room.messages || []);
    if (socket) {
      socket.emit('temp_room_join', { code: room.code });
    }
  };

  // Leave temporary room
  const leaveTempRoom = () => {
    if (socket && activeTempRoom) {
      socket.emit('temp_room_leave', { code: activeTempRoom.code });
    }
    setActiveTempRoom(null);
    setTempMessages([]);
  };

  // Send temporary room message
  const sendTempMessage = async (content) => {
    if (!activeTempRoom || !content.trim()) return;
    try {
      if (socket && socket.connected) {
        socket.emit('temp_room_send_message', {
          code: activeTempRoom.code,
          content: content.trim()
        });
      } else {
        const res = await tempRoomApi.sendRoomMessage(activeTempRoom.code, { content });
        if (res.data.success) {
          setTempMessages((prev) => [...prev, res.data.message]);
        }
      }
      if (soundEnabled) {
        sound.playMessageSent();
      }
    } catch (err) {
      console.error('Failed to send temp message:', err);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        setConversations,
        activeConversation,
        setActiveConversation,
        selectConversation,
        messages,
        setMessages,
        loadingMessages,
        hasMoreMessages,
        loadingOlder,
        loadOlderMessages,
        sendMessage,
        replyingTo,
        setReplyingTo,
        editingMessage,
        setEditingMessage,
        rightPanelTab,
        setRightPanelTab,
        soundEnabled,
        toggleSound,
        fetchConversations,
        // Chat Themes per-conversation/user
        chatThemes,
        setChatTheme,
        getChatTheme,
        // Temp rooms
        activeTempRoom,
        tempMessages,
        openTempRoom,
        leaveTempRoom,
        sendTempMessage
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
