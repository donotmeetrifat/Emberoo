import { CharacterConfig } from '../lib/characterStore';

interface SharedWelcomeModalProps {
  config: CharacterConfig;
  onPlay: () => void;
  onCustomize: () => void;
  onClose: () => void;
}

export default function SharedWelcomeModal({
  config,
  onPlay,
  onCustomize,
  onClose,
}: SharedWelcomeModalProps) {
  return (
    <div className="overlay" style={{ zIndex: 11 }}>
      <div className="modal-card shared-welcome-modal">
        <div className="modal-kicker-pill success">✦ SPECIAL ADVENTURE LOADED ✦</div>
        <h2 className="modal-title" style={{ margin: '6px 0 8px', fontSize: 'clamp(28px, 5vw, 40px)' }}>
          Welcome to Emberoo!
        </h2>
        <p className="modal-copy">
          A friend sent you a custom world made for <strong>{config.heroName}</strong> and{' '}
          <strong>{config.collectibleName}</strong>. Run through three fiery realms to reunite with{' '}
          <strong>{config.collectibleName}</strong>!
        </p>

        <div className="portrait-row" style={{ margin: '10px 0 18px', gap: '16px' }}>
          <div className="portrait-card hero">
            <img src={config.heroImage} alt={config.heroName} />
            <span className="card-badge">{config.heroName.toUpperCase()}</span>
          </div>
          <span className="heart-link">✦</span>
          <div className="portrait-card">
            <img src={config.collectibleImage} alt={config.collectibleName} />
            <span className="card-badge">{config.collectibleName.toUpperCase()}</span>
          </div>
        </div>

        <div className="modal-actions-stack">
          <button className="primary-button" onClick={onPlay}>
            ▶ Start Adventure as {config.heroName} <span aria-hidden="true">→</span>
          </button>
          <div className="modal-actions-row">
            <button className="secondary-button" onClick={onCustomize}>
              🎨 Customize
            </button>
            <button className="secondary-button" onClick={onClose}>
              Explore Title
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
