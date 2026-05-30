/* =============================================================================
 * tools/generate-map.mjs   —   run: node tools/generate-map.mjs
 * -----------------------------------------------------------------------------
 * One-shot authoring tool. Reads config/world.js and bakes an editable Tiled map
 * (assets/maps/world.tmj) + a terrain tileset image (assets/tilesets/terrain.png)
 * that Tiled and Phaser both load. Runtime stays no-build.
 *
 * It builds an ORGANIC ISLAND with noise (elevation + island falloff), so coasts,
 * forests, and cliffs have irregular, bleeding edges — not rectangles. Biomes are
 * assigned by nearest anchor under domain-warped coordinates, so biome borders
 * bleed too. Paths are carved between landmarks. NPCs / signs / fragments from the
 * config are written into Tiled object layers.
 *
 * NOTE ON ART: this generates a clean "Kenney-style" CC0 atlas of our own (no
 * reliable Kenney nature-pack mirror was reachable). To swap in a real tileset
 * later, replace assets/tilesets/terrain.png and the TILES index map below, then
 * re-run. The rest of the pipeline is unchanged.
 * ========================================================================== */

import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WORLD from '../config/world.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = WORLD.width, H = WORLD.height, TS = WORLD.tile;

/* ------------------------------------------------------------------ PNG out */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crcbuf = Buffer.alloc(4); crcbuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcbuf]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* ----------------------------------------------------------------- noise */
function mkNoise(seed) {
  const hash = (x, y) => {
    let h = (x | 0) * 374761393 + (y | 0) * 668265263 + seed * 362437;
    h = (h ^ (h >>> 13)) * 1274126177; h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  const value = (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = smooth(x - x0), fy = smooth(y - y0);
    const a = hash(x0, y0), b = hash(x0 + 1, y0), c = hash(x0, y0 + 1), d = hash(x0 + 1, y0 + 1);
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  };
  const fbm = (x, y, oct = 4) => {
    let amp = 0.5, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < oct; o++) { sum += amp * value(x * freq, y * freq); norm += amp; amp *= 0.5; freq *= 2; }
    return sum / norm;
  };
  return { value, fbm };
}

/* --------------------------------------------------- tileset (our atlas) */
// localId -> name. gid = localId + 1 (firstgid 1). Ground tiles are opaque;
// overlay tiles have transparent backgrounds so the ground shows through.
const TILES = ['deep_water', 'water', 'sand', 'grass', 'grass_flowers', 'path',
  'cliff', 'ruin_floor', 'tree', 'rock', 'ruin_wall', 'bush', 'reeds', 'flowers',
  'signpost', 'fragment', 'snow'];
const ID = Object.fromEntries(TILES.map((n, i) => [n, i]));
const COLLIDES = ['deep_water', 'water', 'cliff', 'tree', 'rock', 'ruin_wall'].map((n) => ID[n]);
const ATLAS_COLS = 6;
const ATLAS_ROWS = Math.ceil(TILES.length / ATLAS_COLS);

