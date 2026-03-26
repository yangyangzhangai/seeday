import React, { useRef } from 'react';
import { X, Download, PenLine } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useTranslation } from 'react-i18next';

interface PlantCardModalProps {
  onClose: () => void;
  onGenerateDiary: () => void;
}

export const PlantCardModal: React.FC<PlantCardModalProps> = ({ onClose, onGenerateDiary }) => {
  const { t } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);

  const saveCard = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
      });
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `plant-diary-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = url;
      link.click();
    } catch (err) {
      console.error('Failed to save card', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in transition-all">
      <div className="flex flex-col items-center w-full max-w-sm gap-5">
        {/* Card */}
        <div
          ref={cardRef}
          className="relative w-full aspect-[3/4] rounded-2xl p-6 flex flex-col items-center justify-center shadow-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, #fdfbf7 0%, #f4eee1 100%)',
            border: '1px solid rgba(139, 115, 85, 0.1)',
          }}
        >
          {/* Decorative Corner Elements */}
          <div className="absolute top-4 left-4 w-8 h-8 opacity-20" style={{ borderTop: '2px solid #6b5a3e', borderLeft: '2px solid #6b5a3e' }} />
          <div className="absolute top-4 right-4 w-8 h-8 opacity-20" style={{ borderTop: '2px solid #6b5a3e', borderRight: '2px solid #6b5a3e' }} />
          <div className="absolute bottom-4 left-4 w-8 h-8 opacity-20" style={{ borderBottom: '2px solid #6b5a3e', borderLeft: '2px solid #6b5a3e' }} />
          <div className="absolute bottom-4 right-4 w-8 h-8 opacity-20" style={{ borderBottom: '2px solid #6b5a3e', borderRight: '2px solid #6b5a3e' }} />

          {/* Plant Image */}
          <div className="flex-1 flex items-center justify-center w-full">
            <img 
              src="/assets/plants/fib_late_001.png" 
              alt="Plant" 
              className="max-w-[70%] max-h-full object-contain filter drop-shadow-lg"
              style={{ paddingBottom: '20px' }}
            />
          </div>

          {/* Poem/Text */}
          <div 
            className="text-center pb-8 px-2"
            style={{ 
              fontFamily: '"LXGW WenKai", cursive',
              color: '#5c4b37',
              fontSize: '1.125rem',
              lineHeight: '1.8',
              letterSpacing: '0.05em'
            }}
          >
            静看一株嫩绿拔节，<br/>
            宛如时光酿就的秘密。
          </div>
          
          {/* Small stamp or date */}
          <div className="absolute bottom-6 right-6 opacity-40 text-xs" style={{ fontFamily: '"LXGW WenKai", cursive', color: '#5c4b37' }}>
            {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-3 px-2">
          <button
            onClick={() => {
              onClose();
              onGenerateDiary();
            }}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-xl text-white font-medium text-[15px] shadow-lg active:scale-95 transition-all"
            style={{ background: 'linear-gradient(to right, #728a5c, #5e734b)' }}
          >
            <PenLine size={18} />
            生成日记
          </button>
          
          <button
            onClick={saveCard}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-xl font-medium text-[15px] active:scale-95 transition-all bg-white shadow"
            style={{ color: '#5e734b', border: '1px solid rgba(94, 115, 75, 0.2)' }}
          >
            <Download size={18} />
            保存卡片
          </button>
        </div>
      </div>

      <button
        onClick={onClose}
        className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-md hover:bg-black/40 transition-colors"
      >
        <X size={20} />
      </button>
    </div>
  );
};
