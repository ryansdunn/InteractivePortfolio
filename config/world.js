/* =============================================================================
 * config/world.js
 * -----------------------------------------------------------------------------
 * The WORLD content seed. This is the INPUT to the map generator
 * (tools/generate-map.mjs), which bakes it into an editable Tiled map
 * (assets/maps/world.tmj). At runtime the engine reads the generated Tiled map,
 * NOT this file — so the map is genuinely "designed in Tiled" and editable
 * there. Re-run `node tools/generate-map.mjs` after changing this.
 *
 * Biomes are placed by ANCHOR points; the generator assigns each tile to the
 * nearest anchor with noise-perturbed distance, so biome borders are irregular
 * and bleed into one another (never rectangular). `flavor` biases terrain
 * (water level, forest/ruin density). Landmarks (npcs / signs / fragments) are
 * written into Tiled object layers.
 *
 * Works in both the browser (global `WORLD`) and Node (module export).
 * ========================================================================== */

const WORLD = {
  seed: 24601,
  width: 120,
  height: 120,
  tile: 16,
  spawn: { tx: 60, ty: 60 }, // a calm crossroads in the wilds

  // Region theming reused by the runtime (palette/ambient/HUD). Keyed by biome.
  biomes: {
    wilds: {
      name: 'The Wilds', subtitle: 'a crossroads',
      anchor: { tx: 60, ty: 60 }, flavor: 'wilds',
      hudColor: '#8aa0c8',
      palette: { accent: 0x8aa0c8 },
      ambient: { type: 'sine', freq: 98, gain: 0.7, detune: 4, src: 'assets/audio/wilds.mp3' },
    },
    dev: {
      name: 'Dev', subtitle: 'a lab among the ruins',
      anchor: { tx: 34, ty: 60 }, flavor: 'forest_ruins',
      hudColor: '#4f7cff',
      palette: { accent: 0x4f7cff },
      ambient: { type: 'sine', freq: 84, gain: 0.05, detune: 3 },
    },
    teaching: {
      name: 'Teaching', subtitle: 'a sunlit meadow',
      anchor: { tx: 60, ty: 34 }, flavor: 'meadow',
      hudColor: '#e8772e',
      palette: { accent: 0xe8772e },
      ambient: { type: 'triangle', freq: 196, gain: 0.04, detune: 4 },
    },
    music: {
      name: 'Music', subtitle: 'a dreaming shore',
      anchor: { tx: 82, ty: 76 }, flavor: 'coast',
      hudColor: '#9a7bff',
      palette: { accent: 0x9a7bff },
      ambient: { type: 'sine', freq: 110, gain: 0.045, detune: 5 },
    },
  },

  // Characters (config/projects.js) scattered through their biome.
  npcs: [
    { characterId: 'identikeys', biome: 'dev', tx: 36, ty: 58 },
    { characterId: 'swimming_pool', biome: 'music', tx: 80, ty: 74 },
    { characterId: 'nalcap', biome: 'teaching', tx: 60, ty: 36 },
  ],

  // Signposts — you navigate by these, not a map marker.
  signs: [
    { tx: 56, ty: 62, dir: 'W', text: 'THE LAB — west, past the old ruins' },
    { tx: 64, ty: 62, dir: 'SE', text: 'A QUIET SHORE — follow the water southeast' },
    { tx: 60, ty: 56, dir: 'N', text: 'THE SUNLIT PLAZA — north through the meadow' },
    { tx: 46, ty: 59, dir: 'W', text: 'someone is working just ahead…' },
    { tx: 71, ty: 68, dir: 'SE', text: 'the sound gets closer…' },
  ],

  // Dead-end environmental storytelling — each sits at the end of a spur path
  // (the generator carves one to it). Rewards exploration, no NPC needed.
  fragments: [
    { tx: 26, ty: 50, title: 'an abandoned terminal',
      text: 'A dead screen, still warm. The last line of a commit hangs half-typed: "almost—". Whoever sat here believed the next try would be the one.' },
    { tx: 84, ty: 84, title: 'a cassette in the sand',
      text: 'Half-buried by the tide. The label, in faded marker: "for when you forget." You can almost hear it.' },
    { tx: 62, ty: 26, title: 'a child\'s drawing, pinned to a post',
      text: 'A crayon sun over a tiny stick figure at a piano. Underneath, careful letters: "el profe nos dejó cantar." (the teacher let us sing.)' },
    { tx: 46, ty: 84, title: 'a cairn of small stones',
      text: 'Someone stacked these, one at a time. A marker for a path, or just proof that they passed through and chose to leave something behind.' },
  ],
};

if (typeof module !== 'undefined') module.exports = WORLD;
