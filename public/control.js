import { THEMES, THEME_IDS, DISCLOSURES, getTheme } from './themes.js';
import { AUDIO_DEFAULTS, normalizeAudioSettings } from './audio.js';

const GIFT_OPTIONS = [
  ['Rose', ''], ['Star', ''], ['Heart', ''], ['Coffee', ''], ['Cloud', ''],
  ['Crown', ''], ['Fish', ''], ['Butterfly', ''], ['Candle', ''], ['Rocket', ''],
  ['Unknown gift (tests default fallback)', '999999'],
];

const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws?role=control`);
let currentTheme = 'sunrise-lake';
let lastCounters = null;
let currentAudio = { ...AUDIO_DEFAULTS };

function renderAudioControls(settings, audioAvailable) {
  currentAudio = normalizeAudioSettings(settings, currentAudio);
  const muteBtn = document.getElementById('btn-mute');
  muteBtn.textContent = currentAudio.muted ? 'Unmute sound' : 'Mute sound';
  muteBtn.classList.toggle('muted', currentAudio.muted);
  const bgm = document.getElementById('bgm-volume');
  const sfx = document.getElementById('sfx-volume');
  bgm.value = String(Math.round(currentAudio.bgmVolume * 100));
  sfx.value = String(Math.round(currentAudio.sfxVolume * 100));
  document.getElementById('bgm-volume-val').textContent = `${bgm.value}%`;
  document.getElementById('sfx-volume-val').textContent = `${sfx.value}%`;
  document.getElementById('motion-toggle').checked = currentAudio.reducedMotion;
  document.getElementById('audio-missing').style.display = audioAvailable === false ? '' : 'none';
  const disabled = audioAvailable === false;
  muteBtn.disabled = disabled;
  bgm.disabled = disabled;
  sfx.disabled = disabled;
}

function send(action) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(action));
}

function fillSelect(select, options) {
  select.innerHTML = '';
  for (const [label, value] of options) {
    const opt = document.createElement('option');
    opt.textContent = label;
    opt.value = value;
    select.appendChild(opt);
  }
}

function fillCommandSelects() {
  const theme = getTheme(currentTheme);
  const options = Object.keys(theme.commands).map((c) => [c, c]);
  fillSelect(document.getElementById('sim-command'), options);
  fillSelect(document.getElementById('man-command'), options);
}

function fillGiftSelects() {
  const options = GIFT_OPTIONS.map(([label, id]) => [label, JSON.stringify({ name: label.startsWith('Unknown') ? 'ZqxUnknownGift' : label, id })]);
  fillSelect(document.getElementById('sim-gift'), options);
  fillSelect(document.getElementById('man-gift'), options);
}

function renderThemeButtons() {
  const wrap = document.getElementById('theme-buttons');
  wrap.innerHTML = '';
  for (const id of THEME_IDS) {
    const theme = THEMES[id];
    const btn = document.createElement('button');
    btn.textContent = theme.name;
    btn.classList.toggle('active', id === currentTheme);
    btn.title = theme.tagline;
    btn.addEventListener('click', () => send({ action: 'setTheme', theme: id }));
    wrap.appendChild(btn);
  }
  const theme = getTheme(currentTheme);
  document.getElementById('theme-desc').textContent =
    `${theme.name}: ${theme.tagline} ${theme.howItWorks.join(' ')}`;
  document.getElementById('overlay-link').href = `/overlay?theme=${currentTheme}`;
  document.getElementById('overlay-link').textContent = `/overlay?theme=${currentTheme}`;
  fillCommandSelects();
}

function logLine(text) {
  const log = document.getElementById('log');
  const time = new Date().toLocaleTimeString('en-GB');
  const line = `[${time}] ${text}\n`;
  log.textContent = (line + log.textContent).slice(0, 4000);
}

function renderStatus(state, mode) {
  document.getElementById('st-mode').textContent = mode;
  document.getElementById('st-theme').textContent = getTheme(state.theme).name;
  document.getElementById('st-conn').textContent = state.status.connection
    + (state.status.killed ? ' (stopped)' : state.status.paused ? ' (paused)' : '');
  document.getElementById('st-spots').textContent = String(state.spotCount);
  document.getElementById('st-meter').textContent = state.meter.total.toLocaleString('en-US');
  document.getElementById('st-queue').textContent = String(state.queueSize);
  document.getElementById('st-stage').textContent = state.meter.stageLabel
    ? `Latest scene beat: ${state.meter.stageLabel}.`
    : 'No scene beats reached yet.';
  if (state.theme !== currentTheme) {
    currentTheme = state.theme;
    renderThemeButtons();
  }
  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  if (lastCounters) {
    const c = state.counters;
    if (c.applied !== lastCounters.applied) {
      logLine(`Applied events: ${c.applied} (duplicates ${c.duplicates}, queue drops ${c.droppedQueue}, partial gifts skipped ${c.streakSkipped}).`);
    }
  }
  lastCounters = { ...state.counters };
}

ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    if (data.type === 'status') {
      renderStatus(data.state, data.mode);
      renderAudioControls(data.audio, data.audioAvailable);
    }
  } catch { /* ignore */ }
};

document.getElementById('btn-mute').addEventListener('click', () => {
  send({ action: 'setAudio', settings: { muted: !currentAudio.muted } });
});
document.getElementById('bgm-volume').addEventListener('input', (e) => {
  send({ action: 'setAudio', settings: { bgmVolume: Number(e.target.value) / 100 } });
});
document.getElementById('sfx-volume').addEventListener('input', (e) => {
  send({ action: 'setAudio', settings: { sfxVolume: Number(e.target.value) / 100 } });
});
document.getElementById('motion-toggle').addEventListener('change', (e) => {
  send({ action: 'setAudio', settings: { reducedMotion: e.target.checked } });
});

document.querySelectorAll('[data-mode]').forEach((btn) => {
  btn.addEventListener('click', () => send({ action: 'setMode', mode: btn.dataset.mode }));
});
document.getElementById('btn-pause').addEventListener('click', () => send({ action: 'pause' }));
document.getElementById('btn-resume').addEventListener('click', () => send({ action: 'resume' }));
document.getElementById('btn-kill').addEventListener('click', () => {
  if (window.confirm('Stop event intake and freeze the scene? Use Resume to restart.')) {
    send({ action: 'kill' });
  }
});
document.getElementById('btn-reset').addEventListener('click', () => {
  if (window.confirm('Reset the session? Spots, the meter, and the local snapshot will be cleared.')) {
    send({ action: 'reset' });
  }
});
document.getElementById('demo-toggle').addEventListener('change', (e) => {
  send({ action: 'demo', on: e.target.checked });
});

function wireTrigger(prefix, actionName) {
  document.getElementById(`${prefix}-follow`).addEventListener('click', () => {
    send({ action: actionName, kind: 'follow', name: document.getElementById(`${prefix}-name`).value });
  });
  document.getElementById(`${prefix}-comment`).addEventListener('click', () => {
    send({ action: actionName, kind: 'comment', name: document.getElementById(`${prefix}-name`).value, text: document.getElementById(`${prefix}-command`).value });
  });
  document.getElementById(`${prefix}-like`).addEventListener('click', () => {
    send({ action: actionName, kind: 'likes', name: document.getElementById(`${prefix}-name`).value, count: document.getElementById(`${prefix}-likes`).value });
  });
  document.getElementById(`${prefix}-gift-btn`).addEventListener('click', () => {
    const gift = JSON.parse(document.getElementById(`${prefix}-gift`).value);
    send({ action: actionName, kind: 'gift', name: document.getElementById(`${prefix}-name`).value, giftName: gift.name, giftId: gift.id });
  });
}
wireTrigger('sim', 'sim');
wireTrigger('man', 'manual');

document.getElementById('disclosures').textContent = DISCLOSURES.join(' ');
fillGiftSelects();
renderThemeButtons();
