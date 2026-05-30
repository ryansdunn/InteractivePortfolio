/* =============================================================================
 * core/DungeonMap.js
 * -----------------------------------------------------------------------------
 * Turns the ROOMS graph (config/dungeon.js) into playable geometry:
 *   - classifies every tile as floor / wall / void
 *   - carves doorways through the walls between connected rooms
 *   - paints floors + walls into one RenderTexture (region-themed)
 *   - builds merged-rectangle wall colliders (few bodies, not per-tile)
 *   - places locked-door sprites + colliders on gated doorways
 *   - exposes a room registry (pixel rects/centers) + openDoor()
 *
 * The scene wires player/enemy colliders against `wallObjects` and `doorBodies`
 * and calls `openDoor(roomId)` when a room is cleared.
 * ========================================================================== */

class DungeonMap {
  constructor(scene) {
    this.scene = scene;
    // Clone room config into a working registry (adds id + computed fields).
    this.rooms = {};
    Object.entries(ROOMS).forEach(([id, r]) => { this.rooms[id] = { id, ...r }; });
    this.wallObjects = [];
    this.doorBodies = [];
    this.doorsByOwner = {};
  }

  build() {
    const T = DUNGEON.TILE;
    const { cols, rows } = DUNGEON;
    const kind = [], reg = [];
    for (let y = 0; y < rows; y++) {
      kind[y] = new Array(cols).fill('void');
      reg[y] = new Array(cols).fill(null);
    }

    // 1) floors
    Object.values(this.rooms).forEach((r) => {
      for (let y = r.rect.ty; y < r.rect.ty + r.rect.h; y++)
        for (let x = r.rect.tx; x < r.rect.tx + r.rect.w; x++) {
          kind[y][x] = 'floor'; reg[y][x] = r.region;
        }
    });

    // 2) walls = any void tile touching a floor tile (8-neighbour ring)
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        if (kind[y][x] !== 'void') continue;
        let region = null;
        for (let dy = -1; dy <= 1 && !region; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny < 0 || nx < 0 || ny >= rows || nx >= cols) continue;
            if (kind[ny][nx] === 'floor') { region = reg[ny][nx]; break; }
          }
        if (region) { kind[y][x] = 'wall'; reg[y][x] = region; }
      }

    // 3) carve doorways; remember gated ones
    const gated = [];
    this._eachDoor((A, B, door) => {
      const tiles = this._doorwayTiles(A, B, door.side);
      tiles.forEach(({ x, y }) => { kind[y][x] = 'floor'; reg[y][x] = A.region; });
      if (door.gate) gated.push({ owner: A.id, tiles });
    });

    this.kind = kind; this.reg = reg;

    // 4) visuals — stamp every non-void tile into one RenderTexture
    const rt = this.scene.add.renderTexture(0, 0, cols * T, rows * T).setOrigin(0).setDepth(-10);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const k = kind[y][x];
        if (k === 'void') continue;
        const region = reg[y][x] || 'hub';
        rt.draw(k === 'floor' ? `${region}-floor` : `${region}-wall`, x * T, y * T);
      }

    // 5) wall colliders — merge contiguous horizontal runs into one body each
    for (let y = 0; y < rows; y++) {
      let x = 0;
      while (x < cols) {
        if (kind[y][x] === 'wall') {
          let x2 = x;
          while (x2 < cols && kind[y][x2] === 'wall') x2++;
          this._staticRect(x * T, y * T, (x2 - x) * T, T);
          x = x2;
        } else x++;
      }
    }

    // 6) locked doors — sprite + collider over each gated doorway
    gated.forEach((d) => {
      const xs = d.tiles.map((t) => t.x), ys = d.tiles.map((t) => t.y);
      const minx = Math.min(...xs), maxx = Math.max(...xs);
      const miny = Math.min(...ys), maxy = Math.max(...ys);
      const w = (maxx - minx + 1) * T, h = (maxy - miny + 1) * T;
      const cx = minx * T + w / 2, cy = miny * T + h / 2;
      const spr = this.scene.add.image(cx, cy, 'door').setDisplaySize(w, h).setDepth(cy);
      const body = this._staticRect(cx - w / 2, cy - h / 2, w, h, true);
      (this.doorsByOwner[d.owner] = this.doorsByOwner[d.owner] || []).push({ spr, body });
    });

    // 7) pixel rects + centres for the room-snap camera
    Object.values(this.rooms).forEach((r) => {
      r.px = { x: r.rect.tx * T, y: r.rect.ty * T, w: r.rect.w * T, h: r.rect.h * T };
      r.center = { x: r.px.x + r.px.w / 2, y: r.px.y + r.px.h / 2 };
    });

    return this;
  }

  /** Open (and remove collision for) the gated doors owned by a room. */
  openDoor(roomId) {
    const doors = this.doorsByOwner[roomId];
    if (!doors || !doors.length) return false;
    doors.forEach(({ spr, body }) => {
      if (body.body) body.body.enable = false;
      this.scene.tweens.add({
        targets: spr, alpha: 0, scaleX: spr.scaleX * 0.4, duration: 350,
        onComplete: () => spr.destroy(),
      });
    });
    this.doorsByOwner[roomId] = [];
    return true;
  }

  /** Which room's floor rect contains this pixel, or null (in a doorway/void). */
  roomAt(px, py) {
    for (const r of Object.values(this.rooms)) {
      if (px >= r.px.x && px < r.px.x + r.px.w && py >= r.px.y && py < r.px.y + r.px.h) return r;
    }
    return null;
  }

  // --- internals ---------------------------------------------------------
  _eachDoor(cb) {
    Object.values(this.rooms).forEach((A) => {
      (A.doors || []).forEach((door) => {
        const B = this.rooms[door.to];
        if (B) cb(A, B, door);
      });
    });
  }

  /** The separator tiles to carve for a doorway (2 wide, centred). */
  _doorwayTiles(A, B, side) {
    const a = A.rect, b = B.rect;
    const out = [];
    if (side === 'W' || side === 'E') {
      const cRow = a.ty + Math.floor(a.h / 2);
      const rows = [cRow - 1, cRow];
      const x0 = side === 'W' ? (b.tx + b.w) : (a.tx + a.w); // first separator col
      const x1 = side === 'W' ? (a.tx - 1) : (b.tx - 1);      // last separator col
      for (let x = x0; x <= x1; x++) rows.forEach((y) => out.push({ x, y }));
    } else {
      const cCol = a.tx + Math.floor(a.w / 2);
      const cols = [cCol - 1, cCol];
      const y0 = side === 'N' ? (b.ty + b.h) : (a.ty + a.h);
      const y1 = side === 'N' ? (a.ty - 1) : (b.ty - 1);
      for (let y = y0; y <= y1; y++) cols.forEach((x) => out.push({ x, y }));
    }
    return out;
  }

  /** Invisible static-body rectangle; returns the game object. */
  _staticRect(x, y, w, h, isDoor) {
    const rect = this.scene.add.rectangle(x + w / 2, y + h / 2, w, h);
    rect.setVisible(false);
    this.scene.physics.add.existing(rect, true);
    if (isDoor) this.doorBodies.push(rect);
    else this.wallObjects.push(rect);
    return rect;
  }
}
