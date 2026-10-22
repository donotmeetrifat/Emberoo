export interface CharacterConfig {
  heroImage: string;
  heroName: string;
  collectibleImage: string;
  collectibleName: string;
  pickupSound: string;
}

export const DEFAULT_CONFIG: CharacterConfig = {
  heroImage: '/assets/1-trimmed.png',
  heroName: 'Bean',
  collectibleImage: '/assets/2-trimmed.png',
  collectibleName: 'Stickman',
  pickupSound: '/assets/Fahhh.mp3',
};

const STORAGE_KEY = 'firebound_character_config_v2';

export function loadCharacterConfig(): CharacterConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      heroImage: parsed.heroImage || DEFAULT_CONFIG.heroImage,
      heroName: parsed.heroName?.trim() || DEFAULT_CONFIG.heroName,
      collectibleImage: parsed.collectibleImage || DEFAULT_CONFIG.collectibleImage,
      collectibleName: parsed.collectibleName?.trim() || DEFAULT_CONFIG.collectibleName,
      pickupSound:
        parsed.pickupSound && parsed.pickupSound !== '/assets/nova-pickup.mp3'
          ? parsed.pickupSound
          : DEFAULT_CONFIG.pickupSound,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveCharacterConfig(config: CharacterConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Failed to save character config to localStorage:', err);
  }
}

export function resetCharacterConfig(): CharacterConfig {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore error
  }
  return { ...DEFAULT_CONFIG };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Trims transparent outer margins from any loaded image using an HTML5 Canvas.
 * Ensures custom uploaded characters sit firmly on platforms and fill portrait cards cleanly.
 */
export function trimImageTransparency(dataUrlOrPath: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(dataUrlOrPath);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const { width, height } = canvas;
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        let minX = width;
        let maxX = 0;
        let minY = height;
        let maxY = 0;
        let hasTransparent = false;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (alpha < 250) hasTransparent = true;
            if (alpha > 12) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        // If completely transparent or completely opaque without significant transparent border, keep as is
        if (minX > maxX || minY > maxY || !hasTransparent) {
          resolve(dataUrlOrPath);
          return;
        }

        // Add 2px safety padding
        const pad = 2;
        const cropX = Math.max(0, minX - pad);
        const cropY = Math.max(0, minY - pad);
        const cropW = Math.min(width - cropX, maxX - minX + 1 + pad * 2);
        const cropH = Math.min(height - cropY, maxY - minY + 1 + pad * 2);

        // If the padding difference is trivial, return original
        if (cropW >= width - 4 && cropH >= height - 4) {
          resolve(dataUrlOrPath);
          return;
        }

        const outCanvas = document.createElement('canvas');
        outCanvas.width = cropW;
        outCanvas.height = cropH;
        const outCtx = outCanvas.getContext('2d');
        if (!outCtx) {
          resolve(dataUrlOrPath);
          return;
        }

        outCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        resolve(outCanvas.toDataURL('image/png'));
      } catch (e) {
        console.warn('Auto-trim skipped due to error, using original:', e);
        resolve(dataUrlOrPath);
      }
    };
    img.onerror = () => resolve(dataUrlOrPath);
    img.src = dataUrlOrPath;
  });
}

/**
 * Optimizes an uploaded image data URL to a lightweight resolution (max 100x130)
 * in WebP format so it fits smoothly into a shareable link.
 */
export async function optimizeImageForShare(
  dataUrlOrPath: string,
  maxW = 100,
  maxH = 130
): Promise<string> {
  if (!dataUrlOrPath || !dataUrlOrPath.startsWith('data:image/')) {
    return dataUrlOrPath;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;

        let scale = 1;
        if (srcW > maxW || srcH > maxH) {
          scale = Math.min(maxW / srcW, maxH / srcH);
        }

        const targetW = Math.max(16, Math.round(srcW * scale));
        const targetH = Math.max(16, Math.round(srcH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrlOrPath);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);

        // Try WebP first for compact size with alpha channel
        let out = canvas.toDataURL('image/webp', 0.82);
        if (!out.startsWith('data:image/webp')) {
          out = canvas.toDataURL('image/png');
        }
        resolve(out);
      } catch {
        resolve(dataUrlOrPath);
      }
    };
    img.onerror = () => resolve(dataUrlOrPath);
    img.src = dataUrlOrPath;
  });
}

