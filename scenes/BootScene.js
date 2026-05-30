/* =============================================================================
 * scenes/BootScene.js
 * -----------------------------------------------------------------------------
 * Generates every texture up front (instant world transitions), then routes to
 * either a world (if ?world=… is present and valid) or the title screen.
 * ========================================================================== */

class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    AssetFactory.generateAll(this);

    // ?world=dev|music|teaching deep-links straight into that wing's entry room.
    // No param → the framing title screen.
    const param = new URLSearchParams(window.location.search).get('world');
    const room = param && BootScene.SPAWN_ROOMS[param];
    if (room) {
      this.scene.start('Overworld', { spawn: room });
    } else {
      this.scene.start('TitleScene');
    }
  }

  static get SPAWN_ROOMS() {
    return { hub: 'hub_entry', dev: 'dev_entry', music: 'music_entry', teaching: 'teach_entry' };
  }
}
