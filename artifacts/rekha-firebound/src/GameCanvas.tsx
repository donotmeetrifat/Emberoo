import { useEffect, useRef } from 'react';

type GameCanvasProps = {
  level: number;
  active: boolean;
  onCollect: () => void;
  onDeath: () => void;
  onCheckpoint: () => void;
  onGoal: () => void;
  onProgress: (progress: number) => void;
  onJump: () => void;
};

type Platform = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind?: string;
  baseX?: number;
  amplitude?: number;
  phase?: number;
  deltaX?: number;
};
type Hazard = { x: number; y: number; w: number; h: number; type: 'flame' | 'pillar' | 'pit' | 'ball'; phase: number };
type Pickup = { x: number; y: number; taken: boolean; phase: number };

const LEVELS = [
  { name: 'Sunny Grasslands', sky: '#91d9d0', far: '#6fb7a4', near: '#48976e', ground: '#4c9b54', accent: '#e9c95f', length: 3300, difficulty: 1 },
  { name: 'Copper Dune Run', sky: '#f4bd83', far: '#d98b62', near: '#b97050', ground: '#a46a43', accent: '#f2d17c', length: 3700, difficulty: 1.35 },
  { name: 'Emberpeak Pass', sky: '#8f5761', far: '#663f52', near: '#493548', ground: '#493e3b', accent: '#f0a44e', length: 4100, difficulty: 1.7 },
];

function buildLevel(level: number) {
  const config = LEVELS[level - 1];
  const platforms: Platform[] = [];
  const hazards: Hazard[] = [];
  const pickups: Pickup[] = [];
  const gaps = level === 1 ? [880, 1640, 2470] : level === 2 ? [700, 1460, 2240, 3040] : [620, 1320, 2040, 2800, 3500];
  let cursor = 0;
  gaps.forEach((gap) => {
    if (gap > cursor) platforms.push({ x: cursor, y: 432, w: gap - cursor, h: 130, kind: 'ground' });
    cursor = gap + (level === 1 ? 118 : 142);
  });
  platforms.push({ x: cursor, y: 432, w: config.length - cursor + 300, h: 130, kind: 'ground' });
  if (level === 2) {
    gaps.forEach((gap, i) => {
      const x = gap + 20;
      platforms.push({
        x,
        baseX: x,
        y: i % 2 === 0 ? 352 : 326,
        w: 100,
        h: 18,
        kind: 'moving',
        amplitude: 16,
        phase: i * 1.4,
        deltaX: 0,
      });
    });
  }
  const spacing = level === 1 ? 520 : 455;
  for (let i = 0; i < 6; i++) {
    const x = 370 + i * spacing;
    platforms.push({ x, y: 330 - (i % 2) * 35, w: 125, h: 22, kind: 'brick' });
    platforms.push({ x: x + 195, y: 375, w: 94, h: 57, kind: 'pipe' });
    pickups.push({ x: x + 48, y: 279 - (i % 2) * 35, taken: false, phase: i * 1.7 });
    pickups.push({ x: x + 82, y: 278 - (i % 2) * 35, taken: false, phase: i * 1.7 + 1 });
    if (i > 0) pickups.push({ x: x - 95, y: 376, taken: false, phase: i * 2 });
  }
  pickups.push({ x: 1150, y: 324, taken: false, phase: 1 });
  pickups.push({ x: 2220, y: 290, taken: false, phase: 2 });
  const hazardCount = level === 1 ? 8 : 12;
  for (let i = 0; i < hazardCount; i++) {
    const x = 550 + i * ((config.length - 850) / hazardCount);
    if (gaps.some((gap) => x > gap - 40 && x < gap + 190)) continue;
    const type = level === 3 && i % 3 === 1 ? 'pillar' : level > 1 && i % 4 === 2 ? 'ball' : 'flame';
    hazards.push({ x, y: type === 'pillar' ? 432 : type === 'ball' ? 404 : 410, w: type === 'pillar' ? 38 : 36, h: type === 'pillar' ? 108 : 24, type, phase: i * 1.3 });
  }
  gaps.forEach((gap, i) => {
    hazards.push({ x: gap - 12, y: 432, w: level === 3 ? 166 : 142, h: 100, type: 'pit', phase: i });
    if (level > 1) pickups.push({ x: gap + 48, y: 355, taken: false, phase: i });
  });
  return { platforms, hazards, pickups, length: config.length };
}

