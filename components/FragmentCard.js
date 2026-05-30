/* =============================================================================
 * components/FragmentCard.js
 * -----------------------------------------------------------------------------
 * The environmental-storytelling popup. When the player wanders into a dead-end
 * and stands near a fragment (a found object), this fades in a quiet, evocative
 * line — no NPC, no dialogue, just a reward for looking. Shown/hidden purely by
 * proximity from TiledWorldScene; the discovery chime is played there.
 * ========================================================================== */

class FragmentCard {
  constructor() {
    this.el = document.getElementById('fragment');
    this.shown = null;
  }

  show(frag) {
    if (this.shown === frag.id) return;
    this.shown = frag.id;
    this.el.innerHTML = `
      <div class="fc-mark">❖ you found something</div>
      <div class="fc-title">${esc(frag.title || '')}</div>
      <p class="fc-text">${esc(frag.text || '')}</p>`;
    this.el.classList.add('show');
  }

  hide() {
    this.shown = null;
    this.el.classList.remove('show');
  }
}
