/* =============================================================================
 * components/DialogueBox.js
 * -----------------------------------------------------------------------------
 * Reusable in-world NPC dialogue UI, rendered with Phaser game objects so it
 * feels part of the world. Typewriter reveal, page-by-page navigation with
 * SPACE / E / click, a name header, and a page indicator.
 *
 * The character's cross-world `prompt` is automatically appended as the final
 * page, so every conversation ends by gesturing toward the other worlds.
 * ========================================================================== */

class DialogueBox {
  constructor(scene) {
    this.scene = scene;
    this.isOpen = false;
    this.pages = [];
    this.page = 0;
    this.onComplete = null;

    const cam = scene.cameras.main;
    const W = cam.width;
    const boxH = 150;
    const margin = 24;
    const boxW = W - margin * 2;
    const y = cam.height - boxH - margin;

    // A fixed-to-camera container so the box stays put while the world scrolls.
    this.c = scene.add.container(0, 0).setScrollFactor(0).setDepth(200).setVisible(false);

    this.bg = scene.add.graphics();
    this.bg.fillStyle(0x0a0c16, 0.92).fillRoundedRect(margin, y, boxW, boxH, 10);
    this.bg.lineStyle(2, 0xffffff, 0.18).strokeRoundedRect(margin, y, boxW, boxH, 10);

    this.accent = scene.add.graphics();

    this.nameText = scene.add.text(margin + 18, y + 12, '', {
      fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold', color: '#ffffff',
    });
    this.roleText = scene.add.text(margin + 18, y + 32, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#9fb0d8',
    });
    this.body = scene.add.text(margin + 18, y + 54, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#e8edf7',
      wordWrap: { width: boxW - 36 }, lineSpacing: 4,
    });
    this.hint = scene.add.text(margin + boxW - 18, y + boxH - 22, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#9fb0d8',
    }).setOrigin(1, 0);

    this.c.add([this.bg, this.accent, this.nameText, this.roleText, this.body, this.hint]);

    this._geom = { margin, y, boxW, boxH };

    // Click anywhere on the box to advance, too.
    this.bg.setInteractive(
      new Phaser.Geom.Rectangle(margin, y, boxW, boxH),
      Phaser.Geom.Rectangle.Contains
    );
    this.bg.on('pointerdown', () => { if (this.isOpen) this.advance(); });
  }

  open(character, onComplete) {
    this.character = character;
    this.onComplete = onComplete;
    this.pages = character.dialogue.slice();
    if (character.prompt) this.pages.push(character.prompt);
    this.page = 0;
    this.isOpen = true;

    // Accent stripe down the left edge, themed to the character's world.
    const { margin, y, boxH } = this._geom;
    const col = REGIONS[character.world] ? REGIONS[character.world].palette.accent : 0xffffff;
    this.accent.clear();
    this.accent.fillStyle(col, 1).fillRect(margin, y, 5, boxH);

    this.nameText.setText(character.name);
    this.roleText.setText(character.role || '');
    this.c.setVisible(true);
    this._renderPage();
  }

  advance() {
    if (this._typing) { this._finishTyping(); return; }
    this.page += 1;
    if (this.page >= this.pages.length) { this.close(); return; }
    this._renderPage();
  }

  close() {
    this.isOpen = false;
    this.c.setVisible(false);
    if (this._timer) this._timer.remove();
    const cb = this.onComplete;
    this.onComplete = null;
    if (cb) cb();
  }

  // --- typewriter --------------------------------------------------------
  _renderPage() {
    const full = this.pages[this.page];
    const isPrompt = this.character.prompt && this.page === this.pages.length - 1;
    this.body.setColor(isPrompt ? '#bcd0ff' : '#e8edf7');

    this._typing = true;
    this._full = full;
    this.body.setText('');
    let i = 0;
    if (this._timer) this._timer.remove();
    this._timer = this.scene.time.addEvent({
      delay: 14,
      repeat: full.length - 1,
      callback: () => {
        i += 1;
        this.body.setText(full.slice(0, i));
        if (i >= full.length) this._typing = false;
      },
    });
    this._updateHint();
  }

  _finishTyping() {
    if (this._timer) this._timer.remove();
    this.body.setText(this._full);
    this._typing = false;
    this._updateHint();
  }

  _updateHint() {
    const last = this.page === this.pages.length - 1;
    const total = this.pages.length;
    this.hint.setText(
      this._typing ? '▾ skip' : `${last ? 'close' : 'next'}  ›  (${this.page + 1}/${total})`
    );
  }
}
