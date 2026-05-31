/* =============================================================================
 * core/AudioManager.js
 * -----------------------------------------------------------------------------
 * Per-world ambient audio with crossfade on world transition. Uses the Web
 * Audio API to synthesize placeholder drones (sine/triangle pads) so there are
 * no MP3 dependencies yet.
 *
 * SWAPPING IN REAL MP3s LATER
 *   Replace `_makeVoice` with an <audio>/AudioBufferSourceNode that loads
 *   `ambient.src` from each world config. `play(world)` and the crossfade logic
 *   stay the same — only the node creation changes.
 * ========================================================================== */

const AudioManager = {
  ctx: null,
  current: null,        // { id, nodes:[], gain }
  master: null,
  enabled: false,
  FADE: 1.2,            // seconds

  /** No-op — AudioContext is created lazily on first user gesture via resume(). */
  init() {},

  /** Create the AudioContext on first user gesture (avoids Chrome autoplay policy),
   *  then resume if suspended. Safe to call repeatedly. */
  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.enabled = true;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  /** Crossfade to a world's ambient bed. Re-calling with the same id is a no-op. */
  play(world) {
    if (!this.enabled) return;
    this.resume();
    const a = world.ambient || { type: 'sine', freq: 110, gain: 0.04, detune: 4 };
    if (this.current && this.current.id === world.id) return;

    const next = this._makeVoice(a);
    next.id = world.id;
    const now = this.ctx.currentTime;
    next.gain.gain.setValueAtTime(0.0001, now);
    next.gain.gain.exponentialRampToValueAtTime(a.gain, now + this.FADE);

    if (this.current) this._fadeOutAndStop(this.current);
    this.current = next;
  },

  stop() {
    if (this.current) this._fadeOutAndStop(this.current);
    this.current = null;
  },

  /** Short triumphant sting — played when the sword is granted at spawn. */
  swordFanfare() {
    if (!this.enabled) return;
    this.resume();
    const now = this.ctx.currentTime;
    // G-major arpeggio: G4 B4 D5 G5, then a brief chord bloom
    const rises = [392, 494, 587, 784];
    rises.forEach((freq, i) => {
      const t = now + i * 0.11;
      const isLast = i === rises.length - 1;
      const g = this.ctx.createGain();
      g.connect(this.master);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (isLast ? 1.1 : 0.16));
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(g);
      osc.start(t);
      osc.stop(t + (isLast ? 1.2 : 0.22));
    });
    // Shimmer chord underneath the final note
    [392, 494, 587].forEach((freq) => {
      const t = now + rises.length * 0.11;
      const g = this.ctx.createGain();
      g.connect(this.master);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(g);
      osc.start(t);
      osc.stop(t + 1.0);
    });
  },

  /** A soft two-note bell — played when the visitor finds a fragment. */
  chime() {
    if (!this.enabled) return;
    this.resume();
    const now = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.connect(this.master);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
    [880, 1320].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const og = this.ctx.createGain(); og.gain.value = i ? 0.4 : 1;
      o.connect(og).connect(g); o.start(now + i * 0.06); o.stop(now + 1.4);
    });
  },

  /** A short percussive blast — played when a thrown bomb explodes. */
  boom() {
    if (!this.enabled) return;
    this.resume();
    const now = this.ctx.currentTime;
    // Low body: a sine dropping in pitch.
    const g = this.ctx.createGain();
    g.connect(this.master);
    g.gain.setValueAtTime(0.45, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.45);
    osc.connect(g);
    osc.start(now); osc.stop(now + 0.5);
    // Noise burst for the crack.
    const len = Math.floor(this.ctx.sampleRate * 0.25);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.3, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    noise.connect(ng).connect(this.master);
    noise.start(now);
  },

  // --- internals ---------------------------------------------------------

  _ATTACK_SFX: [
    'assets/audio/attack_sounds/damage.wav',
    'assets/audio/attack_sounds/damage_1.wav',
    'assets/audio/attack_sounds/damage_2.wav',
    'assets/audio/attack_sounds/damage_3.wav',
  ],
  _DAMAGE_SFX: [
    'assets/audio/damage-taken-sounds/damage1.wav',
    'assets/audio/damage-taken-sounds/damage2.wav',
    'assets/audio/damage-taken-sounds/damage3.wav',
    'assets/audio/damage-taken-sounds/damage4.wav',
  ],

  /** Play a random sword-swing sound. */
  attackSound() {
    const srcs = this._ATTACK_SFX;
    this.playSfx(srcs[Math.floor(Math.random() * srcs.length)], 0.7);
  },

  /** Play a random damage-taken sound. */
  damageSound() {
    const srcs = this._DAMAGE_SFX;
    this.playSfx(srcs[Math.floor(Math.random() * srcs.length)], 0.65);
  },

  /** One-shot SFX: load (cached), decode, play immediately. */
  playSfx(src, volume = 0.7) {
    if (!this.enabled) return;
    this.resume();
    this._loadBuffer(src).then((buffer) => {
      if (!buffer) return;
      const g = this.ctx.createGain();
      g.gain.value = volume;
      g.connect(this.master);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(g);
      source.start();
      source.onended = () => { try { g.disconnect(); } catch (e) {} };
    });
  },

  // Decoded AudioBuffer cache keyed by src path.
  _bufferCache: {},

  _makeVoice(a) {
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(this.master);
    const voice = { nodes: [], gain };

    if (a.src) {
      // Real audio file: fetch → decode → loop. Starts as soon as buffer is ready.
      this._loadBuffer(a.src).then((buffer) => {
        if (!buffer) return;
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gain);
        source.start();
        voice.nodes.push(source);
      });
      return voice;
    }

    // Synthesised drone — fallback for biomes without a real track yet.
    [-a.detune, 0, a.detune].forEach((cents, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = a.type;
      osc.frequency.value = a.freq * (i === 0 ? 0.5 : 1);
      osc.detune.value = cents;
      const og = this.ctx.createGain();
      og.gain.value = i === 0 ? 0.5 : 0.35;
      osc.connect(og).connect(gain);
      osc.start();
      voice.nodes.push(osc);
    });
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = a.gain * 0.25;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();
    voice.nodes.push(lfo);

    return voice;
  },

  async _loadBuffer(src) {
    if (this._bufferCache[src]) return this._bufferCache[src];
    try {
      const encoded = src.split('/').map(encodeURIComponent).join('/');
      const res = await fetch(encoded);
      const raw = await res.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(raw);
      this._bufferCache[src] = buffer;
      return buffer;
    } catch (e) {
      console.warn('AudioManager: could not load', src, e);
      return null;
    }
  },

  _fadeOutAndStop(voice) {
    const now = this.ctx.currentTime;
    try {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(Math.max(voice.gain.gain.value, 0.0001), now);
      voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + this.FADE);
    } catch (e) { /* node may already be stopping */ }
    setTimeout(() => {
      voice.nodes.forEach((n) => { try { n.stop(); } catch (e) {} });
      try { voice.gain.disconnect(); } catch (e) {}
    }, (this.FADE + 0.1) * 1000);
  },
};
