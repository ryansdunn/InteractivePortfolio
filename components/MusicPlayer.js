/* =============================================================================
 * components/MusicPlayer.js
 * -----------------------------------------------------------------------------
 * SoundCloud embed player for the Guideless EP. A collapsible DOM dock that
 * embeds the set (config/music.js) and drives it track by track via the
 * SoundCloud Widget API — so a visitor can listen while continuing to explore.
 *
 * It deliberately does NOT touch AudioManager: the EP plays over the world's
 * ambient bed, exactly as specified.
 * ========================================================================== */

class MusicPlayer {
  constructor() {
    this.el = document.getElementById('music-player');
    this.widget = null;
    this.ready = false;
    this._built = false;
  }

  /** Lazily build the iframe the first time the player is shown. */
  _build() {
    if (this._built) return;
    this._built = true;

    const src =
      'https://w.soundcloud.com/player/?url=' +
      encodeURIComponent(MUSIC.set.url) +
      '&color=%239a7bff&auto_play=false&hide_related=true' +
      '&show_comments=false&show_user=true&show_reposts=false&visual=false';

    this.el.innerHTML = `
      <div class="mp-head">
        <div class="mp-meta">
          <span class="mp-title">♪ ${esc(MUSIC.set.title)}</span>
          <span class="mp-artist">${esc(MUSIC.set.artist)} · EP</span>
        </div>
        <button class="mp-min" title="Minimize">—</button>
      </div>
      <div class="mp-tracks"></div>
      <iframe class="mp-frame" allow="autoplay" scrolling="no" frameborder="no"
        src="${src}"></iframe>`;

    // Track-select chips.
    const tr = this.el.querySelector('.mp-tracks');
    tr.innerHTML = MUSIC.tracks.map((t) => `
      <button class="mp-track" data-i="${t.index}">
        <b>${t.index + 1}. ${esc(t.title)}</b>
        <small>${esc(t.mood)}</small>
      </button>`).join('');
    tr.querySelectorAll('.mp-track').forEach((b) =>
      b.addEventListener('click', () => this.skipTo(+b.dataset.i))
    );

    this.el.querySelector('.mp-min').onclick = () => this.toggle();

    // Hook up the SoundCloud Widget API if it loaded.
    const iframe = this.el.querySelector('.mp-frame');
    if (window.SC && SC.Widget) {
      this.widget = SC.Widget(iframe);
      this.widget.bind(SC.Widget.Events.READY, () => {
        this.ready = true;
        this.widget.bind(SC.Widget.Events.PLAY_PROGRESS, () => this._syncActive());
      });
    }
  }

  /** Show the dock; optionally cue a specific track. */
  show(trackIndex) {
    this._build();
    this.el.classList.add('open');
    this.el.classList.remove('collapsed');
    if (typeof trackIndex === 'number') this.skipTo(trackIndex);
    this._highlight(trackIndex || 0);
  }

  hide() {
    this.el.classList.remove('open');
  }

  toggle() {
    this.el.classList.toggle('collapsed');
  }

  /** Jump to a track in the set and play it. */
  skipTo(i) {
    this._highlight(i);
    if (this.widget && this.ready) {
      this.widget.skip(i);
      this.widget.play();
    }
  }

  _syncActive() {
    if (!this.widget) return;
    this.widget.getCurrentSoundIndex((i) => this._highlight(i));
  }

  _highlight(i) {
    this.el.querySelectorAll('.mp-track').forEach((b) =>
      b.classList.toggle('active', +b.dataset.i === i)
    );
  }
}
