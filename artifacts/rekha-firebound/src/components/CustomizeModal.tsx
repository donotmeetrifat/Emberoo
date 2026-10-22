import React, { useState, useRef } from 'react';
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

  const handleHeroFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsTrimming(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const trimmed = await trimImageTransparency(dataUrl);
      setHeroImage(trimmed);
    } catch (err) {
      console.error('Error processing hero image:', err);
    } finally {
      setIsTrimming(false);
    }
  };

  const handleCollectibleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsTrimming(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const trimmed = await trimImageTransparency(dataUrl);
      setCollectibleImage(trimmed);
    } catch (err) {
      console.error('Error processing collectible image:', err);
    } finally {
      setIsTrimming(false);
    }
  };

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

        {isTrimming && (
          <div className="trimming-badge">
            <span className="spinner-dot" /> Auto-optimizing character transparency...
          </div>
        )}

        <div className="customize-grid">
          {/* Hero Section */}
          <section className="customize-card">
            <div className="customize-card-header">
              <span className="customize-tag">RUNNING HERO</span>
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
            <div className="portrait-preview-box">
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
            <button
              type="button"
              className="secondary-button upload-btn"
              onClick={() => heroInputRef.current?.click()}
            >
              📷 Upload New Hero Image
            </button>
          </section>

          {/* Collectible Section */}
          <section className="customize-card">
            <div className="customize-card-header">
              <span className="customize-tag">COLLECTIBLE CHARACTER</span>
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
            <div className="portrait-preview-box">
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
            <button
              type="button"
              className="secondary-button upload-btn"
              onClick={() => collectibleInputRef.current?.click()}
            >
              ⭐ Upload New Collectible Image
            </button>
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

