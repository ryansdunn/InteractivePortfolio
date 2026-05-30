/* =============================================================================
 * components/DialogueBox.js
 * -----------------------------------------------------------------------------
 * DOM-based NPC dialogue box. Rendered as an HTML element so it is immune to
 * the Phaser camera's 2.5× zoom (which would push a Phaser-object-based box
 * off-screen). All other HUD elements are DOM-based for the same reason.
 *
 * API: open(character, onComplete) · advance() · close() · isOpen (bool)
 * ========================================================================== */

class DialogueBox {
  constructor(scene) {
    this.scene = scene;
    this.isOpen = false;
    this.pages = [];
    this.page = 0;
    this.onComplete = null;
    this._typing = false;
    this._full = '';
    this._timer = null;

    this.el = document.getElementById('dialogue-box');
    this.nameEl = this.el.querySelector('.db-name') || this._el('div', 'db-name');
    this.roleEl = this.el.querySelector('.db-role') || this._el('div', 'db-role');
    this.bodyEl = this.el.querySelector('.db-body') || this._el('div', 'db-body');
    this.hintEl = this.el.querySelector('.db-hint') || this._el('div', 'db-hint');

    if (!this.el.children.length) {
      this.el.append(this.nameEl, this.roleEl, this.bodyEl, this.hintEl);
    }

    this.el.addEventListener('click', () => { if (this.isOpen) this.advance(); });
  }

  open(character, onComplete) {
    this.character = character;
    this.onComplete = onComplete;
    this.pages = character.dialogue.slice();
    if (character.prompt) this.pages.push(character.prompt);
    this.page = 0;
    this.isOpen = true;

    const biome = WORLD.biomes[character.world];
    this.el.style.setProperty('--db-accent', biome ? biome.hudColor : '#ffffff');

    this.nameEl.textContent = character.name;
    this.roleEl.textContent = character.role || '';
    this.el.classList.add('open');
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
    this.el.classList.remove('open');
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    const cb = this.onComplete;
    this.onComplete = null;
    if (cb) cb();
  }

  // --- typewriter ----------------------------------------------------------
  _renderPage() {
    const full = this.pages[this.page];
    const isPrompt = this.character.prompt && this.page === this.pages.length - 1;
    this.bodyEl.style.color = isPrompt ? '#bcd0ff' : '#e8edf7';

    this._typing = true;
    this._full = full;
    this.bodyEl.textContent = '';
    let i = 0;
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => {
      i += 1;
      this.bodyEl.textContent = full.slice(0, i);
      if (i >= full.length) {
        clearInterval(this._timer);
        this._timer = null;
        this._typing = false;
        this._updateHint();
      }
    }, 14);
    this._updateHint();
  }

  _finishTyping() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this.bodyEl.textContent = this._full;
    this._typing = false;
    this._updateHint();
  }

  _updateHint() {
    const last = this.page === this.pages.length - 1;
    const total = this.pages.length;
    this.hintEl.textContent = this._typing
      ? '▾ skip'
      : `${last ? 'close' : 'next'}  ›  (${this.page + 1}/${total})`;
  }

  _el(tag, cls) {
    const el = document.createElement(tag);
    el.className = cls;
    return el;
  }
}