export function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToUint8Array(base64Url: string): Uint8Array {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

interface CompactSharePayload {
  h: string;  // heroName
  hi: string; // heroImage
  c: string;  // collectibleName
  ci: string; // collectibleImage
  s?: string; // pickupSound
}

/**
 * Encodes a CharacterConfig into a compressed, compact base64url string.
 */
export async function serializeShareConfig(config: CharacterConfig): Promise<string> {
  const [optHero, optCollectible] = await Promise.all([
    optimizeImageForShare(config.heroImage),
    optimizeImageForShare(config.collectibleImage),
  ]);

  const payload: CompactSharePayload = {
    h: config.heroName.trim() || DEFAULT_CONFIG.heroName,
    hi: optHero,
    c: config.collectibleName.trim() || DEFAULT_CONFIG.collectibleName,
    ci: optCollectible,
  };

  // Only include sound if it's not the default (and keep it under reasonable size)
  if (config.pickupSound && config.pickupSound !== DEFAULT_CONFIG.pickupSound) {
    if (config.pickupSound.length < 15000) {
      payload.s = config.pickupSound;
    }
  }

  const jsonStr = JSON.stringify(payload);

  // If CompressionStream is available, use deflate-raw
  if (typeof CompressionStream !== 'undefined') {
    try {
      const stream = new Blob([jsonStr]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      const compressedBuffer = await new Response(stream).arrayBuffer();
      return uint8ArrayToBase64Url(new Uint8Array(compressedBuffer));
    } catch (e) {
      console.warn('Deflate compression failed, falling back to base64url:', e);
    }
  }

  // Fallback: standard UTF-8 base64url
  const encoder = new TextEncoder();
  return uint8ArrayToBase64Url(encoder.encode(jsonStr));
}

/**
 * Decodes a compressed base64url share code back into a full CharacterConfig.
 */
export async function deserializeShareConfig(shareCode: string): Promise<CharacterConfig | null> {
  if (!shareCode) return null;
  try {
    const bytes = base64UrlToUint8Array(shareCode.trim());
    let jsonStr = '';

    if (typeof DecompressionStream !== 'undefined') {
      try {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        jsonStr = await new Response(stream).text();
      } catch {
        // May have been stored uncompressed
        const decoder = new TextDecoder();
        jsonStr = decoder.decode(bytes);
      }
    } else {
      const decoder = new TextDecoder();
      jsonStr = decoder.decode(bytes);
    }

    const payload = JSON.parse(jsonStr) as CompactSharePayload;
    if (!payload || typeof payload !== 'object') return null;

    return {
      heroName: payload.h?.trim() || DEFAULT_CONFIG.heroName,
      heroImage: payload.hi || DEFAULT_CONFIG.heroImage,
      collectibleName: payload.c?.trim() || DEFAULT_CONFIG.collectibleName,
      collectibleImage: payload.ci || DEFAULT_CONFIG.collectibleImage,
      pickupSound: payload.s || DEFAULT_CONFIG.pickupSound,
    };
  } catch (err) {
    console.error('Failed to deserialize share config:', err);
    return null;
  }
}

/**
 * Creates a complete shareable URL with the character config encoded in the URL hash.
 */
export async function getShareableUrl(config: CharacterConfig): Promise<string> {
  const code = await serializeShareConfig(config);
  const baseUrl = `${window.location.origin}${window.location.pathname}`.replace(/\/+$/, '');
  return `${baseUrl}#share=${code}`;
}

export interface SharedLoadResult {
  config: CharacterConfig;
  heroName: string;
  collectibleName: string;
}

/**
 * Checks the current page URL (hash or query param) for a shared character config.
 * If found, decodes it, cleans up the URL bar, and returns the loaded config.
 */
export async function checkForSharedConfig(): Promise<SharedLoadResult | null> {
  try {
    let shareCode: string | null = null;

    // 1. Check URL hash: #share=...
    const hash = window.location.hash;
    if (hash) {
      const match = hash.match(/[#&]share=([^&]+)/);
      if (match && match[1]) {
        shareCode = decodeURIComponent(match[1]);
      }
    }

    // 2. Check query params: ?share=...
    if (!shareCode) {
      const params = new URLSearchParams(window.location.search);
      shareCode = params.get('share');
    }

    if (!shareCode) return null;

    const config = await deserializeShareConfig(shareCode);
    if (!config) return null;

    // Clean up the URL without reloading the page
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    return {
      config,
      heroName: config.heroName,
      collectibleName: config.collectibleName,
    };
  } catch (err) {
    console.warn('Error reading shared character config from URL:', err);
    return null;
  }
}
