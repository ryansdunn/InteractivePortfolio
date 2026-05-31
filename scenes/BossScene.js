/* =============================================================================
 * scenes/BossScene.js
 * -----------------------------------------------------------------------------
 * The finale. Once the visitor has met every part of Ryan (the living portrait
 * completes), the Guide sends them down into a cave beneath the crossroads —
 * a brand-new map the player can't otherwise reach. There the scattered doubts
 * gather: three escalating WAVES of the ordinary doubts (config/doubts.js),
 * then THE FINAL DOUBT — a giant four-armed crab — emerges for the boss fight.
 *
 * Combat is reused from core/CombatSystem.js in `bossMode` (no roaming spawner).
 * The scene scripts the waves, drives the boss's chase + telegraphed claw
 * strikes, tracks its health bar, and shows the closing thank-you on victory.
 *
 * The camera is static and centred on the arena, so the whole fight — and the
 * giant crab — is always on screen.
 * ========================================================================== */

class BossScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boss' });
  }

  create(data) {
    this.TILE = 16;
    this.cols = 44;
    this.rows = 30;
    this.W = this.cols * this.TILE;
    this.H = this.rows * this.TILE;

    this.cameras.main.setBackgroundColor(0x0a0710);
    this._buildArena();
    this._buildPlayer(data);

    // input (mirrors the open world)
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,J');
    this.facing = { x: 0, y: -1 };

    this.dialogue = new DialogueBox(this);
    // The scene tells CombatSystem what enemies collide with (the cave walls).
    this.collisionLayers = [this.walls];
    // CombatSystem reads the current weapon from the shared inventory, so every
    // weapon you unlocked in the world carries into the cave (Q still cycles).
    this.combat = new CombatSystem(this, { bossMode: true });

    // Static, arena-filling camera — you always see the whole fight.
    this.cameras.main.setBounds(0, 0, this.W, this.H);
    this.cameras.main.centerOn(this.W / 2, this.H / 2);
    this.cameras.main.setZoom(1.3);
    this.cameras.main.fadeIn(550, 0, 0, 0);

    AudioManager.play({ id: 'boss', ambient: { type: 'sawtooth', freq: 69, gain: 0.35, detune: 10 } });

    // Mobile action button → advance dialogue, else attack.
    Portfolio.mobileControls.onAction = () => {
      if (this.dialogue.isOpen) { this.dialogue.advance(); return; }
      if (!this.combat._blocked()) this.combat._tryAttack();
    };

    // --- encounter state ---
    this.phase = 'intro';
    this.currentWave = 0;
    this.waveActive = false;
    this.bossActive = false;
    this.victory = false;
    this.arms = [];

    this.bossBar = document.getElementById('boss-bar');
    this.bossBar.innerHTML =
      `<div class="bb-label">${esc(BOSS.name)} — ${esc(BOSS.text)}</div>` +
      '<div class="bb-track"><span class="bb-fill"></span></div>';
    this.bossBar.classList.remove('show');

    this.time.delayedCall(700, () => this._intro());
  }

  // --- arena -------------------------------------------------------------
  _buildArena() {
    this.add.tileSprite(0, 0, this.W, this.H, 'cave-floor').setOrigin(0).setDepth(-100);

    this.walls = this.physics.add.staticGroup();
    this.blocked = new Set();
    const put = (tx, ty) => {
      const key = tx + ',' + ty;
      if (this.blocked.has(key)) return;
      this.blocked.add(key);
      this.walls.create(tx * 16 + 8, ty * 16 + 8, 'cave-wall').setDepth(ty * 16).refreshBody();
    };

    // Thick rock border (two tiles deep) so nothing escapes the cave.
    for (let x = 0; x < this.cols; x++) { put(x, 0); put(x, 1); put(x, this.rows - 1); put(x, this.rows - 2); }
    for (let y = 0; y < this.rows; y++) { put(0, y); put(1, y); put(this.cols - 1, y); put(this.cols - 2, y); }
    // A few interior pillars for cover during the waves.
    [[10, 9], [33, 9], [10, 20], [33, 20]].forEach(([tx, ty]) => { put(tx, ty); put(tx + 1, ty); });
  }

  isBlocked(x, y) {
    const tx = Math.floor(x / 16), ty = Math.floor(y / 16);
    if (tx < 2 || ty < 2 || tx >= this.cols - 2 || ty >= this.rows - 2) return true;
    return this.blocked.has(tx + ',' + ty);
  }

  _buildPlayer(data) {
    const x = this.W / 2, y = this.H - 80;
    this.spawnPx = { x, y };
    this.physics.world.setBounds(0, 0, this.W, this.H);
    this.player = this.physics.add.sprite(x, y, 'player');
    this.player.setCollideWorldBounds(true).setSize(12, 10).setOffset(6, 18).setDepth(y);
    this.physics.add.collider(this.player, this.walls);
  }

  // --- intro / waves -----------------------------------------------------
  _intro() {
    const c = {
      name: 'THE FINAL DOUBT', role: 'the one that never quite left', world: 'wilds',
      dialogue: [
        'So. You walked the whole island. The builder, the song, the classroom. ' +
          'You think you know him now.',
        'I am every reason still whispering after the lights go out: not yet, ' +
          'not enough, not you. The little doubts you cut down? Only my echoes.',
        'Three waves of them stand between us. Carve through — then face me, ' +
          'if your certainty can hold.',
      ],
    };
    this.dialogue.open(c, () => { this.phase = 'waves'; this._startWave(1); });
  }

  _startWave(n) {
    this.currentWave = n;
    this.waveActive = true;
    const defs = BOSS_WAVES[n - 1];
    this._flash('WAVE ' + n + ' / ' + BOSS_WAVES.length, '#ff9db0');
    Portfolio.toast('Wave ' + n + ' of ' + BOSS_WAVES.length + ' — the doubts close in', '#ff9db0');
    defs.forEach((id, i) => {
      this.time.delayedCall(350 + i * 280, () => {
        if (!this.scene.isActive()) return;
        const pos = this._edgeSpawn();
        this.combat.spawnEnemy(DOUBTS[id], pos.x, pos.y);
      });
    });
  }

  // Called by CombatSystem when a (non-boss) doubt is dispelled.
  onEnemyDispelled() {
    if (!this.waveActive || this.bossActive) return;
    const alive = this.combat.enemies.getChildren().filter((e) => e.active && !e._isBoss).length;
    if (alive > 0) return;
    this.waveActive = false;
    if (this.currentWave < BOSS_WAVES.length) {
      this.time.delayedCall(1100, () => this._startWave(this.currentWave + 1));
    } else {
      this.time.delayedCall(1300, () => this._spawnBoss());
    }
  }

  _edgeSpawn() {
    for (let k = 0; k < 24; k++) {
      const tx = Phaser.Math.Between(3, this.cols - 4);
      const ty = Phaser.Math.Between(3, Math.floor(this.rows / 2));
      if (!this.blocked.has(tx + ',' + ty)) return { x: tx * 16 + 8, y: ty * 16 + 8 };
    }
    return { x: this.W / 2, y: 90 };
  }

  // --- the boss ----------------------------------------------------------
  _spawnBoss() {
    this.phase = 'boss';
    this.bossActive = true;
    this.cameras.main.shake(800, 0.012);
    this._flash('THE FINAL DOUBT', '#ff5d6c', 2000);
    AudioManager.play({ id: 'bossfight', ambient: { type: 'sawtooth', freq: 55, gain: 0.45, detune: 14 } });

    const bx = this.W / 2, by = 110;
    this.boss = this.combat.spawnBoss(BOSS, bx, by);
    this.boss.setScale(0.5);
    this.tweens.add({ targets: this.boss, scale: 1, duration: 700, ease: 'Back.easeOut' });

    // Four claw-arms arranged around the shell (two front, two back).
    const angles = [-2.35, -0.78, 0.78, 2.35];
    this.arms = angles.map((a) => {
      const sprite = this.add.image(bx, by, 'boss-claw').setOrigin(0.12, 0.5).setDepth(by + 1);
      return { sprite, angle: a, busy: false };
    });

    this.bossBar.classList.add('show');
    this._raged = false;
    this._nextArmAt = this.time.now + 1600;
    this._updateBossBar();
  }

  _bossAI(time) {
    const b = this.boss, p = this.player;

    // Slow, lurching chase (slower vertically so it looms from the back wall).
    if (time >= (b.getData('kbUntil') || 0)) {
      const a = Math.atan2(p.y - b.y, p.x - b.x);
      b.body.setVelocity(Math.cos(a) * b.speed, Math.sin(a) * b.speed * 0.65);
    }
    b.setDepth(b.y);

    // Keep the idle arms hovering around the shell.
    this.arms.forEach((arm) => {
      if (arm.busy) return;
      const r = 50, wob = Math.sin(time / 260 + arm.angle) * 3;
      arm.sprite
        .setPosition(b.x + Math.cos(arm.angle) * r, b.y + Math.sin(arm.angle) * r * 0.7 + 6 + wob)
        .setRotation(arm.angle)
        .setFlipX(Math.cos(arm.angle) < 0)
        .setDepth(b.y + (Math.sin(arm.angle) > 0 ? 2 : -2));
    });

    // Rage at half health: faster, and two adds crawl in.
    if (!this._raged && b.hp <= b.maxHp / 2) {
      this._raged = true;
      b.speed = Math.round(b.speed * 1.4);
      this._flash('"WHY YOU?"', '#ff5d6c', 1500);
      this.cameras.main.shake(500, 0.01);
      ['too_junior', 'will_he_stay'].forEach((id, i) => {
        this.time.delayedCall(i * 350, () => {
          if (this.bossActive) { const s = this._edgeSpawn(); this.combat.spawnEnemy(DOUBTS[id], s.x, s.y); }
        });
      });
    }

    // Claw strikes.
    if (time >= this._nextArmAt) {
      this._nextArmAt = time + (this._raged ? Phaser.Math.Between(900, 1400) : Phaser.Math.Between(1400, 2000));
      this._armStrike();
    }

    this._updateBossBar();
  }

  _armStrike() {
    const b = this.boss, p = this.player;
    const toP = Math.atan2(p.y - b.y, p.x - b.x);
    // Choose the free arm best facing the player.
    let best = null, bestDelta = 99;
    this.arms.forEach((arm) => {
      if (arm.busy) return;
      const d = Math.abs(Phaser.Math.Angle.Wrap(arm.angle - toP));
      if (d < bestDelta) { bestDelta = d; best = arm; }
    });
    if (!best) return;

    best.busy = true;
    best.sprite.setRotation(toP).setFlipX(Math.cos(toP) < 0);
    best.sprite.setTint(0xffd14d); // wind-up glow (telegraph)

    this.time.delayedCall(240, () => {
      if (!this.bossActive || !this.boss.active) { best.busy = false; best.sprite.clearTint(); return; }
      best.sprite.setTint(0xff3b4d);
      const reach = 78;
      const tx = b.x + Math.cos(toP) * reach;
      const ty = b.y + Math.sin(toP) * reach * 0.85 + 6;
      this.tweens.add({
        targets: best.sprite,
        x: tx, y: ty,
        duration: 230, hold: 70, yoyo: true, ease: 'Quad.easeIn',
        onYoyo: () => {
          const d = Phaser.Math.Distance.Between(best.sprite.x, best.sprite.y, this.player.x, this.player.y);
          if (d < 30) this.combat.hurtPlayer(b.getData('damage'), b.getData('knockback'), best.sprite.x, best.sprite.y);
          this._strikeFx(best.sprite.x, best.sprite.y);
        },
        onComplete: () => { best.sprite.clearTint(); best.busy = false; },
      });
    });
  }

  _strikeFx(x, y) {
    const ring = this.add.circle(x, y, 12, 0xff5d6c, 0.5).setDepth(1e6);
    this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
  }

  _updateBossBar() {
    if (!this.boss) return;
    const pct = Phaser.Math.Clamp(this.boss.hp / this.boss.maxHp, 0, 1) * 100;
    const fill = this.bossBar.querySelector('.bb-fill');
    if (fill) fill.style.width = pct + '%';
  }

  // --- defeat / death ----------------------------------------------------
  onBossDefeated() {
    if (this.victory) return;
    this.victory = true;
    this.bossActive = false;
    this.arms.forEach((a) => a.sprite.destroy());
    this.arms = [];
    this.bossBar.classList.remove('show');
    this.combat._clear(); // sweep up any lingering adds
    this.cameras.main.shake(600, 0.014);
    this._flash('THE DOUBT FADES', '#7CFFb0', 1900);
    AudioManager.swordFanfare();
    this.time.delayedCall(1700, () => this._showVictory());
  }

  // Called by CombatSystem when the player is emptied (forgiving — never a fail).
  onPlayerDown() {
    Portfolio.toast('The doubts press in — steady yourself.', '#8aa0c8');
    this.combat.enemies.getChildren().slice().forEach((e) => {
      if (e.active && !e._isBoss) this.combat._remove(e);
    });
    if (this.phase === 'waves' && !this.bossActive) {
      this.waveActive = false;
      this.time.delayedCall(900, () => this._startWave(this.currentWave));
    }
  }

  _showVictory() {
    Portfolio.modalOpen = true;
    const el = document.getElementById('victory');
    el.innerHTML = `
      <div class="vc-card" role="dialog" aria-modal="true">
        <p class="vc-title">Congratulations!</p>
        <p class="vc-sub">You faced every doubt — and the last one — and they faded.</p>
        <p class="vc-body">Thank you for playing. If you'd like to find out more about me,
          check out my website or send me an email. I would be happy to talk with you.</p>
        <div class="vc-buttons">
          <a class="vc-btn" href="mailto:rdunn711@gmail.com">Email me</a>
          <a class="vc-btn ghost" href="https://ryansdunn.com" target="_blank" rel="noopener">ryansdunn.com</a>
          <button class="vc-btn ghost" id="vc-return">Return to World</button>
        </div>
      </div>`;
    el.classList.add('open');
    document.getElementById('vc-return').onclick = () => {
      el.classList.remove('open');
      Portfolio.modalOpen = false;
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('World');
      });
    };
  }

  // --- flash banner (camera is static, so plain world coords are fine) ---
  _flash(text, color, dur = 1300) {
    const t = this.add.text(this.W / 2, this.H / 2 - 30, text, {
      fontFamily: 'monospace', fontSize: '30px', fontStyle: 'bold', color,
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(1e6).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 220, yoyo: true, hold: dur, onComplete: () => t.destroy() });
  }

  // --- loop --------------------------------------------------------------
  update(time, delta) {
    if (!this.player) return;
    const blocked = this.dialogue.isOpen || Portfolio.modalOpen;
    this._move(blocked);
    this.combat.update(delta);
    this.player.setDepth(this.player.y);
    if (this.bossActive && this.boss && this.boss.active) this._bossAI(time);
  }

  _move(blocked) {
    const b = this.player.body;
    if (this.combat && this.combat.playerKnocked()) return;
    b.setVelocity(0);
    if (blocked) return;
    const speed = 165;
    let vx = 0, vy = 0;

    if (this.cursors.left.isDown || this.keys.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) vy += 1;

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
    if (fx || fy) this.facing = { x: fx || this.facing.x, y: fy || this.facing.y };
    if (vx !== 0) this.player.setFlipX(vx < 0);
  }
}
