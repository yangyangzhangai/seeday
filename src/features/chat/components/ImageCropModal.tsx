// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';

const DISPLAY_W = 320;   // modal image display width px
const OUTPUT_W  = 600;   // final output width px
const ASPECT_W  = 3;
const ASPECT_H  = 2;     // 3:2 landscape crop
const OUTPUT_H  = Math.round(OUTPUT_W * ASPECT_H / ASPECT_W); // 400

interface Props {
  file: File;
  onConfirm: (blob: Blob) => void;
  onCancel:  () => void;
}

export const ImageCropModal: React.FC<Props> = ({ file, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  const [imgSrc, setImgSrc]     = useState('');
  const [natural, setNatural]   = useState({ w: 0, h: 0 });
  const [cropTopPx, setCropTop] = useState(0);
  const imgRef  = useRef<HTMLImageElement>(null);
  const dragRef = useRef({ active: false, startY: 0, startTop: 0 });

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Derived display dimensions
  const displayH = natural.w > 0 ? Math.round(DISPLAY_W * natural.h / natural.w) : 0;
  const boxH     = Math.round(DISPLAY_W * ASPECT_H / ASPECT_W); // 213 px for 320 wide
  const maxTop   = Math.max(0, displayH - boxH);

  const handleLoad = () => {
    if (!imgRef.current) return;
    const { naturalWidth: w, naturalHeight: h } = imgRef.current;
    setNatural({ w, h });
    const dh = Math.round(DISPLAY_W * h / w);
    const bh = Math.round(DISPLAY_W * ASPECT_H / ASPECT_W);
    setCropTop(Math.max(0, Math.round((dh - bh) / 2))); // centre
  };

  const startDrag = useCallback((clientY: number) => {
    dragRef.current = { active: true, startY: clientY, startTop: cropTopPx };
  }, [cropTopPx]);

  const moveDrag = useCallback((clientY: number) => {
    if (!dragRef.current.active) return;
    const delta = clientY - dragRef.current.startY;
    setCropTop(prev => Math.max(0, Math.min(maxTop, prev + delta - (prev - dragRef.current.startTop))));
    // simpler: recompute from startTop each move
    const next = Math.max(0, Math.min(maxTop, dragRef.current.startTop + clientY - dragRef.current.startY));
    setCropTop(next);
  }, [maxTop]);

  const endDrag = useCallback(() => { dragRef.current.active = false; }, []);

  const confirm = useCallback(() => {
    if (!imgRef.current || !natural.w || !displayH) return;
    const canvas = document.createElement('canvas');
    canvas.width  = OUTPUT_W;
    canvas.height = OUTPUT_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scaleY = natural.h / displayH;
    const srcY   = Math.round(cropTopPx * scaleY);
    const srcH   = Math.round(boxH * scaleY);
    ctx.drawImage(imgRef.current, 0, srcY, natural.w, srcH, 0, 0, OUTPUT_W, OUTPUT_H);
    canvas.toBlob(blob => { if (blob) onConfirm(blob); }, 'image/jpeg', 0.88);
  }, [natural, displayH, cropTopPx, boxH, onConfirm]);

  if (!imgSrc) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center sm:items-center">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
          <span className="text-sm font-medium text-gray-800">{t('image_crop_title')}</span>
          <button onClick={confirm} className="p-1 text-sky-500 hover:text-sky-700">
            <Check size={18} />
          </button>
        </div>

        {/* Image + drag crop */}
        <div
          className="relative overflow-hidden bg-black cursor-ns-resize select-none mx-auto"
          style={{ width: DISPLAY_W, height: displayH || boxH }}
          onMouseDown={e => startDrag(e.clientY)}
          onMouseMove={e => moveDrag(e.clientY)}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={e => startDrag(e.touches[0].clientY)}
          onTouchMove={e => { e.preventDefault(); moveDrag(e.touches[0].clientY); }}
          onTouchEnd={endDrag}
        >
          <img
            ref={imgRef}
            src={imgSrc}
            alt=""
            draggable={false}
            onLoad={handleLoad}
            style={{ width: DISPLAY_W, height: displayH || 'auto', display: 'block', pointerEvents: 'none' }}
          />
          {/* Above overlay */}
          {cropTopPx > 0 && (
            <div className="absolute inset-x-0 top-0 bg-black/55" style={{ height: cropTopPx }} />
          )}
          {/* Below overlay */}
          {cropTopPx + boxH < displayH && (
            <div
              className="absolute inset-x-0 bg-black/55"
              style={{ top: cropTopPx + boxH, height: displayH - cropTopPx - boxH }}
            />
          )}
          {/* Crop border */}
          <div
            className="absolute inset-x-0 border-2 border-white/90 pointer-events-none"
            style={{ top: cropTopPx, height: boxH }}
          />
          {/* Corner handles */}
          <div className="absolute pointer-events-none" style={{ top: cropTopPx, left: 0 }}>
            <div className="w-4 h-4" style={{ borderTop: '3px solid white', borderLeft: '3px solid white' }} />
          </div>
          <div className="absolute pointer-events-none" style={{ top: cropTopPx, right: 0 }}>
            <div className="w-4 h-4" style={{ borderTop: '3px solid white', borderRight: '3px solid white' }} />
          </div>
          <div className="absolute pointer-events-none" style={{ top: cropTopPx + boxH - 16, left: 0 }}>
            <div className="w-4 h-4" style={{ borderBottom: '3px solid white', borderLeft: '3px solid white' }} />
          </div>
          <div className="absolute pointer-events-none" style={{ top: cropTopPx + boxH - 16, right: 0 }}>
            <div className="w-4 h-4" style={{ borderBottom: '3px solid white', borderRight: '3px solid white' }} />
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 py-3">{t('image_crop_hint')}</p>
      </div>
    </div>
  );
};
