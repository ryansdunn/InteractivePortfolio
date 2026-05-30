/* =============================================================================
 * components/Minimap.js
 * -----------------------------------------------------------------------------
 * A small DOM-canvas dungeon map that reveals rooms as you enter them. Drawn
 * from the room registry (each room's `map:{c,r}` grid cell + `doors`). The
 * current room is highlighted; cleared rooms get a check; undiscovered rooms
 * stay hidden. Updated via the Portfolio bridge on room changes.
 * ========================================================================== */

class Minimap {
  constructor() {
    this.el = document.getElementById('minimap');
    this.rooms = null;
    this.discovered = new Set();
    this.cleared = new Set();
    this.current = null;
    this.theme = '#8aa0c8';
  }

  /** Provide the room registry (called by the scene once the map is built). */
  init(rooms) {
    this.rooms = rooms;
    this.discovered.clear();
    this.cleared.clear();
    this.current = null;

    const cells = Object.values(rooms).map((r) => r.map);
    this.minC = Math.min(...cells.map((m) => m.c));
    this.maxC = Math.max(...cells.map((m) => m.c));
    this.minR = Math.min(...cells.map((m) => m.r));
    this.maxR = Math.max(...cells.map((m) => m.r));

    this.cell = 16; this.gap = 8; this.pad = 10;
    const cols = this.maxC - this.minC + 1;
    const rows = this.maxR - this.minR + 1;
    const w = this.pad * 2 + cols * this.cell + (cols - 1) * this.gap;
    const h = this.pad * 2 + rows * this.cell + (rows - 1) * this.gap + 16;

    this.el.innerHTML = `<div class="mm-title">DUNGEON</div><canvas width="${w}" height="${h - 0}"></canvas>`;
    this.canvas = this.el.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.el.classList.add('show');
    this._draw();
  }

  setTheme(color) { this.theme = color || this.theme; this._draw(); }
  reveal(id) { if (this.rooms && this.rooms[id]) { this.discovered.add(id); this._draw(); } }
  markCleared(id) { this.cleared.add(id); this._draw(); }
  setCurrent(id) { this.current = id; this.discovered.add(id); this._draw(); }

  _cellXY(m) {
    return {
      x: this.pad + (m.c - this.minC) * (this.cell + this.gap),
      y: this.pad + 16 + (m.r - this.minR) * (this.cell + this.gap),
    };
  }

  _draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Door links between discovered neighbours.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    Object.values(this.rooms).forEach((r) => {
      (r.doors || []).forEach((d) => {
        const b = this.rooms[d.to];
        if (!b) return;
        if (!this.discovered.has(r.id) || !this.discovered.has(b.id)) return;
        const a = this._cellXY(r.map), c = this._cellXY(b.map);
        ctx.beginPath();
        ctx.moveTo(a.x + this.cell / 2, a.y + this.cell / 2);
        ctx.lineTo(c.x + this.cell / 2, c.y + this.cell / 2);
        ctx.stroke();
      });
    });

    // Room cells.
    Object.values(this.rooms).forEach((r) => {
      if (!this.discovered.has(r.id)) return;
      const { x, y } = this._cellXY(r.map);
      const isCur = r.id === this.current;
      ctx.fillStyle = isCur ? this.theme : 'rgba(180,195,230,0.35)';
      ctx.fillRect(x, y, this.cell, this.cell);
      if (isCur) {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, this.cell - 2, this.cell - 2);
      }
      if (this.cleared.has(r.id)) {
        ctx.fillStyle = '#7CFFb0';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('✓', x + 4, y + 12);
      }
    });
  }
}
