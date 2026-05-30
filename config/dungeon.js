/* =============================================================================
 * config/dungeon.js
 * -----------------------------------------------------------------------------
 * The dungeon as data: a graph of ROOMS on one master tile grid. A central hub
 * with three two-room wings. The engine (core/DungeonMap.js) reads this to build
 * walled rooms, carve doorways, gate doors, and place NPCs / decorations / Doubts.
 *
 *         [teach_inner]
 *         [teach_entry]            (gated door between entry and inner)
 * [dev_inner][dev_entry][HUB][music_entry][music_inner]
 *
 * ROOM SCHEMA
 *   region       region id (config/worlds.js) for palette / ambient / theme
 *   rect         { tx, ty, w, h } floor rectangle in MASTER tile coords
 *   map          { c, r } cell position on the minimap grid
 *   npc          (optional) character id that stands in this room
 *   doubts       (optional) finite encounter: [{ type, count }] — no respawn
 *   decorations  (optional) [{ type, tx, ty }] RELATIVE to the room's rect
 *   doors        connections: [{ to, side:'N'|'S'|'E'|'W', gate?:'doubts' }]
 *                A door is authored once (on one of the two rooms). `gate:'doubts'`
 *                = locked until THIS room's doubts are cleared.
 *
 * To extend: add a room (non-overlapping rect), wire a door to it, done.
 * ========================================================================== */

const DUNGEON = { TILE: 32, cols: 142, rows: 56, start: 'hub_entry' };

const ROOMS = {
  /* ----- HUB: entrance chamber ------------------------------------------- */
  hub_entry: {
    region: 'hub',
    rect: { tx: 58, ty: 2, w: 26, h: 16 },
    map: { c: 2, r: 1 },
    npc: 'guide',
    decorations: [
      { type: 'lamp', tx: 3, ty: 8 }, { type: 'lamp', tx: 22, ty: 8 },
      { type: 'plant', tx: 1, ty: 1 }, { type: 'crate', tx: 24, ty: 1 },
    ],
    doors: [
      { to: 'dev_entry', side: 'W' },
      { to: 'music_entry', side: 'E' },
      { to: 'teach_entry', side: 'S' },
    ],
  },

  /* ----- DEV wing (west) ------------------------------------------------- */
  dev_entry: {
    region: 'dev',
    rect: { tx: 30, ty: 2, w: 26, h: 16 },
    map: { c: 1, r: 1 },
    doubts: [{ type: 'ships_solo', count: 2 }, { type: 'too_junior', count: 1 }],
    decorations: [{ type: 'crate', tx: 3, ty: 3 }, { type: 'server', tx: 22, ty: 12 }],
    doors: [{ to: 'dev_inner', side: 'W', gate: 'doubts' }],
  },
  dev_inner: {
    region: 'dev',
    rect: { tx: 2, ty: 2, w: 26, h: 16 },
    map: { c: 0, r: 1 },
    npc: 'identikeys',
    decorations: [
      { type: 'desk', tx: 4, ty: 3 }, { type: 'monitor', tx: 4, ty: 2 },
      { type: 'monitor', tx: 6, ty: 2 }, { type: 'whiteboard', tx: 10, ty: 1 },
      { type: 'server', tx: 21, ty: 2 }, { type: 'server', tx: 21, ty: 5 },
      { type: 'plant', tx: 1, ty: 14 }, { type: 'plant', tx: 23, ty: 14 },
      { type: 'rug', tx: 9, ty: 9 }, { type: 'desk', tx: 16, ty: 13 },
      { type: 'monitor', tx: 16, ty: 12 },
    ],
  },

  /* ----- MUSIC wing (east) ----------------------------------------------- */
  music_entry: {
    region: 'music',
    rect: { tx: 86, ty: 2, w: 26, h: 16 },
    map: { c: 3, r: 1 },
    doubts: [{ type: 'just_a_coder', count: 2 }, { type: 'will_he_stay', count: 1 }],
    decorations: [{ type: 'lamp', tx: 3, ty: 3 }, { type: 'crate', tx: 22, ty: 13 }],
    doors: [{ to: 'music_inner', side: 'E', gate: 'doubts' }],
  },
  music_inner: {
    region: 'music',
    rect: { tx: 114, ty: 2, w: 26, h: 16 },
    map: { c: 4, r: 1 },
    npc: 'swimming_pool',
    decorations: [
      { type: 'piano', tx: 4, ty: 3 }, { type: 'candle', tx: 8, ty: 5 },
      { type: 'frame', tx: 11, ty: 1 }, { type: 'frame', tx: 15, ty: 1 },
      { type: 'lamp', tx: 20, ty: 3 }, { type: 'plant', tx: 1, ty: 14 },
      { type: 'crate', tx: 22, ty: 13 },
    ],
  },

  /* ----- TEACHING wing (south) ------------------------------------------- */
  teach_entry: {
    region: 'teaching',
    rect: { tx: 58, ty: 20, w: 26, h: 16 },
    map: { c: 2, r: 2 },
    doubts: [{ type: 'culture_fit', count: 2 }],
    decorations: [{ type: 'bench', tx: 3, ty: 12 }, { type: 'flowers', tx: 20, ty: 3 }],
    doors: [{ to: 'teach_inner', side: 'S', gate: 'doubts' }],
  },
  teach_inner: {
    region: 'teaching',
    rect: { tx: 58, ty: 38, w: 26, h: 16 },
    map: { c: 2, r: 3 },
    npc: 'nalcap',
    decorations: [
      { type: 'schooldoor', tx: 10, ty: 1 }, { type: 'window', tx: 16, ty: 1 },
      { type: 'fountain', tx: 11, ty: 7 }, { type: 'bench', tx: 3, ty: 12 },
      { type: 'bench', tx: 20, ty: 12 }, { type: 'tree', tx: 1, ty: 2 },
      { type: 'tree', tx: 23, ty: 2 }, { type: 'flowers', tx: 6, ty: 14 },
      { type: 'flowers', tx: 18, ty: 14 },
    ],
  },
};
