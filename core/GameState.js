/* =============================================================================
 * core/GameState.js
 * -----------------------------------------------------------------------------
 * Cross-scene shared state, backed by Phaser's global registry so it survives
 * world transitions. Tracks which characters the visitor has met and emits an
 * event whenever the "living portrait" gains a new entry. The DOM ProfileCard
 * listens for that event.
 * ========================================================================== */

const GameState = {
  game: null,

  /** Bind to the Phaser.Game instance (called once in game.js). */
  attach(game) {
    this.game = game;
    if (!game.registry.has('met')) game.registry.set('met', []);
  },

  get events() {
    return this.game.events;
  },

  /** Ordered list of character ids the visitor has spoken with. */
  metIds() {
    return this.game.registry.get('met') || [];
  },

  hasMet(id) {
    return this.metIds().includes(id);
  },

  /** Total number of "main" characters — the ones that build the portrait. */
  totalMain() {
    return Object.values(CHARACTERS).filter((c) => c.main).length;
  },

  /**
   * Record a completed conversation. Idempotent — meeting someone twice won't
   * duplicate their profile entry. Emits 'profile:update' with the character.
   */
  recordMeeting(character) {
    if (this.hasMet(character.id)) return false;
    const met = this.metIds();
    met.push(character.id);
    this.game.registry.set('met', met);
    const mainMet = met.filter((id) => CHARACTERS[id] && CHARACTERS[id].main).length;
    this.events.emit('profile:update', character, mainMet);
    if (mainMet >= this.totalMain()) this.events.emit('profile:complete');
    return true;
  },

  /** Profile entries (main characters only), in the order they were earned. */
  entries() {
    return this.metIds().map((id) => CHARACTERS[id]).filter((c) => c && c.main);
  },
};
