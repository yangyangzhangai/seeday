// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';

const OUTPUT_W  = 600;   // final output width px
const ASPECT_W  = 3;
const ASPECT_H  = 2;     // 3:2 landscape crop
const OUTPUT_H  = Math.round(OUTPUT_W * ASPECT_H / ASPECT_W); // 400

/** Return the width to use for the crop canvas: screen width minus side margins. */
function calcDisplayW(): number {
  return Math.min(320, window.innerWidth - 32);
}

/** Maximum pixel height the crop viewport may occupy (leaves room for header + hint). */
function calcMaxDisplayH(): number {
  // Reserve ~120px for header (56px) + hint (44px) + safe areas
  return Math.max(120, window.innerHeight * 0.55);
}

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
  const [displayW, setDisplayW] = useState(calcDisplayW);
  const [maxDisplayH, setMaxDisplayH] = useState(calcMaxDisplayH);
  const imgRef  = useRef<HTMLImageElement>(null);
  const dragRef = useRef({ active: false, startY: 0, startTop: 0 });

  // Recalculate dimensions on viewport resize (orientation change etc.)
  useEffect(() => {
    const onResize = () => {
      setDisplayW(calcDisplayW());
      setMaxDisplayH(calcMaxDisplayH());
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Derived display dimensions
  // Full image height if unconstrained
  const fullDisplayH = natural.w > 0 ? Math.round(displayW * natural.h / natural.w) : 0;
  // Crop box height (3:2 ratio)
  const boxH = Math.round(displayW * ASPECT_H / ASPECT_W);
  // The rendered image height is capped so the modal fits the viewport
  const displayH = Math.min(fullDisplayH, maxDisplayH);
  const maxTop   = Math.max(0, fullDisplayH - boxH);

  const handleLoad = () => {
    if (!imgRef.current) return;
    const { naturalWidth: w, naturalHeight: h } = imgRef.current;
    setNatural({ w, h });
    const dh = Math.round(displayW * h / w);
    const bh = Math.round(displayW * ASPECT_H / ASPECT_W);
    setCropTop(Math.max(0, Math.round((dh - bh) / 2))); // centre crop
  };

  const startDrag = useCallback((clientY: number) => {
    dragRef.current = { active: true, startY: clientY, startTop: cropTopPx };
  }, [cropTopPx]);

  const moveDrag = useCallback((clientY: number) => {
    if (!dragRef.current.active) return;
    const next = Math.max(0, Math.min(maxTop, dragRef.current.startTop + clientY - dragRef.current.startY));
    setCropTop(next);
  }, [maxTop]);

  const endDrag = useCallback(() => { dragRef.current.active = false; }, []);

  const confirm = useCallback(() => {
    if (!imgRef.current || !natural.w || !fullDisplayH) return;
    const canvas = document.createElement('canvas');
    canvas.width  = OUTPUT_W;
    canvas.height = OUTPUT_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Map crop position from full (uncapped) display coords to natural image coords
    const scaleY = natural.h / fullDisplayH;
    const srcY   = Math.round(cropTopPx * scaleY);
    const srcH   = Math.round(boxH * scaleY);
    ctx.drawImage(imgRef.current, 0, srcY, natural.w, srcH, 0, 0, OUTPUT_W, OUTPUT_H);
    canvas.toBlob(blob => { if (blob) onConfirm(blob); }, 'image/jpeg', 0.88);
  }, [natural, fullDisplayH, cropTopPx, boxH, onConfirm]);

  if (!imgSrc) return null;

  // The visible crop box may be partially scrolled behind the top of displayH
  // Clamp the rendered crop overlay to stay within the visible area
  const visibleCropTop = Math.max(0, Math.min(cropTopPx, displayH - boxH));

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end justify-center sm:items-center"
         style={{ zIndex: 320, paddingBottom: 'env(safe-area-inset-bottom,0px)' }}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden w-full"
           style={{ maxWidth: Math.min(displayW + 32, window.innerWidth) }}>
        {/* Header — always visible */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button onClick={onCancel} className="p-2 text-gray-400 hover:text-gray-600 touch-manipulation">
            <X size={20} />
          </button>
          <span className="text-sm font-medium text-gray-800">{t('image_crop_title')}</span>
          <button onClick={confirm} className="p-2 text-sky-500 hover:text-sky-700 font-semibold touch-manipulation">
            <Check size={20} />
          </button>
        </div>

        {/* Image + drag crop — height capped so buttons stay visible */}
        <div
          className="relative overflow-hidden bg-black cursor-ns-resize select-none mx-auto"
          style={{ width: displayW, height: displayH || boxH }}
          onMouseDown={e => startDrag(e.clientY)}
          onMouseMove={e => moveDrag(e.clientY)}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={e => startDrag(e.touches[0].clientY)}
          onTouchMove={e => { e.preventDefault(); moveDrag(e.touches[0].clientY); }}
          onTouchEnd={endDrag}
        >
          {/* Render full image but clip to displayH — user drags to scroll crop position */}
          <img
            ref={imgRef}
            src={imgSrc}
            alt=""
            draggable={false}
            onLoad={handleLoad}
            style={{
              width: displayW,
              height: fullDisplayH || 'auto',
              marginTop: -cropTopPx + visibleCropTop,  // offset so crop box stays centred
              display: 'block',
              pointerEvents: 'none',
            }}
          />
          {/* Above overlay */}
          {visibleCropTop > 0 && (
            <div className="absolute inset-x-0 top-0 bg-black/55" style={{ height: visibleCropTop }} />
          )}
          {/* Below overlay */}
          {visibleCropTop + boxH < displayH && (
            <div
              className="absolute inset-x-0 bg-black/55"
              style={{ top: visibleCropTop + boxH, bottom: 0 }}
            />
          )}
          {/* Crop border */}
          <div
            className="absolute inset-x-0 border-2 border-white/90 pointer-events-none"
            style={{ top: visibleCropTop, height: boxH }}
          />
          {/* Corner handles */}
          <div className="absolute pointer-events-none" style={{ top: visibleCropTop, left: 0 }}>
            <div className="w-4 h-4" style={{ borderTop: '3px solid white', borderLeft: '3px solid white' }} />
          </div>
          <div className="absolute pointer-events-none" style={{ top: visibleCropTop, right: 0 }}>
            <div className="w-4 h-4" style={{ borderTop: '3px solid white', borderRight: '3px solid white' }} />
          </div>
          <div className="absolute pointer-events-none" style={{ top: visibleCropTop + boxH - 16, left: 0 }}>
            <div className="w-4 h-4" style={{ borderBottom: '3px solid white', borderLeft: '3px solid white' }} />
          </div>
          <div className="absolute pointer-events-none" style={{ top: visibleCropTop + boxH - 16, right: 0 }}>
            <div className="w-4 h-4" style={{ borderBottom: '3px solid white', borderRight: '3px solid white' }} />
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 py-3">{t('image_crop_hint')}</p>
      </div>
    </div>
  );
};
