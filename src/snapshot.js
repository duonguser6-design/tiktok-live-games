// Minimal local session snapshot. Stores ONLY filtered display names,
// spot slots, decorations, the meter total, hit thresholds, and the theme —
// plus, for the Sunrise Lake 3D mode, the like cycle, scene, bait vote,
// thank-you ticker, and visual states. Never stores user ids, comment
// text, or raw names. Expires after the TTL (24h by default) and is
// ignored when expired or corrupt. The file lives under the local data
// dir and is git-ignored.

import { promises as fs } from 'node:fs';
import path from 'node:path';

export const SNAPSHOT_VERSION = 1;

export function isSnapshotExpired(snapshot, ttlMs, now = Date.now()) {
  if (!snapshot || typeof snapshot.savedAt !== 'number') return true;
  return now - snapshot.savedAt > ttlMs;
}

export async function loadSnapshot(filePath, ttlMs, now = Date.now()) {
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return { snapshot: null, reason: 'missing' };
    return { snapshot: null, reason: 'unreadable' };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { snapshot: null, reason: 'corrupt' };
  }
  if (!parsed || parsed.version !== SNAPSHOT_VERSION || !Array.isArray(parsed.spots)) {
    return { snapshot: null, reason: 'invalid' };
  }
  if (isSnapshotExpired(parsed, ttlMs, now)) return { snapshot: null, reason: 'expired' };
  // Defensive shape check: only the documented fields survive.
  const spots = parsed.spots
    .filter((s) => s && Number.isInteger(s.slot) && typeof s.displayName === 'string')
    .map((s) => {
      const mapped = {
        slot: s.slot,
        displayName: String(s.displayName).slice(0, 48),
        hidden: s.hidden === true,
        decorations: Array.isArray(s.decorations) ? s.decorations.map(String).slice(0, 6) : [],
      };
      // Lake-mode fields: baseName lets a restored spot rebind by name,
      // visualStates are the silently-added first-use looks.
      if (typeof s.baseName === 'string' && s.baseName) mapped.baseName = String(s.baseName).slice(0, 48);
      if (Array.isArray(s.visualStates)) mapped.visualStates = s.visualStates.map(String).slice(0, 3);
      return mapped;
    });
  const snapshot = {
    version: SNAPSHOT_VERSION,
    savedAt: parsed.savedAt,
    theme: typeof parsed.theme === 'string' ? parsed.theme : null,
    meterTotal: Number.isFinite(parsed.meterTotal) ? Math.max(0, parsed.meterTotal) : 0,
    thresholdsHit: Array.isArray(parsed.thresholdsHit)
      ? parsed.thresholdsHit.filter(Number.isFinite) : [],
    spots,
  };
  // Lake-mode state, kept only when present and well-shaped; restore()
  // validates the values again. Without these, a real file-based restart
  // would silently lose the cycle, scene, vote, ticker, and looks.
  if (Number.isFinite(parsed.cycleTotal)) snapshot.cycleTotal = Math.max(0, parsed.cycleTotal);
  if (Array.isArray(parsed.cycleHit)) snapshot.cycleHit = parsed.cycleHit.filter(Number.isFinite);
  if (Number.isFinite(parsed.restingUntil)) snapshot.restingUntil = Math.max(0, parsed.restingUntil);
  if (Number.isFinite(parsed.restBank)) snapshot.restBank = Math.max(0, parsed.restBank);
  if (Number.isInteger(parsed.sceneIndex)) snapshot.sceneIndex = parsed.sceneIndex;
  if (Number.isFinite(parsed.sceneStartedAt)) snapshot.sceneStartedAt = parsed.sceneStartedAt;
  if (parsed.baitVote && typeof parsed.baitVote === 'object') {
    snapshot.baitVote = {
      round: Number.isInteger(parsed.baitVote.round) ? parsed.baitVote.round : 0,
      option: typeof parsed.baitVote.option === 'string' ? parsed.baitVote.option : '',
    };
  }
  if (Array.isArray(parsed.ticker)) {
    snapshot.ticker = parsed.ticker
      .filter((e) => e && typeof e.name === 'string' && e.name.length > 0)
      .map((e) => ({ name: String(e.name).slice(0, 48), hidden: e.hidden === true }));
  }
  if (Number.isInteger(parsed.tickerCursor)) snapshot.tickerCursor = Math.max(0, parsed.tickerCursor);
  if (Number.isFinite(parsed.lastLargeLikeEventAt)) snapshot.lastLargeLikeEventAt = Math.max(0, parsed.lastLargeLikeEventAt);
  if (typeof parsed.pendingFinale === 'boolean') snapshot.pendingFinale = parsed.pendingFinale;
  return { snapshot, reason: 'ok' };
}

export async function saveSnapshot(filePath, snapshot) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(snapshot), 'utf8');
  await fs.rename(tmp, filePath);
}

export async function clearSnapshot(filePath) {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (err) {
    if (err && err.code === 'ENOENT') return true;
    return false;
  }
}
