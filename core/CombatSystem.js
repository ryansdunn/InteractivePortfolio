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

class CombatSystem {
  constructor(scene) {
    this.scene = scene;
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
    scene.physics.add.collider(this.enemies, scene.groundLayer);
    scene.physics.add.collider(this.enemies, scene.terrainLayer);
    scene.physics.add.collider(this.enemies, this.enemies);
    scene.physics.add.overlap(scene.player, this.enemies, (pl, en) => this._onPlayerHit(en));

    // The sword sprite is always visible, held at the player's side.
    // Origin near the guard so it pivots from the hand during swings.
    this.sword = scene.add.image(0, 0, 'sword').setOrigin(0.25, 0.5).setDepth(1e6).setScale(0.9);
    this._swinging = false;
    this.attackKey = scene.keys.J;
    // Canvas click attacks on desktop only; mobile uses the action button instead.
    scene.input.on('pointerdown', () => {
      if (!this._blocked() && !(Portfolio.mobileControls && Portfolio.mobileControls.active)) this._tryAttack();
    });

    this.heartsEl = document.getElementById('hearts');
    if (this.heartsEl) this.heartsEl.classList.add('show');
    this._renderHearts();
  }

  playerKnocked() { return this.scene.time.now < this.kbUntil; }

  update(delta) {
    const now = this.scene.time.now;
    this._blink(now);
    this._holdSword();
    if (this._blocked()) { this._freezeEnemies(); return; }
    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) this._tryAttack();
    this._regen(delta);
    this._spawnAccum += delta;
    if (this._spawnAccum > 800) { this._spawnAccum = 0; this._maintain(); }
    this._enemyAI();
  }

  // Position the sword at the player's hand in idle/walk. During a swing the
  // tween owns the rotation, so we skip updates until it finishes.
  _holdSword() {
    if (this._swinging) return;
    const p = this.scene.player, f = this.scene.facing;
    const baseAngle = Math.atan2(f.y, f.x);
    // Offset the pivot point 8px from the player centre in the facing direction.
    const ox = f.x * 8, oy = f.y * 8;
    this.sword.setPosition(p.x + ox, p.y + oy + 2)
      .setRotation(baseAngle + 0.35) // slight downward tilt = "ready" grip
      .setAlpha(1).setDepth(p.depth + (f.y > 0 ? -1 : 1));
  }

  // --- combat ------------------------------------------------------------
  _tryAttack() {
    const now = this.scene.time.now;
    if (now < this.attackCdUntil) return;
    this.attackCdUntil = now + 340;

    const f = this.scene.facing, p = this.scene.player;
    const baseAngle = Math.atan2(f.y, f.x);
    const swingSpan = 2.2; // ~126° total arc
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

  _damage(en, fx, fy) {
    en.hp -= 1;
    const ang = Math.atan2(en.y - fy, en.x - fx);
    en.body.setVelocity(Math.cos(ang) * 250, Math.sin(ang) * 250);
    en.setData('kbUntil', this.scene.time.now + 170);
    en.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => { if (en.active) en.clearTint(); });
    if (en.hp <= 0) this._dispel(en);
  }

  _dispel(en) {
    const x = en.x, y = en.y, text = en.getData('text') || '';
    this._remove(en);
    const t = this.scene.add.text(x, y - 8, '✗ ' + text, { fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', color: '#fff' })
      .setOrigin(0.5).setDepth(1e6);
    this.scene.tweens.add({ targets: t, y: y - 46, alpha: 0, duration: 900, onComplete: () => t.destroy() });
    const ring = this.scene.add.circle(x, y, 10, 0xffffff, 0.5).setDepth(1e6 - 1);
    this.scene.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 320, onComplete: () => ring.destroy() });
  }

  _onPlayerHit(en) {
    const now = this.scene.time.now;
    if (now < this.invulnUntil || this._blocked()) return;
    this.health = Math.max(0, this.health - (en.getData('damage') || 1));
    AudioManager.damageSound();
    this._renderHearts();
    this.invulnUntil = now + 1000;
    this.lastHitTime = now;
    const p = this.scene.player;
    const ang = Math.atan2(p.y - en.y, p.x - en.x);
    p.body.setVelocity(Math.cos(ang) * (en.getData('knockback') || 220), Math.sin(ang) * (en.getData('knockback') || 220));
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
    if (!def) return;
    const en = this.enemies.create(x, y, `doubt-${def.id}`);
    en.setData('damage', def.damage).setData('knockback', def.knockback).setData('text', def.text);
    en.hp = def.hp; en.speed = def.speed;
    en.setCollideWorldBounds(true).setDepth(y);
    en.body.setSize(18, 14).setOffset(6, 12);
    this.scene.tweens.add({ targets: en, angle: { from: -6, to: 6 }, yoyo: true, repeat: -1, duration: 520 });
    en.label = this.scene.add.text(x, y - 20, def.text, {
      fontFamily: 'monospace', fontSize: '10px', color: '#ffd6d6', backgroundColor: '#00000077', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(1e6);
  }

  _enemyAI() {
    const p = this.scene.player, now = this.scene.time.now;
    this.enemies.getChildren().forEach((en) => {
      if (!en.active) return;
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
