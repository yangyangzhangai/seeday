import { supabase } from '../api/supabase';
import { formatUserFacingDiagnostic, logDiagnostic } from './diagnostics';

const AVATAR_BUCKET = 'seeday-images';
const AVATAR_MAX_DIM = 512;
const AVATAR_UPLOAD_QUALITY = 0.86;

function createAvatarPath(userId: string): string {
  return `${userId}/avatars/profile-${Date.now()}.jpg`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  if (!header || !b64) {
    throw new Error('Invalid avatar data URL');
  }
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function blobToJpeg(input: Blob, maxDim = AVATAR_MAX_DIM, quality = AVATAR_UPLOAD_QUALITY): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(input);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable while preparing avatar'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Avatar canvas export returned empty blob'))),
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Avatar image decode failed'));
    };
    img.src = url;
  });
}

export function isDataUrl(value?: string | null): boolean {
  return Boolean(value?.trim().toLowerCase().startsWith('data:'));
}

export async function uploadAvatarToStorage(userId: string, avatarDataUrl: string): Promise<string> {
  const startedAt = Date.now();
  const path = createAvatarPath(userId);
  logDiagnostic('info', 'auth.avatar_upload.start', {
    userId,
    bucket: AVATAR_BUCKET,
    path,
    dataUrlChars: avatarDataUrl.length,
  });

  try {
    const inputBlob = dataUrlToBlob(avatarDataUrl);
    const uploadBlob = await blobToJpeg(inputBlob);
    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, uploadBlob, {
        upsert: false,
        contentType: 'image/jpeg',
        cacheControl: '31536000',
      });

    if (error) throw error;

    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    if (!data.publicUrl) {
      throw new Error('Supabase Storage did not return an avatar public URL');
    }

    const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
    logDiagnostic('info', 'auth.avatar_upload.success', {
      userId,
      bucket: AVATAR_BUCKET,
      path,
      elapsedMs: Date.now() - startedAt,
      uploadBytes: uploadBlob.size,
      publicUrlChars: publicUrl.length,
    });
    return publicUrl;
  } catch (error) {
    const detailed = formatUserFacingDiagnostic('Avatar Storage upload', error, {
      path: `${AVATAR_BUCKET}/${path}`,
      elapsedMs: Date.now() - startedAt,
    });
    logDiagnostic('error', 'auth.avatar_upload.failed', {
      userId,
      bucket: AVATAR_BUCKET,
      path,
      elapsedMs: Date.now() - startedAt,
      error,
      userFacing: detailed,
    });
    throw new Error(detailed);
  }
}
