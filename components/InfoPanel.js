/* =============================================================================
 * components/InfoPanel.js
 * -----------------------------------------------------------------------------
 * The detail panel that opens after a conversation: project description, tech
 * stack chips, and outbound links (ryansdunn.com, TestFlight, SoundCloud, etc).
 * Pure DOM modal so links are real, accessible anchors. Reads straight from a
 * character's `panel` config — engine code never hardcodes copy.
 * ========================================================================== */

class InfoPanel {
  constructor() {
    this.el = document.getElementById('info-panel');
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close(); // click backdrop to dismiss
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  }

  get isOpen() {
    return this.el.classList.contains('open');
  }

  open(character) {
    const pa = character.panel;
    const accent = (WORLD.biomes[character.world] && WORLD.biomes[character.world].hudColor) || '#4f7cff';

    const chips = (pa.tech || [])
      .map((t) => `<span class="ip-chip">${esc(t)}</span>`).join('');
    const links = (pa.links || [])
      .map((l) => `<a class="ip-link" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`)
      .join('');

    this.el.style.setProperty('--accent', accent);
    this.el.innerHTML = `
      <div class="ip-card" role="dialog" aria-modal="true">
        <button class="ip-close" aria-label="Close">×</button>
        <div class="ip-kind">${esc(pa.kind || '')}</div>
        <h2 class="ip-title">${esc(pa.title)}</h2>
        <p class="ip-desc">${esc(pa.description)}</p>
        ${chips ? `<div class="ip-chips">${chips}</div>` : ''}
        ${pa.note ? `<p class="ip-note">${esc(pa.note)}</p>` : ''}
        <div class="ip-links">${links}</div>
      </div>`;

    this.el.classList.add('open');
    Portfolio.modalOpen = true;
    this.el.querySelector('.ip-close').onclick = () => this.close();

    // Some panels (the EP) want the music player surfaced alongside them.
    if (pa.openMusicPlayer && Portfolio.musicPlayer) {
      Portfolio.musicPlayer.show(character.trackIndex || 0);
    }
  }

  close() {
    this.el.classList.remove('open');
    Portfolio.modalOpen = false;
  }
}
