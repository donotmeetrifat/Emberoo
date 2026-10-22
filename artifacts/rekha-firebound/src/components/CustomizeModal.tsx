import React, { useState, useRef, useEffect } from 'react';
import {
  CharacterConfig,
  DEFAULT_CONFIG,
  fileToDataUrl,
  trimImageTransparency,
} from '../lib/characterStore';

interface CustomizeModalProps {
  config: CharacterConfig;
  onSave: (newConfig: CharacterConfig) => void;
  onShare?: (newConfig: CharacterConfig) => void;
  onClose: () => void;
}

export default function CustomizeModal({ config, onSave, onShare, onClose }: CustomizeModalProps) {
  const [heroImage, setHeroImage] = useState(config.heroImage);
  const [heroName, setHeroName] = useState(config.heroName);
  const [collectibleImage, setCollectibleImage] = useState(config.collectibleImage);
  const [collectibleName, setCollectibleName] = useState(config.collectibleName);
  const [pickupSound, setPickupSound] = useState(config.pickupSound);
  const [isTrimming, setIsTrimming] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [activeTarget, setActiveTarget] = useState<'hero' | 'collectible'>('hero');
  const [pasteFeedback, setPasteFeedback] = useState<'hero' | 'collectible' | null>(null);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  const heroInputRef = useRef<HTMLInputElement>(null);
  const collectibleInputRef = useRef<HTMLInputElement>(null);
  const soundInputRef = useRef<HTMLInputElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const getCurrentConfig = (): CharacterConfig => ({
    heroImage,
    heroName: heroName.trim() || DEFAULT_CONFIG.heroName,
    collectibleImage,
    collectibleName: collectibleName.trim() || DEFAULT_CONFIG.collectibleName,
    pickupSound,
  });

  const processImageFile = async (file: File, target: 'hero' | 'collectible') => {
    if (!file.type.startsWith('image/')) {
      setPasteNotice('Please provide an image file (PNG, JPG, or WebP).');
      setTimeout(() => setPasteNotice(null), 3000);
      return;
    }
    setIsTrimming(true);
    setPasteNotice(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const trimmed = await trimImageTransparency(dataUrl);
      if (target === 'hero') {
        setHeroImage(trimmed);
        setPasteFeedback('hero');
      } else {
        setCollectibleImage(trimmed);
        setPasteFeedback('collectible');
      }
      setTimeout(() => setPasteFeedback(null), 2500);
    } catch (err) {
      console.error('Error processing image:', err);
      setPasteNotice('Failed to process image. Please try another image.');
      setTimeout(() => setPasteNotice(null), 3500);
    } finally {
      setIsTrimming(false);
    }
  };

  const handleHeroFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processImageFile(file, 'hero');
  };

  const handleCollectibleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processImageFile(file, 'collectible');
  };

  const handlePasteClick = async (target: 'hero' | 'collectible') => {
    setActiveTarget(target);
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const file = new File([blob], 'clipboard-pasted.png', { type: imageType });
            await processImageFile(file, target);
            return;
          }
        }
      }
    } catch {
      // Clipboard read failed or permission denied
    }
    setPasteNotice(`Press Ctrl+V (or ⌘+V) to paste your copied image into ${target === 'hero' ? heroName || 'Hero' : collectibleName || 'Collectible'}.`);
    setTimeout(() => setPasteNotice(null), 3500);
  };

  // Global paste handler when modal is open
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      let imageFile: File | null = null;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          imageFile = items[i].getAsFile();
          break;
        }
      }

      if (imageFile) {
        e.preventDefault();
        void processImageFile(imageFile, activeTarget);
      }
    };

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [activeTarget]);

  const handleSoundFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setPickupSound(dataUrl);
      testAudio(dataUrl);
    } catch (err) {
      console.error('Error processing sound file:', err);
    }
  };

  const testAudio = (srcToPlay?: string) => {
    const src = srcToPlay || pickupSound;
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
    }
    const audio = new Audio(src);
    audio.volume = 0.85;
    audioPreviewRef.current = audio;
    setIsPlayingAudio(true);
    audio.onended = () => setIsPlayingAudio(false);
    audio.onerror = () => setIsPlayingAudio(false);
    audio.play().catch(() => setIsPlayingAudio(false));
  };

  const handleSave = () => {
    onSave(getCurrentConfig());
    onClose();
  };

  const handleSaveAndShare = () => {
    const newConfig = getCurrentConfig();
    onSave(newConfig);
    if (onShare) {
      onShare(newConfig);
    }
  };

  const handleResetDefaults = () => {
    setHeroImage(DEFAULT_CONFIG.heroImage);
    setHeroName(DEFAULT_CONFIG.heroName);
    setCollectibleImage(DEFAULT_CONFIG.collectibleImage);
    setCollectibleName(DEFAULT_CONFIG.collectibleName);
    setPickupSound(DEFAULT_CONFIG.pickupSound);
  };

  return (
    <div className="overlay" style={{ zIndex: 10 }}>
      <div className="modal-card customize-modal">
        <header className="customize-header">
          <div>
            <div className="modal-kicker">Custom Character Studio</div>
            <h2 className="modal-title" style={{ fontSize: 'clamp(24px, 4vw, 34px)', margin: '4px 0' }}>
              Your Characters & Sound
            </h2>
          </div>
          <button className="icon-button close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </header>

        <div className="paste-tip-bar">
          <span>📋 <strong>Paste feature enabled:</strong> Copy any image and press <strong>Ctrl+V</strong> (or <strong>⌘+V</strong>) to paste it directly!</span>
        </div>

        {pasteNotice && (
          <div className="trimming-badge" style={{ background: '#fff2db', borderColor: '#e49f39', color: '#7a4205' }}>
            <span>💡 {pasteNotice}</span>
          </div>
        )}

        {isTrimming && (
          <div className="trimming-badge">
            <span className="spinner-dot" /> Auto-optimizing character transparency...
          </div>
        )}

        <div className="customize-grid">
          {/* Hero Section */}
          <section
            className={`customize-card ${activeTarget === 'hero' ? 'active-target' : ''}`}
            onClick={() => setActiveTarget('hero')}
          >
            <div className="customize-card-header">
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span className="customize-tag">RUNNING HERO</span>
                {activeTarget === 'hero' && <span className="paste-target-badge">● Active Paste</span>}
              </div>
              {heroImage !== DEFAULT_CONFIG.heroImage && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setHeroImage(DEFAULT_CONFIG.heroImage)}
                >
                  Reset to Bean
                </button>
              )}
            </div>
            <div
              className="portrait-preview-box"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file) void processImageFile(file, 'hero');
              }}
              title="Click or drag & drop an image here, or press Ctrl+V"
            >
              {pasteFeedback === 'hero' && <div className="paste-success-badge">✓ Image Pasted!</div>}
              <img src={heroImage} alt="Hero preview" />
              <span className="card-badge">{heroName.toUpperCase() || 'HERO'}</span>
            </div>
            <div className="input-group">
              <label htmlFor="hero-name-input">Hero Name</label>
              <input
                id="hero-name-input"
                type="text"
                maxLength={14}
                value={heroName}
                onChange={(e) => setHeroName(e.target.value)}
                placeholder="e.g. Bean"
              />
            </div>
            <input
              ref={heroInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={handleHeroFile}
            />
            <div className="button-action-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() => heroInputRef.current?.click()}
              >
                📁 Upload
              </button>
              <button
                type="button"
                className="secondary-button paste-btn"
                onClick={() => handlePasteClick('hero')}
                title="Paste image from clipboard (Ctrl+V)"
              >
                📋 Paste Image
              </button>
            </div>
          </section>

          {/* Collectible Section */}
          <section
            className={`customize-card ${activeTarget === 'collectible' ? 'active-target' : ''}`}
            onClick={() => setActiveTarget('collectible')}
          >
            <div className="customize-card-header">
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span className="customize-tag">COLLECTIBLE CHARACTER</span>
                {activeTarget === 'collectible' && <span className="paste-target-badge">● Active Paste</span>}
              </div>
              {collectibleImage !== DEFAULT_CONFIG.collectibleImage && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setCollectibleImage(DEFAULT_CONFIG.collectibleImage)}
                >
                  Reset to Stickman
                </button>
              )}
            </div>
            <div
              className="portrait-preview-box"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const file = e.dataTransfer.files?.[0];
                if (file) void processImageFile(file, 'collectible');
              }}
              title="Click or drag & drop an image here, or press Ctrl+V"
            >
              {pasteFeedback === 'collectible' && <div className="paste-success-badge">✓ Image Pasted!</div>}
              <img src={collectibleImage} alt="Collectible preview" />
              <span className="card-badge">{collectibleName.toUpperCase() || 'NOVA'}</span>
            </div>
            <div className="input-group">
              <label htmlFor="collectible-name-input">Collectible Name</label>
              <input
                id="collectible-name-input"
                type="text"
                maxLength={14}
                value={collectibleName}
                onChange={(e) => setCollectibleName(e.target.value)}
                placeholder="e.g. Stickman"
              />
            </div>
            <input
              ref={collectibleInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={handleCollectibleFile}
            />
            <div className="button-action-row">
              <button
                type="button"
                className="secondary-button"
                onClick={() => collectibleInputRef.current?.click()}
              >
                📁 Upload
              </button>
              <button
                type="button"
                className="secondary-button paste-btn"
                onClick={() => handlePasteClick('collectible')}
                title="Paste image from clipboard (Ctrl+V)"
              >
                📋 Paste Image
              </button>
            </div>
          </section>
        </div>

        {/* Pickup Audio Section */}
        <section className="audio-customize-section">
          <div className="audio-header">
            <div>
              <strong>Pickup Sound Effect</strong>
              <div className="audio-subtext">
                {pickupSound === DEFAULT_CONFIG.pickupSound
                  ? 'Default (Fahhh)'
                  : 'Custom Audio Loaded'}
              </div>
            </div>
            <div className="audio-actions">
              <button
                type="button"
                className="icon-button test-audio-btn"
                onClick={() => testAudio()}
              >
                {isPlayingAudio ? '🔊 Playing...' : '▶ Test Sound'}
              </button>
              <input
                ref={soundInputRef}
                type="file"
                accept="audio/mp3,audio/wav,audio/ogg,audio/m4a,audio/*"
                style={{ display: 'none' }}
                onChange={handleSoundFile}
              />
              <button
                type="button"
                className="secondary-button"
                style={{ minHeight: '38px', padding: '0 12px' }}
                onClick={() => soundInputRef.current?.click()}
              >
                Upload Sound
              </button>
              {pickupSound !== DEFAULT_CONFIG.pickupSound && (
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setPickupSound(DEFAULT_CONFIG.pickupSound)}
                >
                  Reset to Fahhh
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Footer Actions */}
        <footer className="customize-footer">
          <button
            type="button"
            className="secondary-button reset-all-btn"
            onClick={handleResetDefaults}
          >
            Reset All Defaults
          </button>
          <div className="footer-right">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="secondary-button share-modal-trigger-btn"
              onClick={handleSaveAndShare}
            >
              🔗 Share Link
            </button>
            <button type="button" className="primary-button" onClick={handleSave}>
              Save & Apply
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

