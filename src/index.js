// Entrypoint. Local only: binds 127.0.0.1, configured by public username
// only. Never accepts session cookies, tokens, or passwords — if
// credential-looking environment variables are present they are ignored
// with a warning and never read into the connection.
//
//   MODE=simulator|live|manual   (default: simulator)
//   TIKTOK_USERNAME=@name       (required for MODE=live)
//   PORT=3000  THEME=sunrise-lake  DATA_DIR=./data
//   BANNED_WORDS=word1,word2    (extra display-name filters)

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameState } from './gameState.js';
import { createGameServer } from './server.js';
import { LiveAdapter } from './adapters/liveAdapter.js';
import { SimulatorAdapter } from './adapters/simulatorAdapter.js';
import { ManualAdapter } from './adapters/manualAdapter.js';
import { isValidTheme, DEFAULT_THEME } from './themes.js';
import { DEFAULT_PORT, SNAPSHOT_TTL_MS, SNAPSHOT_DEBOUNCE_MS } from './config.js';
import { loadSnapshot, saveSnapshot, clearSnapshot } from './snapshot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CREDENTIAL_ENV_KEYS = [
  'TIKTOK_SESSION', 'TIKTOK_COOKIE', 'TIKTOK_SESSIONID', 'SESSIONID',
  'TT_COOKIE', 'COOKIE', 'OAUTH_TOKEN', 'TIKTOK_TOKEN', 'SESSION_COOKIE',
];

export function readConfig(env = process.env) {
  for (const key of CREDENTIAL_ENV_KEYS) {
    if (env[key]) {
      console.warn(`[games] WARNING: ${key} is set but will be ignored. This game never uses session cookies or tokens.`);
    }
  }
  const mode = ['live', 'simulator', 'manual'].includes(env.MODE) ? env.MODE : 'simulator';
  const username = String(env.TIKTOK_USERNAME || '').replace(/^@/, '').trim();
  const port = Number.parseInt(env.PORT || '', 10);
  const theme = isValidTheme(env.THEME) ? env.THEME : DEFAULT_THEME;
  return {
    mode,
    username,
    port: Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT,
    theme,
    dataDir: env.DATA_DIR ? path.resolve(env.DATA_DIR) : path.join(ROOT, 'data'),
    extraBannedWords: env.BANNED_WORDS || '',
  };
}

export async function main(env = process.env) {
  const config = readConfig(env);
  if (config.mode === 'live' && !config.username) {
    console.error('[games] MODE=live requires TIKTOK_USERNAME (public username, no @ needed).');
    process.exitCode = 2;
    return null;
  }
  const snapshotPath = path.join(config.dataDir, 'session-snapshot.json');
  const { snapshot, reason } = await loadSnapshot(snapshotPath, SNAPSHOT_TTL_MS);
  if (reason !== 'missing' && reason !== 'ok') {
    console.log(`[games] Previous session snapshot ignored (${reason}).`);
  }

  const gameState = new GameState({
    theme: config.theme,
    streamerName: config.username,
    extraBannedWords: config.extraBannedWords,
  });
  if (snapshot) {
    gameState.restore(snapshot);
    console.log(`[games] Restored ${snapshot.spots.length} spot(s) from the local session snapshot.`);
  }

  const liveAdapter = config.mode === 'live' || config.username
    ? new LiveAdapter({
      uniqueId: config.username,
      onStatus: ({ status }) => gameState.setConnection(status),
    })
    : null;
  const simulatorAdapter = new SimulatorAdapter();
  const manualAdapter = new ManualAdapter();
  for (const adapter of [liveAdapter, simulatorAdapter, manualAdapter]) {
    if (adapter) adapter.onEvent((event) => gameState.ingest(event));
  }

  let saveTimer = null;
  const persist = {
    scheduleSave() {
      if (saveTimer) return;
      saveTimer = setTimeout(() => {
        saveTimer = null;
        saveSnapshot(snapshotPath, gameState.persistData()).catch(() => {});
      }, SNAPSHOT_DEBOUNCE_MS);
    },
    async clear() {
      await clearSnapshot(snapshotPath);
    },
    async flush() {
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
      await saveSnapshot(snapshotPath, gameState.persistData()).catch(() => {});
    },
  };

  const server = createGameServer({
    gameState,
    adapters: { live: liveAdapter, simulator: simulatorAdapter, manual: manualAdapter },
    publicDir: path.join(ROOT, 'public'),
    srcDir: path.join(ROOT, 'src'),
    audioDir: path.join(ROOT, 'assets', 'audio'),
    port: config.port,
    mode: config.mode,
    persist,
  });
  gameState.onChange = () => {
    persist.scheduleSave();
    server.broadcastSnapshotSoon();
  };

  const address = await server.listen();
  const base = `http://127.0.0.1:${address.port}`;
  console.log(`[games] ${config.mode} mode, theme ${gameState.themeId}.`);
  console.log(`[games] Overlay: ${base}/overlay?theme=${gameState.themeId}`);
  console.log(`[games] Control panel: ${base}/control`);
  if (server.audioAvailable) {
    console.log('[games] Audio files present: background loops and effects will play in the overlay.');
  } else {
    console.log('[games] Audio files missing: the game runs silent. Run scripts/fetch-audio.sh to fetch them, or use the Drive package which ships them directly.');
  }
  console.log('[games] Policy-cautious build. Creator must stay on camera. See README risk consent.');
  if (config.mode === 'live') {
    console.log('[games] Live adapter is UNVERIFIED: never tested against a real TikTok LIVE session.');
    console.log('[games] Live signing goes through Euler Stream (third-party signing service): if it is down, rate-limited, or changes, the live feed stops. See README.');
    await server.setMode('live');
  } else {
    await server.setMode(config.mode);
  }

  const shutdown = async () => {
    console.log('\n[games] Shutting down; saving session snapshot.');
    if (liveAdapter) await liveAdapter.stop().catch(() => {});
    await simulatorAdapter.stop().catch(() => {});
    await persist.flush();
    await server.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return { gameState, server, adapters: { live: liveAdapter, simulator: simulatorAdapter, manual: manualAdapter }, persist, config };
}

const isEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) {
  main().catch((err) => {
    console.error('[games] Fatal startup error:', err && err.message ? err.message : err);
    process.exit(1);
  });
}
