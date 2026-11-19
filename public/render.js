// Original canvas rendering for all five overlay variants. Dependency-free:
// the browser overlay imports this module, and Node tests import it with a
// stub context. No external assets, no images, no randomness at draw time —
// every motion is a deterministic function of (slot, time), and every
// particle is pooled (fixed arrays, no per-frame allocation), so the scene
// cannot leak memory no matter how long it runs.
//
// Story: each theme tells a small arc visually. The sky, light, and ambient
// life evolve ONLY with the shared like-meter stage (0-6) and with follow
// arrivals (persistent spots). Between events the scene idles gently so it
// always feels alive. Nothing here counts down, threatens loss, or teases
// prizes; the only "progress" is the shared, visible scene.
//
// Reduced motion: when view.reducedMotion is true (control-panel toggle or
// the OS prefers-reduced-motion setting), the scene keeps every name, the
// meter, and the disclosures fully readable but moves gently: fewer
// particles, no drift, no shooting star, fade-only entrances.

export const CANVAS_W = 1080;
export const CANVAS_H = 1920;
export const CAMERA_WINDOW = { x: 70, y: 70, w: 940, h: 540, r: 36 };
const PLAY_TOP = 720;
const PLAY_BOTTOM = 1580;
const GRID_COLS = 6;
const GRID_ROWS = 8;

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
export function easeOutCubic(t) {
  const u = clamp(t, 0, 1);
  return 1 - (1 - u) ** 3;
}
export function easeInOut(t) {
  const u = clamp(t, 0, 1);
  return u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2;
}
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export function mixHex(a, b, t) {
  const ca = hexRgb(a);
  const cb = hexRgb(b);
  const c = ca.map((v, i) => Math.round(lerp(v, cb[i], t)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

function star(ctx, x, y, r, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI * i) / points - Math.PI / 2;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function glowDot(ctx, x, y, r, color, alpha) {
  // Respect the incoming alpha so callers can fade a whole figure.
  const base = ctx.globalAlpha;
  ctx.fillStyle = color;
  ctx.globalAlpha = base * alpha * 0.18;
  circle(ctx, x, y, r * 2.6); ctx.fill();
  ctx.globalAlpha = base * alpha * 0.35;
  circle(ctx, x, y, r * 1.6); ctx.fill();
  ctx.globalAlpha = base * alpha;
  circle(ctx, x, y, r); ctx.fill();
  ctx.globalAlpha = base;
}

// Gradient cache: quantized by theme + blend step so frames reuse gradients.
const gradientCache = new Map();
function skyGradient(ctx, theme, blend, w, h) {
  const step = Math.round(blend * 20) / 20;
  const key = `${theme.id}:${step}`;
  let g = gradientCache.get(key);
  if (!g) {
    g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, mixHex(theme.palette.skyTop, theme.palette.skyTopLate, step));
    g.addColorStop(0.62, mixHex(theme.palette.skyBottom, theme.palette.skyBottomLate, step));
    g.addColorStop(1, mixHex(theme.palette.waterTop, theme.palette.skyBottomLate, step));
    if (gradientCache.size > 120) gradientCache.clear();
    gradientCache.set(key, g);
  }
  return g;
}

/** Pooled ambient particles. Positions are pure functions of time. */
export function createParticles(themeId, count = 96) {
  const rand = mulberry32(hashStr(`particles:${themeId}`));
  const out = [];
  for (let i = 0; i < count; i += 1) {
    out.push({
      x: rand(), y: rand(), size: 1.5 + rand() * 3.5,
      speed: 0.2 + rand() * 0.8, phase: rand() * Math.PI * 2,
      drift: (rand() - 0.5) * 40,
    });
  }
  return out;
}

export function spotPosition(slot, timeMs, themeId, motionScale = 1) {
  const col = slot % GRID_COLS;
  const row = Math.floor(slot / GRID_COLS) % GRID_ROWS;
  const cellW = CANVAS_W / GRID_COLS;
  const cellH = (PLAY_BOTTOM - PLAY_TOP) / GRID_ROWS;
  const rand = mulberry32(hashStr(`slot:${themeId}:${slot}`));
  const jx = (rand() - 0.5) * cellW * 0.3;
  const jy = (rand() - 0.5) * cellH * 0.3;
  const x = col * cellW + cellW / 2 + jx;
  const y = PLAY_TOP + row * cellH + cellH / 2 + jy;
  // Gentle idle motion: slow bob, different phase per slot. motionScale
  // shrinks it for reduced motion (0 = perfectly still).
  const bob = Math.sin(timeMs / 1400 + slot * 1.7) * 5 * motionScale;
  const sway = Math.sin(timeMs / 2100 + slot * 0.9) * 4 * motionScale;
  return { x: x + sway, y: y + bob, bob, seed: rand() };
}

/**
 * Motion profile for a frame. Full motion is the default; reduced motion
 * keeps the scene readable and calm: a third of the particles, quarter
 * idle movement, no drifting layers, no shooting star, and entrances that
 * fade in place instead of rising with a ring.
 */
export function motionProfile(reducedMotion) {
  if (reducedMotion) {
    return {
      particleFraction: 0.35, bobScale: 0.25, driftScale: 0,
      shootingStar: false, entranceRise: 0, entranceRing: false,
      waveScale: 0,
    };
  }
  return {
    particleFraction: 1, bobScale: 1, driftScale: 1,
    shootingStar: true, entranceRise: 26, entranceRing: true,
    waveScale: 1,
  };
}

function ridge(ctx, baseY, amplitude, step, driftPx, color, alpha, seedPhase) {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(-140, baseY + 40);
  for (let x = -140; x <= CANVAS_W + 140; x += step) {
    const px = x - driftPx;
    const peak = baseY + Math.sin((x / step + seedPhase) * 1.3) * amplitude
      + Math.sin((x / step + seedPhase) * 2.7) * amplitude * 0.35;
    ctx.lineTo(px, peak);
  }
  ctx.lineTo(CANVAS_W + 140, CANVAS_H);
  ctx.lineTo(-140, CANVAS_H);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawBackground(ctx, theme, blend, timeMs, stage, motion) {
  const { palette } = theme;
  const farHill = palette.farHill || palette.hill;
  const midHill = palette.midHill || palette.hill;
  const wt = timeMs * motion.waveScale; // frozen when reduced motion
  ctx.fillStyle = skyGradient(ctx, theme, blend, CANVAS_W, CANVAS_H);
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Celestial body with a soft glow; it rises slightly as the story advances.
  const cx = CANVAS_W * 0.78;
  const cy = lerp(300, 210, blend);
  const cr = lerp(54, 72, blend);
  glowDot(ctx, cx, cy, cr, palette.sun, 0.55 + blend * 0.3);
  ctx.fillStyle = palette.sun;
  circle(ctx, cx, cy, cr * 0.62); ctx.fill();

  // Slow light rays from the celestial body, strengthening with the stage.
  // Static angles, gentle alpha: calm, never flashing.
  ctx.fillStyle = palette.sun;
  ctx.globalAlpha = 0.05 + blend * 0.06;
  for (let i = 0; i < 3; i += 1) {
    const a = 0.5 + i * 0.45;
    const spread = 0.12 + i * 0.03;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a - spread) * 900, cy + Math.sin(a - spread) * 900);
    ctx.lineTo(cx + Math.cos(a + spread) * 900, cy + Math.sin(a + spread) * 900);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Three parallax depth layers, each drifting slower the farther it is.
  const driftFar = ((timeMs / 160000) % 1) * 120 * motion.driftScale;
  const driftMid = ((timeMs / 90000) % 1) * 120 * motion.driftScale;
  ridge(ctx, 1060, 46, 150, driftFar, farHill, 0.5, 1);
  ridge(ctx, 1130, 40, 120, driftMid, midHill, 0.62, 2);
  ridge(ctx, 1200, 30, 100, driftMid * 1.6, palette.hill, 0.8, 3);

  // Per-theme sky life, above the ridges.
  if (theme.id === 'firefly-garden') {
    // Distant tree line: soft round canopies along the horizon.
    ctx.fillStyle = palette.foreground || palette.hill;
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 9; i += 1) {
      const tx = 60 + i * 120;
      const tr = 34 + ((i * 37) % 22);
      circle(ctx, tx, 1095, tr); ctx.fill();
      ctx.fillRect(tx - 5, 1095, 10, 40);
    }
    ctx.globalAlpha = 1;
  }
  if (theme.id === 'starlight-observatory' && stage >= 3) {
    // Milky-way band: a diagonal wash of tiny deterministic stars.
    const rand = mulberry32(4242);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 70; i += 1) {
      const bx = rand() * CANVAS_W;
      const bandY = 700 + (bx / CANVAS_W) * 260 + (rand() - 0.5) * 130;
      ctx.globalAlpha = 0.12 + rand() * 0.3 * (0.4 + blend * 0.6);
      circle(ctx, bx, bandY, 1 + rand() * 1.8); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (theme.id === 'balloon-sky') {
    // Two drifting cloud banks at different speeds and heights.
    for (let layer = 0; layer < 2; layer += 1) {
      const speed = layer === 0 ? 240000 : 140000;
      const off = ((timeMs / speed) % 1) * 420 * motion.driftScale;
      const baseY = layer === 0 ? 690 : 830;
      ctx.fillStyle = palette.cloud || '#ffffff';
      ctx.globalAlpha = layer === 0 ? 0.5 : 0.75;
      for (let i = -1; i < 4; i += 1) {
        const bx = i * 420 + layer * 190 - off;
        const s = layer === 0 ? 0.7 : 1;
        circle(ctx, bx - 34 * s, baseY, 26 * s); ctx.fill();
        circle(ctx, bx, baseY - 14 * s, 34 * s); ctx.fill();
        circle(ctx, bx + 36 * s, baseY, 26 * s); ctx.fill();
        ctx.fillRect(bx - 60 * s, baseY - 2, 120 * s, 22 * s);
      }
      ctx.globalAlpha = 1;
    }
    // Distant birds join once the wind picks up.
    if (stage >= 4) {
      const birdOff = ((timeMs / 120000) % 1) * (CANVAS_W + 200) * motion.driftScale;
      ctx.strokeStyle = 'rgba(40,60,80,0.6)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i += 1) {
        const bx = 900 - birdOff + i * 70;
        const by = 720 + i * 26 + Math.sin(wt / 900 + i) * 6 * motion.waveScale;
        ctx.beginPath();
        ctx.moveTo(bx - 12, by);
        ctx.quadraticCurveTo(bx - 4, by - 7, bx, by);
        ctx.quadraticCurveTo(bx + 4, by - 7, bx + 12, by);
        ctx.stroke();
      }
    }
  }
  if (theme.id === 'cozy-corner-cafe') {
    // String lights under the camera window: warm dots on a gentle curve.
    ctx.strokeStyle = 'rgba(20,12,6,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, 624);
    ctx.quadraticCurveTo(CANVAS_W / 2, 668, CANVAS_W - 60, 624);
    ctx.stroke();
    for (let i = 0; i <= 10; i += 1) {
      const t = i / 10;
      const lx = lerp(60, CANVAS_W - 60, t);
      const ly = 624 + Math.sin(t * Math.PI) * 22;
      glowDot(ctx, lx, ly + 10, 5, palette.glow || palette.sun, 0.35 + blend * 0.45);
    }
  }

  // Aurora ribbons for the observatory; brighter with the meter stage.
  if (theme.id === 'starlight-observatory' && stage >= 2) {
    ctx.globalAlpha = 0.1 + stage * 0.05;
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = ['#7ef0c8', '#9be7ff', '#c9a7ff'][i];
      ctx.beginPath();
      const baseY = 760 + i * 60;
      ctx.moveTo(0, baseY);
      for (let x = 0; x <= CANVAS_W; x += 90) {
        ctx.lineTo(x, baseY + Math.sin(x / 190 + wt / 2600 + i * 2) * 26);
      }
      ctx.lineTo(CANVAS_W, baseY + 46);
      ctx.lineTo(0, baseY + 46);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawParticles(ctx, theme, particles, timeMs, stage, motion) {
  const density = clamp(0.45 + stage * 0.1, 0, 1); // more life as the story advances
  const count = Math.floor(particles.length * density * motion.particleFraction);
  const t = timeMs / 1000;
  const wt = t * (motion.waveScale === 0 ? 0 : 1);
  for (let i = 0; i < count; i += 1) {
    const p = particles[i];
    // Reduced motion: particles hold still (no drift, no fall/rise), and
    // twinkle freezes at a calm mid-brightness.
    const driftTerm = motion.driftScale === 0 ? 0 : Math.sin(t * p.speed + p.phase) * 18 + p.drift * Math.sin(t * 0.05 + p.phase);
    let x = p.x * CANVAS_W + driftTerm;
    let y = p.y * CANVAS_H;
    if (motion.driftScale !== 0) {
      if (theme.id === 'balloon-sky' || theme.id === 'sunrise-lake') {
        y = ((p.y * CANVAS_H + t * 6 * p.speed) % CANVAS_H);
      } else if (theme.id === 'cozy-corner-cafe') {
        y = ((p.y * CANVAS_H - t * 9 * p.speed) % CANVAS_H + CANVAS_H) % CANVAS_H;
        x += Math.sin(y / 60 + p.phase) * 10; // rising steam wobble
      }
    }
    const twinkle = motion.waveScale === 0 ? 0.7 : 0.5 + 0.5 * Math.sin(wt * 1.4 * p.speed + p.phase);
    if (theme.id === 'firefly-garden') {
      glowDot(ctx, x, y, p.size, '#d8f26a', 0.25 + twinkle * 0.55);
    } else if (theme.id === 'starlight-observatory') {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.3 + twinkle * 0.6;
      circle(ctx, x, y, p.size * 0.7); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (theme.id === 'cozy-corner-cafe') {
      ctx.fillStyle = '#ffe8c8';
      ctx.globalAlpha = 0.12 + twinkle * 0.16;
      circle(ctx, x, y, p.size * 2.2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (theme.id === 'balloon-sky') {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.35 + twinkle * 0.3;
      ellipse(ctx, x, y, p.size * 5, p.size * 1.8); ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#fff6d8';
      ctx.globalAlpha = 0.25 + twinkle * 0.4;
      circle(ctx, x, y, p.size); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  // Observatory shooting star: deterministic, about every 16 seconds.
  // Skipped entirely under reduced motion.
  if (theme.id === 'starlight-observatory' && motion.shootingStar) {
    const cycle = 16000;
    const local = timeMs % cycle;
    if (local < 1400) {
      const p = local / 1400;
      const x = lerp(120, 900, p);
      const y = lerp(760, 1010, p);
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.7 * (1 - p);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 120, y - 40);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function cutCameraWindow(ctx, theme) {
  const { x, y, w, h, r } = CAMERA_WINDOW;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  rr(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
  // Thin frame so the window reads deliberately, not as a hole.
  ctx.strokeStyle = theme.palette.accent;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 3;
  rr(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawGround(ctx, theme, timeMs, blend, stage, motion) {
  const { palette } = theme;
  const wt = timeMs * motion.waveScale;
  const gy = PLAY_TOP - 40;
  ctx.fillStyle = palette.waterTop;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(0, gy + 30);
  for (let x = 0; x <= CANVAS_W; x += 60) {
    ctx.lineTo(x, gy + 30 + Math.sin(x / 170 + wt / 1800) * 8);
  }
  ctx.lineTo(CANVAS_W, CANVAS_H);
  ctx.lineTo(0, CANVAS_H);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  if (theme.id === 'sunrise-lake') {
    // Sun reflection: a shimmering column of short dashes under the sun,
    // brightening as the sunrise advances.
    const cx = CANVAS_W * 0.78;
    ctx.fillStyle = palette.sun;
    for (let i = 0; i < 14; i += 1) {
      const ry = gy + 60 + i * 56;
      const wobble = Math.sin(wt / 700 + i * 1.4) * 14 * motion.waveScale;
      const w = 26 + i * 5;
      ctx.globalAlpha = (0.1 + blend * 0.22) * (1 - i / 18);
      ctx.fillRect(cx - w / 2 + wobble, ry, w, 5);
    }
    ctx.globalAlpha = 1;
    // Lily pads: still, seeded positions between the dock rows.
    ctx.fillStyle = '#3f7a3a';
    const padSpots = [[150, 900], [930, 1010], [240, 1300], [850, 1420], [520, 1120]];
    for (const [px, py] of padSpots) {
      ellipse(ctx, px, py, 26, 10); ctx.fill();
      ctx.fillStyle = '#ff9ebb';
      circle(ctx, px + 8, py - 6, 5); ctx.fill();
      ctx.fillStyle = '#3f7a3a';
    }
    // Wooden dock planks across the play area.
    ctx.fillStyle = palette.dock;
    for (let row = 0; row < GRID_ROWS; row += 1) {
      const y = PLAY_TOP + row * ((PLAY_BOTTOM - PLAY_TOP) / GRID_ROWS) + 34;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(30, y, CANVAS_W - 60, 10);
      ctx.globalAlpha = 0.35;
      ctx.fillRect(30, y + 8, CANVAS_W - 60, 2);
    }
    ctx.globalAlpha = 1;
    // Foreground reeds in the bottom corners.
    ctx.strokeStyle = palette.foreground || palette.hill;
    ctx.lineWidth = 5;
    for (const baseX of [46, 78, 1010, 1042]) {
      const h = 90 + ((baseX * 7) % 40);
      ctx.beginPath();
      ctx.moveTo(baseX, 1608);
      ctx.quadraticCurveTo(baseX + 8, 1608 - h * 0.6, baseX + 2, 1608 - h);
      ctx.stroke();
      ctx.fillStyle = '#6b4a2a';
      ellipse(ctx, baseX + 2, 1608 - h, 5, 14); ctx.fill();
    }
  }
  if (theme.id === 'firefly-garden') {
    // Soil mounds, grass tufts, and dew sparkles that appear with the stage.
    ctx.fillStyle = palette.waterBottom;
    for (let i = 0; i < 6; i += 1) {
      ellipse(ctx, 90 + i * 180, 1590, 120, 26); ctx.fill();
    }
    ctx.strokeStyle = '#5d9a52';
    ctx.lineWidth = 4;
    for (let i = 0; i < 14; i += 1) {
      const gx = 40 + ((i * 173) % 1000);
      const gy2 = 1560 + ((i * 47) % 40);
      const lean = Math.sin(wt / 2400 + i) * 4 * motion.waveScale;
      ctx.beginPath();
      ctx.moveTo(gx, gy2);
      ctx.quadraticCurveTo(gx + lean, gy2 - 18, gx + lean * 2, gy2 - 30);
      ctx.stroke();
    }
    if (stage >= 2) {
      ctx.fillStyle = '#e8ff9b';
      for (let i = 0; i < 10; i += 1) {
        const dx = 80 + ((i * 211) % 920);
        const dy = 760 + ((i * 137) % 780);
        ctx.globalAlpha = 0.25 + 0.2 * Math.sin(wt / 1500 + i * 2);
        circle(ctx, dx, dy, 3); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // Foreground flower silhouettes in the bottom corners.
    ctx.fillStyle = palette.foreground || palette.hill;
    for (const [fx, fy, fs] of [[70, 1580, 1.4], [1010, 1590, 1.2], [140, 1600, 1]]) {
      for (let i = 0; i < 5; i += 1) {
        const a = (Math.PI * 2 * i) / 5;
        circle(ctx, fx + Math.cos(a) * 16 * fs, fy + Math.sin(a) * 16 * fs, 11 * fs); ctx.fill();
      }
      circle(ctx, fx, fy, 8 * fs); ctx.fill();
    }
  }
  if (theme.id === 'starlight-observatory') {
    // Rocky ridge along the bottom + the observatory dome silhouette.
    ctx.fillStyle = palette.foreground || palette.hill;
    ctx.beginPath();
    ctx.moveTo(0, 1608);
    for (let x = 0; x <= CANVAS_W; x += 90) {
      ctx.lineTo(x, 1572 + Math.sin(x / 90 * 1.7) * 14);
    }
    ctx.lineTo(CANVAS_W, 1608);
    ctx.closePath();
    ctx.fill();
    // Dome with a lit slit, bottom-right, clear of the footer.
    ctx.fillStyle = '#1c2a52';
    ctx.beginPath();
    ctx.arc(930, 1560, 62, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(868, 1560, 124, 48);
    ctx.fillStyle = palette.glow || '#ffffff';
    ctx.globalAlpha = 0.5 + blend * 0.4;
    ctx.fillRect(924, 1508, 12, 52);
    ctx.globalAlpha = 1;
    // Telescope silhouette, bottom-left.
    ctx.strokeStyle = '#0a0f24';
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(90, 1608); ctx.lineTo(90, 1540); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(60, 1608); ctx.lineTo(90, 1560); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(120, 1608); ctx.lineTo(90, 1560); ctx.stroke();
    ctx.save();
    ctx.translate(90, 1532);
    ctx.rotate(-0.5);
    ctx.fillStyle = '#2a3a5f';
    rr(ctx, -46, -12, 92, 24, 10); ctx.fill();
    ctx.restore();
  }
  if (theme.id === 'cozy-corner-cafe') {
    // Wooden floor boards + a warm rug under the play area.
    ctx.fillStyle = palette.waterBottom;
    ctx.globalAlpha = 0.6;
    for (let y = PLAY_TOP; y < PLAY_BOTTOM; y += 54) {
      ctx.fillRect(0, y, CANVAS_W, 3);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#a34a3a';
    ctx.globalAlpha = 0.5;
    ellipse(ctx, CANVAS_W / 2, 1160, 430, 340); ctx.fill();
    ctx.fillStyle = '#c96a4a';
    ctx.globalAlpha = 0.4;
    ellipse(ctx, CANVAS_W / 2, 1160, 340, 260); ctx.fill();
    ctx.globalAlpha = 1;
    // Foreground: potted plant (right) and a stack of books (left).
    ctx.fillStyle = '#b56a3e';
    rr(ctx, 980, 1540, 56, 60, 6); ctx.fill();
    ctx.fillStyle = '#5d9a52';
    ellipse(ctx, 996, 1510, 12, 34, -0.3); ctx.fill();
    ellipse(ctx, 1020, 1512, 12, 30, 0.3); ctx.fill();
    ellipse(ctx, 1008, 1500, 10, 36, 0); ctx.fill();
    ctx.fillStyle = '#3f6d8e';
    rr(ctx, 44, 1570, 84, 16, 3); ctx.fill();
    ctx.fillStyle = '#c9a7ff';
    rr(ctx, 52, 1554, 72, 16, 3); ctx.fill();
    ctx.fillStyle = '#e8b23e';
    rr(ctx, 60, 1538, 58, 16, 3); ctx.fill();
  }
  if (theme.id === 'balloon-sky') {
    // Rolling hill mounds along the bottom + tiny trees.
    ctx.fillStyle = palette.waterBottom;
    for (let i = 0; i < 5; i += 1) {
      ellipse(ctx, 40 + i * 260, 1620, 200, 60); ctx.fill();
    }
    ctx.fillStyle = palette.foreground || palette.hill;
    for (let i = 0; i < 7; i += 1) {
      const tx = 90 + i * 150;
      const ty = 1580 + ((i * 29) % 20);
      ctx.fillRect(tx - 3, ty, 6, 18);
      circle(ctx, tx, ty - 8, 16); ctx.fill();
    }
    // Foreground cloud puffs drifting along the bottom edge.
    const off = ((timeMs / 180000) % 1) * (CANVAS_W + 300) * motion.driftScale;
    ctx.fillStyle = palette.cloud || '#ffffff';
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 3; i += 1) {
      const bx = 200 + i * 480 - off;
      circle(ctx, bx - 30, 1596, 22); ctx.fill();
      circle(ctx, bx, 1586, 28); ctx.fill();
      circle(ctx, bx + 32, 1596, 22); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// Stage-driven lighting and weather: slow washes that evolve ONLY with the
// meter stage, so the scene visibly warms, brightens, or clears as the
// shared meter advances. All alphas stay low; nothing flashes.
function drawStageLighting(ctx, theme, blend, stage, timeMs, motion) {
  const { palette } = theme;
  const wt = timeMs * motion.waveScale;
  if (theme.id === 'sunrise-lake') {
    // Morning mist at low stages, burning off as the sun rises.
    const mist = clamp(0.22 - blend * 0.18, 0.03, 0.22);
    ctx.fillStyle = '#fff6e0';
    ctx.globalAlpha = mist;
    ctx.fillRect(0, PLAY_TOP - 40, CANVAS_W, 260);
    ctx.globalAlpha = 1;
    // Golden wash at high stages.
    if (stage >= 4) {
      ctx.fillStyle = palette.sun;
      ctx.globalAlpha = 0.05 + (stage - 4) * 0.02;
      ctx.fillRect(0, PLAY_TOP - 40, CANVAS_W, PLAY_BOTTOM - PLAY_TOP + 40);
      ctx.globalAlpha = 1;
    }
  }
  if (theme.id === 'firefly-garden') {
    // Moonbeam wash, brightening with the stage.
    ctx.fillStyle = '#d8f26a';
    ctx.globalAlpha = 0.03 + blend * 0.05;
    ctx.fillRect(0, PLAY_TOP - 40, CANVAS_W, PLAY_BOTTOM - PLAY_TOP + 40);
    ctx.globalAlpha = 1;
  }
  if (theme.id === 'starlight-observatory' && stage >= 5) {
    // Deep violet night wash at the final stages.
    ctx.fillStyle = '#6a5acd';
    ctx.globalAlpha = 0.06 + (stage - 5) * 0.03;
    ctx.fillRect(0, PLAY_TOP - 40, CANVAS_W, PLAY_BOTTOM - PLAY_TOP + 40);
    ctx.globalAlpha = 1;
  }
  if (theme.id === 'cozy-corner-cafe') {
    // Warm lamplight pooling from the top, stronger with the stage.
    ctx.fillStyle = palette.glow || palette.sun;
    ctx.globalAlpha = 0.04 + blend * 0.07;
    ctx.fillRect(0, PLAY_TOP - 40, CANVAS_W, 300);
    ctx.globalAlpha = 1;
    // Steady candle-glow pools at fixed seats, appearing with the stage.
    if (stage >= 3) {
      for (const [gx, gy] of [[200, 900], [880, 1240], [540, 1480]]) {
        glowDot(ctx, gx, gy, 26, palette.glow || palette.sun, 0.1 + blend * 0.12);
      }
    }
  }
  if (theme.id === 'balloon-sky') {
    // Sunlit wash at high stages, plus a soft rainbow arc at the final mark.
    if (stage >= 5) {
      ctx.fillStyle = palette.sun;
      ctx.globalAlpha = 0.05;
      ctx.fillRect(0, PLAY_TOP - 40, CANVAS_W, PLAY_BOTTOM - PLAY_TOP + 40);
      ctx.globalAlpha = 1;
    }
    if (stage >= 6) {
      const bands = ['#ff8c66', '#ffd97a', '#7fbf7a', '#7fb7e8', '#c9a7ff'];
      ctx.globalAlpha = 0.22;
      for (let i = 0; i < bands.length; i += 1) {
        ctx.strokeStyle = bands[i];
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(CANVAS_W / 2, 1560, 420 - i * 12, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }
  void wt;
}

// --- Spot drawings (one per theme). All original vector shapes. ---

function drawAngler(ctx, x, y, scale, palette, action, progress, seed, timeMs = 0, motion = null) {
  const wave = motion ? motion.waveScale : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // Ripple rings under the boat, expanding slowly.
  const rippleBase = ctx.globalAlpha;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 2; i += 1) {
    const rp = (((timeMs / 2400 + i * 0.5) % 1) * wave + (1 - wave) * (0.3 + i * 0.4));
    ctx.globalAlpha = rippleBase * 0.3 * (1 - rp);
    ellipse(ctx, 0, 30, 30 + rp * 30, 7 + rp * 6);
    ctx.stroke();
  }
  ctx.globalAlpha = rippleBase;
  // Boat hull with plank seams + a soft reflection below.
  ctx.fillStyle = '#8a5a33';
  ctx.beginPath();
  ctx.moveTo(-42, 6); ctx.lineTo(42, 6); ctx.lineTo(30, 26); ctx.lineTo(-30, 26);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#a06a3e';
  ctx.fillRect(-42, 2, 84, 6);
  ctx.strokeStyle = 'rgba(60,35,15,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-14, 6); ctx.lineTo(-11, 26); ctx.moveTo(14, 6); ctx.lineTo(11, 26); ctx.stroke();
  ctx.fillStyle = 'rgba(138,90,51,0.25)';
  ellipse(ctx, 0, 32, 40, 6); ctx.fill();
  // Angler: round head, body, hat with band; arm lifts on wave/cast.
  ctx.fillStyle = '#f2c89b';
  circle(ctx, 0, -22, 11); ctx.fill();
  ctx.fillStyle = '#e8b23e';
  ellipse(ctx, 0, -30, 15, 5); ctx.fill();
  ctx.fillStyle = '#3f6d8e';
  ctx.fillRect(-13, -33, 26, 3);
  ctx.fillStyle = '#3f6d8e';
  rr(ctx, -11, -14, 22, 18, 6); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(-11, -6, 22, 3);
  const lift = action === 'wave' || action === 'cast' ? -14 * Math.sin(progress * Math.PI) : 0;
  ctx.strokeStyle = '#f2c89b';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(10, -8); ctx.lineTo(22, -2 + lift); ctx.stroke();
  // Fishing rod, always held; the line and bobber rest on the water.
  ctx.strokeStyle = '#6b4a2a';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(20, -4 + lift); ctx.quadraticCurveTo(38, -22, 52, -30); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.5;
  if (action === 'cast') {
    ctx.beginPath(); ctx.moveTo(52, -30); ctx.quadraticCurveTo(58, 6, 62, 34); ctx.stroke();
    circle(ctx, 62, 34, 3); ctx.fillStyle = '#ffd97a'; ctx.fill();
  } else {
    const bobY = 30 + Math.sin(timeMs / 900 + seed * 6) * 2 * wave;
    ctx.beginPath(); ctx.moveTo(52, -30); ctx.quadraticCurveTo(56, 0, 54, bobY - 4); ctx.stroke();
    ctx.fillStyle = '#ff6b6b'; circle(ctx, 54, bobY - 4, 4); ctx.fill();
    ctx.fillStyle = '#f4f1de'; circle(ctx, 54, bobY + 1, 4); ctx.fill();
  }
  ctx.restore();
}

function drawFlower(ctx, x, y, scale, palette, action, progress, seed, timeMs = 0, motion = null) {
  const wave = motion ? motion.waveScale : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const hues = ['#ff9ebb', '#ffd97a', '#c9a7ff', '#ff8c66', '#9be7ff'];
  const petal = hues[Math.floor(seed * hues.length)];
  // Grass tuft at the base.
  ctx.strokeStyle = '#4a7c43';
  ctx.lineWidth = 3;
  for (const gx of [-16, -8, 10, 18]) {
    ctx.beginPath();
    ctx.moveTo(gx, 28);
    ctx.quadraticCurveTo(gx + 2, 16, gx + 5, 10);
    ctx.stroke();
  }
  // Stem + leaves
  ctx.strokeStyle = '#4a7c43';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0, 26); ctx.lineTo(0, -6); ctx.stroke();
  ellipse(ctx, -10, 12, 10, 5, -0.5); ctx.fillStyle = '#5d9a52'; ctx.fill();
  ellipse(ctx, 10, 18, 9, 4.5, 0.5); ctx.fillStyle = '#4a7c43'; ctx.fill();
  // Small side bud.
  ctx.strokeStyle = '#4a7c43';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(12, -2, 16, -10); ctx.stroke();
  ctx.fillStyle = petal;
  circle(ctx, 17, -12, 5); ctx.fill();
  // Petals open wider on bloom, with soft inner shading.
  const open = action === 'bloom' ? 1 + 0.35 * Math.sin(progress * Math.PI) : 1;
  ctx.fillStyle = petal;
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI * i) / 3;
    ellipse(ctx, Math.cos(a) * 13 * open, -14 + Math.sin(a) * 13 * open, 9, 6, a);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 6; i += 1) {
    const a = (Math.PI * i) / 3;
    ellipse(ctx, Math.cos(a) * 9 * open, -14 + Math.sin(a) * 9 * open, 4.5, 3, a);
    ctx.fill();
  }
  ctx.fillStyle = '#ffd97a';
  circle(ctx, 0, -14, 8); ctx.fill();
  ctx.fillStyle = '#e8a83e';
  circle(ctx, -2, -15, 2.5); ctx.fill();
  circle(ctx, 3, -12, 2); ctx.fill();
  // Firefly companion, slowly orbiting; glowing brighter on glow.
  const glow = action === 'glow' ? 0.9 : 0.55;
  const orbit = timeMs / 2600 + seed * 6;
  const fx = 26 + (wave ? Math.cos(orbit) * 8 : 8);
  const fy = -26 + (wave ? Math.sin(orbit) * 6 : 0);
  glowDot(ctx, fx, fy, 4, '#d8f26a', glow);
  ctx.restore();
}

function drawStarSpot(ctx, x, y, scale, palette, action, progress, seed, timeMs = 0, motion = null) {
  const wave = motion ? motion.waveScale : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const tints = ['#ffe89b', '#fff3c8', '#cfeaff'];
  const tint = tints[Math.floor(seed * tints.length)];
  const pulse = action === 'wish' || action === 'wave'
    ? 1 + 0.25 * Math.sin(progress * Math.PI) : 1;
  // Faint orbit ring + a tiny orbiting dot.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  ellipse(ctx, 0, 0, 34, 14, -0.3); ctx.stroke();
  const orbit = timeMs / 3200 + seed * 6;
  const ox = Math.cos(wave ? orbit : 0.8) * 34;
  const oy = Math.sin(wave ? orbit : 0.8) * 14;
  ctx.fillStyle = '#9be7ff';
  circle(ctx, ox, oy - 4, 3); ctx.fill();
  // Four-point sparkle cross behind the star.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-30, 0); ctx.lineTo(30, 0);
  ctx.moveTo(0, -30); ctx.lineTo(0, 30);
  ctx.stroke();
  glowDot(ctx, 0, 0, 16 * pulse, tint, 0.5);
  ctx.fillStyle = tint;
  star(ctx, 0, 0, 20 * pulse);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  star(ctx, 0, 0, 9 * pulse);
  ctx.fill();
  if (action === 'zoom') {
    // Telescope sight lines toward the star.
    ctx.strokeStyle = 'rgba(155,231,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-34, 30); ctx.lineTo(-10, 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(34, 30); ctx.lineTo(10, 8); ctx.stroke();
  }
  ctx.restore();
}

function drawCat(ctx, x, y, scale, palette, action, progress, seed, timeMs = 0, motion = null) {
  const wave = motion ? motion.waveScale : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const coats = ['#e8dcc8', '#8a8f98', '#d9a066', '#5b5f6b'];
  const coat = coats[Math.floor(seed * coats.length)];
  // Table + cloth stripe + cup with saucer.
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(-40, 14, 80, 8);
  ctx.fillRect(-6, 22, 12, 12);
  ctx.fillStyle = '#a34a3a';
  ctx.fillRect(-40, 14, 80, 3);
  const lift = action === 'sip' ? -8 * Math.sin(progress * Math.PI) : 0;
  ctx.fillStyle = '#d9d2c0';
  ellipse(ctx, 24, 15, 12, 4); ctx.fill();
  ctx.fillStyle = '#f4f1de';
  rr(ctx, 16, -2 + lift, 16, 14, 4); ctx.fill();
  ctx.strokeStyle = '#f4f1de';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(33, 5 + lift, 5, -1.2, 1.2); ctx.stroke();
  // Steam curls above the cup, drifting slowly.
  ctx.strokeStyle = 'rgba(255,232,200,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 2; i += 1) {
    const sx = 20 + i * 8;
    const sway = Math.sin(timeMs / 1200 + i * 2 + seed * 5) * 3 * wave;
    ctx.beginPath();
    ctx.moveTo(sx, -4 + lift);
    ctx.quadraticCurveTo(sx + sway, -12 + lift, sx - sway, -20 + lift);
    ctx.stroke();
  }
  // Cat: body, head, ears with inner pink, tail curl with light tip.
  ctx.fillStyle = coat;
  ellipse(ctx, -8, 0, 20, 16); ctx.fill();
  circle(ctx, -8, -18, 13); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-19, -26); ctx.lineTo(-15, -38); ctx.lineTo(-8, -28); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(1, -28); ctx.lineTo(6, -38); ctx.lineTo(9, -25); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d98a94';
  ctx.beginPath();
  ctx.moveTo(-16, -28); ctx.lineTo(-14, -34); ctx.lineTo(-10, -28); ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(2, -28); ctx.lineTo(5, -34); ctx.lineTo(7, -27); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = coat;
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(12, 8); ctx.quadraticCurveTo(30, 4, 28, -12); ctx.stroke();
  ctx.strokeStyle = '#f4f1de';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(28, -10); ctx.lineTo(28, -13); ctx.stroke();
  // Closed happy eyes + nose + whiskers.
  ctx.strokeStyle = '#3b2a20';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(-13, -18, 3, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.beginPath(); ctx.arc(-3, -18, 3, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.lineWidth = 1.5;
  for (const wy of [-14, -11, -8]) {
    ctx.beginPath(); ctx.moveTo(-19, wy); ctx.lineTo(-29, wy - 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, wy); ctx.lineTo(13, wy - 1); ctx.stroke();
  }
  ctx.fillStyle = '#d98a94';
  circle(ctx, -8, -13, 2); ctx.fill();
  const pawLift = action === 'wave' ? -8 * Math.sin(progress * Math.PI) : 0;
  ctx.strokeStyle = coat;
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(6, 2); ctx.lineTo(14, -6 + pawLift); ctx.stroke();
  ctx.restore();
}

function drawBalloon(ctx, x, y, scale, palette, action, progress, seed, timeMs = 0, motion = null) {
  void timeMs;
  void motion;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const cols = [['#ff8c66', '#ffd97a'], ['#7fb7e8', '#f4f1de'], ['#c9a7ff', '#ffd97a'], ['#7fbf7a', '#fff3b0']];
  const [c1, c2] = cols[Math.floor(seed * cols.length)];
  const dip = action === 'wave' ? 6 * Math.sin(progress * Math.PI) : 0;
  const rise = action === 'float' ? -8 * Math.sin(progress * Math.PI) : 0;
  const driftX = action === 'drift' ? 10 * Math.sin(progress * Math.PI) : 0;
  ctx.translate(driftX, dip + rise);
  // Envelope: striped balloon with panel shading + a highlight.
  ctx.fillStyle = c1;
  ellipse(ctx, 0, -18, 30, 36); ctx.fill();
  ctx.fillStyle = c2;
  ellipse(ctx, 0, -18, 12, 36); ctx.fill();
  ctx.fillStyle = c1;
  ellipse(ctx, 0, -18, 4, 36); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ellipse(ctx, -14, -30, 7, 14, -0.3); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-28, -18); ctx.lineTo(28, -18); ctx.stroke();
  // Pennant flag on top.
  ctx.strokeStyle = '#6b4423';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -54); ctx.lineTo(0, -64); ctx.stroke();
  ctx.fillStyle = c2;
  ctx.beginPath(); ctx.moveTo(0, -64); ctx.lineTo(14, -61); ctx.lineTo(0, -58); ctx.closePath(); ctx.fill();
  // Ropes + basket with weave + sandbags.
  ctx.strokeStyle = '#6b4423';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-16, 12); ctx.lineTo(-10, 28); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(16, 12); ctx.lineTo(10, 28); ctx.stroke();
  ctx.fillStyle = '#8a5a33';
  rr(ctx, -12, 28, 24, 14, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(60,35,15,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-12, 35); ctx.lineTo(12, 35); ctx.moveTo(-4, 28); ctx.lineTo(-4, 42); ctx.moveTo(4, 28); ctx.lineTo(4, 42); ctx.stroke();
  ctx.fillStyle = '#a08a6a';
  circle(ctx, -14, 38, 3.5); ctx.fill();
  circle(ctx, 14, 38, 3.5); ctx.fill();
  // Small cloud puff below the basket.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  circle(ctx, -8, 48, 7); ctx.fill();
  circle(ctx, 2, 46, 9); ctx.fill();
  circle(ctx, 10, 48, 6); ctx.fill();
  ctx.restore();
}

// Small cosmetic glyphs for gift effects, drawn beside the spot.
function drawEffectGlyph(ctx, effect, x, y, s, timeMs, seed) {
  ctx.save();
  ctx.translate(x, y);
  const flap = Math.sin(timeMs / 180 + seed * 9);
  switch (effect) {
    case 'lantern':
      glowDot(ctx, 0, 0, 7 * s, '#ffd97a', 0.7);
      ctx.fillStyle = '#e8b23e'; rr(ctx, -6 * s, -9 * s, 12 * s, 18 * s, 4); ctx.fill();
      break;
    case 'butterfly':
      ctx.fillStyle = '#c9a7ff';
      ellipse(ctx, -5 * s * (0.6 + 0.4 * flap), 0, 6 * s, 9 * s, -0.4); ctx.fill();
      ellipse(ctx, 5 * s * (0.6 + 0.4 * flap), 0, 6 * s, 9 * s, 0.4); ctx.fill();
      break;
    case 'comet':
      ctx.strokeStyle = '#9be7ff'; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.moveTo(-14 * s, 8 * s); ctx.lineTo(8 * s, -8 * s); ctx.stroke();
      glowDot(ctx, 10 * s, -10 * s, 4 * s, '#ffffff', 0.8);
      break;
    case 'cloud':
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.9;
      circle(ctx, -8 * s, 2 * s, 7 * s); ctx.fill();
      circle(ctx, 0, -3 * s, 9 * s); ctx.fill();
      circle(ctx, 9 * s, 2 * s, 7 * s); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    case 'plant':
      ctx.fillStyle = '#b56a3e'; rr(ctx, -6 * s, 2 * s, 12 * s, 10 * s, 2); ctx.fill();
      ctx.fillStyle = '#5d9a52';
      ellipse(ctx, -4 * s, -4 * s, 4 * s, 8 * s, -0.4); ctx.fill();
      ellipse(ctx, 4 * s, -4 * s, 4 * s, 8 * s, 0.4); ctx.fill();
      break;
    case 'blossom': case 'bloom':
      ctx.fillStyle = '#ff9ebb';
      for (let i = 0; i < 5; i += 1) {
        const a = (Math.PI * 2 * i) / 5;
        circle(ctx, Math.cos(a) * 6 * s, Math.sin(a) * 6 * s, 4.5 * s); ctx.fill();
      }
      ctx.fillStyle = '#ffd97a'; circle(ctx, 0, 0, 3.5 * s); ctx.fill();
      break;
    case 'sun-hat': case 'hat':
      ctx.fillStyle = '#e8b23e';
      ellipse(ctx, 0, 2 * s, 11 * s, 4 * s); ctx.fill();
      rr(ctx, -6 * s, -8 * s, 12 * s, 9 * s, 3); ctx.fill();
      break;
    case 'flag': case 'ribbon':
      ctx.strokeStyle = '#8a5a33'; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.moveTo(0, 10 * s); ctx.lineTo(0, -10 * s); ctx.stroke();
      ctx.fillStyle = '#ff8c66';
      ctx.beginPath(); ctx.moveTo(0, -10 * s); ctx.lineTo(14 * s, -6 * s); ctx.lineTo(0, -2 * s); ctx.closePath(); ctx.fill();
      break;
    case 'fish-charm':
      ctx.fillStyle = '#7fb7e8';
      ellipse(ctx, 0, 0, 10 * s, 5 * s); ctx.fill();
      ctx.beginPath(); ctx.moveTo(9 * s, 0); ctx.lineTo(16 * s, -6 * s); ctx.lineTo(16 * s, 6 * s); ctx.closePath(); ctx.fill();
      break;
    case 'bobber':
      ctx.fillStyle = '#ff6b6b'; circle(ctx, 0, -3 * s, 6 * s); ctx.fill();
      ctx.fillStyle = '#f4f1de'; circle(ctx, 0, 3 * s, 6 * s); ctx.fill();
      break;
    case 'dew-drop':
      ctx.fillStyle = '#9be7ff';
      ctx.beginPath(); ctx.moveTo(0, -10 * s); ctx.quadraticCurveTo(7 * s, 0, 0, 7 * s); ctx.quadraticCurveTo(-7 * s, 0, 0, -10 * s); ctx.fill();
      break;
    case 'mushroom':
      ctx.fillStyle = '#f4f1de'; rr(ctx, -3 * s, 0, 6 * s, 9 * s, 2); ctx.fill();
      ctx.fillStyle = '#e86a6a'; ellipse(ctx, 0, -1 * s, 10 * s, 6 * s); ctx.fill();
      break;
    case 'firefly':
      glowDot(ctx, 0, 0, 4 * s, '#d8f26a', 0.8);
      break;
    case 'satellite':
      ctx.fillStyle = '#c8ccd4'; rr(ctx, -4 * s, -4 * s, 8 * s, 8 * s, 2); ctx.fill();
      ctx.fillStyle = '#7f9fd4'; ctx.fillRect(-12 * s, -2 * s, 7 * s, 4 * s); ctx.fillRect(5 * s, -2 * s, 7 * s, 4 * s);
      break;
    case 'moon-charm': {
      // Crescent via even-odd fill (no transparency tricks).
      ctx.fillStyle = '#ffe89b';
      ctx.beginPath();
      ctx.arc(0, 0, 8 * s, 0, Math.PI * 2);
      ctx.arc(3.5 * s, -2 * s, 7 * s, 0, Math.PI * 2);
      ctx.fill('evenodd');
      break;
    }
    case 'star-lantern': case 'window-star':
      ctx.fillStyle = '#ffe89b'; star(ctx, 0, 0, 9 * s); ctx.fill();
      break;
    case 'aurora-ribbon':
      ctx.strokeStyle = '#7ef0c8'; ctx.lineWidth = 3 * s;
      ctx.beginPath(); ctx.moveTo(-12 * s, 4 * s); ctx.quadraticCurveTo(0, -10 * s, 12 * s, 2 * s); ctx.stroke();
      break;
    case 'candle':
      ctx.fillStyle = '#f4f1de'; rr(ctx, -4 * s, -2 * s, 8 * s, 12 * s, 2); ctx.fill();
      glowDot(ctx, 0, -6 * s, 3 * s, '#ffb85c', 0.9);
      break;
    case 'menu-board':
      ctx.fillStyle = '#3b2a20'; rr(ctx, -9 * s, -8 * s, 18 * s, 16 * s, 2); ctx.fill();
      ctx.strokeStyle = '#f4f1de'; ctx.lineWidth = 1.5 * s;
      ctx.beginPath(); ctx.moveTo(-5 * s, -3 * s); ctx.lineTo(5 * s, -3 * s); ctx.moveTo(-5 * s, 2 * s); ctx.lineTo(5 * s, 2 * s); ctx.stroke();
      break;
    case 'teacup':
      ctx.fillStyle = '#f4f1de'; rr(ctx, -7 * s, -3 * s, 14 * s, 11 * s, 3); ctx.fill();
      break;
    case 'bird':
      ctx.strokeStyle = '#3b2a20'; ctx.lineWidth = 2.5 * s;
      ctx.beginPath(); ctx.moveTo(-10 * s, 0); ctx.quadraticCurveTo(-5 * s, -6 * s - flap * 3, 0, 0); ctx.quadraticCurveTo(5 * s, -6 * s - flap * 3, 10 * s, 0); ctx.stroke();
      break;
    case 'kite':
      ctx.fillStyle = '#ff8c66';
      ctx.beginPath(); ctx.moveTo(0, -10 * s); ctx.lineTo(8 * s, 0); ctx.lineTo(0, 10 * s); ctx.lineTo(-8 * s, 0); ctx.closePath(); ctx.fill();
      break;
    case 'sun-charm':
      ctx.fillStyle = '#ffd97a'; circle(ctx, 0, 0, 6 * s); ctx.fill();
      ctx.strokeStyle = '#ffd97a'; ctx.lineWidth = 2 * s;
      for (let i = 0; i < 8; i += 1) {
        const a = (Math.PI * i) / 4;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8 * s, Math.sin(a) * 8 * s); ctx.lineTo(Math.cos(a) * 12 * s, Math.sin(a) * 12 * s); ctx.stroke();
      }
      break;
    default:
      glowDot(ctx, 0, 0, 5 * s, '#ffd97a', 0.6);
      break;
  }
  ctx.restore();
}

function drawNamePill(ctx, x, y, name, palette) {
  if (!name) return;
  ctx.font = '600 24px system-ui, sans-serif';
  let label = name;
  while (ctx.measureText(label).width > 150 && label.length > 4) {
    label = label.slice(0, -2);
  }
  if (label !== name) label += '…';
  const w = ctx.measureText(label).width + 24;
  ctx.fillStyle = palette.panel;
  rr(ctx, x - w / 2, y, w, 34, 17);
  ctx.fill();
  ctx.fillStyle = palette.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 18);
}

function drawSpots(ctx, view, motion) {
  const { theme, spots, timeMs, animations } = view;
  const animBySlot = new Map();
  for (const a of animations) {
    if (a.slot != null && a.slot >= 0) animBySlot.set(a.slot, a);
  }
  // Constellation lines first (behind stars).
  if (theme.id === 'starlight-observatory' && spots.length > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const pts = spots.map((s) => spotPosition(s.slot, timeMs, theme.id, motion.bobScale));
    for (let i = 1; i < pts.length; i += 1) {
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
  }
  for (const spot of spots) {
    const pos = spotPosition(spot.slot, timeMs, theme.id, motion.bobScale);
    const anim = animBySlot.get(spot.slot);
    let scale = 1;
    let action = null;
    let progress = 0;
    let entranceAlpha = 1;
    let riseY = 0;
    if (anim && anim.kind === 'follow') {
      const p = easeOutCubic(anim.progress);
      if (motion.entranceRing) {
        // Full motion: grow from small, rise gently, soft ring + halo.
        scale = 0.3 + 0.7 * p;
        riseY = (1 - p) * motion.entranceRise;
        glowDot(ctx, pos.x, pos.y, 26, theme.palette.accent, 0.35 * (1 - anim.progress));
        ctx.strokeStyle = theme.palette.accent;
        ctx.globalAlpha = 0.5 * (1 - anim.progress);
        ctx.lineWidth = 3;
        circle(ctx, pos.x, pos.y, 30 + anim.progress * 46);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        // Reduced motion: fade in place at full size, no travel, no ring.
        entranceAlpha = clamp(anim.progress * 1.6, 0, 1);
      }
    } else if (anim && anim.kind === 'command') {
      action = anim.action;
      progress = anim.progress;
    } else if (spot.lastAction && timeMs - spot.lastActionAt < 2000) {
      action = spot.lastAction;
      progress = (timeMs - spot.lastActionAt) / 2000;
    }
    const draw = {
      'sunrise-lake': drawAngler,
      'firefly-garden': drawFlower,
      'starlight-observatory': drawStarSpot,
      'cozy-corner-cafe': drawCat,
      'balloon-sky': drawBalloon,
    }[theme.id] || drawAngler;
    ctx.save();
    if (entranceAlpha < 1) ctx.globalAlpha = entranceAlpha;
    draw(ctx, pos.x, pos.y + riseY, scale, theme.palette, action, progress, pos.seed, timeMs, motion);
    ctx.restore();
    // Decorations fan out beside the spot.
    spot.decorations.forEach((effect, i) => {
      const angle = -0.9 + i * 0.32;
      drawEffectGlyph(ctx, effect, pos.x + 52 + i * 4, pos.y - 34 + Math.sin(angle) * 10, 1, timeMs, pos.seed + i);
    });
    if (!spot.hidden) drawNamePill(ctx, pos.x, pos.y + 40, spot.displayName, theme.palette);
  }
}

function drawFloatingAnimations(ctx, view, motion) {
  const { theme, timeMs, animations } = view;
  for (const anim of animations) {
    if (anim.kind === 'gift-scene') {
      const y = 900 - anim.progress * 160;
      ctx.globalAlpha = 1 - anim.progress * 0.6;
      drawEffectGlyph(ctx, anim.effect, CANVAS_W / 2 + Math.sin(anim.progress * 4) * 30, y, 1.6, timeMs, 0.3);
      ctx.globalAlpha = 1;
      if (anim.displayName) drawNamePill(ctx, CANVAS_W / 2, y + 40, anim.displayName, theme.palette);
    } else if (anim.kind === 'gift' && anim.slot >= 0) {
      const pos = spotPosition(anim.slot, timeMs, theme.id, motion.bobScale);
      const y = pos.y - 60 - anim.progress * 50;
      ctx.globalAlpha = 1 - anim.progress * 0.5;
      drawEffectGlyph(ctx, anim.effect, pos.x + 40, y, 1.3, timeMs, 0.5);
      ctx.globalAlpha = 1;
    } else if (anim.kind === 'meter-stage') {
      // Slow shimmer banner, gentle fade in and out.
      const alpha = Math.sin(anim.progress * Math.PI) * 0.85;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = theme.palette.panel;
      rr(ctx, 140, 640, CANVAS_W - 280, 54, 27);
      ctx.fill();
      ctx.fillStyle = theme.palette.text;
      ctx.font = '600 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(anim.label || '', CANVAS_W / 2, 668);
      ctx.globalAlpha = 1;
    } else if (anim.kind === 'toast') {
      const alpha = Math.sin(anim.progress * Math.PI);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = theme.palette.panel;
      rr(ctx, 240, 640, CANVAS_W - 480, 54, 27);
      ctx.fill();
      ctx.fillStyle = theme.palette.text;
      ctx.font = '600 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Overflow toasts carry their own explicit text ("All 48 spots are
      // full — thank you!"); other toasts fall back to the thank-you line.
      ctx.fillText(anim.text || `Thank you, ${anim.displayName || 'friend'}`, CANVAS_W / 2, 668);
      ctx.globalAlpha = 1;
    }
  }
}

function drawMeter(ctx, view) {
  const { theme, meter, timeMs } = view;
  void timeMs;
  const x = 70;
  const y = 656;
  const w = CANVAS_W - 140;
  const h = 26;
  const thresholds = meter.thresholds;
  const hitCount = meter.hit.length;
  const prev = hitCount === 0 ? 0 : thresholds[hitCount - 1];
  const next = hitCount < thresholds.length ? thresholds[hitCount] : thresholds[thresholds.length - 1];
  const within = next > prev ? clamp((meter.total - prev) / (next - prev), 0, 1) : 1;
  const segW = w / thresholds.length;
  ctx.fillStyle = 'rgba(10,18,30,0.6)';
  rr(ctx, x, y, w, h, 13);
  ctx.fill();
  // Filled segments + partial current segment.
  for (let i = 0; i < thresholds.length; i += 1) {
    const fill = i < hitCount ? 1 : i === hitCount ? within : 0;
    if (fill <= 0) continue;
    ctx.fillStyle = theme.palette.accent;
    ctx.globalAlpha = i < hitCount ? 0.9 : 0.75;
    const sx = x + i * segW + 2;
    rr(ctx, sx, y + 3, Math.max(0, segW * fill - 4), h - 6, 10);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.palette.text;
  ctx.font = '600 24px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${theme.meterLabel} · ${meter.total.toLocaleString('en-US')}`, x, y - 22);
  ctx.textAlign = 'right';
  const stageLabel = meter.stageLabel || (hitCount < thresholds.length
    ? `Next: ${theme.meterStages[hitCount].label}` : theme.meterStages[thresholds.length - 1].label);
  ctx.fillText(stageLabel, x + w, y - 22);
}

/**
 * Greedy word wrap using ctx.measureText. The exact input text is
 * preserved: joining the returned lines with ' ' reproduces it. A single
 * over-long word is hard-split so no line can overflow maxWidth.
 */
export function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let current = '';
  for (const word of String(text).split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    while (ctx.measureText(current).width > maxWidth && current.length > 1) {
      let cut = current.length - 1;
      while (cut > 1 && ctx.measureText(current.slice(0, cut)).width > maxWidth) cut -= 1;
      lines.push(current.slice(0, cut));
      current = current.slice(cut);
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

// Footer panel geometry. The top stays at y 1610 (the V1 position, just
// below the play area); the panel is taller so the wrapped body lines fit
// inside it, and ends at 1910, above the 1920 canvas bottom.
export const FOOTER = { x: 50, y: 1610, w: CANVAS_W - 100, h: 300 };
const FOOTER_BODY_X = FOOTER.x + 28;
const FOOTER_BODY_START = 92; // offset of the first body baseline from the panel top
const FOOTER_LINE_HEIGHT = 28;

function drawFooter(ctx, view) {
  const { theme, disclosures } = view;
  const { x, y, w, h } = FOOTER;
  ctx.fillStyle = theme.palette.panel;
  rr(ctx, x, y, w, h, 22);
  ctx.fill();
  ctx.fillStyle = theme.palette.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '700 30px system-ui, sans-serif';
  ctx.fillText(theme.name, x + 28, y + 40);
  ctx.font = '24px system-ui, sans-serif';
  ctx.globalAlpha = 0.85;
  ctx.fillText(theme.tagline, x + 28, y + 70);
  const maxWidth = w - 2 * 28;
  ctx.font = '23px system-ui, sans-serif';
  // Body: how-it-works + disclosures + the on-screen music credit (CC BY
  // 3.0 attribution). Seven source lines wrap to eight at most, and the
  // last baseline (y + 92 + 7 * 28 = y + 288) stays inside the panel.
  const credit = view.musicCredit ? [view.musicCredit] : [];
  const lines = [...theme.howItWorks, ...disclosures, ...credit]
    .flatMap((line) => wrapText(ctx, line, maxWidth));
  lines.forEach((line, i) => {
    ctx.fillText(line, FOOTER_BODY_X, y + FOOTER_BODY_START + i * FOOTER_LINE_HEIGHT);
  });
  ctx.globalAlpha = 1;
}

function drawHeader(ctx, view) {
  const { theme } = view;
  ctx.fillStyle = theme.palette.text;
  ctx.globalAlpha = 0.9;
  ctx.font = '600 24px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(theme.name, 72, 46);
  ctx.textAlign = 'right';
  ctx.fillText('Quiet live scene', CANVAS_W - 72, 46);
  ctx.globalAlpha = 1;
}

/**
 * Draw one frame. view: { theme, spots, meter, animations, particles,
 * timeMs, paused, killed, disclosures, reducedMotion }. Animations carry
 * 0..1 progress. The canvas is cleared with a transparent background first;
 * the camera window is cut out so a camera source below shows through in
 * OBS. reducedMotion selects the gentle motion profile (see
 * motionProfile); names, meter, and disclosures are identical either way.
 */
export function renderScene(ctx, view) {
  const { theme, meter, timeMs } = view;
  const stage = meter.hit.length;
  const blend = clamp(stage / 6, 0, 1);
  const motion = motionProfile(view.reducedMotion === true);
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.save();
  drawBackground(ctx, theme, blend, timeMs, stage, motion);
  drawParticles(ctx, theme, view.particles, timeMs, stage, motion);
  cutCameraWindow(ctx, theme);
  drawGround(ctx, theme, timeMs, blend, stage, motion);
  drawStageLighting(ctx, theme, blend, stage, timeMs, motion);
  drawSpots(ctx, view, motion);
  drawFloatingAnimations(ctx, view, motion);
  drawMeter(ctx, view);
  drawFooter(ctx, view);
  drawHeader(ctx, view);
  if (view.paused || view.killed) {
    ctx.fillStyle = 'rgba(10,18,30,0.55)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      view.killed ? 'Game stopped from the control panel.' : 'Paused — the scene is resting.',
      CANVAS_W / 2, 960,
    );
  }
  ctx.restore();
}
