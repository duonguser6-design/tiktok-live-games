// Minimal local session snapshot. Stores ONLY filtered display names,
// spot slots, decorations, the meter total, hit thresholds, and the theme.
// Never stores user ids, comment text, or raw names. Expires after the TTL
// (24h by default) and is ignored when expired or corrupt. The file lives
// under the local data dir and is git-ignored.

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
    .map((s) => ({
      slot: s.slot,
      displayName: String(s.displayName).slice(0, 48),
      hidden: s.hidden === true,
      decorations: Array.isArray(s.decorations) ? s.decorations.map(String).slice(0, 6) : [],
    }));
  return {
    snapshot: {
      version: SNAPSHOT_VERSION,
      savedAt: parsed.savedAt,
      theme: typeof parsed.theme === 'string' ? parsed.theme : null,
      meterTotal: Number.isFinite(parsed.meterTotal) ? Math.max(0, parsed.meterTotal) : 0,
      thresholdsHit: Array.isArray(parsed.thresholdsHit)
        ? parsed.thresholdsHit.filter(Number.isFinite) : [],
      spots,
    },
    reason: 'ok',
  };
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
