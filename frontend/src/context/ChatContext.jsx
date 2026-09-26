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

  // Load conversations
  const fetchConversations = useCallback(async () => {
    if (!user) return;
    try {
      const res = await chatApi.getConversations();
      if (res.data.success) {
        setConversations(res.data.conversations);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load messages when activeConversation changes
  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const res = await chatApi.getMessages(activeConversation._id);
        if (res.data.success) {
          setMessages(res.data.messages);
        }
        // Mark as read
        await chatApi.markAsRead(activeConversation._id);
        socket?.emit('message_read', { conversationId: activeConversation._id });
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    };

    joinConversation(activeConversation._id);
    loadMessages();

    return () => {
      leaveConversation(activeConversation._id);
    };
  }, [activeConversation?._id, socket]);

  // Real-time socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Incoming new message
    const handleReceiveMessage = (message) => {
      if (activeConversation && message.conversation === activeConversation._id) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });

        // Mark as read immediately if chat is open
        if (message.sender._id !== user._id) {
          chatApi.markAsRead(activeConversation._id);
          socket.emit('message_read', { conversationId: activeConversation._id });
          if (soundEnabled) {
            sound.playMessageReceived();
          }
        }
      } else if (message.sender._id !== user._id && soundEnabled) {
        sound.playMessageReceived();
      }

      // Update conversations list preview
      setConversations((prev) => {
        return prev.map((conv) => {
          if (conv._id === message.conversation) {
            return {
              ...conv,
              lastMessage: message,
              updatedAt: new Date().toISOString()
            };
          }
          return conv;
        }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
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

  // Send message helper
  const sendMessage = async ({ content, type = 'text', attachments = [] }) => {
    if (!activeConversation) return;

    try {
      const payload = {
        conversationId: activeConversation._id,
        content,
        type,
        attachments,
        replyTo: replyingTo ? replyingTo._id : null
      };

      if (socket && socket.connected) {
        socket.emit('send_message', payload);
      } else {
        const res = await chatApi.sendMessage(payload);
        if (res.data.success) {
          setMessages((prev) => [...prev, res.data.message]);
        }
      }

      if (soundEnabled) {
        sound.playMessageSent();
      }
      setReplyingTo(null);
    } catch (err) {
      console.error('Failed to send message:', err);
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