function buildAtlas() {
  const aw = ATLAS_COLS * TS, ah = ATLAS_ROWS * TS;
  const buf = Buffer.alloc(aw * ah * 4); // transparent
  const px = (ox, oy, x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= TS || y >= TS) return;
    const i = ((oy + y) * aw + (ox + x)) * 4; buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  };
  const fill = (ox, oy, r, g, b) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) px(ox, oy, x, y, r, g, b); };
  const speck = (ox, oy, n, r, g, b, seed) => { let s = seed; for (let k = 0; k < n; k++) { s = (s * 1103515245 + 12345) & 0x7fffffff; const x = s % TS; s = (s * 1103515245 + 12345) & 0x7fffffff; const y = s % TS; px(ox, oy, x, y, r, g, b); } };
  const disc = (ox, oy, cx, cy, rad, r, g, b, a = 255) => { for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) px(ox, oy, x, y, r, g, b, a); };
  const rect = (ox, oy, x0, y0, x1, y1, r, g, b, a = 255) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(ox, oy, x, y, r, g, b, a); };

  const paint = {
    deep_water: (o) => { fill(o[0], o[1], 26, 48, 104); speck(o[0], o[1], 10, 20, 40, 92, 7); },
    water: (o) => { fill(o[0], o[1], 46, 86, 150); speck(o[0], o[1], 12, 92, 142, 200, 11); speck(o[0], o[1], 8, 36, 72, 130, 5); },
    sand: (o) => { fill(o[0], o[1], 214, 196, 140); speck(o[0], o[1], 16, 196, 176, 120, 3); speck(o[0], o[1], 8, 228, 212, 160, 9); },
    grass: (o) => { fill(o[0], o[1], 84, 142, 74); speck(o[0], o[1], 22, 64, 118, 58, 13); speck(o[0], o[1], 14, 104, 166, 90, 21); },
    grass_flowers: (o) => { fill(o[0], o[1], 84, 142, 74); speck(o[0], o[1], 16, 64, 118, 58, 13); [[3, 4, 240, 90, 110], [11, 6, 240, 210, 90], [7, 12, 235, 235, 245], [13, 11, 150, 120, 230]].forEach(([x, y, r, g, b]) => px(o[0], o[1], x, y, r, g, b)); },
    path: (o) => { fill(o[0], o[1], 172, 142, 96); speck(o[0], o[1], 18, 150, 120, 80, 17); speck(o[0], o[1], 8, 192, 166, 120, 4); },
    cliff: (o) => { fill(o[0], o[1], 122, 120, 134); rect(o[0], o[1], 0, 0, 15, 2, 154, 152, 166); speck(o[0], o[1], 18, 92, 90, 104, 6); rect(o[0], o[1], 4, 6, 5, 13, 92, 90, 104); rect(o[0], o[1], 10, 4, 11, 12, 92, 90, 104); },
    ruin_floor: (o) => { fill(o[0], o[1], 142, 138, 150); rect(o[0], o[1], 0, 7, 15, 8, 104, 100, 114); rect(o[0], o[1], 7, 0, 8, 15, 104, 100, 114); speck(o[0], o[1], 8, 120, 116, 130, 8); },
    tree: (o) => { rect(o[0], o[1], 7, 10, 8, 15, 96, 64, 36); disc(o[0], o[1], 8, 6, 5, 52, 116, 58); disc(o[0], o[1], 6, 5, 3, 72, 142, 74); px(o[0], o[1], 5, 4, 110, 168, 96); },
    rock: (o) => { disc(o[0], o[1], 8, 9, 5, 122, 120, 134); disc(o[0], o[1], 6, 8, 3, 150, 148, 162); rect(o[0], o[1], 3, 13, 13, 14, 0, 0, 0, 60); },
    ruin_wall: (o) => { rect(o[0], o[1], 2, 3, 13, 15, 154, 150, 160); rect(o[0], o[1], 2, 7, 13, 7, 108, 104, 116); rect(o[0], o[1], 7, 3, 7, 15, 108, 104, 116); rect(o[0], o[1], 4, 3, 6, 3, 0, 0, 0, 0); rect(o[0], o[1], 10, 3, 12, 4, 0, 0, 0, 0); },
    bush: (o) => { disc(o[0], o[1], 8, 10, 4, 66, 124, 64); disc(o[0], o[1], 6, 9, 2, 88, 150, 84); },
    reeds: (o) => { for (const x of [5, 8, 11]) rect(o[0], o[1], x, 6, x, 15, 92, 150, 80); },
    flowers: (o) => { [[5, 8, 240, 90, 110], [9, 6, 240, 210, 90], [8, 11, 235, 235, 245]].forEach(([x, y, r, g, b]) => { px(o[0], o[1], x, y, r, g, b); px(o[0], o[1], x + 1, y, r, g, b); }); },
    signpost: (o) => { rect(o[0], o[1], 7, 6, 8, 15, 110, 78, 44); rect(o[0], o[1], 2, 3, 13, 7, 156, 120, 72); rect(o[0], o[1], 2, 3, 13, 3, 120, 88, 50); },
    fragment: (o) => { disc(o[0], o[1], 8, 8, 6, 200, 220, 255, 70); rect(o[0], o[1], 7, 5, 8, 11, 235, 240, 255); rect(o[0], o[1], 5, 7, 10, 8, 235, 240, 255); },
    snow: (o) => { fill(o[0], o[1], 218, 230, 252); speck(o[0], o[1], 14, 200, 215, 245, 23); speck(o[0], o[1], 8, 248, 252, 255, 17); speck(o[0], o[1], 4, 160, 185, 220, 11); },
  };

  TILES.forEach((name, id) => {
    const o = [(id % ATLAS_COLS) * TS, Math.floor(id / ATLAS_COLS) * TS];
    (paint[name] || ((oo) => fill(oo[0], oo[1], 255, 0, 255)))(o);
  });

  const dir = path.join(ROOT, 'assets/tilesets');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'terrain.png'), encodePNG(aw, ah, buf));
  return { aw, ah };
}

