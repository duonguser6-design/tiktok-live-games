// Manual / mod-control adapter: the streamer (or a moderator at the same
// machine) triggers events by hand from the local control panel. This is
// the legitimate fallback path that works with no TikTok connection at all:
// the game can be driven live by a person instead of by the unofficial
// event feed. Emits the same normalized events as every other adapter.

import { LocalEventSource } from './base.js';

export function manualUserId(name) {
  const slug = String(name || 'guest').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'guest';
  return `manual:${slug}`;
}

export class ManualAdapter extends LocalEventSource {
  constructor() {
    super('manual', 'manual');
  }

  follow(displayName) {
    return this.trigger({ type: 'follow', userId: manualUserId(displayName), displayName });
  }

  comment(displayName, text) {
    return this.trigger({ type: 'comment', userId: manualUserId(displayName), displayName, text });
  }

  likes(displayName, likeCount) {
    return this.trigger({ type: 'like', userId: manualUserId(displayName), displayName, likeCount });
  }

  gift(displayName, giftName, giftId = '') {
    return this.trigger({
      type: 'gift', userId: manualUserId(displayName), displayName,
      giftId, giftName, repeatCount: 1, repeatEnd: true,
    });
  }
}
