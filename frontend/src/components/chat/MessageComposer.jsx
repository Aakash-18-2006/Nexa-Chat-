import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';
import { mediaApi, chatApi } from '../../api/endpoints';
import { EmojiPicker } from './EmojiPicker';
import { VoiceRecorder } from './VoiceRecorder';
import {
  Smile,
  Paperclip,
  Mic,
  Send,
  X,
  Image,
  FileText,
  Edit2
} from 'lucide-react';

export const MessageComposer = () => {
  const {
    activeConversation,
    sendMessage,
    replyingTo,
    setReplyingTo,
    editingMessage,
    setEditingMessage,
    messages,
    setMessages
  } = useChat();

  const { startTyping, stopTyping } = useSocket();

  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Sync editing text
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content || '');
      textareaRef.current?.focus();
    }
  }, [editingMessage]);

  // Listen for text insertion events (e.g. from Translator "Use in Chat")
  useEffect(() => {
    const handleInsert = (e) => {
      if (e.detail?.text) {
        setText((prev) => (prev ? `${prev} ${e.detail.text}` : e.detail.text));
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.selectionStart = textareaRef.current.value.length;
            textareaRef.current.selectionEnd = textareaRef.current.value.length;
          }
        }, 50);
      }
    };
    window.addEventListener('nexa:insert-chat-input', handleInsert);
    return () => window.removeEventListener('nexa:insert-chat-input', handleInsert);
  }, []);

  // Handle typing indicator
  const handleInputChange = (e) => {
    setText(e.target.value);

    if (activeConversation) {
      startTyping(activeConversation._id);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(activeConversation._id);
      }, 2000);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (editingMessage) {
      // Edit message
      try {
        const res = await chatApi.editMessage(editingMessage._id, trimmed);
        if (res.data.success) {
          setMessages((prev) =>
            prev.map((m) => (m._id === editingMessage._id ? res.data.message : m))
          );
        }
      } catch (err) {
        console.error('Failed to edit message:', err);
      }
      setEditingMessage(null);
      setText('');
      return;
    }

    if (activeConversation) {
      stopTyping(activeConversation._id);
    }

    sendMessage({ content: trimmed, type: 'text' });
    setText('');
    setShowEmoji(false);
  };

  // Attachments
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowAttachmentMenu(false);
    setUploadProgress(0);

    console.log('[Upload] started');
    console.log('[Upload] file selected');
    console.log('[Upload] filename:', file.name);
    console.log('[Upload] size:', file.size);
    console.log('[Upload] MIME type:', file.type || 'application/octet-stream');
    console.log('[Upload] endpoint: /api/media/upload');

    try {
      const res = await mediaApi.uploadFile(file, (percent) => {
        setUploadProgress(percent);
      });

      console.log('[Upload] response status:', res.status);
      console.log('[Upload] response received');

      if (res.data?.success) {
        const uploaded = res.data.file;
        const isImage = file.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
        const msgType = isImage ? 'image' : 'file';

        sendMessage({
          content: '',
          type: msgType,
          attachments: [uploaded]
        });
      }
    } catch (err) {
      console.error('[Upload] failed:', err?.message || err);
      alert('Upload failed: ' + (err.response?.data?.message || err.message || 'Network error'));
    } finally {
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Voice note complete
  const handleSendVoice = (voiceFile) => {
    setIsRecordingVoice(false);
    sendMessage({
      content: '',
      type: 'audio',
      attachments: [voiceFile]
    });
  };

  return (
    <div className="nexa-chat-composer relative border-t border-white/10 bg-[#0f121a] p-2.5 sm:p-4 pb-[max(0.625rem,env(safe-area-inset-bottom))] z-20">
      {/* Upload Progress Bar */}
      {uploadProgress !== null && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] transition-all duration-200"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {/* Reply Banner */}
      {replyingTo && (
        <div className="nexa-composer-banner flex items-center justify-between mb-2 px-3 py-1.5 rounded-xl bg-[#0a0a0f] border border-[#ff1744]/25 shadow-[0_0_12px_rgba(255,23,68,0.1)] text-xs text-slate-200 animate-in fade-in duration-100">
          <div className="truncate">
            <span className="font-semibold text-[#ff1744]">Replying to {replyingTo.sender?.name}:</span>{' '}
            <span className="opacity-80 truncate">{replyingTo.content || '[Attachment]'}</span>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Edit Banner */}
      {editingMessage && (
        <div className="nexa-composer-banner flex items-center justify-between mb-2 px-3 py-1.5 rounded-xl bg-[#0a0a0f] border border-[#ff1744]/30 shadow-[0_0_12px_rgba(255,23,68,0.12)] text-xs text-[#ff1744] animate-in fade-in duration-100">
          <div className="flex items-center gap-1.5 truncate">
            <Edit2 className="w-3.5 h-3.5 text-[#ff1744]" />
            <span className="font-semibold">Editing message</span>
          </div>
          <button
            onClick={() => {
              setEditingMessage(null);
              setText('');
            }}
            className="p-1 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Voice Recorder Mode */}
      {isRecordingVoice ? (
        <VoiceRecorder
          onSendVoice={handleSendVoice}
          onCancel={() => setIsRecordingVoice(false)}
        />
      ) : (
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Emoji Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmoji((prev) => !prev)}
              className={`p-2 sm:p-2.5 rounded-xl transition-colors cursor-pointer ${
                showEmoji ? 'text-[#ff1744] bg-[#ff1744]/15' : 'text-slate-400 hover:text-[#ff1744] hover:bg-white/5'
              }`}
              title="Add Emoji"
            >
              <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {showEmoji && (
              <EmojiPicker
                onSelectEmoji={(emoji) => setText((prev) => prev + emoji)}
                onClose={() => setShowEmoji(false)}
              />
            )}
          </div>

          {/* Attachment Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAttachmentMenu((prev) => !prev)}
              className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-[#ff1744] hover:bg-white/5 transition-colors cursor-pointer"
              title="Add Attachment"
            >
              <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {showAttachmentMenu && (
              <div className="nexa-composer-menu absolute bottom-14 left-0 w-44 bg-[#0a0a0f]/95 border border-[#ff1744]/30 rounded-2xl p-2 shadow-[0_0_25px_rgba(255,23,68,0.15)] z-30 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.setAttribute('accept', 'image/*');
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-white/5 hover:text-[#ff1744] transition-colors cursor-pointer"
                >
                  <Image className="w-4 h-4 text-[#ff1744]" />
                  <span>Upload Image</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.removeAttribute('accept');
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-white/5 hover:text-[#ff1744] transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-[#ff1744]" />
                  <span>Upload File</span>
                </button>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Text Area */}
          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Write a message..."
              title="Press Enter to send, Shift+Enter for new line"
              className="nexa-composer-textarea w-full bg-[#0d0d14] border border-black dark:border-white/10 rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_15px_rgba(255,23,68,0.25)] resize-none max-h-32 transition-all leading-relaxed"
            />
          </div>

          {/* Voice Record Button (when no text) or Send Button */}
          {text.trim() || editingMessage ? (
            <button
              type="button"
              onClick={handleSend}
              className="p-2 sm:p-2.5 rounded-2xl bg-gradient-to-tr from-[#991b1b] via-[#d3121f] to-[#ff1744] hover:brightness-110 text-white font-bold shadow-[0_0_15px_rgba(255,23,68,0.4)] hover:shadow-[0_0_25px_rgba(255,23,68,0.6)] hover:scale-105 active:scale-95 transition-all cursor-pointer flex-shrink-0"
              title="Send Message"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsRecordingVoice(true)}
              className="p-2 sm:p-2.5 rounded-2xl bg-white/5 hover:bg-[#ff1744]/10 text-slate-300 hover:text-[#ff1744] border border-white/10 hover:border-[#ff1744]/30 transition-all cursor-pointer flex-shrink-0 hover:shadow-[0_0_10px_rgba(255,23,68,0.2)]"
              title="Record Voice Note"
            >
              <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
