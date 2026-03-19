// DOC-DEPS: LLM.md -> docs/PROJECT_MAP.md -> src/features/chat/README.md
// 前端 Canvas 图片压缩工具，不依赖第三方服务

export interface CompressOptions {
  maxWidth: number;
  maxSize: number;
  quality: number;
  minQuality: number;
}

const DEFAULT_OPTIONS: CompressOptions = {
  maxWidth: 1200,
  maxSize: 512_000, // 500KB
  quality: 0.8,
  minQuality: 0.5,
};

/** 使用 Canvas 压缩图片，输出 image/jpeg，透明背景填白 */
export async function compressImage(
  file: File,
  options?: Partial<CompressOptions>,
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const bitmap = await createImageBitmap(file);
  const { width: origW, height: origH } = bitmap;

  const scale = Math.min(1, opts.maxWidth / origW);
  const targetW = Math.round(origW * scale);
  const targetH = Math.round(origH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  let quality = opts.quality;
  let blob = await canvasToBlob(canvas, quality);

  while (blob.size > opts.maxSize && quality > opts.minQuality) {
    quality = Math.max(opts.minQuality, quality - 0.1);
    blob = await canvasToBlob(canvas, quality);
  }

  if (blob.size > opts.maxSize) {
    import.meta.env.DEV && console.log('[imageCompressor] 压缩后仍超过目标大小', blob.size);
  }

  return blob;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      quality,
    );
  });
}
