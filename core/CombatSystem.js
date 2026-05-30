/* =============================================================================
 * core/CombatSystem.js
 * -----------------------------------------------------------------------------
 * Forgiving, pure-action combat — now as DUNGEON ROOM ENCOUNTERS. When you enter
 * an uncleared room that has Doubts, a finite set spawns once. Defeat them all
 * and the room is "cleared," which the scene uses to open its gated door. Cleared
 * rooms never respawn; safe rooms (hub, inner rooms) have no Doubts.
 *
 * Still forgiving: hearts regenerate, getting hit only knocks you back, and being
 * emptied respawns you in the current room with its encounter re-armed — no
 * game-over.
 * ========================================================================== */

class CombatSystem {
  constructor(scene) {
    this.scene = scene;
    this.maxHearts = 5;
    this.health = this.maxHearts;
    this.hasSword = false;

    this.invulnUntil = 0;
    this.kbUntil = 0;
    this.attackCdUntil = 0;
    this.lastHitTime = -9999;
    this.regenEvery = 5000;
    this.regenAccum = 0;

    this.roomState = {};   // roomId -> { spawned, cleared, remaining }

    this.enemies = scene.physics.add.group();
    scene.physics.add.collider(this.enemies, scene.dungeon.wallObjects);
    scene.physics.add.collider(this.enemies, scene.dungeon.doorBodies);
    scene.physics.add.collider(this.enemies, this.enemies);
    scene.physics.add.overlap(scene.player, this.enemies, (pl, en) => this._onPlayerHit(en));

    this.slash = scene.add.image(0, 0, 'slash').setVisible(false).setDepth(1e6);

    this.attackKey = scene.keys.J;
    scene.input.on('pointerdown', () => {
      if (this.hasSword && !this._blocked()) this._tryAttack();
    });

    this.heartsEl = document.getElementById('hearts');
    this._renderHearts();
  }

  // --- public API --------------------------------------------------------
  giveSword() {
    if (this.hasSword) return;
    this.hasSword = true;
    this.health = this.maxHearts;
    if (this.heartsEl) this.heartsEl.classList.add('show');
    this._renderHearts();
    Portfolio.toast('⚔  Sword of Curiosity found! — J or click to swing', '#ffe08a');
    // If we're already standing in a Doubt room, arm it now.
    if (this.scene.currentRoom) this.enterRoom(this.scene.currentRoom);
  }

  /** Start a room's encounter (once) when the player enters it. */
  enterRoom(room) {
    if (!this.hasSword || !room || !room.doubts || !room.doubts.length) return;
    const st = this.roomState[room.id] || (this.roomState[room.id] = { spawned: false, cleared: false, remaining: 0 });
    if (st.spawned || st.cleared) return;
    st.spawned = true;
    st.remaining = 0;
    room.doubts.forEach((spec) => {
      const def = DOUBTS[spec.type];
      if (!def) return;
      for (let i = 0; i < spec.count; i++) { this._spawnInRoom(def, room); st.remaining++; }
    });
  }

  playerKnocked() { return this.scene.time.now < this.kbUntil; }

