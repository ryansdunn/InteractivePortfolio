/* =============================================================================
 * scenes/BootScene.js
 * -----------------------------------------------------------------------------
 * Loads the generated Tiled world (assets/maps/world.tmj) + terrain tileset,
 * generates the sprite textures, then routes to the title screen or — for a
 * ?world=dev|music|teaching deep-link — straight into that biome.
 * ========================================================================== */

class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.load.image('terrain', 'assets/tilesets/terrain.png');
    this.load.tilemapTiledJSON('world', 'assets/maps/world.tmj');
  }

  create() {
    AssetFactory.generateAll(this);

    const param = new URLSearchParams(window.location.search).get('world');
    if (param && WORLD.biomes[param]) {
      this.scene.start('World', { spawn: param });
    } else {
      this.scene.start('TitleScene');
    }
  }
}