/* ------------------------------------------------------------- map build */
function build() {
  const n = mkNoise(WORLD.seed);
  const warpA = mkNoise(WORLD.seed + 7), warpB = mkNoise(WORLD.seed + 19);
  const biomeKeys = Object.keys(WORLD.biomes);
  const flavorOf = {};
  biomeKeys.forEach((k) => (flavorOf[k] = WORLD.biomes[k].flavor));
  const waterLevel = { coast: 0.34, meadow: 0.30, forest_ruins: 0.36, wilds: 0.37 };
  const forestThresh = { coast: 0.62, meadow: 0.74, forest_ruins: 0.50, wilds: 0.62 };

  const ground = new Array(W * H);
  const overlay = new Array(W * H).fill(0);
  const biome = new Array(W * H);
  const solid = new Array(W * H).fill(false);
  const cx = W / 2, cy = H / 2, maxR = Math.min(W, H) / 2;

  const biomeAt = (x, y) => {
    const wx = x + (warpA.fbm(x * 0.06, y * 0.06) - 0.5) * 34;
    const wy = y + (warpB.fbm(x * 0.06, y * 0.06) - 0.5) * 34;
    let best = null, bd = Infinity;
    for (const k of biomeKeys) {
      const a = WORLD.biomes[k].anchor;
      const d = (wx - a.tx) ** 2 + (wy - a.ty) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  };

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const bk = biomeAt(x, y);
    biome[i] = bk;
    const fl = flavorOf[bk];

    // elevation with radial island falloff → coasts at the world's edges
    let e = n.fbm(x * 0.045, y * 0.045, 5);
    const dr = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxR;
    e -= Math.max(0, (dr - 0.74)) * 1.5;            // sink the rim into sea
    const moist = n.fbm((x + 1000) * 0.05, (y + 500) * 0.05, 4);
    const wl = waterLevel[fl];

    let g;
    if (e < wl - 0.06) g = 'deep_water';
    else if (e < wl) g = 'water';
    else if (e > 0.72) g = 'cliff';                 // inland highlands = obstacles
    else g = 'grass';

    // ruins cluster near the dev anchor (a lab among ruins)
    if (g === 'grass' && fl === 'forest_ruins') {
      const a = WORLD.biomes.dev.anchor;
      const rd = Math.sqrt((x - a.tx) ** 2 + (y - a.ty) ** 2);
      if (rd < 16 && n.value(x * 0.3, y * 0.3) > 0.62) g = 'ruin_floor';
    }
    // biome terrain overrides: dev→snowy, teaching→sandy beach
    if (bk === 'dev' && g === 'grass') g = 'snow';
    if (bk === 'teaching' && g === 'grass') g = 'sand';
    ground[i] = g;

    // overlay (trees / rocks / reeds / flowers), only on land
    if (g === 'grass') {
      const h = n.value(x * 0.9 + 5, y * 0.9 + 5);
      if (moist > forestThresh[fl] && h > 0.42) overlay[i] = 'tree';
      else if (e > 0.74 && h > 0.7) overlay[i] = 'rock';
      else if (fl === 'meadow' && h > 0.85) overlay[i] = 'flowers';
      else if (h > 0.93) overlay[i] = 'bush';
    } else if (g === 'ruin_floor') {
      if (n.value(x * 0.5 + 2, y * 0.5 + 2) > 0.7) overlay[i] = 'ruin_wall';
    }
  }

  // beach: land touching water becomes sand; flowers on some meadow grass
  const water = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return true; const g = ground[y * W + x]; return g === 'water' || g === 'deep_water'; };
  const g2 = ground.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (g2[i] === 'grass' && (water(x + 1, y) || water(x - 1, y) || water(x, y + 1) || water(x, y - 1))) {
      ground[i] = 'sand'; if (overlay[i] === 'tree' || overlay[i] === 'rock') overlay[i] = 0;
      if (n.value(x * 0.7, y * 0.7) > 0.6) overlay[i] = 'reeds';
    }
    if (g2[i] === 'grass' && biome[i] === 'teaching' && overlay[i] === 0 && n.value(x + 3, y + 9) > 0.86) overlay[i] = 'flowers';
  }

  // carve a walkable path between two tile points (wandering line)
  const carve = (ax, ay, bx, by) => {
    let x = ax, y = ay, guard = 0;
    while ((x !== bx || y !== by) && guard++ < 4000) {
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const nx = x + ox, ny = y + oy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const i = ny * W + nx;
        if (Math.abs(ox) + Math.abs(oy) <= 1) { ground[i] = 'path'; overlay[i] = 0; }
      }
      const wob = (n.value(x * 0.2, y * 0.2) - 0.5) * 1.4;
      if (Math.abs(bx - x) > Math.abs(by - y)) { x += Math.sign(bx - x); if (Math.random() < 0.25) y += Math.sign(wob) || 0; }
      else { y += Math.sign(by - y); if (Math.random() < 0.25) x += Math.sign(wob) || 0; }
    }
  };
  const sp = WORLD.spawn;
  for (const k of biomeKeys) if (k !== 'wilds') carve(sp.tx, sp.ty, WORLD.biomes[k].anchor.tx, WORLD.biomes[k].anchor.ty);
  WORLD.npcs.forEach((nc) => carve(WORLD.biomes[nc.biome].anchor.tx, WORLD.biomes[nc.biome].anchor.ty, nc.tx, nc.ty));
  // each fragment is a reachable DEAD-END: carve a spur from the nearest anchor.
  WORLD.fragments.forEach((f) => {
    let best = sp, bd = Infinity;
    for (const k of biomeKeys) { const a = WORLD.biomes[k].anchor; const d = (a.tx - f.tx) ** 2 + (a.ty - f.ty) ** 2; if (d < bd) { bd = d; best = a; } }
    carve(best.tx, best.ty, f.tx, f.ty);
  });

  // make sure landmarks + spawn sit on clear, walkable land
  const clearSpot = (tx, ty, rad = 1, deco = 0) => {
    for (let oy = -rad; oy <= rad; oy++) for (let ox = -rad; ox <= rad; ox++) {
      const x = tx + ox, y = ty + oy; if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      if (ground[i] === 'water' || ground[i] === 'deep_water' || ground[i] === 'cliff') ground[i] = 'grass';
      overlay[i] = 0;
    }
    if (deco) overlay[ty * W + tx] = deco;
  };
  clearSpot(sp.tx, sp.ty, 2);
  WORLD.npcs.forEach((nc) => clearSpot(nc.tx, nc.ty, 1));
  WORLD.signs.forEach((s) => clearSpot(s.tx, s.ty, 0, 'signpost'));
  WORLD.fragments.forEach((f) => clearSpot(f.tx, f.ty, 1, 'fragment'));

  // collision flags from final tiles
  for (let i = 0; i < W * H; i++) {
    if (COLLIDES.includes(ID[ground[i]])) solid[i] = true;
    if (overlay[i] && COLLIDES.includes(ID[overlay[i]])) solid[i] = true;
  }

  return { ground, overlay, biome };
}

