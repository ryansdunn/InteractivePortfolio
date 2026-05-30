/* =============================================================================
 * components/ProfileCard.js
 * -----------------------------------------------------------------------------
 * The "living portrait." A DOM overlay pinned to a corner, visible throughout.
 * It starts nearly empty and fills in as the visitor talks to characters —
 * each conversation adds a tag and a human sentence about Ryan. When all main
 * characters are met it resolves into a finished portrait with a "Get in touch"
 * call to action.
 *
 * It listens to GameState's 'profile:update' event, so worlds/NPCs never call
 * it directly — they just record meetings.
 * ========================================================================== */

class ProfileCard {
  constructor() {
    this.el = document.getElementById('profile-card');
    this.theme = '#4f7cff';
    this._render();
  }

  /** Subscribe to game-state changes (called once the Phaser game exists). */
  bind() {
    GameState.events.on('profile:update', () => this._render(true));
    GameState.events.on('profile:complete', () => this._render(true));
  }

  setTheme(color) {
    this.theme = color || this.theme;
    this.el.style.setProperty('--accent', this.theme);
  }

  toggle() {
    this.el.classList.toggle('collapsed');
  }

  _render(pulse = false) {
    const entries = (typeof GameState !== 'undefined' && GameState.game)
      ? GameState.entries() : [];
    const total = (typeof GameState !== 'undefined' && GameState.game)
      ? GameState.totalMain() : 3;
    const met = entries.length;
    const complete = met >= total;

    const rows = entries.map((c) => `
      <li class="pc-row">
        <span class="pc-tag">${esc(c.profile.tag)}</span>
        <span class="pc-sentence">${esc(c.profile.sentence)}</span>
      </li>`).join('');

    const empty = met === 0
      ? `<li class="pc-empty">You're a stranger here. Walk up to someone and
           press <b>SPACE</b> to talk. This card fills in as you learn who
           Ryan is.</li>`
      : '';

    const cta = complete ? `
      <div class="pc-cta">
        <p class="pc-resolve">You came as a recruiter. You're leaving knowing a person —
          a builder who shows up fully, in code, in music, in a classroom in Spain.</p>
        <div class="pc-buttons">
          <a class="pc-btn" href="mailto:rdunn711@gmail.com">Get in touch</a>
          <a class="pc-btn ghost" href="https://ryansdunn.com" target="_blank" rel="noopener">ryansdunn.com</a>
        </div>
      </div>` : '';

    this.el.innerHTML = `
      <div class="pc-head">
        <div class="pc-avatar">RD</div>
        <div class="pc-id">
          <div class="pc-name">Ryan Dunn</div>
          <div class="pc-sub">${complete ? 'builder · musician · teacher' : 'a living portrait'}</div>
        </div>
        <button class="pc-collapse" title="Hide/show">—</button>
      </div>
      <div class="pc-progress">
        <div class="pc-bar"><span style="width:${(met / total) * 100}%"></span></div>
        <span class="pc-count">${met}/${total} discovered</span>
      </div>
      <ul class="pc-list">${empty}${rows}</ul>
      ${cta}
    `;

    this.setTheme(this.theme);
    this.el.querySelector('.pc-collapse').onclick = () => this.toggle();

    if (pulse) {
      this.el.classList.remove('pulse');
      void this.el.offsetWidth; // restart the animation
      this.el.classList.add('pulse');
    }
  }
}

// Tiny HTML escaper for config-sourced strings.
function esc(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[m]));
}
