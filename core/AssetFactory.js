/* =============================================================================
 * core/AssetFactory.js
 * -----------------------------------------------------------------------------
 * Generates all in-game textures at runtime with Phaser's Graphics API, so the
 * project has ZERO binary asset dependencies and runs anywhere (GitHub Pages,
 * file://) with no build step.
 *
 * SWAPPING IN KENNEY ASSETS LATER
 *   These are deliberately simple, palette-driven placeholders. To replace them
 *   with real Kenney.nl pixel art, preload the spritesheets in BootScene and
 *   swap these sprite generators for a Kenney character atlas preloaded in BootScene
 *   generators. Texture KEYS are namespaced per world (`<worldId>-floor`, etc.)
 *   and per character (`npc-<id>`), which is exactly how a Kenney atlas would
 *   be keyed — so the engine code wouldn't need to change.
 * ========================================================================== */

const AssetFactory = {
  TILE: 32,

  /** Build the runtime SPRITE textures. Terrain comes from the Tiled tileset, so
   *  this only makes the player, NPCs, Doubts, sword slash, and prompt bubble. */
  generateAll(scene) {
    this.generatePlayer(scene);
    this.generatePromptBubble(scene);
    this.generateSword(scene);
    this.generateCrossbow(scene);
    this.generateBolt(scene);
    this.generateBomb(scene);
    this.generateCaveTiles(scene);
    this.generateBoss(scene);

    Object.values(CHARACTERS).forEach((c) => this.generateNpc(scene, c));
    Object.values(DOUBTS).forEach((d) => this.generateDoubt(scene, d));
  },

  // --- cave arena tiles (BossScene) --------------------------------------
  generateCaveTiles(scene) {
    // 16×16 floor — dark stone with a faint speckle so the tiling reads.
    this._tex(scene, 'cave-floor', 16, 16, (g) => {
      g.fillStyle(0x231f2b, 1).fillRect(0, 0, 16, 16);
      g.fillStyle(0x2b2636, 1).fillRect(0, 0, 16, 2);
      g.fillStyle(0x1a1722, 1).fillRect(3, 6, 2, 2).fillRect(10, 10, 2, 2).fillRect(7, 12, 2, 2);
    });
    // 16×16 wall — lit top edge, dark base, so a ring of them reads as cave rock.
    this._tex(scene, 'cave-wall', 16, 16, (g) => {
      g.fillStyle(0x14101a, 1).fillRect(0, 0, 16, 16);
      g.fillStyle(0x2c2436, 1).fillRect(0, 0, 16, 5);
      g.fillStyle(0x0c0911, 1).fillRect(0, 13, 16, 3);
      g.fillStyle(0x3a3148, 0.5).fillRect(2, 2, 4, 2).fillRect(9, 3, 4, 2);
    });
  },

  // --- the boss: a giant four-armed crab ---------------------------------
  generateBoss(scene) {
    const c = BOSS.palette;
    // Body: a broad reddish shell, two eye-stalks, an angry maw. Arms are a
    // separate 'boss-claw' texture so they can swipe independently.
    this._tex(scene, 'boss-crab', 124, 90, (g) => {
      g.fillStyle(0x000000, 0.35).fillEllipse(62, 84, 100, 14);     // shadow
      // legs poking out beneath the shell
      g.fillStyle(c.claw, 1);
      [-44, -28, 28, 44].forEach((dx) => {
        g.fillTriangle(62 + dx, 58, 62 + dx + (dx < 0 ? -10 : 10), 78, 62 + dx + (dx < 0 ? 4 : -4), 62);
      });
      // shell
      g.fillStyle(c.shell, 1).fillEllipse(62, 48, 108, 62);
      g.fillStyle(c.shellHi, 1).fillEllipse(62, 40, 98, 42);
      g.fillStyle(c.shell, 1).fillEllipse(62, 52, 92, 40);
      // shell cracks / texture
      g.fillStyle(0x000000, 0.18).fillRect(34, 44, 5, 4).fillRect(82, 40, 5, 4).fillRect(58, 30, 6, 3);
      // eye-stalks + eyes
      g.fillStyle(c.shell, 1).fillRect(46, 8, 5, 18).fillRect(73, 8, 5, 18);
      g.fillStyle(0xffffff, 1).fillCircle(48, 8, 8).fillCircle(76, 8, 8);
      g.fillStyle(c.eye, 1).fillCircle(48, 8, 6).fillCircle(76, 8, 6);
      g.fillStyle(0x10101a, 1).fillCircle(48, 8, 3).fillCircle(76, 8, 3);
      // angry brow
      g.fillStyle(c.claw, 1).fillTriangle(40, 4, 56, 12, 40, 12).fillTriangle(84, 4, 68, 12, 84, 12);
      // maw with jagged teeth
      g.fillStyle(0x2a0a10, 1).fillRect(48, 60, 28, 10);
      g.fillStyle(0xf2e6c8, 1);
      for (let x = 50; x < 74; x += 5) g.fillTriangle(x, 60, x + 4, 60, x + 2, 66);
    });

    // Claw arm, pointing right; origin set near the base at runtime so it
    // pivots from the shoulder when it swipes.
    this._tex(scene, 'boss-claw', 48, 34, (g) => {
      g.fillStyle(c.shell, 1).fillRect(0, 13, 22, 9);              // arm
      g.fillStyle(c.shellHi, 1).fillRect(0, 13, 22, 3);
      g.fillStyle(c.claw, 1).fillEllipse(26, 17, 20, 22);         // pincer base
      g.fillTriangle(26, 8, 48, 1, 36, 17);                       // upper jaw
      g.fillTriangle(26, 26, 48, 33, 36, 17);                     // lower jaw
      g.fillStyle(0x2a0a10, 1).fillTriangle(30, 14, 44, 9, 36, 17); // mouth gap
      g.fillStyle(c.shellHi, 0.6).fillRect(20, 11, 8, 3);
    });
  },

  // --- region tiles + decorations ----------------------------------------
  generateRegion(scene, region) {
    const p = region.palette;
    const T = this.TILE;
    const id = region.id;

    // Floor — base color with a few darker speckles for texture.
    this._tex(scene, `${id}-floor`, T, T, (g) => {
      g.fillStyle(p.floor, 1).fillRect(0, 0, T, T);
      g.fillStyle(p.floorAlt, 1);
      g.fillRect(4, 6, 3, 3).fillRect(20, 22, 3, 3).fillRect(24, 8, 2, 2);
      g.lineStyle(1, p.floorAlt, 0.35).strokeRect(0, 0, T, T);
    });

    // Wall — a face with a lighter "top" band so it reads as 3D-ish.
    this._tex(scene, `${id}-wall`, T, T, (g) => {
      g.fillStyle(p.wall, 1).fillRect(0, 0, T, T);
      g.fillStyle(p.wallTop, 1).fillRect(0, 0, T, 10);
      g.fillStyle(p.bg, 0.4).fillRect(0, T - 4, T, 4);
    });

  },

  generateDecoration(scene, worldId, type, p) {
    const key = `${worldId}-deco-${type}`;
    if (scene.textures.exists(key)) return;
    const T = this.TILE;
    const draw = this.DECORATIONS[type] || this.DECORATIONS.crate;
    const size = draw.size || [T, T];
    this._tex(scene, key, size[0], size[1], (g) => draw.paint(g, p, T));
  },

  // Decoration painters. Each is intentionally chunky/pixel-ish.
  DECORATIONS: {
    desk: { size: [64, 32], paint: (g) => {
      g.fillStyle(0x4a3b2a, 1).fillRect(0, 8, 64, 24);
      g.fillStyle(0x5c4a34, 1).fillRect(0, 8, 64, 6);
      g.fillStyle(0x2e2418, 1).fillRect(4, 26, 6, 6).fillRect(54, 26, 6, 6);
    }},
    monitor: { size: [32, 32], paint: (g, p) => {
      g.fillStyle(0x111111, 1).fillRect(2, 2, 28, 20);
      g.fillStyle(p.glow, 0.9).fillRect(4, 4, 24, 16);
      g.fillStyle(0xffffff, 0.25).fillRect(6, 6, 10, 3).fillRect(6, 12, 16, 2);
      g.fillStyle(0x333333, 1).fillRect(14, 22, 4, 6).fillRect(8, 28, 16, 3);
    }},
    whiteboard: { size: [96, 56], paint: (g, p) => {
      g.fillStyle(0x20283f, 1).fillRect(0, 0, 96, 56);
      g.fillStyle(0xe8edf7, 1).fillRect(4, 4, 88, 48);
      g.lineStyle(2, p.accent, 0.8);
      g.beginPath(); g.moveTo(10, 14); g.lineTo(34, 14); g.moveTo(10, 24);
      g.lineTo(50, 24); g.moveTo(10, 34); g.lineTo(28, 34); g.strokePath();
      g.fillStyle(0xff6b6b, 1).fillRect(60, 18, 20, 20);
    }},
    server: { size: [32, 64], paint: (g, p) => {
      g.fillStyle(0x1c2233, 1).fillRect(2, 0, 28, 64);
      for (let y = 4; y < 60; y += 8) {
        g.fillStyle(0x10141f, 1).fillRect(5, y, 22, 5);
        g.fillStyle(p.glow, 1).fillRect(7, y + 1, 2, 2);
        g.fillStyle(0x59ff8a, 1).fillRect(11, y + 1, 2, 2);
      }
    }},
    plant: { size: [32, 40], paint: (g) => {
      g.fillStyle(0x7a4a2a, 1).fillRect(8, 26, 16, 14);
      g.fillStyle(0x8a5634, 1).fillRect(8, 26, 16, 4);
      g.fillStyle(0x2f7d4f, 1).fillRect(10, 6, 12, 22);
      g.fillStyle(0x3fa368, 1).fillRect(4, 12, 10, 12).fillRect(18, 12, 10, 12);
      g.fillStyle(0x4fc47e, 1).fillRect(12, 2, 8, 10);
    }},
    rug: { size: [128, 96], paint: (g, p) => {
      g.fillStyle(p.accent, 0.12).fillRect(0, 0, 128, 96);
      g.lineStyle(3, p.accent, 0.35).strokeRect(8, 8, 112, 80);
      g.lineStyle(2, p.glow, 0.25).strokeRect(20, 20, 88, 56);
    }},
    piano: { size: [96, 56], paint: (g) => {
      g.fillStyle(0x14101e, 1).fillRect(0, 6, 96, 50);
      g.fillStyle(0x241b38, 1).fillRect(0, 6, 96, 8);
      g.fillStyle(0xf2ecff, 1).fillRect(6, 30, 84, 20);
      g.fillStyle(0x14101e, 1);
      for (let x = 12; x < 88; x += 12) g.fillRect(x, 30, 6, 12);
      g.fillStyle(0x3a2f57, 1).fillRect(10, 50, 8, 6).fillRect(78, 50, 8, 6);
    }},
    candle: { size: [32, 32], paint: (g) => {
      g.fillStyle(0x2a2140, 1).fillRect(11, 16, 10, 14);
      g.fillStyle(0xe9d8a6, 1).fillRect(13, 8, 6, 10);
      g.fillStyle(0xffd98a, 1).fillRect(14, 2, 4, 7);
      g.fillStyle(0xfff4cf, 0.6).fillRect(8, 0, 16, 16);
    }},
    frame: { size: [32, 40], paint: (g, p) => {
      g.fillStyle(0x3a2f57, 1).fillRect(0, 0, 32, 40);
      g.fillStyle(p.glow, 0.5).fillRect(4, 4, 24, 32);
      g.fillStyle(0xffffff, 0.18).fillRect(8, 10, 16, 4).fillRect(8, 20, 10, 4);
    }},
    crate: { size: [32, 32], paint: (g) => {
      g.fillStyle(0x6b5230, 1).fillRect(0, 0, 32, 32);
      g.lineStyle(2, 0x4a3a22, 1).strokeRect(2, 2, 28, 28);
      g.beginPath(); g.moveTo(2, 2); g.lineTo(30, 30);
      g.moveTo(30, 2); g.lineTo(2, 30); g.strokePath();
    }},
    lamp: { size: [32, 56], paint: (g) => {
      g.fillStyle(0x2a2140, 1).fillRect(13, 18, 6, 38);
      g.fillStyle(0x9a7bff, 1).fillRect(6, 2, 20, 16);
      g.fillStyle(0xfff4cf, 0.5).fillRect(2, 10, 28, 20);
    }},
    fountain: { size: [96, 80], paint: (g, p) => {
      g.fillStyle(0x9c6b3f, 1).fillRect(8, 40, 80, 36);
      g.fillStyle(0xb98a55, 1).fillRect(8, 40, 80, 6);
      g.fillStyle(0x6ab0d6, 1).fillRect(16, 46, 64, 24);
      g.fillStyle(0x9ad4ef, 0.8).fillRect(20, 48, 56, 8);
      g.fillStyle(0xb98a55, 1).fillRect(44, 10, 8, 36);
      g.fillStyle(0x9ad4ef, 0.7).fillRect(40, 6, 16, 8);
    }},
    bench: { size: [64, 32], paint: (g) => {
      g.fillStyle(0x7a4a2a, 1).fillRect(2, 10, 60, 8);
      g.fillStyle(0x8a5634, 1).fillRect(2, 10, 60, 3);
      g.fillStyle(0x5c3a20, 1).fillRect(6, 18, 6, 12).fillRect(52, 18, 6, 12);
    }},
    tree: { size: [56, 72], paint: (g) => {
      g.fillStyle(0x6b4423, 1).fillRect(24, 40, 10, 32);
      g.fillStyle(0x2f7d4f, 1).fillRect(8, 8, 40, 36);
      g.fillStyle(0x3fa368, 1).fillRect(2, 18, 22, 22).fillRect(32, 18, 22, 22);
      g.fillStyle(0x4fc47e, 1).fillRect(18, 2, 22, 16);
    }},
    flowers: { size: [32, 24], paint: (g) => {
      g.fillStyle(0x2f7d4f, 1).fillRect(6, 14, 20, 8);
      const cols = [0xff6b9d, 0xffd166, 0x9a7bff];
      [6, 14, 22].forEach((x, i) => { g.fillStyle(cols[i], 1).fillRect(x, 6, 6, 6); });
    }},
    schooldoor: { size: [96, 96], paint: (g, p) => {
      g.fillStyle(0x9c6b3f, 1).fillRect(0, 0, 96, 96);
      g.fillStyle(0xb98a55, 1).fillRect(6, 6, 84, 90);
      g.fillStyle(0x5c3a20, 1).fillRect(30, 30, 36, 66);
      g.fillStyle(p.glow, 0.6).fillRect(34, 34, 28, 24);
      g.fillStyle(0xffd98a, 1).fillRect(58, 60, 4, 8);
    }},
    window: { size: [64, 56], paint: (g, p) => {
      g.fillStyle(0x9c6b3f, 1).fillRect(0, 0, 64, 56);
      g.fillStyle(0x1a2a3a, 1).fillRect(6, 6, 52, 44);
      g.fillStyle(p.glow, 0.45).fillRect(6, 6, 52, 44);
      g.lineStyle(3, 0x9c6b3f, 1);
      g.beginPath(); g.moveTo(32, 6); g.lineTo(32, 50);
      g.moveTo(6, 28); g.lineTo(58, 28); g.strokePath();
    }},
  },

  // --- player ------------------------------------------------------------
  generatePlayer(scene) {
    this._tex(scene, 'player', 24, 30, (g) => {
      g.fillStyle(0x1b1f2e, 0.35).fillEllipse(12, 28, 18, 5);   // shadow
      g.fillStyle(0x2c4a8f, 1).fillRect(5, 14, 14, 12);          // jacket
      g.fillStyle(0x3a5fb0, 1).fillRect(5, 14, 14, 4);
      g.fillStyle(0xf0c8a0, 1).fillRect(7, 4, 10, 10);           // face
      g.fillStyle(0x3a2a1a, 1).fillRect(6, 2, 12, 5);            // hair
      g.fillStyle(0x1b1f2e, 1).fillRect(9, 8, 2, 2).fillRect(14, 8, 2, 2); // eyes
      g.fillStyle(0x24305a, 1).fillRect(6, 26, 5, 4).fillRect(13, 26, 5, 4); // feet
    });
  },

  // --- NPC (palette-driven, so each character looks distinct) -------------
  generateNpc(scene, c) {
    const s = c.sprite;
    this._tex(scene, `npc-${c.id}`, 26, 32, (g) => {
      g.fillStyle(0x000000, 0.3).fillEllipse(13, 30, 20, 5);
      g.fillStyle(s.body, 1).fillRect(5, 15, 16, 13);
      g.fillStyle(s.accent, 1).fillRect(5, 15, 16, 4).fillRect(11, 19, 4, 9);
      g.fillStyle(0xf0c8a0, 1).fillRect(7, 4, 12, 11);
      g.fillStyle(s.hair, 1).fillRect(6, 1, 14, 6).fillRect(6, 1, 3, 9).fillRect(17, 1, 3, 9);
      g.fillStyle(0x1b1f2e, 1).fillRect(9, 8, 2, 2).fillRect(15, 8, 2, 2);
    });
  },

  // --- "!" prompt bubble shown above an interactable NPC ------------------
  generatePromptBubble(scene) {
    this._tex(scene, 'prompt-bubble', 20, 24, (g) => {
      g.fillStyle(0xffffff, 1).fillRoundedRect(0, 0, 20, 18, 5);
      g.fillTriangle(6, 16, 14, 16, 8, 23);
      g.fillStyle(0x222831, 1).fillRect(8, 3, 4, 8).fillRect(8, 13, 4, 3);
    });
  },

  // --- pixel-art sword (pointing right; rotated at runtime per facing) ---
  generateSword(scene) {
    // 40 wide x 10 tall. Handle on left, tip on right.
    this._tex(scene, 'sword', 40, 10, (g) => {
      // pommel
      g.fillStyle(0x5a3a1e, 1).fillRect(0, 2, 3, 6);
      // grip
      g.fillStyle(0x7a4a2a, 1).fillRect(3, 3, 7, 4);
      g.fillStyle(0xa06438, 1).fillRect(3, 3, 7, 2);
      // crossguard
      g.fillStyle(0x4a4a5a, 1).fillRect(10, 0, 4, 10);
      g.fillStyle(0x8a8a9a, 1).fillRect(10, 0, 4, 2);
      // blade
      g.fillStyle(0xb8c8d8, 1).fillRect(14, 3, 20, 4);
      g.fillStyle(0xe8f4ff, 1).fillRect(14, 3, 20, 2);
      // tapered tip
      g.fillStyle(0xb8c8d8, 1).fillRect(34, 3, 4, 3);
      g.fillStyle(0xe8f4ff, 1).fillRect(34, 3, 3, 1);
      g.fillStyle(0xb8c8d8, 1).fillRect(37, 4, 3, 1);
    });
  },

  // --- pixel-art crossbow (pointing right; rotated at runtime per facing) ---
  generateCrossbow(scene) {
    // 26 wide x 10 tall. Compact crossbow — tip on right, stock on left.
    this._tex(scene, 'crossbow', 26, 10, (g) => {
      // stock
      g.fillStyle(0x7a4a2a, 1).fillRect(0, 3, 14, 4);
      g.fillStyle(0xa06438, 1).fillRect(0, 3, 14, 2);
      // tiller / rail
      g.fillStyle(0x5a3a20, 1).fillRect(14, 3, 8, 4);
      g.fillStyle(0x8a6040, 1).fillRect(14, 3, 8, 2);
      // bow limbs
      g.fillStyle(0x4a4a5a, 1).fillRect(22, 0, 4, 10);
      g.fillStyle(0x8a8a9a, 1).fillRect(22, 0, 4, 2).fillRect(22, 8, 4, 2);
      // bowstring
      g.lineStyle(1, 0xe8f4ff, 0.85);
      g.beginPath().moveTo(24, 1).lineTo(20, 5).lineTo(24, 9).strokePath();
      // bolt in groove
      g.fillStyle(0xd8c090, 1).fillRect(8, 4, 12, 2);
      g.fillStyle(0xffd98a, 1).fillRect(18, 3, 3, 1);
    });
  },

  // --- crossbow bolt projectile (pointing right; rotated per facing) ------
  generateBolt(scene) {
    // 14 wide x 3 tall.
    this._tex(scene, 'bolt', 14, 3, (g) => {
      // fletching
      g.fillStyle(0xff6b6b, 1).fillRect(0, 0, 3, 1).fillRect(0, 2, 3, 1);
      // shaft
      g.fillStyle(0xd8c090, 1).fillRect(3, 1, 8, 1);
      // tip
      g.fillStyle(0xb8c8d8, 1).fillRect(11, 0, 3, 3);
      g.fillStyle(0xe8f4ff, 1).fillRect(11, 0, 2, 1);
    });
  },

  // --- throwable bomb (held in hand + the tossed projectile) -------------
  generateBomb(scene) {
    // 16×18: a round iron bomb with a short fuse and a lit spark.
    this._tex(scene, 'bomb', 16, 18, (g) => {
      g.fillStyle(0x000000, 0.3).fillEllipse(8, 17, 12, 3);   // shadow
      g.fillStyle(0x20242e, 1).fillCircle(8, 11, 6);          // body
      g.fillStyle(0x3a4150, 1).fillCircle(8, 11, 6).fillCircle(10, 9, 2); // shading + glint
      g.fillStyle(0x10131a, 1).fillCircle(8, 12, 5);
      g.fillStyle(0x4a5163, 1).fillCircle(6, 9, 1.5);
      g.fillStyle(0x7a4a2a, 1).fillRect(9, 2, 2, 5);          // fuse
      g.fillStyle(0xffd98a, 1).fillCircle(11, 2, 2);          // spark
      g.fillStyle(0xff8a3a, 1).fillCircle(11, 2, 1);
    });
  },

  // --- locked door / gate (spans a 2-tile doorway, 64x64) ----------------
  generateDoor(scene) {
    this._tex(scene, 'door', 64, 64, (g) => {
      g.fillStyle(0x20242e, 1).fillRect(0, 0, 64, 64);          // dark frame
      g.fillStyle(0x3a3f4d, 1).fillRect(4, 4, 56, 56);          // gate plate
      g.fillStyle(0x2a2e38, 1);
      for (let x = 12; x < 60; x += 14) g.fillRect(x, 8, 6, 48); // bars
      g.fillStyle(0x4a5163, 1).fillRect(4, 30, 56, 5);          // cross beam
      g.fillStyle(0xffd98a, 1).fillRect(28, 26, 8, 12);         // lock body
      g.fillStyle(0x3a3f4d, 1).fillRect(30, 22, 4, 6);          // shackle
      g.fillStyle(0x1a1d24, 1).fillRect(31, 31, 2, 4);          // keyhole
    });
  },

  // --- Doubt monster (palette-driven spiky blob with a worried eye) -------
  generateDoubt(scene, d) {
    const c = d.palette;
    this._tex(scene, `doubt-${d.id}`, 30, 30, (g) => {
      g.fillStyle(0x000000, 0.3).fillEllipse(15, 27, 22, 5); // shadow
      // spiky body
      g.fillStyle(c.body, 1);
      g.fillTriangle(4, 14, 9, 2, 14, 14);
      g.fillTriangle(11, 14, 15, 1, 19, 14);
      g.fillTriangle(16, 14, 21, 2, 26, 14);
      g.fillRect(4, 12, 22, 12);
      g.fillTriangle(4, 24, 9, 24, 6, 29);
      g.fillTriangle(11, 24, 16, 24, 13, 29);
      g.fillTriangle(17, 24, 22, 24, 19, 29);
      // glowing rim + single eye
      g.fillStyle(c.accent, 0.9).fillRect(4, 12, 22, 2);
      g.fillStyle(0xffffff, 1).fillRect(11, 16, 8, 6);
      g.fillStyle(0x10101a, 1).fillRect(14, 17, 3, 4);
    });
  },

  // --- helper: draw to a Graphics then bake to a texture -----------------
  _tex(scene, key, w, h, paint) {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    paint(g);
    g.generateTexture(key, w, h);
    g.destroy();
  },
};
