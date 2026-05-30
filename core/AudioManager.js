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

  // --- internals ---------------------------------------------------------
  _makeVoice(a) {
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(this.master);

    // A small stack of detuned oscillators makes a warmer "pad" than one tone.
    const nodes = [];
    [-a.detune, 0, a.detune].forEach((cents, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = a.type;
      osc.frequency.value = a.freq * (i === 0 ? 0.5 : 1); // sub on the first
      osc.detune.value = cents;
      const og = this.ctx.createGain();
      og.gain.value = i === 0 ? 0.5 : 0.35;
      osc.connect(og).connect(gain);
      osc.start();
      nodes.push(osc);
    });

    // Slow LFO on the master gain → gentle breathing motion.
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = a.gain * 0.25;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();
    nodes.push(lfo);

    return { nodes, gain };
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
