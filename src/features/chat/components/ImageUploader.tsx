// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React, { useRef, useState, useEffect, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, X, Loader2, AlertCircle, ZoomIn } from 'lucide-react';
import { useImageUpload } from '../../../hooks/useImageUpload';
import { ImageCropModal } from './ImageCropModal';

export interface ImageUploaderProps {
  messageId: string;
  imageUrl?: string | null;
  onUploaded: (url: string) => void;
  onRemoved:  () => void;
  compact?: boolean;
  hideUploadWhen?: boolean;
  hideUploadButton?: boolean;
  openSignal?: number;
  readonly?: boolean;
}

export interface ImageUploaderHandle {
  openFilePicker: () => void;
}

export const ImageUploader = React.forwardRef<ImageUploaderHandle, ImageUploaderProps>(({
  messageId, imageUrl, onUploaded, onRemoved, compact, hideUploadWhen, hideUploadButton, openSignal, readonly,
}, ref) => {
  const { t } = useTranslation();
  const { upload, remove, uploading } = useImageUpload();
  const inputRef  = useRef<HTMLInputElement>(null);
  const imageRef  = useRef<HTMLDivElement>(null);
  const [error, setError]             = useState(false);
  const [cropFile, setCropFile]       = useState<File | null>(null);
  const [imageTapped, setImageTapped] = useState(false);
  const [lightbox, setLightbox]       = useState(false);

  // Dismiss image overlay on tap outside
  useEffect(() => {
    if (!imageTapped) return;
    const handler = (e: MouseEvent) => {
      if (imageRef.current && !imageRef.current.contains(e.target as Node)) {
        setImageTapped(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [imageTapped]);

  const openFilePicker = () => {
    if (readonly || imageUrl || uploading) return;
    inputRef.current?.click();
  };

  useImperativeHandle(ref, () => ({ openFilePicker }), [readonly, imageUrl, uploading]);

  useEffect(() => {
    if (!openSignal) return;
    openFilePicker();
  }, [openSignal, imageUrl, uploading, readonly]);

  const handleCropConfirm = async (blob: Blob) => {
    setCropFile(null);
    setError(false);
    try {
      const url = await upload(blob, messageId);
      onUploaded(url);
    } catch {
      setError(true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setCropFile(file);
  };

  const handleRemove = async () => {
    setImageTapped(false);
    await remove(messageId, imageUrl ?? undefined);
    onRemoved();
  };

  // Hidden file input is always rendered
  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={handleFileChange}
    />
  );

  // ── Image uploaded: thumbnail + overlay ──────────────────────
  if (imageUrl) {
    return (
      <>
        {fileInput}

        {/* Thumbnail */}
        <div
          ref={imageRef}
          className="relative rounded-lg overflow-hidden cursor-pointer"
          onClick={() => setImageTapped(v => !v)}
        >
          <img
            src={imageUrl}
            alt=""
            className={compact ? 'w-full h-20 object-cover' : 'w-full max-h-48 object-cover'}
          />

          {/* Tap-to-show overlay buttons */}
          {imageTapped && (
            <div className="absolute inset-0 bg-black/20 flex items-start justify-end p-1.5 gap-1.5">
              <button
                onClick={e => { e.stopPropagation(); setImageTapped(false); setLightbox(true); }}
                className="p-1.5 bg-black/50 rounded-full text-white"
              >
                <ZoomIn size={13} />
              </button>
              {!readonly && (
                <button
                  onClick={e => { e.stopPropagation(); void handleRemove(); }}
                  className="p-1.5 bg-black/50 rounded-full text-white"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Lightbox: full-screen image view */}
        {lightbox && (
          <div
            className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50"
            style={{ paddingTop: 'env(safe-area-inset-top,0px)', paddingBottom: 'env(safe-area-inset-bottom,0px)', paddingLeft: 'env(safe-area-inset-left,0px)', paddingRight: 'env(safe-area-inset-right,0px)' }}
            onClick={() => setLightbox(false)}
          >
            <img
              src={imageUrl}
              alt=""
              className="max-w-full max-h-[75vh] object-contain rounded-lg"
              onClick={e => e.stopPropagation()}
            />
            <button
              onClick={() => setLightbox(false)}
              className="mt-5 flex items-center justify-center w-10 h-10 bg-white/15 hover:bg-white/25 rounded-full text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Crop modal — only for new uploads */}
        {cropFile && (
          <ImageCropModal
            file={cropFile}
            onConfirm={handleCropConfirm}
            onCancel={() => setCropFile(null)}
          />
        )}
      </>
    );
  }

  if (hideUploadWhen || hideUploadButton) return (
    <>
      {fileInput}
      {cropFile && (
        <ImageCropModal
          file={cropFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      )}
    </>
  );

  return (
    <>
      {fileInput}

      <div className="mt-0">
        {uploading ? (
          <div className="flex items-center justify-center w-7 h-7">
            <Loader2 size={14} className="animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <button
            onClick={() => { setError(false); inputRef.current?.click(); }}
            title={t('image_upload_fail')}
            className="flex items-center justify-center w-7 h-7 text-red-400 hover:text-red-600 transition-colors"
          >
            <AlertCircle size={14} />
          </button>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            title={t('image_upload')}
            className="flex items-center justify-center w-7 h-7 text-gray-300 hover:text-gray-500 transition-colors"
          >
            <Camera size={15} />
          </button>
        )}
      </div>

      {cropFile && (
        <ImageCropModal
          file={cropFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      )}
    </>
  );
});

ImageUploader.displayName = 'ImageUploader';
