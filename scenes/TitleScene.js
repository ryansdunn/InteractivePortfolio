/* =============================================================================
 * scenes/TitleScene.js
 * -----------------------------------------------------------------------------
 * The framing screen. Sets the premise, then drops the visitor onto the island
 * at the crossroads (the wilds) to explore. Small biome quick-links remain for
 * sharable deep-entry. Navigation in-world is by landmark + signs, not markers.
 * ========================================================================== */

class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    const { width: W, height: H } = this.scale;
    this.cameras.main.setBackgroundColor(0x081018);

    for (let i = 0; i < 70; i++) {
      const s = this.add.rectangle(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 2, 2, 0xffffff, Phaser.Math.FloatBetween(0.15, 0.7));
      this.tweens.add({ targets: s, alpha: 0.05, yoyo: true, repeat: -1, duration: Phaser.Math.Between(1200, 3000), delay: Phaser.Math.Between(0, 1500) });
    }

    this.add.text(W / 2, H * 0.22, 'RYAN DUNN', { fontFamily: 'monospace', fontSize: '46px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(W / 2, H * 0.22 + 44, 'an interactive portrait', { fontFamily: 'monospace', fontSize: '15px', color: '#9fb0d8' }).setOrigin(0.5);

    this.add.text(W / 2, H * 0.4,
      "You walked in as a recruiter, or maybe just curious.\n" +
      "Ahead is an island. Wander it — follow the signs and the\n" +
      "landmarks. The people you meet, and the things they left\n" +
      "behind, are real. Enter a recruiter, leave knowing a person.", {
      fontFamily: 'monospace', fontSize: '13px', color: '#c7d2ec', align: 'center', lineSpacing: 6,
    }).setOrigin(0.5);

    this._enterButton(W / 2, H * 0.62);

    const named = Object.entries(WORLD.biomes).filter(([k]) => k !== 'wilds');
    this.add.text(W / 2, H * 0.74, 'or wash ashore near:', { fontFamily: 'monospace', fontSize: '11px', color: '#6b7aa0' }).setOrigin(0.5);
    const spacing = 150, startX = W / 2 - ((named.length - 1) * spacing) / 2;
    named.forEach(([key, b], i) => this._quickLink(key, b, startX + i * spacing, H * 0.74 + 26));

    this.add.text(W / 2, H - 28, 'WASD / Arrows move · SPACE or E talk · J or click attack · Q switch weapon · M music', { fontFamily: 'monospace', fontSize: '12px', color: '#6b7aa0' }).setOrigin(0.5);
  }

  _enterButton(x, y) {
    const w = 320, h = 60, accent = 0x8aa0c8;
    const g = this.add.graphics();
    const draw = (hover) => {
      g.clear();
      g.fillStyle(0x141a2a, hover ? 1 : 0.85).fillRoundedRect(x - w / 2, y - h / 2, w, h, 12);
      g.lineStyle(2, accent, hover ? 1 : 0.55).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);
    };
    draw(false);
    this.add.text(x, y - 8, 'Step onto the island', { fontFamily: 'monospace', fontSize: '20px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(x, y + 14, 'begin at the crossroads', { fontFamily: 'monospace', fontSize: '11px', color: '#9fb0d8' }).setOrigin(0.5);
    const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', () => this._start('wilds'));
  }

  _quickLink(key, biome, x, y) {
    const t = this.add.text(x, y, biome.name, { fontFamily: 'monospace', fontSize: '13px', color: biome.hudColor }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    t.on('pointerover', () => t.setStyle({ color: '#ffffff' }));
    t.on('pointerout', () => t.setStyle({ color: biome.hudColor }));
    t.on('pointerdown', () => this._start(key));
  }

  _start(spawn) {
    AudioManager.resume();
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('World', { spawn }));
  }
}
