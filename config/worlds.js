/* =============================================================================
 * config/worlds.js
 * -----------------------------------------------------------------------------
 * REGIONS of one big contiguous overworld (Zelda-style). The three "worlds" are
 * no longer separate scenes/menus — they're zones of a single scrolling map,
 * each with its own palette, ambient bed, decorations, NPCs, and the Doubts
 * (config/doubts.js) that haunt it. Crossing from one zone into another shifts
 * the look, the music (crossfade), and the HUD theme — no loading, no menu.
 *
 * MASTER MAP MODEL
 *   The map is `MAP.cols` x `MAP.rows` tiles. Each region occupies a rectangle
 *   at `origin` of `size` tiles. The space between zones is neutral "crossroads"
 *   ground (the hub palette) you walk freely across. OverworldScene paints every
 *   tile from whichever region contains it (hub/neutral as fallback), draws a
 *   wall border around the whole map, then places decorations/NPCs.
 *
 * COORDINATES
 *   `origin`, `size`, `entrance` are MASTER tile coordinates.
 *   Decoration / NPC positions are RELATIVE to the region origin (the engine
 *   adds the origin), so each region stays self-contained and movable.
 *
 * TO ADD A REGION: add an entry here (origin/size that doesn't overlap),
 * reference its id from characters (config/projects.js `world`) and doubts.
 * Nothing else changes.
 * ========================================================================== */

const MAP = {
  TILE: 32,
  cols: 80,
  rows: 56,
  spawn: { tx: 40, ty: 28 }, // hub center — where the player begins
};

const REGIONS = {
  /* ----- HUB: the crossroads (neutral connective ground) ----------------- */
  hub: {
    id: 'hub',
    name: 'The Crossroads',
    subtitle: 'where every path begins',
    origin: { tx: 31, ty: 22 },
    size: { w: 18, h: 12 },
    entrance: { tx: 40, ty: 28 },
    palette: {
      bg: 0x0e1018, floor: 0x232838, floorAlt: 0x2b3145,
      wall: 0x3a4258, wallTop: 0x4a5474, accent: 0x8aa0c8, glow: 0xb8c8e8,
    },
    hudColor: '#8aa0c8',
    ambient: { type: 'sine', freq: 98, gain: 0.04, detune: 4 },
    decorations: [
      { type: 'lamp', tx: 2, ty: 9 },
      { type: 'lamp', tx: 15, ty: 9 },
      { type: 'plant', tx: 1, ty: 2 },
      { type: 'crate', tx: 16, ty: 2 },
    ],
    npcs: ['guide'],
    doubts: [{ type: 'too_junior', cap: 1 }],
  },

  /* ----- DEV: a lab at night --------------------------------------------- */
  dev: {
    id: 'dev',
    name: 'Dev World',
    subtitle: 'a lab at night',
    origin: { tx: 3, ty: 16 },
    size: { w: 24, h: 24 },
    entrance: { tx: 25, ty: 28 },
    palette: {
      bg: 0x0a0c16, floor: 0x161a2b, floorAlt: 0x1b2036,
      wall: 0x2b3358, wallTop: 0x3a447a, accent: 0x4f7cff, glow: 0x6ad0ff,
    },
    hudColor: '#4f7cff',
    ambient: { type: 'sine', freq: 84, gain: 0.05, detune: 3 },
    decorations: [
      { type: 'desk', tx: 10, ty: 4 }, { type: 'monitor', tx: 10, ty: 3 },
      { type: 'monitor', tx: 12, ty: 3 }, { type: 'whiteboard', tx: 16, ty: 2 },
      { type: 'server', tx: 20, ty: 4 }, { type: 'server', tx: 20, ty: 7 },
      { type: 'plant', tx: 2, ty: 20 }, { type: 'plant', tx: 21, ty: 20 },
      { type: 'rug', tx: 9, ty: 12 }, { type: 'desk', tx: 15, ty: 18 },
      { type: 'monitor', tx: 15, ty: 17 },
    ],
    npcs: ['identikeys'],
    doubts: [{ type: 'ships_solo', cap: 2 }, { type: 'too_junior', cap: 2 }],
  },

  /* ----- MUSIC: the inside of a memory ----------------------------------- */
  music: {
    id: 'music',
    name: 'Music World',
    subtitle: 'the inside of a memory',
    origin: { tx: 53, ty: 16 },
    size: { w: 24, h: 24 },
    entrance: { tx: 54, ty: 28 },
    palette: {
      bg: 0x0c0a14, floor: 0x191428, floorAlt: 0x1f1830,
      wall: 0x2a2140, wallTop: 0x3a2f57, accent: 0x9a7bff, glow: 0xc9a8ff,
    },
    hudColor: '#9a7bff',
    ambient: { type: 'sine', freq: 110, gain: 0.045, detune: 5 },
    decorations: [
      { type: 'piano', tx: 4, ty: 4 }, { type: 'candle', tx: 8, ty: 6 },
      { type: 'frame', tx: 10, ty: 2 }, { type: 'frame', tx: 14, ty: 2 },
      { type: 'crate', tx: 20, ty: 18 }, { type: 'lamp', tx: 19, ty: 5 },
      { type: 'plant', tx: 3, ty: 19 },
    ],
    npcs: ['swimming_pool'],
    doubts: [{ type: 'just_a_coder', cap: 2 }, { type: 'will_he_stay', cap: 1 }],
  },

  /* ----- TEACHING: a plaza in Almassora ---------------------------------- */
  teaching: {
    id: 'teaching',
    name: 'Teaching World',
    subtitle: 'a plaza in Almassora',
    origin: { tx: 28, ty: 38 },
    size: { w: 24, h: 16 },
    entrance: { tx: 40, ty: 39 },
    palette: {
      bg: 0x2a1d12, floor: 0xcaa46a, floorAlt: 0xbf9659,
      wall: 0x9c6b3f, wallTop: 0xb98a55, accent: 0xe8772e, glow: 0xffd98a,
    },
    hudColor: '#e8772e',
    ambient: { type: 'triangle', freq: 196, gain: 0.04, detune: 4 },
    decorations: [
      { type: 'schooldoor', tx: 10, ty: 2 }, { type: 'window', tx: 15, ty: 2 },
      { type: 'fountain', tx: 11, ty: 7 }, { type: 'bench', tx: 4, ty: 12 },
      { type: 'bench', tx: 18, ty: 12 }, { type: 'tree', tx: 2, ty: 3 },
      { type: 'tree', tx: 20, ty: 3 }, { type: 'flowers', tx: 6, ty: 14 },
      { type: 'flowers', tx: 17, ty: 14 },
    ],
    npcs: ['nalcap'],
    doubts: [{ type: 'culture_fit', cap: 2 }],
  },
};
