// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
import { useState } from 'react';
import { supabase } from '../api/supabase';
import { getSupabaseSession } from '../lib/supabase-utils';

const BUCKET = 'timeshine-images';

/** Convert a Blob to a base64 data URL for local persistence fallback. */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useImageUpload() {
  const [uploading, setUploading] = useState(false);

  /**
   * Upload an image (File or pre-cropped Blob) for a message.
   * Tries Supabase Storage first; falls back to a data URL stored locally.
   */
  async function upload(file: File | Blob, messageId: string): Promise<string> {
    setUploading(true);
    try {
      // Try Supabase Storage; any thrown error falls through to the data URL fallback
      try {
        const session = await getSupabaseSession();
        if (session) {
          const path = `${session.user.id}/${messageId}.jpg`;
          const { error } = await supabase.storage
            .from(BUCKET)
            .upload(path, file, { upsert: true, contentType: 'image/jpeg' });
          if (!error) {
            const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
            if (data.publicUrl) return data.publicUrl;
          }
          if (import.meta.env.DEV) console.warn('[ImageUpload] Supabase upload failed, using data URL fallback', error);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('[ImageUpload] Supabase error, using data URL fallback', err);
      }
      // Fallback: persist image as base64 data URL inside zustand store
      return await blobToDataUrl(file);
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
