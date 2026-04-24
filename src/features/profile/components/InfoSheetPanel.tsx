// DOC-DEPS: LLM.md -> src/features/profile/README.md
import React from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const InfoSheetPanel: React.FC<Props> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex flex-col bg-[#F7F9F8]">
    <div className="flex items-center justify-between border-b border-slate-200/60 bg-[#F7F9F8]/95 px-4 py-3 backdrop-blur-sm">
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      <button
        onClick={onClose}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
      >
        <X size={16} strokeWidth={2.5} />
      </button>
    </div>
    <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
  </div>
);