/* --------------------------------------------------------- write the .tmj */
function writeMap({ ground, overlay, biome }, atlas) {
  const gid = (name) => (name ? ID[name] + 1 : 0);
  const groundData = ground.map(gid);
  const overlayData = overlay.map((o) => (o ? ID[o] + 1 : 0));
  const biomeGrid = biome.map((b) => b[0]).join(''); // w/d/t/m per tile

  let oid = 0;
  const obj = (name, type, tx, ty, props) => ({
    id: ++oid, name, type, x: tx * TS, y: ty * TS, width: TS, height: TS, visible: true, rotation: 0,
    properties: Object.entries(props).map(([k, v]) => ({ name: k, type: typeof v === 'boolean' ? 'bool' : 'string', value: v })),
  });

  const npcObjs = WORLD.npcs.map((n) => obj(n.characterId, 'npc', n.tx, n.ty, { characterId: n.characterId, biome: n.biome }));
  const signObjs = WORLD.signs.map((s, i) => obj('sign' + i, 'sign', s.tx, s.ty, { text: s.text, dir: s.dir }));
  const fragObjs = WORLD.fragments.map((f, i) => obj('fragment' + i, 'fragment', f.tx, f.ty, { title: f.title, text: f.text }));
  const spawnObj = obj('spawn', 'spawn', WORLD.spawn.tx, WORLD.spawn.ty, {});

  const tileProps = COLLIDES.map((id) => ({ id, properties: [{ name: 'collides', type: 'bool', value: true }] }));

  const map = {
    type: 'map', version: '1.10', tiledversion: '1.10.2', orientation: 'orthogonal',
    renderorder: 'right-down', infinite: false, width: W, height: H, tilewidth: TS, tileheight: TS,
    nextlayerid: 7, nextobjectid: oid + 1,
    properties: [
      { name: 'biomeGrid', type: 'string', value: biomeGrid },
      { name: 'spawnTx', type: 'int', value: WORLD.spawn.tx },
      { name: 'spawnTy', type: 'int', value: WORLD.spawn.ty },
    ],
    tilesets: [{
      firstgid: 1, name: 'terrain', tilewidth: TS, tileheight: TS, spacing: 0, margin: 0,
      tilecount: ATLAS_COLS * ATLAS_ROWS, columns: ATLAS_COLS,
      image: '../tilesets/terrain.png', imagewidth: atlas.aw, imageheight: atlas.ah,
      tiles: tileProps,
    }],
    layers: [
      { id: 1, type: 'tilelayer', name: 'ground', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: groundData },
      { id: 2, type: 'tilelayer', name: 'terrain', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: overlayData },
      { id: 3, type: 'objectgroup', name: 'spawn', opacity: 1, visible: true, objects: [spawnObj] },
      { id: 4, type: 'objectgroup', name: 'npcs', opacity: 1, visible: true, objects: npcObjs },
      { id: 5, type: 'objectgroup', name: 'signs', opacity: 1, visible: true, objects: signObjs },
      { id: 6, type: 'objectgroup', name: 'fragments', opacity: 1, visible: true, objects: fragObjs },
    ],
  };

  const dir = path.join(ROOT, 'assets/maps');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'world.tmj'), JSON.stringify(map));
  return { npcs: npcObjs.length, signs: signObjs.length, fragments: fragObjs.length };
}

/* ----------------------------------------------------------------- run */
const atlas = buildAtlas();
const m = build();
const counts = writeMap(m, atlas);
console.log(`✓ wrote assets/tilesets/terrain.png (${atlas.aw}x${atlas.ah})`);
console.log(`✓ wrote assets/maps/world.tmj (${W}x${H} tiles)`);
console.log(`  objects: ${counts.npcs} npcs, ${counts.signs} signs, ${counts.fragments} fragments`);
