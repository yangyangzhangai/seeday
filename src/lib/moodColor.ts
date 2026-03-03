export const MOOD_COLORS: Record<string, string> = {
  开心: '#F9A8D4',
  平静: '#93C5FD',
  专注: '#86EFAC',
  满足: '#FDE68A',
  疲惫: '#9CA3AF',
  无聊: '#C7D2FE',
  低落: '#60A5FA',
};

function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = parseInt(cleaned.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function softenHexColor(hex: string): string {
  try {
    const { h, s, l } = hexToHsl(hex);
    const s2 = Math.max(0, Math.min(1, s * 0.75)); // 降低饱和度
    const l2 = Math.max(0, Math.min(1, l + 0.06)); // 提升亮度
    return hslToHex(h, s2, l2);
  } catch {
    return hex;
  }
}

export function getMoodColor(label: string | undefined): string | undefined {
  if (!label) return undefined;
  if (MOOD_COLORS[label]) return softenHexColor(MOOD_COLORS[label]);
  let hue = hashStringToInt(label) % 360;
  // 更低饱和、更高亮度的粉彩色
  let color = hslToHex(hue, 0.42, 0.84);
  const used = new Set(Object.values(MOOD_COLORS).map(c => c.toLowerCase()));
  let tries = 0;
  while (used.has(color.toLowerCase()) && tries < 12) {
    hue = (hue + 30) % 360;
    color = hslToHex(hue, 0.42, 0.84);
    tries++;
  }
  return softenHexColor(color);
}
