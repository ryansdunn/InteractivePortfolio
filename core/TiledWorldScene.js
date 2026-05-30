/* =============================================================================
 * core/TiledWorldScene.js
 * -----------------------------------------------------------------------------
 * The open-world explorer. Loads the generated Tiled map (assets/maps/world.tmj)
 * + terrain tileset, builds collision from tile properties, and follows the
 * player with a smooth scrolling camera across one continuous organic island.
 *
 * Everything in the world comes from the Tiled map's OBJECT LAYERS (the "Tiled
 * contract") — npcs, signs, fragments, spawn — so the world is authored in Tiled,
 * not hardcoded. Biome theming (palette / ambient / HUD colour) comes from
 * WORLD.biomes (config/world.js); biome at the player is read per-tile from the
 * map's `biomeGrid` property, so it respects the bleeding, non-rectangular edges.
 * ========================================================================== */

const BIOME_KEY = { w: 'wilds', d: 'dev', t: 'teaching', m: 'music' };

class TiledWorldScene extends Phaser.Scene {
  constructor() {
    super({ key: 'World' });
  }

  create(data) {
    this.cameras.main.setBackgroundColor(0x1a3068); // sea, where the map is void

    // --- tilemap + layers ---
    const map = this.make.tilemap({ key: 'world' });
    this.map = map;
    const tiles = map.addTilesetImage('terrain', 'terrain');
    this.groundLayer = map.createLayer('ground', tiles, 0, 0).setDepth(-20);
    this.terrainLayer = map.createLayer('terrain', tiles, 0, 0).setDepth(-10);
    this.groundLayer.setCollisionByProperty({ collides: true });
    this.terrainLayer.setCollisionByProperty({ collides: true });

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    // biome grid (per-tile) from the map properties
    const td = this.cache.tilemap.get('world').data;
    this.biomeGrid = ((td.properties || []).find((p) => p.name === 'biomeGrid') || {}).value || '';

    this._buildPlayer(data);
    this._buildNpcs();
    this._buildSigns();
    this._buildFragments();

    // input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,E,J');
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.facing = { x: 0, y: 1 };

    this.dialogue = new DialogueBox(this);
    this.combat = new CombatSystem(this);

    // Wire mobile action button (context-aware: dialogue → talk → attack)
    Portfolio.mobileControls.onAction = () => {
      if (this.dialogue.isOpen) { this.dialogue.advance(); return; }
      if (this.nearbyNpc && !Portfolio.modalOpen) { this._doInteract(); return; }
      if (!this.combat._blocked()) this.combat._tryAttack();
    };

    this.nearbyNpc = null;
    this.currentBiome = null;
    this.discoveredFragments = new Set();

    const startAudio = () => { AudioManager.resume(); this.currentBiome = null; this._updateBiome(true); };
    this.input.once('pointerdown', startAudio);
    this.input.keyboard.once('keydown', startAudio);

    this._updateBiome(true);
    this.cameras.main.fadeIn(450, 0, 0, 0);
  }

  // --- collision query ---------------------------------------------------
  isBlocked(x, y) {
    const a = this.groundLayer.getTileAtWorldXY(x, y);
    const b = this.terrainLayer.getTileAtWorldXY(x, y);
    return (a && a.collides) || (b && b.collides);
  }

