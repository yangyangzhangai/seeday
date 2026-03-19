// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, X, Loader2, AlertCircle, ZoomIn, Crop } from 'lucide-react';
import { useImageUpload } from '../../../hooks/useImageUpload';
import { ImageCropModal } from './ImageCropModal';

export interface ImageUploaderProps {
  messageId: string;
  imageUrl?: string | null;
  onUploaded: (url: string) => void;
  onRemoved:  () => void;
  /** Show image at compact height (h-20) instead of full height */
  compact?: boolean;
  /** Hide the upload button when this slot has no image but shouldn't show camera */
  hideUploadWhen?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  messageId, imageUrl, onUploaded, onRemoved, compact, hideUploadWhen,
}) => {
  const { t } = useTranslation();
  const { upload, remove, uploading } = useImageUpload();
  const inputRef  = useRef<HTMLInputElement>(null);
  const imageRef  = useRef<HTMLDivElement>(null);
  const [error, setError]           = useState(false);
  const [lightbox, setLightbox]     = useState(false);
  const [cropFile, setCropFile]     = useState<File | null>(null);
  const [imageTapped, setImageTapped] = useState(false);
  const [reCropping, setReCropping] = useState(false);

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

  /**
   * Re-crop: fetch the current image as a blob and reopen the crop modal.
   * Falls back to the file picker if the URL cannot be fetched (e.g. CORS).
   */
  const handleReCrop = async () => {
    if (!imageUrl) return;
    setLightbox(false);
    setReCropping(true);
    try {
      const res  = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' });
      setCropFile(file);
    } catch {
      // Fetch failed — let user pick a replacement file instead
      inputRef.current?.click();
    } finally {
      setReCropping(false);
    }
  };

  // Hidden file input is always rendered so the fallback picker works
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
            <div className="absolute inset-0 bg-black/20 flex items-start justify-end p-1 gap-1">
              <button
                onClick={e => { e.stopPropagation(); setLightbox(true); setImageTapped(false); }}
                className="p-1 bg-black/50 rounded-full text-white"
              >
                <ZoomIn size={11} />
              </button>
              <button
                onClick={e => { e.stopPropagation(); void handleRemove(); }}
                className="p-1 bg-black/50 rounded-full text-white"
              >
                <X size={11} />
              </button>
            </div>
          )}
        </div>

        {/* Re-crop loading indicator */}
        {reCropping && (
          <div className="flex items-center justify-center mt-1">
            <Loader2 size={14} className="animate-spin text-gray-400" />
          </div>
        )}

        {/* Lightbox with re-crop action */}
        {lightbox && (
          <div
            className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center"
            onClick={() => setLightbox(false)}
          >
            {/* Full-size image */}
            <img
              src={imageUrl}
              alt=""
              className="max-w-full max-h-[75vh] object-contain"
              onClick={e => e.stopPropagation()}
            />

            {/* Toolbar */}
            <div
              className="flex items-center gap-3 mt-5"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => void handleReCrop()}
                className="flex items-center gap-1.5 px-4 py-2 bg-white/15 hover:bg-white/25 text-white text-xs rounded-full transition-colors"
              >
                <Crop size={13} />
                <span>{t('image_recrop')}</span>
              </button>
              <button
                onClick={() => setLightbox(false)}
                className="flex items-center justify-center w-8 h-8 bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Crop modal (initial upload or re-crop) */}
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

  // ── No image: show upload button (unless hidden) ─────────────
  if (hideUploadWhen) return <>{fileInput}</>;

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
};
