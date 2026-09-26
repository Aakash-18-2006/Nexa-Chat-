import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { NexaSearchBar } from '../ui/NexaSearchBar';
import { userApi, groupApi } from '../../api/endpoints';
import { useChat } from '../../context/ChatContext';
import { Search, Users, Check } from 'lucide-react';

export const CreateGroupModal = ({ isOpen, onClose }) => {
  const { selectConversation, fetchConversations } = useChat();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]); // [userObj]
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await userApi.searchUsers(query);
        if (res.data.success) {
          setSearchResults(res.data.users);
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const toggleSelectUser = (user) => {
    setSelectedUsers((prev) => {
      const exists = prev.some((u) => u._id === user._id);
      if (exists) {
        return prev.filter((u) => u._id !== user._id);
      } else {
        return [...prev, user];
      }
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await groupApi.createGroup({
        name: name.trim(),
        description: description.trim(),
        memberIds: selectedUsers.map((u) => u._id)
      });

      if (res.data.success) {
        await fetchConversations();
        selectConversation(res.data.group);
        onClose();
        setName('');
        setDescription('');
        setSelectedUsers([]);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Group Conversation">
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Group Name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Design Systems & Engineering"
            className="w-full bg-[#050505] border border-[#ff1744]/25 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_12px_rgba(255,23,68,0.25)] transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">Description (Optional)</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief topic or team focus..."
            className="w-full bg-[#050505] border border-[#ff1744]/25 rounded-xl px-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_12px_rgba(255,23,68,0.25)] transition-all resize-none"
          />
        </div>

        {/* Selected Members Badges */}
        {selectedUsers.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Selected Members ({selectedUsers.length})
            </label>
            <div className="flex flex-wrap gap-1.5">
              {selectedUsers.map((u) => (
                <span
                  key={u._id}
                  onClick={() => toggleSelectUser(u)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#ff1744]/15 border border-[#ff1744]/30 text-[#ff1744] text-xs cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/30 hover:text-rose-300 transition-colors"
                  title="Click to remove"
                >
                  <span>{u.name}</span>
                  <span>✕</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Member Search */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Add Members</label>
          <div className="mb-2">
            <NexaSearchBar
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery('')}
              placeholder="Search contacts to add..."
              showFilter={false}
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {loading ? (
              <div className="py-6 text-center text-xs text-slate-500">Searching...</div>
            ) : searchResults.length > 0 ? (
              Array.from(new Map(searchResults.map((u) => [u._id, u])).values()).map((u) => {
                const isSelected = selectedUsers.some((sel) => sel._id === u._id);
                return (
                  <div
                    key={u._id}
                    onClick={() => toggleSelectUser(u)}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#ff1744]/15 border border-[#ff1744]/40 text-white shadow-[0_0_10px_rgba(255,23,68,0.15)]'
                        : 'hover:bg-white/5 text-slate-300 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Avatar src={u.avatar} name={u.name} size="sm" isOnline={u.isOnline} />
                      <div className="truncate">
                        <p className="font-semibold text-white truncate">{u.name}</p>
                        <p className="text-[11px] text-[#ff1744] truncate">@{u.username}</p>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-gradient-to-r from-[#ff1744] to-[#991b1b] border-[#ff1744] text-white shadow-[0_0_8px_rgba(255,23,68,0.5)]'
                          : 'border-white/20'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                  </div>
                );
              })
            ) : query.trim() ? (
              <div className="py-6 text-center text-xs text-slate-500">No users found</div>
            ) : null}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="w-full mt-2 py-3 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-[0_0_15px_rgba(255,23,68,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Users className="w-4 h-4" />
              <span>Create Group</span>
            </>
          )}
        </button>
      </form>
    </Modal>
  );
};
