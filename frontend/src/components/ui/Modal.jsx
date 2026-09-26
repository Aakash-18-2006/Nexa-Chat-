import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="nexa-modal-backdrop fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className={`nexa-modal relative w-full ${maxWidth} bg-[#0a0a0f]/95 text-slate-100 rounded-2xl border border-[#ff1744]/25 shadow-[0_0_35px_rgba(255,23,68,0.1),0_0_55px_rgba(153,27,27,0.06)] backdrop-blur-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150`}
      >
        <div className="nexa-modal-header flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <h3 className="nexa-modal-title text-lg font-bold tracking-tight text-white">{title}</h3>
          <button
            onClick={onClose}
            className="nexa-modal-close p-1.5 rounded-lg text-slate-400 hover:text-[#ff1744] hover:bg-[#ff1744]/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="nexa-modal-body p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
