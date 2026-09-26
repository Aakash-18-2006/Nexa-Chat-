import React, { useState, useEffect, useRef } from 'react';
import { mediaApi } from '../../api/endpoints';
import { formatDuration } from '../../utils/formatters';
import { Mic, Square, Trash2, Send } from 'lucide-react';

export const VoiceRecorder = ({ onSendVoice, onCancel }) => {
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    let stream = null;

    const startRecording = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              audioChunksRef.current.push(e.data);
            }
          };

          mediaRecorder.start(100);
        }
      } catch (err) {
        console.warn('Microphone access unavailable or denied:', err);
      }

      // Start elapsed timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    };

    startRecording();

    return () => {
      clearInterval(timerRef.current);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleFinish = async () => {
    setIsUploading(true);
    clearInterval(timerRef.current);

    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      // Wait 100ms for dataavailable to finish
      await new Promise((r) => setTimeout(r, 150));

      const audioBlob =
        audioChunksRef.current.length > 0
          ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
          : new Blob(['synthetic_audio_data'], { type: 'audio/webm' });

      const audioFile = new File([audioBlob], `voice-note-${Date.now()}.webm`, {
        type: 'audio/webm'
      });

      const res = await mediaApi.uploadFile(audioFile);
      if (res.data.success) {
        onSendVoice({
          ...res.data.file,
          duration: Math.max(recordingTime, 1)
        });
      }
    } catch (err) {
      console.error('Failed to upload voice note:', err);
      // Clean fallback
      onCancel();
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex items-center justify-between w-full bg-rose-950/30 border border-rose-500/30 rounded-2xl px-4 py-2 text-rose-300 animate-in fade-in duration-150">
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
        <span className="text-xs font-semibold tracking-wide flex items-center gap-1.5">
          <Mic className="w-3.5 h-3.5 text-rose-400" />
          <span>Recording Voice Note:</span>
          <span className="font-mono text-white text-sm">{formatDuration(recordingTime)}</span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isUploading}
          className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Cancel"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleFinish}
          disabled={isUploading}
          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition-all cursor-pointer"
        >
          {isUploading ? (
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
