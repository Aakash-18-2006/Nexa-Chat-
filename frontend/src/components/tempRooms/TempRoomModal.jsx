import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { tempRoomApi } from '../../api/endpoints';
import { useChat } from '../../context/ChatContext';
import { Clock, KeyRound, Sparkles, Copy, Check, ArrowRight } from 'lucide-react';

export const TempRoomModal = ({ isOpen, onClose }) => {
  const { openTempRoom } = useChat();

  const [mode, setMode] = useState('create'); // 'create' | 'join'
  const [name, setName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [joinCode, setJoinCode] = useState('');
  const [createdRoom, setCreatedRoom] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await tempRoomApi.createRoom({
        name: name.trim() || 'Ephemeral Sync',
        durationMinutes: parseInt(durationMinutes)
      });

      if (res.data.success) {
        setCreatedRoom(res.data.room);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await tempRoomApi.joinRoom(joinCode.trim().toUpperCase());
      if (res.data.success) {
        openTempRoom(res.data.room);
        onClose();
        setJoinCode('');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired room code');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (createdRoom) {
      navigator.clipboard.writeText(createdRoom.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const enterCreatedRoom = () => {
    if (createdRoom) {
      openTempRoom(createdRoom);
      onClose();
      setCreatedRoom(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Temporary Chat Rooms">
      {/* Mode Switcher */}
      {!createdRoom && (
        <div className="flex bg-[#050505] p-1 rounded-xl mb-4 border border-[#ff1744]/20">
          <button
            type="button"
            onClick={() => {
              setMode('create');
              setError('');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'create'
                ? 'bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white shadow-[0_0_12px_rgba(255,23,68,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Room
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('join');
              setError('');
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'join'
                ? 'bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white shadow-[0_0_12px_rgba(255,23,68,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Join with Code
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
          {error}
        </div>
      )}

      {/* Success Room Created View */}
      {createdRoom ? (
        <div className="text-center py-4 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#ff1744] via-[#d3121f] to-[#991b1b] text-white flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(255,23,68,0.3)]">
            <Sparkles className="w-6 h-6" />
          </div>

          <div>
            <h4 className="text-base font-bold text-white">Temporary Room Ready!</h4>
            <p className="text-xs text-slate-400 mt-1">
              Share this 6-character code with anyone you want to chat with:
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-[#050505] border border-[#ff1744]/30 shadow-[0_0_20px_rgba(255,23,68,0.15)] max-w-xs mx-auto">
            <span className="font-mono text-2xl font-black tracking-widest text-[#ff1744]">
              {createdRoom.code}
            </span>
            <button
              onClick={copyCode}
              className="p-2 rounded-xl bg-white/5 hover:bg-[#ff1744]/20 text-white transition-colors cursor-pointer"
              title="Copy Code"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-white" />}
            </button>
          </div>

          <p className="text-[11px] text-slate-500">
            Expires in {durationMinutes} minutes &bull; Automatic cleanup
          </p>

          <button
            onClick={enterCreatedRoom}
            className="w-full py-3 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 text-white font-bold text-sm rounded-xl shadow-[0_0_15px_rgba(255,23,68,0.3)] flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <span>Enter Room</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : mode === 'create' ? (
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Room Title</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Quick Brainstorm Session"
              className="w-full bg-[#050505] border border-[#ff1744]/25 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_12px_rgba(255,23,68,0.25)] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Expiration Time</label>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full bg-[#050505] border border-[#ff1744]/25 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#ff1744] cursor-pointer"
            >
              <option value={15}>15 Minutes</option>
              <option value={60}>1 Hour</option>
              <option value={360}>6 Hours</option>
              <option value={1440}>24 Hours</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-[0_0_15px_rgba(255,23,68,0.3)] flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Clock className="w-4 h-4" />
                <span>Generate Room Code</span>
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Room Code</label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="text"
                autoFocus
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. X7K92P"
                className="w-full uppercase font-mono tracking-widest bg-[#050505] border border-[#ff1744]/25 rounded-xl pl-10 pr-4 py-2.5 text-base text-white placeholder:text-slate-500 focus:outline-none focus:border-[#ff1744] focus:shadow-[0_0_12px_rgba(255,23,68,0.25)] transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !joinCode.trim()}
            className="w-full mt-2 py-3 bg-gradient-to-r from-[#ff1744] via-[#d3121f] to-[#991b1b] hover:brightness-110 active:scale-95 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-[0_0_15px_rgba(255,23,68,0.3)] flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                <span>Join Temporary Room</span>
              </>
            )}
          </button>
        </form>
      )}
    </Modal>
  );
};
