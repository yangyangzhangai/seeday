// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import { useState } from 'react';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';

const BUCKET = 'timeshine-images';
/** Maximum dimension (px) before downscaling */
const MAX_DIM = 1200;
/** JPEG quality for storage upload (0–1) */
const UPLOAD_QUALITY = 0.82;
/** JPEG quality for data-URL fallback (keep smaller for localStorage) */
const FALLBACK_QUALITY = 0.72;

/** Convert a Blob to a base64 data URL for local persistence fallback. */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Downscale + re-compress an image so it fits within MAX_DIM on the longest side.
 * If the image is already smaller than MAX_DIM the original blob is returned as-is
 * (but still re-encoded to strip EXIF / ensure JPEG format).
 */
function compressImage(input: File | Blob, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(input);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, MAX_DIM / Math.max(w, h));
      const outW = Math.round(w * scale);
      const outH = Math.round(h * scale);

      const canvas = document.createElement('canvas');
      canvas.width  = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no canvas ctx')); return; }
      ctx.drawImage(img, 0, 0, outW, outH);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null')),
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load failed')); };
    img.src = url;
  });
}

export function useImageUpload() {
  const [uploading, setUploading] = useState(false);

  /**
   * Upload an image (File or pre-cropped Blob) for a message.
   * 1. Compress to ≤MAX_DIM px on longest side (fast, smaller payload)
   * 2. Try Supabase Storage → get permanent public URL
   * 3. Fallback: data URL stored locally in Zustand / localStorage
   */
  async function upload(file: File | Blob, messageId: string): Promise<string> {
    setUploading(true);
    try {
      // Compress first (even for Supabase path — faster upload + cheaper storage)
      let compressed: Blob;
      try {
        compressed = await compressImage(file, UPLOAD_QUALITY);
      } catch {
        compressed = file; // if compression fails, use original
      }

      // Try Supabase Storage
      try {
        const session = await getSupabaseSession();
        if (session) {
          const path = `${session.user.id}/${messageId}.jpg`;
          const { error } = await supabase.storage
            .from(BUCKET)
            .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });
          if (!error) {
            const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
            if (data.publicUrl) return data.publicUrl;
          }
          if (import.meta.env.DEV) console.warn('[ImageUpload] Supabase upload failed, using data URL fallback', error);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[ImageUpload] Supabase error, using data URL fallback', err);
      }

      // Fallback: compress more aggressively for localStorage then convert to data URL
      let fallbackBlob = compressed;
      try {
        fallbackBlob = await compressImage(file, FALLBACK_QUALITY);
      } catch { /* use the already-compressed blob */ }
      return await blobToDataUrl(fallbackBlob);
    } finally {
      setUploading(false);
    }
  }

  /**
   * Remove an uploaded image.
   * Skips Supabase removal if the URL is a local data URL.
   */
  async function remove(messageId: string, currentUrl?: string): Promise<void> {
    if (currentUrl?.startsWith('data:')) return; // local-only, nothing to remove
    const session = await getSupabaseSession();
    if (!session) return;
    const path = `${session.user.id}/${messageId}.jpg`;
    await supabase.storage.from(BUCKET).remove([path]);
  }

  return { upload, remove, uploading };
}
