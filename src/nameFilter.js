// Display-name filtering. Every name shown on screen passes through here.
// Raw chat text and raw names are never echoed, logged, or stored.
//
// Rules: strip control/bidi/zero-width characters, tame combining-mark
// (zalgo) runs, cap emoji runs, cap length, block names that look like
// personal data (emails, URLs, long digit runs), block impersonation
// patterns, and block a starter banned-word list. Blocked/empty names fall
// back to "Viewer". The streamer can extend the list with the BANNED_WORDS
// environment variable (comma-separated, matched case-insensitively).

import { NAME_MAX_LENGTH } from './config.js';

const STARTER_BANNED_WORDS = [
  'fuck', 'shit', 'bitch', 'dick', 'pussy', 'cunt', 'whore', 'slut',
  'bastard', 'asshole', 'nigger', 'nigga', 'faggot', 'retard',
];

export function bannedWords(extra = '') {
  const list = [...STARTER_BANNED_WORDS];
  for (const w of String(extra || '').split(',')) {
    const t = w.trim().toLowerCase();
    if (t.length >= 3) list.push(t);
  }
  return list;
}

const COMBINING = /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff]/u;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff\u200b\u200c]/gu;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const URL_RE = /(https?:\/\/|www\.|\.(com|net|org|io|gg|me|tv|co)\b)/i;
const LONG_DIGITS_RE = /\d{7,}/;

function tameCombiningMarks(text) {
  // Allow at most 2 combining marks after each base character.
  let out = '';
  let run = 0;
  for (const ch of text) {
    if (COMBINING.test(ch)) {
      run += 1;
      if (run > 2) continue;
    } else {
      run = 0;
    }
    out += ch;
  }
  return out;
}

function capEmojiRuns(text) {
  // At most 3 pictographs in a row, at most 6 in total. ZWJ (U+200D) and
  // variation selectors are kept so joined emoji still render.
  let out = '';
  let run = 0;
  let total = 0;
  for (const ch of text) {
    if (PICTOGRAPHIC.test(ch)) {
      run += 1;
      total += 1;
      if (run > 3 || total > 6) continue;
    } else if (ch !== '\u200d' && ch !== '\ufe0f') {
      run = 0;
    }
    out += ch;
  }
  return out;
}

export function sanitizeDisplayName(raw, options = {}) {
  const streamerName = String(options.streamerName || '').replace(/^@/, '').toLowerCase();
  const extraBanned = options.extraBannedWords || '';
  let name = String(raw ?? '').normalize('NFC').replace(CONTROL_OR_BIDI, '').trim();
  name = tameCombiningMarks(name);
  name = capEmojiRuns(name);
  // Collapse whitespace; cap length by code point.
  name = name.replace(/\s+/g, ' ');
  const chars = Array.from(name);
  let filtered = chars.length > NAME_MAX_LENGTH;
  if (filtered) name = chars.slice(0, NAME_MAX_LENGTH).join('').trim();

  let blocked = false;
  const folded = name.toLowerCase();
  if (!name) blocked = true;
  if (EMAIL_RE.test(name) || URL_RE.test(name) || LONG_DIGITS_RE.test(name)) blocked = true;
  if (folded.includes('tiktok') && /(official|support|admin|staff|team|\bmod\b)/.test(folded)) blocked = true;
  if (['admin', 'moderator', 'support', 'official'].includes(folded)) blocked = true;
  if (streamerName && folded.replace(/^@/, '') === streamerName) blocked = true;
  if (!blocked) {
    const letters = folded.replace(/[^a-z]/g, '');
    for (const word of bannedWords(extraBanned)) {
      if (letters.includes(word)) { blocked = true; break; }
    }
  }
  if (blocked) return { name: 'Viewer', blocked: true, filtered: true };
  return { name, blocked: false, filtered };
}
