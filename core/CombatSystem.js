/* =============================================================================
 * core/CombatSystem.js
 * -----------------------------------------------------------------------------
 * Forgiving, non-gating combat for the open world. You carry the sword from the
 * start. "Doubts" (config/doubts.js) — a recruiter's objections — roam each biome
 * as an optional hazard: they wander near you, chase, and deal contact damage.
 * Swing the sword (J / click) to dispel them. Nothing is ever locked; getting
 * emptied just respawns you at the start. Combat is atmosphere, not progression.
 * ========================================================================== */

const BIOME_DOUBTS = {
  wilds: ['too_junior'],
  dev: ['ships_solo', 'too_junior'],
  music: ['just_a_coder', 'will_he_stay'],
  teaching: ['culture_fit'],
};

// Canonical cycle order + how each weapon announces itself on switch.
const WEAPON_ORDER = ['sword', 'crossbow', 'bombs'];
const WEAPON_TOAST = {
  sword: 'Sword — close range, wide swing',
  crossbow: 'Crossbow — aim with the mouse, fire a bolt',
  bombs: 'Bombs — tossed where you face, blast on a fuse',
};
const WEAPON_COLOR = { sword: '#8aa0c8', crossbow: '#6ad0ff', bombs: '#e8772e' };

class CombatSystem {
  constructor(scene, opts = {}) {
    this.scene = scene;
    // Boss mode (BossScene): no roaming spawner — waves + the boss are scripted
    // by the scene, which also handles wave-clear / player-down / boss-defeat.
    this.bossMode = !!opts.bossMode;
    this.maxHearts = 5;
    this.health = this.maxHearts;
    this.hasSword = true; // open world: armed from the start, never trapped

    this.invulnUntil = 0;
    this.kbUntil = 0;
    this.attackCdUntil = 0;
    this.lastHitTime = -9999;
    this.regenEvery = 5000;
    this.regenAccum = 0;
    this._spawnAccum = 0;
    this.cap = 4; // max roaming Doubts near the player

    this.enemies = scene.physics.add.group();
    // The scene declares what enemies collide with (tilemap layers in the open
    // world, a static wall group in the cave). Works for both layers and groups.
    const layers = scene.collisionLayers || [scene.groundLayer, scene.terrainLayer];
    layers.forEach((l) => { if (l) scene.physics.add.collider(this.enemies, l); });
    scene.physics.add.collider(this.enemies, this.enemies);
    scene.physics.add.overlap(scene.player, this.enemies, (pl, en) => this._onPlayerHit(en));

    // Current weapon comes from the shared inventory so it carries across
    // scenes (the open world → the cave). Unlocking is driven by progression.
    this.weapon = GameState.currentWeapon();
    // Sword: origin near guard so it pivots from the hand during swings.
    this.sword = scene.add.image(0, 0, 'sword').setOrigin(0.25, 0.5).setDepth(1e6).setScale(0.9);
    // Crossbow: origin toward the stock so it aims from the hand.
    this.crossbow = scene.add.image(0, 0, 'crossbow').setOrigin(0.15, 0.5).setDepth(1e6).setScale(0.9).setVisible(false);
    // Bomb held in hand (the thrown bombs are separate sprites in `this.bombs`).
    this.bombHeld = scene.add.image(0, 0, 'bomb').setOrigin(0.5, 0.6).setDepth(1e6).setScale(0.9).setVisible(false);

    this.bolts = scene.physics.add.group();
    scene.physics.add.overlap(this.bolts, this.enemies, (bolt, en) => {
      if (!en.active || !bolt.active) return;
      this._damage(en, bolt.x, bolt.y);
      this.bolts.remove(bolt, true, true);
    });

    // Thrown bombs: lobbed projectiles that stop on walls and blast on a fuse
    // (or on contact with a doubt, whichever comes first).
    this.bombs = scene.physics.add.group();
    const wallLayers = scene.collisionLayers || [scene.groundLayer, scene.terrainLayer];
    wallLayers.forEach((l) => { if (l) scene.physics.add.collider(this.bombs, l); });
    scene.physics.add.overlap(this.bombs, this.enemies, (bomb, en) => {
      if (!bomb.active || !en.active) return;
      // Let it travel a moment first, so a bomb tossed past you doesn't instantly
      // pop on the thrower's own crowd before it's clear of the hand.
      if (this.scene.time.now < bomb.getData('armedAt')) return;
      const x = bomb.x, y = bomb.y;
      this.bombs.remove(bomb, true, true);
      this._explode(x, y);
    });

    this._swinging = false;
    this.attackKey = scene.keys.J;
    this.switchKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    // Canvas click attacks on desktop only; mobile uses the action button instead.
    scene.input.on('pointerdown', () => {
      if (!this._blocked() && !(Portfolio.mobileControls && Portfolio.mobileControls.active)) this._tryAttack();
    });

    this.setWeapon(this.weapon); // sync held-weapon visibility

    this.heartsEl = document.getElementById('hearts');
    if (this.heartsEl) this.heartsEl.classList.add('show');
    this._renderHearts();
  }

