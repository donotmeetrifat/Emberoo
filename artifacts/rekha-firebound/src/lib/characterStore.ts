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
