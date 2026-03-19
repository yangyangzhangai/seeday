// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, X, Loader2, AlertCircle, ZoomIn } from 'lucide-react';
import { useImageUpload } from '../../../hooks/useImageUpload';
import { ImageCropModal } from './ImageCropModal';

export interface ImageUploaderProps {
  messageId: string;
  imageUrl?: string | null;
  onUploaded: (url: string) => void;
  onRemoved:  () => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  messageId, imageUrl, onUploaded, onRemoved,
}) => {
  const { t } = useTranslation();
  const { upload, remove, uploading } = useImageUpload();
  const inputRef   = useRef<HTMLInputElement>(null);
  const [error, setError]         = useState(false);
  const [lightbox, setLightbox]   = useState(false);
  const [cropFile, setCropFile]   = useState<File | null>(null);

  // Called after user confirms the crop
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
    // Reset input so the same file can be reselected after crop cancel
    e.target.value = '';
    setCropFile(file);
  };

  const handleRemove = async () => {
    await remove(messageId, imageUrl ?? undefined);
    onRemoved();
  };

  // ── Image already uploaded ──────────────────────────────────
  if (imageUrl) {
    return (
      <>
        <div className="relative mt-2 rounded-lg overflow-hidden">
          <img
            src={imageUrl}
            alt=""
            className="w-full max-h-48 object-cover cursor-pointer"
            onClick={() => setLightbox(true)}
          />
          <div className="absolute top-1 right-1 flex gap-1">
            <button
              onClick={() => setLightbox(true)}
              className="p-1 bg-black/40 rounded-full text-white"
            >
              <ZoomIn size={12} />
            </button>
            <button
              onClick={handleRemove}
              className="p-1 bg-black/40 rounded-full text-white"
            >
              <X size={12} />
            </button>
          </div>
        </div>

        {lightbox && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
            onClick={() => setLightbox(false)}
          >
            <img src={imageUrl} alt="" className="max-w-full max-h-full object-contain" />
          </div>
        )}
      </>
    );
  }

  // ── Upload button (camera icon only) ───────────────────────
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="mt-1">
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

      {/* Crop modal */}
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