  playerKnocked() { return this.scene.time.now < this.kbUntil; }

  update(delta) {
    const now = this.scene.time.now;
    this._blink(now);
    this._holdWeapon();
    if (this._blocked()) { this._freezeEnemies(); return; }
    if (Phaser.Input.Keyboard.JustDown(this.switchKey)) this.cycleWeapon();
    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) this._tryAttack();
    this._regen(delta);
    if (!this.bossMode) {
      this._spawnAccum += delta;
      if (this._spawnAccum > 800) { this._spawnAccum = 0; this._maintain(); }
    }
    this._enemyAI();
    this._tickBolts();
    this._tickBombs();
  }

  setWeapon(type) {
    this.weapon = type;
    GameState.setCurrentWeapon(type);
    this.sword.setVisible(type === 'sword');
    this.crossbow.setVisible(type === 'crossbow');
    this.bombHeld.setVisible(type === 'bombs');
  }

  /** Add a weapon to the inventory (progression reward). */
  unlockWeapon(type) {
    GameState.unlockWeapon(type);
    if (!GameState.currentWeapon()) this.setWeapon(type);
  }

  /** The very first pick from the Guide — your single starting weapon. */
  setStarterWeapon(type) {
    GameState.setStarterWeapon(type);
    this.setWeapon(type);
  }

  /** Q — cycle to the next unlocked weapon (canonical order). */
  cycleWeapon() {
    const owned = WEAPON_ORDER.filter((w) => GameState.hasWeapon(w));
    if (owned.length <= 1) {
      Portfolio.toast('No other weapons yet — meet more of Ryan to earn them.', '#8aa0c8');
      return;
    }
    let i = owned.indexOf(this.weapon);
    if (i < 0) i = 0;
    const next = owned[(i + 1) % owned.length];
    this.setWeapon(next);
    AudioManager.chime();
    Portfolio.toast(WEAPON_TOAST[next], WEAPON_COLOR[next]);
  }

  // Position the held weapon at the player's hand in idle/walk.
  _holdWeapon() {
    if (this._swinging) return;
    const p = this.scene.player, f = this.scene.facing;
    if (this.weapon === 'crossbow') {
      const angle = this._mouseAngle(p);
      const ox = Math.cos(angle) * 8, oy = Math.sin(angle) * 8;
      const depth = p.depth + (Math.sin(angle) > 0 ? -1 : 1);
      this.crossbow.setPosition(p.x + ox, p.y + oy + 2).setRotation(angle).setDepth(depth);
      this.sword.setAlpha(0);
      this.crossbow.setAlpha(1);
      this.bombHeld.setAlpha(0);
    } else if (this.weapon === 'bombs') {
      const angle = this._mouseAngle(p);
      const ox = Math.cos(angle) * 7, oy = Math.sin(angle) * 7;
      this.bombHeld.setPosition(p.x + ox, p.y + oy - 2).setDepth(p.depth + (Math.sin(angle) > 0 ? -1 : 1));
      this.bombHeld.setAlpha(1);
      this.sword.setAlpha(0);
      this.crossbow.setAlpha(0);
    } else {
      const baseAngle = Math.atan2(f.y, f.x);
      const ox = f.x * 8, oy = f.y * 8;
      const depth = p.depth + (f.y > 0 ? -1 : 1);
      this.sword.setPosition(p.x + ox, p.y + oy + 2).setRotation(baseAngle + 0.35).setDepth(depth);
      this.sword.setAlpha(1);
      this.crossbow.setAlpha(0);
      this.bombHeld.setAlpha(0);
    }
  }

  _mouseAngle(p) {
    const ptr = this.scene.input.activePointer;
    // getWorldPoint recalculates from current camera scroll each frame, so the
    // crossbow tracks correctly even when the mouse is still and the player moves.
    const w = this.scene.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const dx = w.x - p.x, dy = w.y - p.y;
    if (Math.hypot(dx, dy) < 8) return Math.atan2(this.scene.facing.y, this.scene.facing.x);
    return Math.atan2(dy, dx);
  }

  // --- combat ------------------------------------------------------------
  _tryAttack() {
    const now = this.scene.time.now;
    if (now < this.attackCdUntil) return;
    if (this.weapon === 'crossbow') {
      this.attackCdUntil = now + 480;
      this._shootBolt();
    } else if (this.weapon === 'bombs') {
      this.attackCdUntil = now + 700;
      this._throwBomb();
    } else {
      this.attackCdUntil = now + 340;
      this._swingSword();
    }
  }

  _swingSword() {
    const f = this.scene.facing, p = this.scene.player;
    const baseAngle = Math.atan2(f.y, f.x);
    const swingSpan = 2.2;
    const ox = f.x * 8, oy = f.y * 8;

    AudioManager.attackSound();
    this._swinging = true;
    this.sword
      .setPosition(p.x + ox, p.y + oy + 2)
      .setRotation(baseAngle - swingSpan / 2)
      .setAlpha(1).setScale(1.0)
      .setDepth(p.depth + (f.y > 0 ? -1 : 1));

    this.scene.tweens.add({
      targets: this.sword,
      rotation: baseAngle + swingSpan / 2,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => { this._swinging = false; },
    });

    const hitR = 46;
    this.enemies.getChildren().slice().forEach((en) => {
      if (!en.active) return;
      const dx = en.x - p.x, dy = en.y - p.y, dist = Math.hypot(dx, dy);
      if (dist > hitR) return;
      if (dist > 22 && (dx * f.x + dy * f.y) <= 0) return;
      this._damage(en, p.x, p.y);
    });
  }

  _shootBolt() {
    const p = this.scene.player;
    const angle = this._mouseAngle(p);
    const fx = Math.cos(angle), fy = Math.sin(angle);
    AudioManager.attackSound();
    const bolt = this.bolts.create(p.x + fx * 14, p.y + fy * 14, 'bolt');
    bolt.setDepth(1e6).setRotation(angle);
    bolt._origin = { x: p.x, y: p.y };
    bolt.setVelocity(fx * 580, fy * 580);

    this.scene.tweens.add({
      targets: this.crossbow,
      x: this.crossbow.x - fx * 3,
      y: this.crossbow.y - fy * 3,
      duration: 80,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  _tickBolts() {
    this.bolts.getChildren().slice().forEach((bolt) => {
      if (!bolt.active) return;
      const dx = bolt.x - bolt._origin.x, dy = bolt.y - bolt._origin.y;
      if (Math.hypot(dx, dy) > 340) this.bolts.remove(bolt, true, true);
    });
  }

  // --- bombs -------------------------------------------------------------
  _throwBomb() {
    const p = this.scene.player;
    const ang = this._mouseAngle(p);

    // Scale throw power by how far the mouse is from the player.
    const ptr = this.scene.input.activePointer;
    const w = this.scene.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const dist = Phaser.Math.Distance.Between(p.x, p.y, w.x, w.y);
    const t = Phaser.Math.Clamp((dist - 16) / 100, 0, 1);
    const power = 80 + t * 230; // 80 px/s (drop at feet) → 310 px/s (full lob)

    const bomb = this.bombs.create(p.x + Math.cos(ang) * 10, p.y + Math.sin(ang) * 10 - 4, 'bomb').setDepth(1e6);
    bomb.body.setSize(10, 10);
    bomb.setVelocity(Math.cos(ang) * power, Math.sin(ang) * power);
    bomb.body.setDrag(280, 280);     // skids to a stop like a lobbed object
    bomb.setData('boomAt', this.scene.time.now + 700);
    bomb.setData('armedAt', this.scene.time.now + 120); // contact-fuse after it clears the hand
    this.scene.tweens.add({ targets: bomb, angle: 300, duration: 700 });
    AudioManager.attackSound();
  }

  _tickBombs() {
    const now = this.scene.time.now;
    this.bombs.getChildren().slice().forEach((bomb) => {
      if (!bomb.active) return;
      // a quickening blink as the fuse runs down
      bomb.setTintFill(Math.floor(now / 90) % 2 ? 0xffffff : 0xffd98a);
      if (now >= bomb.getData('boomAt')) {
        const x = bomb.x, y = bomb.y;
        this.bombs.remove(bomb, true, true);
        this._explode(x, y);
      }
    });
  }

  _explode(x, y) {
    AudioManager.boom();
    const R = 66;
    const flash = this.scene.add.circle(x, y, R, 0xffb24d, 0.5).setDepth(1e6);
    this.scene.tweens.add({ targets: flash, scale: 1.4, alpha: 0, duration: 320, onComplete: () => flash.destroy() });
    const core = this.scene.add.circle(x, y, 18, 0xffffff, 0.9).setDepth(1e6 + 1);
    this.scene.tweens.add({ targets: core, scale: 2.4, alpha: 0, duration: 260, onComplete: () => core.destroy() });
    this.scene.cameras.main.shake(150, 0.006);
    this.enemies.getChildren().slice().forEach((en) => {
      if (en.active && Phaser.Math.Distance.Between(x, y, en.x, en.y) <= R) this._bombDamage(en, x, y);
    });
    // Self-damage: standing too close to your own blast hurts.
    const p = this.scene.player;
    if (Phaser.Math.Distance.Between(x, y, p.x, p.y) <= R) this.hurtPlayer(2, 240, x, y);
  }

  // Bombs hit hard (2 points) over an area; the boss can't be shoved.
  _bombDamage(en, x, y) {
    en.hp -= 2;
    if (!en._isBoss) {
      const a = Math.atan2(en.y - y, en.x - x);
      en.body.setVelocity(Math.cos(a) * 300, Math.sin(a) * 300);
      en.setData('kbUntil', this.scene.time.now + 200);
    }
    en.setTintFill(0xffd27f);
    this.scene.time.delayedCall(90, () => { if (en.active) en.clearTint(); });
    if (en.hp <= 0) this._dispel(en);
  }

  _damage(en, fx, fy) {
    en.hp -= 1;
    // The boss is too big to shove around; ordinary doubts get knocked back.
    if (!en._isBoss) {
      const ang = Math.atan2(en.y - fy, en.x - fx);
      en.body.setVelocity(Math.cos(ang) * 250, Math.sin(ang) * 250);
      en.setData('kbUntil', this.scene.time.now + 170);
    }
    en.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => { if (en.active) en.clearTint(); });
    if (en.hp <= 0) this._dispel(en);
  }

  _dispel(en) {
    // The boss has its own defeat sequence, owned by the scene.
    if (en._isBoss) {
      this._remove(en);
      if (this.scene.onBossDefeated) this.scene.onBossDefeated();
      return;
    }
    const x = en.x, y = en.y, text = en.getData('text') || '';
    this._remove(en);
    const t = this.scene.add.text(x, y - 8, '✗ ' + text, { fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', color: '#fff' })
      .setOrigin(0.5).setDepth(1e6);
    this.scene.tweens.add({ targets: t, y: y - 46, alpha: 0, duration: 900, onComplete: () => t.destroy() });
    const ring = this.scene.add.circle(x, y, 10, 0xffffff, 0.5).setDepth(1e6 - 1);
    this.scene.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 320, onComplete: () => ring.destroy() });
    // Let the boss scene track wave clearance.
    if (this.scene.onEnemyDispelled) this.scene.onEnemyDispelled(en);
  }

  _onPlayerHit(en) {
    this.hurtPlayer(en.getData('damage') || 1, en.getData('knockback') || 220, en.x, en.y);
  }

  /** Apply damage + knockback to the player from a source point. Used by both
   *  contact damage and the boss's claw strikes. Respects i-frames / pauses. */
  hurtPlayer(damage, knockback, srcX, srcY) {
    const now = this.scene.time.now;
    if (now < this.invulnUntil || this._blocked()) return;
    this.health = Math.max(0, this.health - (damage || 1));
    AudioManager.damageSound();
    this._renderHearts();
    this.invulnUntil = now + 1000;
    this.lastHitTime = now;
    const p = this.scene.player;
    const ang = Math.atan2(p.y - srcY, p.x - srcX);
    const kb = knockback || 220;
    p.body.setVelocity(Math.cos(ang) * kb, Math.sin(ang) * kb);
    this.kbUntil = now + 200;
    if (this.health <= 0) this._respawn();
  }

  _respawn() {
    const p = this.scene.player, s = this.scene.spawnPx;
    p.setPosition(s.x, s.y);
    p.body.setVelocity(0, 0);
    this.kbUntil = 0;
    this.health = this.maxHearts;
    this.invulnUntil = this.scene.time.now + 1200;
    this._renderHearts();
    // In the cave the scene decides what happens (re-arm the current wave,
    // keep the boss); in the open world you simply catch your breath.
    if (this.bossMode && this.scene.onPlayerDown) { this.scene.onPlayerDown(); return; }
    this._clear();
    Portfolio.toast('The doubts overtook you. You catch your breath back at the crossroads.', '#8aa0c8');
  }

  // --- roaming spawner ---------------------------------------------------
  _maintain() {
    const p = this.scene.player;
    const alive = this.enemies.getChildren().filter((e) => e.active).length;
    const types = BIOME_DOUBTS[this.scene.currentBiome] || BIOME_DOUBTS.wilds;
    for (let i = alive; i < this.cap; i++) {
      const pos = this._spawnPos(p.x, p.y);
      if (pos) this._spawn(DOUBTS[Phaser.Utils.Array.GetRandom(types)], pos.x, pos.y);
    }
    this.enemies.getChildren().slice().forEach((e) => {
      if (e.active && Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) > 560) this._remove(e);
    });
  }

  _spawnPos(px, py) {
    for (let k = 0; k < 12; k++) {
      const ang = Math.random() * Math.PI * 2, r = 220 + Math.random() * 200;
      const x = px + Math.cos(ang) * r, y = py + Math.sin(ang) * r;
      if (x < 16 || y < 16 || x > this.scene.map.widthInPixels - 16 || y > this.scene.map.heightInPixels - 16) continue;
      if (!this.scene.isBlocked(x, y)) return { x, y };
    }
    return null;
  }

  _spawn(def, x, y) {
    if (!def) return null;
    const en = this.enemies.create(x, y, `doubt-${def.id}`);
    en.setData('damage', def.damage).setData('knockback', def.knockback).setData('text', def.text);
    en.hp = def.hp; en.speed = def.speed;
    en.setCollideWorldBounds(true).setDepth(y);
    en.body.setSize(18, 14).setOffset(6, 12);
    this.scene.tweens.add({ targets: en, angle: { from: -6, to: 6 }, yoyo: true, repeat: -1, duration: 520 });
    en.label = this.scene.add.text(x, y - 20, def.text, {
      fontFamily: 'monospace', fontSize: '10px', color: '#ffd6d6', backgroundColor: '#00000077', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(1e6);
    return en;
  }

  /** Public: spawn a single doubt (used by the scripted boss-arena waves). */
  spawnEnemy(def, x, y) { return this._spawn(def, x, y); }

  /** Public: spawn the boss. Big body, lots of HP, immovable to small adds.
   *  Its AI (chase + claw swipes) is driven by BossScene. */
  spawnBoss(def, x, y) {
    const en = this.enemies.create(x, y, 'boss-crab');
    en.setData('damage', def.damage).setData('knockback', def.knockback).setData('text', def.text);
    en.hp = def.hp; en.maxHp = def.hp; en.speed = def.speed;
    en._isBoss = true;
    en.setCollideWorldBounds(true).setDepth(y);
    en.body.setSize(86, 50).setOffset(20, 32);
    if (en.setPushable) en.setPushable(false);
    return en;
  }

  _enemyAI() {
    const p = this.scene.player, now = this.scene.time.now;
    this.enemies.getChildren().forEach((en) => {
      if (!en.active) return;
      if (en._isBoss) { en.setDepth(en.y); return; } // boss movement is scene-driven
      if (now >= (en.getData('kbUntil') || 0)) {
        const d = Phaser.Math.Distance.Between(p.x, p.y, en.x, en.y);
        if (d < 260) { const a = Math.atan2(p.y - en.y, p.x - en.x); en.body.setVelocity(Math.cos(a) * en.speed, Math.sin(a) * en.speed); }
        else en.body.velocity.scale(0.92);
      }
      en.setDepth(en.y);
      if (en.label) en.label.setPosition(en.x, en.y - 20).setDepth(en.y + 1);
    });
  }

  _freezeEnemies() {
    this.enemies.getChildren().forEach((en) => { if (en.active) { en.body.setVelocity(0, 0); if (en.label) en.label.setPosition(en.x, en.y - 20); } });
  }

  // --- helpers -----------------------------------------------------------
  _blocked() { return this.scene.dialogue.isOpen || Portfolio.modalOpen; }
  _blink(now) { const inv = now < this.invulnUntil; this.scene.player.setAlpha(inv ? (Math.floor(now / 100) % 2 ? 0.4 : 1) : 1); }
  _regen(delta) {
    if (this.health >= this.maxHearts) return;
    if (this.scene.time.now - this.lastHitTime < 3000) return;
    this.regenAccum += delta;
    if (this.regenAccum >= this.regenEvery) { this.regenAccum = 0; this.health = Math.min(this.maxHearts, this.health + 1); this._renderHearts(); }
  }
  _remove(en) { if (en.label) { en.label.destroy(); en.label = null; } en.destroy(); }
  _clear() { this.enemies.getChildren().slice().forEach((e) => this._remove(e)); }
  _renderHearts() {
    if (!this.heartsEl) return;
    let html = '';
    for (let i = 0; i < this.maxHearts; i++) html += `<span class="heart ${i < this.health ? 'full' : 'empty'}">♥</span>`;
    this.heartsEl.innerHTML = html;
  }
}
