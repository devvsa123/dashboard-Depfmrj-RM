import { useState } from 'react';
import { Info } from 'lucide-react';

// --- COMPONENTE DE EXPLICAÇÃO (TOOLTIP) ---
const InfoButton = ({ title, description }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative inline-block ml-1">
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-300 hover:text-indigo-500"
      >
        <Info size={14} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-4 bg-slate-800 text-white text-xs rounded-2xl shadow-2xl z-[70] animate-in fade-in zoom-in duration-200">
            <p className="font-black uppercase tracking-widest mb-2 text-indigo-300 border-b border-slate-700 pb-1">{title}</p>
            <p className="font-medium leading-relaxed">{description}</p>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800" />
          </div>
        </>
      )}
    </div>
  );
};

export default InfoButton;
