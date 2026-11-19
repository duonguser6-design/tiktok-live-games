// One normalized event shape for every adapter (live, simulator, manual).
// The game server only ever consumes normalized events, so the live adapter
// can be swapped without touching game logic.
//
// Shape:
//   { msgId, type, userId, displayName, text, command, likeCount, likeTotal,
//     giftId, giftName, repeatCount, repeatEnd, timestamp, source }
// Raw comment text is capped and is only used to recognise a fixed command;
// it is never stored, logged, or broadcast.

import { COMMENT_MAX_LENGTH, COMMAND_MAX_LENGTH } from './config.js';

export const EVENT_TYPES = ['follow', 'comment', 'like', 'gift', 'share', 'join'];

function fnv1a(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function syntheticMsgId(source, event) {
  const basis = [
    source, event.type, event.userId, event.timestamp,
    event.text || '', event.giftId || '', event.repeatCount || 0,
    event.likeCount || 0,
  ].join('|');
  return `synth:${fnv1a(basis)}:${event.timestamp}`;
}

function toFiniteNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function parseCommand(text) {
  if (typeof text !== 'string') return null;
  const first = text.trim().split(/\s+/, 1)[0] || '';
  if (!first.startsWith('!')) return null;
  if (first.length > COMMAND_MAX_LENGTH) return null;
  return first.toLowerCase();
}

/** Validate and normalize a raw adapter event. Returns null if unusable. */
export function normalizeEvent(raw, source) {
  if (!raw || typeof raw !== 'object') return null;
  const type = raw.type;
  if (!EVENT_TYPES.includes(type)) return null;
  const userId = String(raw.userId ?? '').trim();
  if (!userId) return null;
  const timestamp = toFiniteNumber(raw.timestamp) || Date.now();
  const text = typeof raw.text === 'string'
    ? raw.text.slice(0, COMMENT_MAX_LENGTH)
    : '';
  const event = {
    msgId: String(raw.msgId ?? '').trim(),
    type,
    userId,
    displayName: String(raw.displayName ?? ''),
    text,
    command: type === 'comment' ? parseCommand(text) : null,
    likeCount: toFiniteNumber(raw.likeCount),
    likeTotal: toFiniteNumber(raw.likeTotal),
    giftId: raw.giftId == null ? '' : String(raw.giftId),
    giftName: String(raw.giftName ?? ''),
    repeatCount: toFiniteNumber(raw.repeatCount) ?? 0,
    repeatEnd: raw.repeatEnd === true || raw.repeatEnd === 1 || raw.repeatEnd === '1',
    timestamp,
    source,
  };
  if (!event.msgId) event.msgId = syntheticMsgId(source, event);
  return event;
}
