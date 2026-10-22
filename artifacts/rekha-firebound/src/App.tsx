import { useCallback, useEffect, useRef, useState } from 'react';
import GameCanvas from './GameCanvas';
import {
  CharacterConfig,
  checkForSharedConfig,
  loadCharacterConfig,
  saveCharacterConfig,
} from './lib/characterStore';
import CustomizeModal from './components/CustomizeModal';
import ShareModal from './components/ShareModal';
import SharedWelcomeModal from './components/SharedWelcomeModal';

type Scene = 'title' | 'playing' | 'paused' | 'complete' | 'gameover' | 'victory';

const levelNames = ['Sunny Grasslands', 'Copper Dune Run', 'Emberpeak Pass'];

function App() {
  const [scene, setScene] = useState<Scene>('title');
  const [level, setLevel] = useState(1);
  const [novaCount, setNovaCount] = useState(0);
  const [lives, setLives] = useState(3);
  const [seconds, setSeconds] = useState(0);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(false);
  const [checkpointToast, setCheckpointToast] = useState(false);
  const [charConfig, setCharConfig] = useState<CharacterConfig>(() => loadCharacterConfig());
  const [showCustomize, setShowCustomize] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharedWelcome, setSharedWelcome] = useState<CharacterConfig | null>(null);

  useEffect(() => {
    void checkForSharedConfig().then((result) => {
      if (result) {
        setCharConfig(result.config);
        saveCharacterConfig(result.config);
        setSharedWelcome(result.config);
      }
    });
  }, []);

  const audioRef = useRef<AudioContext | null>(null);
  const pickupAudioRef = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<number | null>(null);
  const beatRef = useRef(0);
  const mutedRef = useRef(false);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  mutedRef.current = muted;

  const getAudio = useCallback(() => {
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    if (!audioRef.current) audioRef.current = new AudioCtor();
    if (audioRef.current.state === 'suspended') void audioRef.current.resume();
    return audioRef.current;
  }, []);

  const tone = useCallback((frequency: number, duration: number, wave: OscillatorType = 'square', volume = .045, delay = 0) => {
    if (mutedRef.current) return;
    const audio = getAudio();
    if (!audio) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(frequency, audio.currentTime + delay);
    gain.gain.setValueAtTime(.0001, audio.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(volume, audio.currentTime + delay + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + delay + duration);
    osc.connect(gain); gain.connect(audio.destination);
    osc.start(audio.currentTime + delay); osc.stop(audio.currentTime + delay + duration + .03);
  }, [getAudio]);

  const stopMusic = useCallback(() => {
    if (musicRef.current !== null) window.clearInterval(musicRef.current);
    musicRef.current = null;
  }, []);

  const startMusic = useCallback(() => {
    stopMusic();
    const notes = [392, 494, 587, 494, 440, 523, 659, 523, 392, 494, 587, 784, 659, 587, 523, 440];
    musicRef.current = window.setInterval(() => {
      if (sceneRef.current !== 'playing' || mutedRef.current) return;
      const step = beatRef.current++ % notes.length;
      tone(notes[step], .16, step % 4 === 0 ? 'triangle' : 'square', .018);
      if (step % 4 === 0) tone(notes[step] / 2, .22, 'triangle', .014);
    }, 190);
  }, [stopMusic, tone]);

  useEffect(() => () => {
    stopMusic();
    pickupAudioRef.current?.pause();
    if (audioRef.current) void audioRef.current.close();
  }, [stopMusic]);

  useEffect(() => {
    if (scene === 'playing') startMusic();
    else stopMusic();
  }, [scene, startMusic, stopMusic]);

  useEffect(() => {
    if (scene !== 'playing') return;
    const timer = window.setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [scene]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'escape' && sceneRef.current === 'playing') setScene('paused');
      else if (event.key.toLowerCase() === 'escape' && sceneRef.current === 'paused') setScene('playing');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const begin = () => {
    getAudio();
    setLevel(1); setNovaCount(0); setLives(3); setSeconds(0); setProgress(0);
    setScene('playing');
  };

  const collect = () => {
    setNovaCount((n) => n + 1);
    if (!mutedRef.current) {
      if (!pickupAudioRef.current || pickupAudioRef.current.src !== charConfig.pickupSound) {
        pickupAudioRef.current = new Audio(charConfig.pickupSound);
        pickupAudioRef.current.preload = 'auto';
        pickupAudioRef.current.volume = .8;
      }
      pickupAudioRef.current.currentTime = 0;
      void pickupAudioRef.current.play().catch(() => tone(880, .12, 'triangle', .05));
    }
  };

  const handleSaveConfig = (newConfig: CharacterConfig) => {
    setCharConfig(newConfig);
    saveCharacterConfig(newConfig);
    if (pickupAudioRef.current) {
      pickupAudioRef.current.pause();
      pickupAudioRef.current = null;
    }
  };

  const toggleMute = () => setMuted((current) => {
    const next = !current;
    mutedRef.current = next;
    if (next && pickupAudioRef.current) {
      pickupAudioRef.current.pause();
      pickupAudioRef.current.currentTime = 0;
    }
    return next;
  });

  const jump = () => {
    const optionalJump = new Audio('/assets/aag.mp3');
    optionalJump.volume = mutedRef.current ? 0 : .45;
    optionalJump.play().catch(() => tone(520, .11, 'square', .035));
  };

  const loseLife = () => {
    tone(190, .28, 'sawtooth', .05); tone(118, .35, 'triangle', .04, .14);
    setLives((n) => {
      if (n <= 1) {
        window.setTimeout(() => setScene('gameover'), 80);
        return 0;
      }
      return n - 1;
    });
  };

  const checkpoint = () => {
    setCheckpointToast(true);
    window.setTimeout(() => setCheckpointToast(false), 1800);
    tone(659, .09, 'triangle', .035); tone(880, .15, 'triangle', .04, .1);
  };

  const goal = () => {
    tone(523, .13, 'triangle', .045); tone(659, .13, 'triangle', .045, .14); tone(784, .28, 'triangle', .05, .28);
    setScene(level === 3 ? 'victory' : 'complete');
  };

  const advance = () => {
    setLevel((n) => n + 1); setProgress(0); setScene('playing');
  };

  const retry = () => {
    setLevel(1); setLives(3); setNovaCount(0); setSeconds(0); setProgress(0); setScene('playing');
  };

  const timeLabel = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  const isGame = scene !== 'title';
  const isActive = scene === 'playing';

  return (
    <main className="game-shell">
      <header className="topline">
        <div className="brand">
          <img src="/assets/emberoo-run-icon.png" alt="Emberoo" className="brand-mark-img" />
          <div className="brand-text">
            <span className="brand-title">EMBEROO</span>
            <small>AN ADVENTURE IN THREE ACTS</small>
          </div>
        </div>
        <div className="top-actions">
          <button
            className="icon-button share-btn"
            onClick={() => setShowShareModal(true)}
            title="Share Adventure Link with Friend"
            aria-label="Share Adventure Link with Friend"
          >
            🔗 Share Link
          </button>
          <button
            className="icon-button"
            onClick={() => setShowCustomize(true)}
            title="Customize Characters & Sound"
            aria-label="Customize Characters and Sound"
          >
            🎨 Characters
          </button>
          <button className="icon-button" onClick={toggleMute} aria-label={muted ? 'Turn sound on' : 'Mute sound'}>
            {muted ? '🔇 Sound off' : '🔊 Sound on'}
          </button>
          {scene === 'playing' && (
            <button className="icon-button pause-btn" onClick={() => setScene('paused')} aria-label="Pause game">
              ⏸ Pause
            </button>
          )}
        </div>
      </header>

      <section className="game-frame" aria-label="Emberoo game">
        <div className="game-stage">
          <GameCanvas
            level={level}
            active={isActive && !showCustomize}
            onCollect={collect}
            onDeath={loseLife}
            onCheckpoint={checkpoint}
            onGoal={goal}
            onProgress={setProgress}
            onJump={jump}
            heroSrc={charConfig.heroImage}
            heroName={charConfig.heroName}
            collectibleSrc={charConfig.collectibleImage}
            collectibleName={charConfig.collectibleName}
          />
          {isGame && (
            <div className="hud">
              <div className="hud-group">
                <div className="hud-chip">
                  <img className="hud-portrait" src={charConfig.collectibleImage} alt={charConfig.collectibleName} />
                  <strong>{novaCount}</strong>
                  <span>{charConfig.collectibleName.toUpperCase()}</span>
                </div>
                <div className="hud-chip"><span className="hud-heart">♥</span><strong>{lives}</strong></div>
              </div>
              <div className="hud-group">
                <div className="hud-chip"><strong>0{level}</strong><span>{levelNames[level - 1]}</span></div>
                <div className="hud-chip timer-chip"><span>TIME</span><strong>{timeLabel}</strong></div>
                {scene === 'playing' && <button className="hud-chip pause-chip" onClick={() => setScene('paused')} aria-label="Pause">⏸</button>}
              </div>
            </div>
          )}
          {isGame && <div className="level-progress"><span style={{ width: `${progress}%` }} /></div>}
          {checkpointToast && scene === 'playing' && (
            <div className="checkpoint-toast">
              <span>✦ CHECKPOINT REACHED ✦</span>
            </div>
          )}

          {scene === 'title' && (
            <div className="overlay">
              <div className="modal-card title-modal">
                <img src="/assets/emberoo-run-icon.png" alt="Emberoo" className="title-logo-img" />
                <div className="modal-kicker-pill">AN ADVENTURE IN THREE ACTS</div>
                <h1 className="modal-title">Emberoo</h1>
                <p className="modal-copy">Leap through sunlit fields, copper dunes and an ember-lit mountain. Find your way back to <strong>{charConfig.collectibleName}</strong>.</p>
                <div className="portrait-row">
                  <div className="portrait-card hero">
                    <img src={charConfig.heroImage} alt={charConfig.heroName} />
                    <span className="card-badge">{charConfig.heroName.toUpperCase()}</span>
                  </div>
                  <span className="heart-link">✦</span>
                  <div className="portrait-card">
                    <img src={charConfig.collectibleImage} alt={charConfig.collectibleName} />
                    <span className="card-badge">{charConfig.collectibleName.toUpperCase()}</span>
                  </div>
                </div>
                <div className="modal-actions-stack">
                  <button className="primary-button" onClick={begin}>Start the adventure <span aria-hidden="true">→</span></button>
                  <div className="modal-actions-row">
                    <button className="secondary-button" onClick={() => setShowCustomize(true)}>🎨 Customize</button>
                    <button className="secondary-button" onClick={() => setShowShareModal(true)}>🔗 Share Link</button>
                  </div>
                </div>
                <div className="instructions">
                  <span className="keycap">← → / A D</span>
                  <span className="keycap">SPACE / W / ↑ JUMP</span>
                  <span className="keycap">ESC PAUSE</span>
                </div>
              </div>
            </div>
          )}

          {scene === 'paused' && (
            <div className="overlay">
              <div className="modal-card pause-modal">
                <div className="modal-kicker-pill">⏸ GAME PAUSED</div>
                <h2 className="modal-title">Take a breath</h2>
                <p className="modal-copy">Your adventure is right where you left it.</p>
                <div className="modal-actions-stack">
                  <button className="primary-button" onClick={() => setScene('playing')}>
                    ▶ Keep Going
                  </button>
                  <div className="modal-actions-row">
                    <button className="secondary-button" onClick={() => setShowShareModal(true)}>
                      🔗 Share Link
                    </button>
                    <button className="secondary-button" onClick={() => setShowCustomize(true)}>
                      🎨 Customize
                    </button>
                    <button className="secondary-button" onClick={() => setScene('title')}>
                      🏠 Title Screen
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {scene === 'complete' && (
            <div className="overlay">
              <div className="modal-card complete-modal">
                <div className="modal-kicker-pill success">CHAPTER {level} CLEARED</div>
                <h2 className="modal-title">Level Complete!</h2>
                <div className="portrait-card mini" style={{ margin: '12px auto' }}>
                  <img src={charConfig.collectibleImage} alt={charConfig.collectibleName} />
                  <span className="card-badge">{charConfig.collectibleName.toUpperCase()}</span>
                </div>
                <p className="modal-copy">You found {novaCount} {charConfig.collectibleName} {novaCount === 1 ? 'character' : 'characters'} on the way. The path keeps going.</p>
                <div className="modal-actions-stack">
                  <button className="primary-button" onClick={advance}>
                    Enter {levelNames[level]} <span aria-hidden="true">→</span>
                  </button>
                  <button className="secondary-button" onClick={() => setShowCustomize(true)}>
                    🎨 Customize Characters
                  </button>
                </div>
                <div className="instructions"><span className="keycap">{timeLabel} ADVENTURE TIME</span></div>
              </div>
            </div>
          )}

          {scene === 'gameover' && (
            <div className="overlay">
              <div className="modal-card gameover-modal">
                <div className="modal-kicker-pill danger">THE FIRE PREVAILED</div>
                <h2 className="modal-title">One More Try?</h2>
                <div className="portrait-card hero mini" style={{ margin: '12px auto' }}>
                  <img src={charConfig.heroImage} alt={charConfig.heroName} />
                  <span className="card-badge">{charConfig.heroName.toUpperCase()}</span>
                </div>
                <p className="modal-copy">Every brave run teaches you the way. {charConfig.collectibleName} is still out there.</p>
                <div className="modal-actions-stack">
                  <button className="primary-button" onClick={retry}>
                    ↺ Retry Adventure
                  </button>
                  <button className="secondary-button" onClick={() => setScene('title')}>
                    🏠 Title Screen
                  </button>
                </div>
              </div>
            </div>
          )}

          {scene === 'victory' && (
            <div className="overlay">
              <div className="modal-card victory-modal">
                <div className="modal-kicker-pill success">★ ALL THREE WORLDS CLEARED ★</div>
                <h2 className="modal-title">Together Again!</h2>
                <div className="portrait-row victory">
                  <div className="portrait-card hero">
                    <img src={charConfig.heroImage} alt={charConfig.heroName} />
                    <span className="card-badge">{charConfig.heroName.toUpperCase()}</span>
                  </div>
                  <span className="heart-link">♥</span>
                  <div className="portrait-card">
                    <img src={charConfig.collectibleImage} alt={charConfig.collectibleName} />
                    <span className="card-badge">{charConfig.collectibleName.toUpperCase()}</span>
                  </div>
                </div>
                <p className="modal-copy">You crossed every flame and found {novaCount} {charConfig.collectibleName} characters. The best part of every adventure is who waits at the end.</p>
                <div className="modal-actions-stack">
                  <button className="primary-button" onClick={retry}>
                    ↺ Play Again
                  </button>
                  <div className="modal-actions-row">
                    <button className="secondary-button" onClick={() => setShowShareModal(true)}>
                      🔗 Share Link
                    </button>
                    <button className="secondary-button" onClick={() => setShowCustomize(true)}>
                      🎨 Character Studio
                    </button>
                  </div>
                </div>
                <div className="instructions"><span className="keycap">FINAL TIME {timeLabel}</span></div>
              </div>
            </div>
          )}
        </div>
      </section>
      <footer className="bottom-bar">
        <div className="bottom-note"><span className="pixel-dot" /> {isGame ? levelNames[level - 1] : 'Three worlds. One reason to keep going.'}</div>
        <div className="bottom-note"><span className="keycap">ESC</span> {scene === 'playing' ? 'pause' : 'a story made for ' + charConfig.collectibleName}</div>
      </footer>

      {showCustomize && (
        <CustomizeModal
          config={charConfig}
          onSave={handleSaveConfig}
          onShare={(newConfig) => {
            handleSaveConfig(newConfig);
            setShowCustomize(false);
            setShowShareModal(true);
          }}
          onClose={() => setShowCustomize(false)}
        />
      )}

      {showShareModal && (
        <ShareModal
          config={charConfig}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {sharedWelcome && (
        <SharedWelcomeModal
          config={sharedWelcome}
          onPlay={() => {
            setSharedWelcome(null);
            begin();
          }}
          onCustomize={() => {
            setSharedWelcome(null);
            setShowCustomize(true);
          }}
          onClose={() => setSharedWelcome(null)}
        />
      )}
    </main>
  );
}

export default App;
