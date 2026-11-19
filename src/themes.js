// Theme registry: the single source of truth for all five overlay variants.
// This file is dependency-free on purpose: the browser overlay imports it
// directly (served at /themes.js) and the Node server and tests import it too.
//
// Shared rules for every theme (see README for the full policy-cautious
// wording): no follow/gift calls-to-action, no prizes, no currency, no
// randomness tied to gifts, no leaderboards, fixed deterministic gift
// cosmetics, !hide works identically everywhere.

export const METER_THRESHOLDS = [100, 500, 1000, 2500, 5000, 10000];

export const DISCLOSURES = [
  'No prizes. Gifts are cosmetic only, non-refundable, and give no gameplay advantage.',
  'This game is not affiliated with or endorsed by TikTok.',
];

// On-screen music credit (CC BY 3.0 requires attribution where viewers
// can see it while the music plays; ATTRIBUTION.md alone is not enough).
// Shown as the last line of the overlay footer, and the streamer should
// also put it in the LIVE description (see README).
export const MUSIC_CREDIT = 'Music: Kevin MacLeod (incompetech.com), CC BY 3.0';

export const THEMES = {
  'sunrise-lake': {
    id: 'sunrise-lake',
    name: 'Sunrise Lake',
    tagline: 'A quiet fishing dock at first light.',
    spotNoun: 'boat',
    spotLabel: 'Thank-you boat',
    commands: {
      '!cast': { action: 'cast', label: 'Cast', description: 'The angler casts a line.' },
      '!bait': { action: 'bait', label: 'Bait', description: 'The angler drops bait in the water.' },
      '!wave': { action: 'wave', label: 'Wave', description: 'The angler waves.' },
      '!hide': { action: 'hide', label: 'Hide name', description: 'Hides the viewer name on screen.' },
    },
    meterLabel: 'Tide meter',
    meterStages: [
      { at: 100, label: 'First light on the water' },
      { at: 500, label: 'Ripples spread' },
      { at: 1000, label: 'Sunrise glow' },
      { at: 2500, label: 'A school of fish passes' },
      { at: 5000, label: 'Golden hour' },
      { at: 10000, label: 'Full sunrise' },
    ],
    howItWorks: [
      'A follow adds a thank-you boat at the dock.',
      'Comments !cast, !bait, !wave move the angler. !hide hides a name.',
      'Likes fill the shared tide meter. The whole scene changes at set marks.',
      'Gifts add one fixed decoration.',
    ],
    giftEffects: {
      lantern: { label: 'Dock lantern', target: 'spot' },
      blossom: { label: 'Blossom on the boat', target: 'spot' },
      'sun-hat': { label: 'Sun hat for the angler', target: 'spot' },
      flag: { label: 'Boat flag', target: 'spot' },
      'fish-charm': { label: 'Fish charm', target: 'spot' },
    },
    giftDefault: 'lantern',
    giftKeywords: [
      ['rose', 'blossom'], ['flower', 'blossom'], ['blossom', 'blossom'], ['tulip', 'blossom'],
      ['heart', 'flag'], ['love', 'flag'],
      ['star', 'lantern'], ['moon', 'lantern'], ['light', 'lantern'], ['fire', 'lantern'],
      ['cap', 'sun-hat'], ['hat', 'sun-hat'], ['crown', 'sun-hat'],
      ['fish', 'fish-charm'], ['shark', 'fish-charm'], ['whale', 'fish-charm'],
    ],
    palette: {
      skyTop: '#1d3a5f', skyBottom: '#f7b267', skyTopLate: '#3a6ea5', skyBottomLate: '#ffd9a0', sun: '#ffd97a',
      waterTop: '#3e7ca8', waterBottom: '#1d4e6b', dock: '#7a5230',
      hill: '#2e5d43', accent: '#ffd97a', text: '#ffffff', panel: 'rgba(12, 24, 38, 0.72)',
      farHill: '#24405c', midHill: '#2e5d43', glow: '#ffe9b0', foreground: '#16324a', cloud: '#ffd9a0',
    },
  },

  'firefly-garden': {
    id: 'firefly-garden',
    name: 'Firefly Garden',
    tagline: 'A night garden that wakes with the viewers.',
    spotNoun: 'flower',
    spotLabel: 'Glowing flower',
    commands: {
      '!bloom': { action: 'bloom', label: 'Bloom', description: 'The flower opens its petals.' },
      '!glow': { action: 'glow', label: 'Glow', description: 'The firefly glows brighter for a moment.' },
      '!wave': { action: 'wave', label: 'Wave', description: 'The flower sways.' },
      '!hide': { action: 'hide', label: 'Hide name', description: 'Hides the viewer name on screen.' },
    },
    meterLabel: 'Moonlight meter',
    meterStages: [
      { at: 100, label: 'Fireflies wake' },
      { at: 500, label: 'Dew settles' },
      { at: 1000, label: 'Moonlight brightens' },
      { at: 2500, label: 'Blossoms open' },
      { at: 5000, label: 'Garden glows' },
      { at: 10000, label: 'Dawn glow' },
    ],
    howItWorks: [
      'A follow adds a glowing flower with a firefly to the garden.',
      'Comments !bloom, !glow, !wave move the flower. !hide hides a name.',
      'Likes fill the shared moonlight meter. The whole scene changes at set marks.',
      'Gifts add one fixed decoration.',
    ],
    giftEffects: {
      butterfly: { label: 'Butterfly visitor', target: 'spot' },
      lantern: { label: 'Garden lantern', target: 'spot' },
      'dew-drop': { label: 'Dew drop', target: 'spot' },
      mushroom: { label: 'Mushroom beside the flower', target: 'spot' },
      bloom: { label: 'Extra bloom', target: 'spot' },
      firefly: { label: 'Extra firefly', target: 'spot' },
    },
    giftDefault: 'butterfly',
    giftKeywords: [
      ['butterfly', 'butterfly'], ['bee', 'butterfly'], ['bird', 'butterfly'],
      ['star', 'lantern'], ['moon', 'lantern'], ['light', 'lantern'], ['lamp', 'lantern'],
      ['rain', 'dew-drop'], ['drop', 'dew-drop'], ['water', 'dew-drop'], ['ice', 'dew-drop'],
      ['mushroom', 'mushroom'],
      ['rose', 'bloom'], ['flower', 'bloom'], ['blossom', 'bloom'], ['tulip', 'bloom'],
      ['fire', 'firefly'], ['spark', 'firefly'],
    ],
    palette: {
      skyTop: '#101a33', skyBottom: '#2c4a6e', skyTopLate: '#2a3a5f', skyBottomLate: '#7a9a6a', sun: '#f4f1de',
      waterTop: '#1e4632', waterBottom: '#0f2a1e', dock: '#5d4a2f',
      hill: '#1e4632', accent: '#d8f26a', text: '#ffffff', panel: 'rgba(10, 18, 30, 0.72)',
      farHill: '#0d1526', midHill: '#1e4632', glow: '#e8ff9b', foreground: '#0a1f14', cloud: '#3a5a4a',
    },
  },

  'starlight-observatory': {
    id: 'starlight-observatory',
    name: 'Starlight Observatory',
    tagline: 'A constellation drawn one viewer at a time.',
    spotNoun: 'star',
    spotLabel: 'Constellation star',
    commands: {
      '!wish': { action: 'wish', label: 'Wish', description: 'The star twinkles.' },
      '!zoom': { action: 'zoom', label: 'Zoom', description: 'The telescope turns toward the star.' },
      '!wave': { action: 'wave', label: 'Wave', description: 'The star pulses gently.' },
      '!hide': { action: 'hide', label: 'Hide name', description: 'Hides the viewer name on screen.' },
    },
    meterLabel: 'Aurora meter',
    meterStages: [
      { at: 100, label: 'Stars sharpen' },
      { at: 500, label: 'Telescope focuses' },
      { at: 1000, label: 'Aurora shimmer' },
      { at: 2500, label: 'Meteor shower' },
      { at: 5000, label: 'Milky Way brightens' },
      { at: 10000, label: 'Full aurora' },
    ],
    howItWorks: [
      'A follow adds a named star to the constellation.',
      'Comments !wish, !zoom, !wave move the star. !hide hides a name.',
      'Likes fill the shared aurora meter. The whole scene changes at set marks.',
      'Gifts add one fixed decoration.',
    ],
    giftEffects: {
      comet: { label: 'Comet trail', target: 'spot' },
      satellite: { label: 'Little satellite', target: 'spot' },
      'moon-charm': { label: 'Moon charm', target: 'spot' },
      'star-lantern': { label: 'Star lantern', target: 'spot' },
      'aurora-ribbon': { label: 'Aurora ribbon', target: 'spot' },
    },
    giftDefault: 'comet',
    giftKeywords: [
      ['comet', 'comet'], ['shooting', 'comet'], ['meteor', 'comet'],
      ['rocket', 'satellite'], ['satellite', 'satellite'], ['plane', 'satellite'],
      ['moon', 'moon-charm'],
      ['star', 'star-lantern'], ['light', 'star-lantern'], ['lamp', 'star-lantern'],
      ['rainbow', 'aurora-ribbon'], ['aurora', 'aurora-ribbon'], ['ribbon', 'aurora-ribbon'],
    ],
    palette: {
      skyTop: '#070b1d', skyBottom: '#1c2a52', skyTopLate: '#16224d', skyBottomLate: '#4a6a9a', sun: '#f4f1de',
      waterTop: '#131c38', waterBottom: '#0a0f24', dock: '#4a3b2a',
      hill: '#131c38', accent: '#9be7ff', text: '#ffffff', panel: 'rgba(8, 12, 28, 0.72)',
      farHill: '#0a1026', midHill: '#131c38', glow: '#bdefff', foreground: '#070b1d', cloud: '#2a3a5f',
    },
  },

  'cozy-corner-cafe': {
    id: 'cozy-corner-cafe',
    name: 'Cozy Corner Cafe',
    tagline: 'A warm window seat for every regular.',
    spotNoun: 'seat',
    spotLabel: 'Window seat',
    commands: {
      '!sip': { action: 'sip', label: 'Sip', description: 'The cat lifts its cup.' },
      '!stir': { action: 'stir', label: 'Stir', description: 'The cat stirs its cup.' },
      '!wave': { action: 'wave', label: 'Wave', description: 'The cat waves a paw.' },
      '!hide': { action: 'hide', label: 'Hide name', description: 'Hides the viewer name on screen.' },
    },
    meterLabel: 'Warmth meter',
    meterStages: [
      { at: 100, label: 'Kettle warms' },
      { at: 500, label: 'Steam rises' },
      { at: 1000, label: 'Candles lit' },
      { at: 2500, label: 'Window glows' },
      { at: 5000, label: 'Room warms' },
      { at: 10000, label: 'Golden evening' },
    ],
    howItWorks: [
      'A follow adds a cat at a window seat with a cup.',
      'Comments !sip, !stir, !wave move the cat. !hide hides a name.',
      'Likes fill the shared warmth meter. The whole scene changes at set marks.',
      'Gifts add one fixed decoration.',
    ],
    giftEffects: {
      plant: { label: 'Potted plant', target: 'spot' },
      candle: { label: 'Table candle', target: 'spot' },
      'menu-board': { label: 'Menu board', target: 'spot' },
      teacup: { label: 'Second teacup', target: 'spot' },
      'window-star': { label: 'Star in the window', target: 'spot' },
    },
    giftDefault: 'plant',
    giftKeywords: [
      ['plant', 'plant'], ['leaf', 'plant'], ['tree', 'plant'], ['flower', 'plant'], ['rose', 'plant'],
      ['candle', 'candle'], ['fire', 'candle'], ['light', 'candle'], ['lamp', 'candle'],
      ['cake', 'menu-board'], ['bread', 'menu-board'], ['food', 'menu-board'], ['cookie', 'menu-board'],
      ['coffee', 'teacup'], ['tea', 'teacup'], ['cup', 'teacup'], ['heart', 'teacup'],
      ['star', 'window-star'], ['moon', 'window-star'],
    ],
    palette: {
      skyTop: '#3b2a20', skyBottom: '#8a5a33', skyTopLate: '#5a3a24', skyBottomLate: '#c98a4b', sun: '#ffd97a',
      waterTop: '#6b4423', waterBottom: '#4a2c17', dock: '#7a5230',
      hill: '#5d3a22', accent: '#ffb85c', text: '#ffffff', panel: 'rgba(30, 18, 10, 0.72)',
      farHill: '#2a1c12', midHill: '#5d3a22', glow: '#ffcf8a', foreground: '#241407', cloud: '#8a5a33',
    },
  },

  'balloon-sky': {
    id: 'balloon-sky',
    name: 'Balloon Sky',
    tagline: 'A slow sky fleet drifting over the hills.',
    spotNoun: 'balloon',
    spotLabel: 'Hot-air balloon',
    commands: {
      '!float': { action: 'float', label: 'Float', description: 'The balloon bobs gently.' },
      '!drift': { action: 'drift', label: 'Drift', description: 'The balloon drifts sideways and back.' },
      '!wave': { action: 'wave', label: 'Wave', description: 'The balloon dips in greeting.' },
      '!hide': { action: 'hide', label: 'Hide name', description: 'Hides the viewer name on screen.' },
    },
    meterLabel: 'Wind meter',
    meterStages: [
      { at: 100, label: 'A breeze stirs' },
      { at: 500, label: 'Clouds drift' },
      { at: 1000, label: 'Wind picks up' },
      { at: 2500, label: 'Birds join' },
      { at: 5000, label: 'Sun breaks through' },
      { at: 10000, label: 'Full sky fleet' },
    ],
    howItWorks: [
      'A follow adds a named hot-air balloon to the sky fleet.',
      'Comments !float, !drift, !wave move the balloon. !hide hides a name.',
      'Likes fill the shared wind meter. The whole scene changes at set marks.',
      'Gifts add one fixed decoration.',
    ],
    giftEffects: {
      cloud: { label: 'Little cloud', target: 'spot' },
      bird: { label: 'Bird companion', target: 'spot' },
      ribbon: { label: 'Ribbon on the basket', target: 'spot' },
      kite: { label: 'Kite on a string', target: 'spot' },
      'sun-charm': { label: 'Sun charm', target: 'spot' },
    },
    giftDefault: 'cloud',
    giftKeywords: [
      ['cloud', 'cloud'], ['rain', 'cloud'], ['snow', 'cloud'],
      ['bird', 'bird'], ['butterfly', 'bird'], ['bee', 'bird'],
      ['ribbon', 'ribbon'], ['bow', 'ribbon'], ['flag', 'ribbon'],
      ['kite', 'kite'], ['plane', 'kite'], ['rocket', 'kite'],
      ['star', 'sun-charm'], ['sun', 'sun-charm'], ['moon', 'sun-charm'], ['light', 'sun-charm'],
    ],
    palette: {
      skyTop: '#2f6da8', skyBottom: '#bfe3f2', skyTopLate: '#4a90c8', skyBottomLate: '#eaf7ff', sun: '#fff3b0',
      waterTop: '#7fb069', waterBottom: '#4a7c43', dock: '#7a5230',
      hill: '#6aa84f', accent: '#ff8c66', text: '#ffffff', panel: 'rgba(18, 42, 66, 0.72)',
      farHill: '#7fb3d9', midHill: '#6aa84f', glow: '#fff8d0', foreground: '#3f7a3a', cloud: '#ffffff',
    },
  },
};

export const THEME_IDS = Object.keys(THEMES);
export const DEFAULT_THEME = 'sunrise-lake';

export function getTheme(themeId) {
  return THEMES[themeId] || THEMES[DEFAULT_THEME];
}

export function isValidTheme(themeId) {
  return Object.prototype.hasOwnProperty.call(THEMES, themeId);
}

/** Fixed, deterministic gift mapping. Unknown gifts fall back to one default. */
export function giftEffectFor(themeId, giftId, giftName) {
  const theme = getTheme(themeId);
  const key = String(giftName || '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
  if (key) {
    for (const [keyword, effectId] of theme.giftKeywords) {
      if (key.includes(keyword)) return effectId;
    }
  }
  // giftId is recorded for diagnostics but never invents an effect: the
  // mapping is by gift name keywords, and anything unmatched uses the default.
  void giftId;
  return theme.giftDefault;
}

export function themeCommands(themeId) {
  return getTheme(themeId).commands;
}