export default function GameCanvas({ level, active, onCollect, onDeath, onCheckpoint, onGoal, onProgress, onJump }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callbacks = useRef({ onCollect, onDeath, onCheckpoint, onGoal, onProgress, onJump });
  callbacks.current = { onCollect, onDeath, onCheckpoint, onGoal, onProgress, onJump };
  const activeRef = useRef(active);
  activeRef.current = active;
  const levelRef = useRef(level);
  levelRef.current = level;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = 960;
    canvas.height = 540;
    const hero = new Image();
    hero.src = '/assets/hero.png';
    let heroReady = false;
    const keyed = document.createElement('canvas');
    const keyedCtx = keyed.getContext('2d', { willReadFrequently: true });
    hero.onload = () => {
      keyed.width = hero.width;
      keyed.height = hero.height;
      keyedCtx?.drawImage(hero, 0, 0);
      if (keyedCtx) {
        const imageData = keyedCtx.getImageData(0, 0, keyed.width, keyed.height);
        const p = imageData.data;
        for (let i = 0; i < p.length; i += 4) {
          const max = Math.max(p[i], p[i + 1], p[i + 2]);
          if (max < 36) p[i + 3] = 0;
          else if (max < 78 && p[i] < 55 && p[i + 1] < 55 && p[i + 2] < 55) p[i + 3] = Math.round(p[i + 3] * (max - 36) / 42);
        }
        keyedCtx.putImageData(imageData, 0, 0);
      }
      heroReady = true;
    };
    const rekha = new Image();
    rekha.src = '/assets/collectible.png';
    let rekhaReady = false;
    rekha.onload = () => { rekhaReady = true; };

    const input = { left: false, right: false, jump: false };
    const game = {
      x: 78, y: 350, vx: 0, vy: 0, w: 54, h: 74, facing: 1, grounded: false,
      camera: 0, frame: 0, lastJump: false, checkpoint: 78, lastCheckpoint: 78,
      invulnerable: 0, flash: 0, label: '' as string, labelUntil: 0, goalSent: false,
      level, data: buildLevel(level),
    };
    let raf = 0;
    let last = 0;
    const keys = (event: KeyboardEvent, down: boolean) => {
      const k = event.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'arrowup', ' '].includes(k)) event.preventDefault();
      if (k === 'arrowleft' || k === 'a') input.left = down;
      if (k === 'arrowright' || k === 'd') input.right = down;
      if (k === 'arrowup' || k === 'w' || k === ' ') input.jump = down;
    };
    const keyDown = (e: KeyboardEvent) => keys(e, true);
    const keyUp = (e: KeyboardEvent) => keys(e, false);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);

    const draw = (now: number) => {
      const dt = Math.min((now - (last || now)) / 16.67, 2);
      last = now;
      game.frame += dt;
      const cfg = LEVELS[level - 1];
      ctx.clearRect(0, 0, 960, 540);
      if (game.level !== levelRef.current) {
        game.level = levelRef.current;
        game.data = buildLevel(game.level);
        game.x = 78; game.y = 350; game.vx = 0; game.vy = 0; game.camera = 0;
        game.checkpoint = 78; game.lastCheckpoint = 78; game.goalSent = false;
      }
      if (activeRef.current) {
        for (const p of game.data.platforms) {
          if (p.kind !== 'moving') continue;
          const wasStanding = game.grounded &&
            Math.abs(game.y + game.h - p.y) < 2 &&
            game.x + game.w * .72 > p.x &&
            game.x + game.w * .28 < p.x + p.w;
          const previousX = p.x;
          p.x = (p.baseX ?? p.x) + Math.sin(game.frame * .035 + (p.phase ?? 0)) * (p.amplitude ?? 0);
          p.deltaX = p.x - previousX;
          if (wasStanding) game.x += p.deltaX;
        }
        for (const h of game.data.hazards) {
          if (h.type !== 'ball' || Math.abs(game.x - h.x) > 620) continue;
          const direction = Math.sign(game.x + game.w / 2 - (h.x + h.w / 2));
          h.x += direction * .2 * dt;
        }
        const dir = Number(input.right) - Number(input.left);
        game.vx += dir * 0.58 * dt;
        if (!dir) game.vx *= Math.pow(0.82, dt);
        game.vx = Math.max(-4.5, Math.min(4.5, game.vx));
        if (Math.abs(game.vx) < .08) game.vx = 0;
        if (dir) game.facing = dir;
        const jumped = input.jump && !game.lastJump && game.grounded;
        if (jumped) {
          game.vy = -11.2;
          game.grounded = false;
          callbacks.current.onJump();
          game.label = 'Aag'; game.labelUntil = game.frame + 60;
        }
        game.lastJump = input.jump;
        if (input.jump && game.vy < -3) game.vy -= .19 * dt;
        game.vy = Math.min(12, game.vy + .48 * dt);
        game.x += game.vx * dt;
        const prevY = game.y;
        game.y += game.vy * dt;
        game.grounded = false;
        for (const p of game.data.platforms) {
          const horizontal = game.x + game.w * .72 > p.x && game.x + game.w * .28 < p.x + p.w;
          if (horizontal && game.vy >= 0 && prevY + game.h <= p.y + 7 && game.y + game.h >= p.y) {
            game.y = p.y - game.h;
            game.vy = 0;
            game.grounded = true;
          }
        }
        game.x = Math.max(0, Math.min(game.data.length - 30, game.x));
        if (game.y > 560) {
          game.y = 0; game.vy = 0; game.x = game.checkpoint; game.invulnerable = 100; callbacks.current.onDeath();
        }
        if (game.invulnerable > 0) game.invulnerable -= dt;
        for (const h of game.data.hazards) {
          const bob = Math.sin(game.frame * .07 + h.phase);
          const hx = h.x;
          const hy = h.type === 'pillar' ? h.y - (35 + bob * 25) : h.y + (h.type === 'flame' ? bob * 3 : 0);
          const hitTop = h.type === 'pit' ? h.y + 2 : h.type === 'pillar' ? hy : h.type === 'ball' ? h.y - 18 : hy - 24;
          const hitBottom = h.type === 'pillar' ? h.y : h.type === 'pit' ? h.y + 18 : h.type === 'ball' ? h.y + 18 : hy + 5;
          if (game.invulnerable <= 0 && game.x + game.w * .75 > hx && game.x + game.w * .25 < hx + h.w && game.y + game.h > hitTop && game.y + 12 < hitBottom) {
            game.x = game.checkpoint; game.y = 350; game.vx = 0; game.vy = 0; game.invulnerable = 110; callbacks.current.onDeath();
            break;
          }
        }
        for (const p of game.data.pickups) {
          if (!p.taken && Math.abs(game.x + game.w / 2 - p.x) < 38 && Math.abs(game.y + game.h / 2 - (p.y + Math.sin(game.frame * .05 + p.phase) * 7)) < 52) {
            p.taken = true; callbacks.current.onCollect(); game.label = 'Rekha'; game.labelUntil = game.frame + 60;
          }
        }
        if (game.x > game.checkpoint && game.checkpoint < game.data.length / 2 && game.x > game.data.length * .48) {
          game.checkpoint = game.x; callbacks.current.onCheckpoint();
        }
        if (game.x > game.data.length - 150 && !game.goalSent) {
          game.goalSent = true; callbacks.current.onGoal();
        }
        game.camera += (Math.max(0, game.x - 310) - game.camera) * .085;
        if (Math.floor(game.frame) % 8 === 0) callbacks.current.onProgress(Math.min(100, game.x / game.data.length * 100));
      }

      // Layered pixel-sky with a warm sun and parallax ridges.
      ctx.fillStyle = cfg.sky; ctx.fillRect(0, 0, 960, 540);
      ctx.fillStyle = '#fff0bb'; ctx.beginPath(); ctx.arc(790 - game.camera * .05, 105, 43, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = cfg.far;
      for (let i = 0; i < 7; i++) {
        const x = ((i * 190 - game.camera * .16) % 1320 + 1320) % 1320 - 160;
        ctx.beginPath(); ctx.moveTo(x, 432); ctx.lineTo(x + 100, 258 + (i % 3) * 18); ctx.lineTo(x + 225, 432); ctx.fill();
      }
      ctx.fillStyle = cfg.near;
      for (let i = 0; i < 10; i++) {
        const x = ((i * 145 - game.camera * .32) % 1450 + 1450) % 1450 - 150;
        ctx.beginPath(); ctx.moveTo(x, 432); ctx.lineTo(x + 90, 328 + (i % 2) * 22); ctx.lineTo(x + 180, 432); ctx.fill();
      }
      ctx.save(); ctx.translate(-game.camera, 0);
      // Ground/platforms and themed brickwork.
      for (const p of game.data.platforms) {
        if (p.x + p.w < game.camera - 100 || p.x > game.camera + 1100) continue;
        if (p.kind === 'ground') {
          ctx.fillStyle = cfg.ground; ctx.fillRect(p.x, p.y, p.w, p.h);
          ctx.fillStyle = cfg.accent; ctx.fillRect(p.x, p.y, p.w, 10);
          ctx.fillStyle = '#283b3655';
          for (let bx = p.x + 18; bx < p.x + p.w; bx += 54) ctx.fillRect(bx, p.y + 31 + (Math.floor(bx / 54) % 2) * 22, 21, 5);
          if (level === 1) {
            ctx.fillStyle = '#357b47'; for (let bx = p.x + 30; bx < p.x + p.w; bx += 94) { ctx.fillRect(bx, p.y - 5, 3, 6); ctx.fillRect(bx + 6, p.y - 3, 3, 4); }
          }
        } else if (p.kind === 'brick') {
          ctx.fillStyle = '#bd6d49'; ctx.fillRect(p.x, p.y, p.w, p.h);
          ctx.strokeStyle = '#814b42'; ctx.lineWidth = 3; ctx.strokeRect(p.x + 1.5, p.y + 1.5, p.w - 3, p.h - 3);
          ctx.beginPath(); ctx.moveTo(p.x, p.y + 11); ctx.lineTo(p.x + p.w, p.y + 11); ctx.moveTo(p.x + 40, p.y); ctx.lineTo(p.x + 40, p.y + 11); ctx.moveTo(p.x + 81, p.y + 11); ctx.lineTo(p.x + 81, p.y + 22); ctx.stroke();
        } else if (p.kind === 'moving') {
          ctx.fillStyle = '#d89555'; ctx.fillRect(p.x, p.y, p.w, p.h);
          ctx.fillStyle = '#ffe29a'; ctx.fillRect(p.x + 4, p.y + 3, p.w - 8, 4);
          ctx.fillStyle = '#7a5549'; ctx.fillRect(p.x + 10, p.y + p.h - 3, p.w - 20, 4);
        } else {
          ctx.fillStyle = '#4a9e70'; ctx.fillRect(p.x, p.y, p.w, p.h);
          ctx.fillStyle = '#82c978'; ctx.fillRect(p.x - 6, p.y, p.w + 12, 10);
          ctx.fillStyle = '#357655'; ctx.fillRect(p.x + 9, p.y + 13, p.w - 18, 7);
        }
      }
      // Checkpoint and finish pennant.
      const flag = (x: number, final = false) => {
        ctx.fillStyle = '#f2ead0'; ctx.fillRect(x, 325, 5, 108);
        ctx.fillStyle = final ? '#f06b3e' : '#f0cf68';
        ctx.beginPath(); ctx.moveTo(x + 5, 329); ctx.lineTo(x + 48, 342); ctx.lineTo(x + 5, 357); ctx.fill();
        ctx.fillStyle = '#33405a'; ctx.fillRect(x - 5, 430, 16, 5);
      };
      flag(game.data.length * .5); flag(game.data.length - 116, true);
      for (const h of game.data.hazards) {
        if (h.x < game.camera - 100 || h.x > game.camera + 1100) continue;
        const b = Math.sin(game.frame * .18 + h.phase);
        ctx.save();
        ctx.shadowColor = '#ff702b';
        ctx.shadowBlur = h.type === 'pit' ? 18 : 13;
        if (h.type === 'pit') {
          ctx.fillStyle = '#342c36'; ctx.fillRect(h.x, h.y, h.w, 92);
          ctx.fillStyle = '#ef5b2e'; ctx.fillRect(h.x + 7, h.y + 8, h.w - 14, 11 + b * 3);
          for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#ffd65e' : '#f76b28'; ctx.fillRect(h.x + 12 + i * (h.w - 28) / 5, h.y + 3 + Math.sin(game.frame * .22 + i) * 6, 8, 10); }
        } else if (h.type === 'pillar') {
          const rise = 34 + (Math.sin(game.frame * .035 + h.phase) + 1) * 35;
          ctx.fillStyle = '#a62e2a'; ctx.fillRect(h.x, h.y - rise, h.w, rise);
          ctx.fillStyle = '#ff6a32'; ctx.fillRect(h.x + 6, h.y - rise + 8, h.w - 12, rise);
          ctx.fillStyle = '#ffe779'; ctx.fillRect(h.x + 13, h.y - rise + 5, 12, rise);
        } else if (h.type === 'ball') {
          const bx = h.x;
          ctx.fillStyle = '#be3e25'; ctx.beginPath(); ctx.arc(bx + 16, h.y, 18, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ffbd46'; ctx.beginPath(); ctx.arc(bx + 15, h.y - 2, 10, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff1a1'; ctx.fillRect(bx + 11, h.y - 7, 7, 4);
        } else {
          ctx.fillStyle = '#c43f2a'; ctx.fillRect(h.x + 4, h.y - 8 + b * 2, 28, 17);
          ctx.fillStyle = '#ff9b30'; ctx.beginPath(); ctx.moveTo(h.x + 4, h.y); ctx.quadraticCurveTo(h.x + 12, h.y - 31 - b * 5, h.x + 20, h.y); ctx.quadraticCurveTo(h.x + 29, h.y - 26 + b * 4, h.x + 33, h.y); ctx.fill();
          ctx.fillStyle = '#ffe98a'; ctx.fillRect(h.x + 14, h.y - 10 - b * 4, 6, 9);
        }
        if (h.type !== 'ball') {
          const particleX = h.type === 'pit' ? h.x + 8 : h.x + 8;
          const particleY = h.type === 'pit' ? h.y - 4 : h.y - 18;
          for (let i = 0; i < 3; i++) {
            const drift = Math.sin(game.frame * .13 + h.phase + i * 2.2);
            ctx.fillStyle = i === 1 ? '#ffe779' : '#ff8a31';
            ctx.fillRect(particleX + i * 13 + drift * 5, particleY - Math.abs(drift) * 10, 3 + (i % 2), 3 + (i % 2));
          }
        }
        ctx.restore();
      }
      // Portrait keeps original transparency; bobbing sparkle flecks.
      for (const p of game.data.pickups) {
        if (p.taken || p.x < game.camera - 80 || p.x > game.camera + 1050) continue;
        const py = p.y + Math.sin(game.frame * .05 + p.phase) * 7;
        ctx.fillStyle = '#fff4a8'; ctx.fillRect(p.x - 20, py - 17, 4, 4); ctx.fillRect(p.x + 19, py + 10, 3, 3);
        ctx.fillStyle = '#e4a34f'; ctx.beginPath(); ctx.ellipse(p.x, py + 17, 18, 4, 0, 0, Math.PI * 2); ctx.fill();
        if (rekhaReady) ctx.drawImage(rekha, p.x - 15, py - 28, 30, 45);
      }
      // Player with a gentle squash/stretch run cycle.
      const running = Math.abs(game.vx) > .5 && game.grounded;
      const squash = running ? 1 + Math.sin(game.frame * .5) * .045 : game.grounded ? 1 : .96;
      if (game.invulnerable <= 0 || Math.floor(game.frame / 5) % 2 === 0) {
        ctx.save();
        ctx.translate(game.x + game.w / 2, game.y + game.h);
        if (game.facing < 0) ctx.scale(-1, 1);
        if (heroReady) {
          ctx.scale(1 / squash, squash);
          ctx.drawImage(keyed, -game.w * .43, -game.h, game.w * .86, game.h);
        } else {
          ctx.fillStyle = '#29334c'; ctx.fillRect(-19, -62, 38, 62);
          ctx.fillStyle = '#f4bd83'; ctx.fillRect(-13, -71, 26, 28);
        }
        ctx.restore();
      }
      if (game.label && game.frame < game.labelUntil) {
        ctx.globalAlpha = Math.min(1, (game.labelUntil - game.frame) / 10);
        ctx.fillStyle = '#fff7c6'; ctx.strokeStyle = '#bb5435'; ctx.lineWidth = 4;
        ctx.font = 'bold 20px "Space Grotesk", sans-serif'; ctx.textAlign = 'center';
        const text = game.label;
        ctx.strokeText(text, game.x + game.w / 2, game.y - 14 - (60 - (game.labelUntil - game.frame)) * .45);
        ctx.fillText(text, game.x + game.w / 2, game.y - 14 - (60 - (game.labelUntil - game.frame)) * .45);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      if (activeRef.current) raf = requestAnimationFrame(draw);
      else raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    };
  }, [level]);

  const touch = (key: 'left' | 'right' | 'jump', down: boolean) => {
    const e = new CustomEvent('firebound-touch', { detail: { key, down } });
    window.dispatchEvent(e);
  };
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; down: boolean }>).detail;
      const map: Record<string, string> = { left: 'ArrowLeft', right: 'ArrowRight', jump: ' ' };
      window.dispatchEvent(new KeyboardEvent(detail.down ? 'keydown' : 'keyup', { key: map[detail.key] }));
    };
    window.addEventListener('firebound-touch', listener);
    return () => window.removeEventListener('firebound-touch', listener);
  }, []);

  return (
    <>
      <canvas ref={canvasRef} aria-label="Rekha Firebound platform game" />
      <div className="mobile-controls">
        <div className="touch-cluster">
          <button className="touch-button" aria-label="Move left" onPointerDown={() => touch('left', true)} onPointerUp={() => touch('left', false)} onPointerLeave={() => touch('left', false)}>←</button>
          <button className="touch-button" aria-label="Move right" onPointerDown={() => touch('right', true)} onPointerUp={() => touch('right', false)} onPointerLeave={() => touch('right', false)}>→</button>
        </div>
        <button className="touch-button jump" aria-label="Jump" onPointerDown={() => touch('jump', true)} onPointerUp={() => touch('jump', false)} onPointerLeave={() => touch('jump', false)}>JUMP</button>
      </div>
    </>
  );
}
