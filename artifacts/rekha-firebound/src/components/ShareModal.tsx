import { useEffect, useState } from 'react';
import { CharacterConfig, getShareableUrl } from '../lib/characterStore';

interface ShareModalProps {
  config: CharacterConfig;
  onClose: () => void;
}

export default function ShareModal({ config, onClose }: ShareModalProps) {
  const [shareUrl, setShareUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(true);
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    let active = true;
    setIsGenerating(true);
    getShareableUrl(config)
      .then((url) => {
        if (active) {
          setShareUrl(url);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate share URL:', err);
        if (active) setIsGenerating(false);
      });
    return () => {
      active = false;
    };
  }, [config]);

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.getElementById('share-link-input') as HTMLInputElement | null;
        if (input) {
          input.select();
          document.execCommand('copy');
        }
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  };

  const handleNativeShare = async () => {
    if (!shareUrl || !canShare) return;
    try {
      await navigator.share({
        title: `Play Emberoo with ${config.heroName} & ${config.collectibleName}!`,
        text: `Hey! I customized an Emberoo adventure for us with ${config.heroName} and ${config.collectibleName}. Open this link to play:`,
        url: shareUrl,
      });
    } catch {
      // User cancelled share
    }
  };

  const handleOpenTest = () => {
    if (!shareUrl) return;
    window.open(shareUrl, '_blank');
  };

  return (
    <div className="overlay fixed-overlay">
      <div className="modal-card share-modal">
        <div className="modal-kicker-pill success">✦ SHARE ADVENTURE LINK ✦</div>
        <h2 className="modal-title" style={{ margin: '4px 0 6px', fontSize: 'clamp(26px, 4.5vw, 36px)' }}>
          Share With Your Friend
        </h2>
        <p className="modal-copy" style={{ marginBottom: '14px' }}>
          Send this link to your friend! When they open it, they will leap through the world as{' '}
          <strong>{config.heroName}</strong> and find <strong>{config.collectibleName}</strong>.
        </p>

        {/* Dual character preview */}
        <div className="portrait-row" style={{ margin: '6px 0 16px', gap: '14px' }}>
          <div className="portrait-card mini hero">
            <img src={config.heroImage} alt={config.heroName} />
            <span className="card-badge">{config.heroName.toUpperCase()}</span>
          </div>
          <span className="heart-link" style={{ fontSize: '22px' }}>
            ✦
          </span>
          <div className="portrait-card mini">
            <img src={config.collectibleImage} alt={config.collectibleName} />
            <span className="card-badge">{config.collectibleName.toUpperCase()}</span>
          </div>
        </div>

        {/* Share Link Box */}
        <div className="share-link-box">
          <input
            id="share-link-input"
            type="text"
            readOnly
            value={isGenerating ? 'Generating short link...' : shareUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="share-url-input"
          />
          <button
            type="button"
            className="primary-button copy-share-btn"
            onClick={handleCopy}
            disabled={isGenerating || !shareUrl}
          >
            {copied ? '✓ Copied to Clipboard!' : '📋 Copy Short Link'}
          </button>
        </div>

        <div className="modal-actions-row" style={{ marginTop: '12px' }}>
          {canShare && (
            <button type="button" className="secondary-button" onClick={handleNativeShare}>
              📲 Share via App
            </button>
          )}
          <button
            type="button"
            className="secondary-button"
            onClick={handleOpenTest}
            title="Open link in a new tab to see what your friend will experience"
          >
            ↗ Test Link
          </button>
          <button type="button" className="secondary-button" onClick={onClose}>
            Done
          </button>
        </div>

        <div className="share-hint">
          <span>💡 Ultra-compact link ({shareUrl ? `${shareUrl.length} chars` : 'short'}) — works instantly in any chat (WhatsApp, SMS, Discord).</span>
        </div>
      </div>
    </div>
  );
}
