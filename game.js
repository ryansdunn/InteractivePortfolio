/* =============================================================================
 * game.js — bootstrap
 * -----------------------------------------------------------------------------
 * Wires everything together: creates the DOM overlay singletons (the bridge
 * between Phaser and HTML UI), boots the Phaser game, and registers every
 * scene. Loaded last. Adding a world = add a config entry + a thin scene file
 * + one line in the `scenes` array below.
 * ========================================================================== */

/* The bridge between the Phaser game (canvas) and the DOM overlays. Every
 * scene/component reaches shared UI through this single namespace. */
const Portfolio = {
  profileCard: null,
  infoPanel: null,
  musicPlayer: null,
  fragmentCard: null,
  modalOpen: false,
  _hintEl: null,
  _toastEl: null,
  _toastTimer: null,

  setHint(text) {
    if (!this._hintEl) this._hintEl = document.getElementById('hint');
    this._hintEl.textContent = text || '';
    this._hintEl.classList.toggle('show', !!text);
  },

  toast(text, color) {
    if (!this._toastEl) this._toastEl = document.getElementById('toast');
    const el = this._toastEl;
    el.textContent = text;
    el.style.borderColor = color || '#4f7cff';
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  },
};

window.addEventListener('load', () => {
  // 1) DOM overlays.
  Portfolio.profileCard = new ProfileCard();
  Portfolio.infoPanel = new InfoPanel();
  Portfolio.musicPlayer = new MusicPlayer();
  Portfolio.fragmentCard = new FragmentCard();

  // 2) Audio (placeholder synth beds; resumed on first user gesture).
  AudioManager.init();

  // 3) Phaser.
  const config = {
    type: Phaser.AUTO,
    parent: 'game',
    width: 960,
    height: 640,
    pixelArt: true,
    backgroundColor: '#080a12',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: 0 }, debug: false },
    },
    scene: [
      BootScene,
      TitleScene,
      TiledWorldScene,
    ],
  };

  const game = new Phaser.Game(config);

  // 4) Bind shared state once the game (and its registry) exists.
  GameState.attach(game);
  Portfolio.profileCard.bind();

  // Convenience: toggle the music dock with the M key from anywhere.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') Portfolio.musicPlayer.toggle();
  });

});