  biomeAtPx(x, y) {
    const tx = Math.floor(x / this.map.tileWidth);
    const ty = Math.floor(y / this.map.tileHeight);
    if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) return 'wilds';
    return BIOME_KEY[this.biomeGrid[ty * this.map.width + tx]] || 'wilds';
  }

  // --- build from object layers -----------------------------------------
  _objProp(obj, name) {
    const p = (obj.properties || []).find((q) => q.name === name);
    return p ? p.value : undefined;
  }

  _spawnPoint(data) {
    // deep-link → near that biome's anchor; else the map's spawn object.
    if (data && data.spawn && WORLD.biomes[data.spawn] && data.spawn !== 'wilds') {
      const a = WORLD.biomes[data.spawn].anchor;
      return { x: a.tx * this.map.tileWidth + 8, y: a.ty * this.map.tileHeight + 8 };
    }
    const layer = this.map.getObjectLayer('spawn');
    const o = layer && layer.objects[0];
    return o ? { x: o.x + 8, y: o.y + 8 } : { x: this.map.widthInPixels / 2, y: this.map.heightInPixels / 2 };
  }

  _buildPlayer(data) {
    const s = this._spawnPoint(data);
    this.spawnPx = s;
    this.player = this.physics.add.sprite(s.x, s.y, 'player');
    this.player.setCollideWorldBounds(true).setSize(12, 10).setOffset(6, 18).setDepth(s.y);
    this.physics.add.collider(this.player, this.groundLayer);
    this.physics.add.collider(this.player, this.terrainLayer);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(2.5); // 16px tiles → readable explorer scale
  }

  _buildNpcs() {
    this.npcs = [];
    const layer = this.map.getObjectLayer('npcs');
    if (!layer) return;
    layer.objects.forEach((o) => {
      const id = this._objProp(o, 'characterId');
      const c = CHARACTERS[id];
      if (!c) { console.warn('Unknown characterId in map:', id); return; }
      const x = o.x + 8, y = o.y + 8;
      const sprite = this.physics.add.staticImage(x, y, `npc-${c.id}`).setDepth(y);
      const name = this.add.text(x, y - 24, c.name, {
        fontFamily: 'monospace', fontSize: '11px', color: '#fff',
        backgroundColor: '#00000099', padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(y + 1);
      const bubble = this.add.image(x + 14, y - 20, 'prompt-bubble').setDepth(y + 2);
      this.tweens.add({ targets: bubble, y: bubble.y - 4, yoyo: true, repeat: -1, duration: 700 });
      const met = this.add.text(x, y - 36, '✓', { fontFamily: 'monospace', fontSize: '12px', color: '#7CFFb0' })
        .setOrigin(0.5).setDepth(y + 2).setVisible(GameState.hasMet(c.id));
      this.npcs.push({ character: c, sprite, bubble, metMark: met });
    });
  }

  _buildSigns() {
    this.signs = [];
    const layer = this.map.getObjectLayer('signs');
    if (!layer) return;
    layer.objects.forEach((o) => {
      this.signs.push({ x: o.x + 8, y: o.y + 8, text: this._objProp(o, 'text'), dir: this._objProp(o, 'dir') });
    });
  }

  _buildFragments() {
    this.fragments = [];
    const layer = this.map.getObjectLayer('fragments');
    if (!layer) return;
    layer.objects.forEach((o, i) => {
      const x = o.x + 8, y = o.y + 8;
      // a soft glow so the dead-end reads as "something is here"
      const glow = this.add.circle(x, y, 9, 0xcfe0ff, 0.18).setDepth(y - 1);
      this.tweens.add({ targets: glow, alpha: 0.5, scale: 1.3, yoyo: true, repeat: -1, duration: 1400 });
      this.fragments.push({ id: 'frag' + i, x, y, title: this._objProp(o, 'title'), text: this._objProp(o, 'text') });
    });
  }

  // --- biome theming -----------------------------------------------------
  _updateBiome(instant) {
    const key = this.biomeAtPx(this.player.x, this.player.y);
    if (this.currentBiome === key) return;
    this.currentBiome = key;
    const b = WORLD.biomes[key];
    AudioManager.play({ id: key, ambient: b.ambient });
    Portfolio.profileCard.setTheme(b.hudColor);
    if (!instant) Portfolio.toast(`${b.name} — ${b.subtitle}`, b.hudColor);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('world', key);
      window.history.replaceState({}, '', url);
    } catch (e) {}
  }

  // --- loop --------------------------------------------------------------
  update(time, delta) {
    if (!this.player) return;
    const blocked = this.dialogue.isOpen || Portfolio.modalOpen;
    this._move(blocked);
    this._updateBiome(false);
    this._updateProximity();
    this._handleInteract(blocked);
    this.combat.update(delta, blocked);
    this.player.setDepth(this.player.y);
  }

  _move(blocked) {
    const b = this.player.body;
    if (this.combat && this.combat.playerKnocked()) return;
    b.setVelocity(0);
    if (blocked) return;
    const speed = 165;
    let vx = 0, vy = 0;

    // Keyboard
    if (this.cursors.left.isDown || this.keys.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) vy += 1;

    // Virtual joystick (mobile only; no-op on desktop)
    const mc = Portfolio.mobileControls;
    if (mc && mc.active) {
      const { x: jx, y: jy } = mc.joystick;
      if (Math.abs(jx) > 0.12 || Math.abs(jy) > 0.12) { vx = jx; vy = jy; }
    }

    if (vx === 0 && vy === 0) return;
    const len = Math.hypot(vx, vy);
    b.setVelocity(vx / len * speed, vy / len * speed);
    const fx = vx > 0.15 ? 1 : vx < -0.15 ? -1 : 0;
    const fy = vy > 0.15 ? 1 : vy < -0.15 ? -1 : 0;
    if (fx || fy) { this.facing = { x: fx || this.facing.x, y: fy || this.facing.y }; }
    if (vx !== 0) this.player.setFlipX(vx < 0);
  }

  _updateProximity() {
    const px = this.player.x, py = this.player.y;
    // nearest NPC
    let npc = null;
    for (const n of this.npcs) {
      const d = Phaser.Math.Distance.Between(px, py, n.sprite.x, n.sprite.y);
      n.bubble.setVisible(d < 48 && !this.dialogue.isOpen);
      if (d < 48 && (!npc || d < npc.d)) npc = { n, d };
    }
    this.nearbyNpc = npc ? npc.n : null;

    // fragments: reveal on proximity (no keypress)
    let frag = null;
    for (const f of this.fragments) {
      const d = Phaser.Math.Distance.Between(px, py, f.x, f.y);
      if (d < 40 && (!frag || d < frag.d)) frag = { f, d };
    }
    if (frag) this._revealFragment(frag.f);
    else if (this._activeFragment) { Portfolio.fragmentCard.hide(); this._activeFragment = null; }

    // signs: nearest sign shows its line; otherwise NPC hint; else nothing
    let sign = null;
    for (const s of this.signs) {
      const d = Phaser.Math.Distance.Between(px, py, s.x, s.y);
      if (d < 46 && (!sign || d < sign.d)) sign = { s, d };
    }
    if (this.dialogue.isOpen) return;
    if (this.nearbyNpc) Portfolio.setHint(`Press SPACE / E to talk to ${this.nearbyNpc.character.name}`);
    else if (sign) Portfolio.setHint(`${this._arrow(sign.s.dir)}  ${sign.s.text}`);
    else Portfolio.setHint('');
  }

  _arrow(dir) {
    return ({ N: '↑', S: '↓', E: '→', W: '←', NE: '↗', NW: '↖', SE: '↘', SW: '↙' })[dir] || '•';
  }

  _revealFragment(f) {
    if (this._activeFragment === f.id) return;
    this._activeFragment = f.id;
    Portfolio.fragmentCard.show(f);
    if (!this.discoveredFragments.has(f.id)) {
      this.discoveredFragments.add(f.id);
      AudioManager.chime();
      Portfolio.toast(`a fragment — ${this.discoveredFragments.size}/${this.fragments.length} found`, '#cfe0ff');
    }
  }

  _handleInteract(blocked) {
    const pressed = Phaser.Input.Keyboard.JustDown(this.interactKey) || Phaser.Input.Keyboard.JustDown(this.keys.E);
    if (!pressed) return;
    if (this.dialogue.isOpen) { this.dialogue.advance(); return; }
    if (blocked || !this.nearbyNpc) return;
    this._doInteract();
  }

  _doInteract() {
    const n = this.nearbyNpc;
    Portfolio.setHint('');
    this.dialogue.open(n.character, () => {
      GameState.recordMeeting(n.character);
      n.metMark.setVisible(true);
      if (n.character.panel) Portfolio.infoPanel.open(n.character);
    });
  }
}