  update(delta) {
    const now = this.scene.time.now;
    this._blink(now);
    if (!this.hasSword) return;
    if (this._blocked()) { this._freezeEnemies(); return; }

    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) this._tryAttack();
    this._regen(delta);
    this._enemyAI();
  }

  // --- combat ------------------------------------------------------------
  _tryAttack() {
    const now = this.scene.time.now;
    if (now < this.attackCdUntil) return;
    this.attackCdUntil = now + 340;

    const f = this.scene.facing;
    const p = this.scene.player;
    const sx = p.x + f.x * 28, sy = p.y + f.y * 28 - 4;
    this.slash.setPosition(sx, sy).setRotation(Math.atan2(f.y, f.x))
      .setVisible(true).setAlpha(1).setScale(0.7).setDepth(1e6);
    this.scene.tweens.add({
      targets: this.slash, scale: 1.15, alpha: 0, duration: 180,
      onComplete: () => this.slash.setVisible(false),
    });

    const hitR = 48;
    this.enemies.getChildren().slice().forEach((en) => {
      if (!en.active) return;
      const dx = en.x - p.x, dy = en.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > hitR) return;
      if (dist > 22 && (dx * f.x + dy * f.y) <= 0) return;
      this._damageEnemy(en, p.x, p.y);
    });
  }

  _damageEnemy(en, fromX, fromY) {
    en.hp -= 1;
    const ang = Math.atan2(en.y - fromY, en.x - fromX);
    en.body.setVelocity(Math.cos(ang) * 260, Math.sin(ang) * 260);
    en.setData('kbUntil', this.scene.time.now + 180);
    en.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => { if (en.active) en.clearTint(); });
    if (en.hp <= 0) this._kill(en);
  }

  _kill(en) {
    const roomId = en.getData('room');
    this._dispelVFX(en.x, en.y, en.getData('text') || '');
    this._removeEnemy(en);

    const st = this.roomState[roomId];
    if (st && !st.cleared) {
      st.remaining = Math.max(0, st.remaining - 1);
      if (st.remaining === 0) { st.cleared = true; this.scene.events.emit('room:cleared', roomId); }
    }
  }

  _dispelVFX(x, y, text) {
    const t = this.scene.add.text(x, y - 8, '✗ ' + text, {
      fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(1e6);
    this.scene.tweens.add({ targets: t, y: y - 48, alpha: 0, duration: 950, onComplete: () => t.destroy() });
    const ring = this.scene.add.circle(x, y, 10, 0xffffff, 0.5).setDepth(1e6 - 1);
    this.scene.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 320, onComplete: () => ring.destroy() });
  }

  _onPlayerHit(en) {
    const now = this.scene.time.now;
    if (now < this.invulnUntil || this._blocked() || !this.hasSword) return;

    this.health = Math.max(0, this.health - (en.getData('damage') || 1));
    this._renderHearts();
    this.invulnUntil = now + 1000;
    this.lastHitTime = now;

    const p = this.scene.player;
    const ang = Math.atan2(p.y - en.y, p.x - en.x);
    const kb = en.getData('knockback') || 220;
    p.body.setVelocity(Math.cos(ang) * kb, Math.sin(ang) * kb);
    this.kbUntil = now + 200;

    if (this.health <= 0) this._respawn();
  }

  _respawn() {
    const room = this.scene.currentRoom;
    const T = DUNGEON.TILE;
    const p = this.scene.player;
    p.setPosition(room.center.x, room.center.y + 2 * T);
    p.body.setVelocity(0, 0);
    this.kbUntil = 0;
    this.health = this.maxHearts;
    this.invulnUntil = this.scene.time.now + 1200;
    this._renderHearts();

    // Re-arm this room's encounter from scratch.
    this._clearRoomEnemies(room.id);
    const st = this.roomState[room.id];
    if (st) { st.spawned = false; st.cleared = false; st.remaining = 0; }
    this.enterRoom(room);
    Portfolio.toast('The doubts pushed you back. You catch your breath.', this.scene.currentRegion.hudColor);
  }

  // --- spawning / AI -----------------------------------------------------
  _spawnInRoom(def, room) {
    const px = this.scene.player.x, py = this.scene.player.y;
    let x = room.center.x, y = room.center.y;
    for (let k = 0; k < 10; k++) {
      const tx = room.px.x + 48 + Math.random() * (room.px.w - 96);
      const ty = room.px.y + 48 + Math.random() * (room.px.h - 96);
      if (Phaser.Math.Distance.Between(px, py, tx, ty) > 120) { x = tx; y = ty; break; }
    }

    const en = this.enemies.create(x, y, `doubt-${def.id}`);
    en.setData('type', def.id).setData('room', room.id)
      .setData('damage', def.damage).setData('knockback', def.knockback)
      .setData('text', def.text);
    en.hp = def.hp;
    en.speed = def.speed;
    en.setCollideWorldBounds(true).setDepth(y);
    en.body.setSize(20, 16).setOffset(5, 10);
    this.scene.tweens.add({ targets: en, angle: { from: -6, to: 6 }, yoyo: true, repeat: -1, duration: 520 });

    en.label = this.scene.add.text(x, y - 22, def.text, {
      fontFamily: 'monospace', fontSize: '10px', color: '#ffd6d6',
      backgroundColor: '#00000077', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setDepth(1e6);
  }

  _enemyAI() {
    const p = this.scene.player;
    const now = this.scene.time.now;
    const curId = this.scene.currentRoom ? this.scene.currentRoom.id : null;
    this.enemies.getChildren().forEach((en) => {
      if (!en.active) return;
      const inCurrentRoom = en.getData('room') === curId;
      if (!inCurrentRoom) { en.body.setVelocity(0, 0); }
      else if (now >= (en.getData('kbUntil') || 0)) {
        const ang = Math.atan2(p.y - en.y, p.x - en.x);
        en.body.setVelocity(Math.cos(ang) * en.speed, Math.sin(ang) * en.speed);
      }
      en.setDepth(en.y);
      if (en.label) en.label.setPosition(en.x, en.y - 22).setDepth(en.y + 1);
    });
  }

  _freezeEnemies() {
    this.enemies.getChildren().forEach((en) => {
      if (!en.active) return;
      en.body.setVelocity(0, 0);
      if (en.label) en.label.setPosition(en.x, en.y - 22);
    });
  }

  // --- helpers -----------------------------------------------------------
  _blocked() { return this.scene.dialogue.isOpen || Portfolio.modalOpen; }

  _blink(now) {
    const inv = now < this.invulnUntil;
    this.scene.player.setAlpha(inv ? (Math.floor(now / 100) % 2 ? 0.4 : 1) : 1);
  }

  _regen(delta) {
    if (this.health >= this.maxHearts) return;
    if (this.scene.time.now - this.lastHitTime < 3000) return;
    this.regenAccum += delta;
    if (this.regenAccum >= this.regenEvery) {
      this.regenAccum = 0;
      this.health = Math.min(this.maxHearts, this.health + 1);
      this._renderHearts();
    }
  }

  _removeEnemy(en) {
    if (en.label) { en.label.destroy(); en.label = null; }
    en.destroy();
  }

  _clearRoomEnemies(roomId) {
    this.enemies.getChildren().slice().forEach((e) => {
      if (e.getData('room') === roomId) this._removeEnemy(e);
    });
  }

  _renderHearts() {
    if (!this.heartsEl) return;
    let html = '';
    for (let i = 0; i < this.maxHearts; i++) {
      html += `<span class="heart ${i < this.health ? 'full' : 'empty'}">♥</span>`;
    }
    this.heartsEl.innerHTML = html;
  }
}
