/* =============================================================================
 * core/OverworldScene.js
 * -----------------------------------------------------------------------------
 * The dungeon scene. Builds the rooms-and-doors map (core/DungeonMap.js), frames
 * one room at a time with a room-snap camera, detects the room the player is in
 * (driving ambient-music crossfade, HUD theme, minimap reveal, and the combat
 * encounter), handles NPC conversations, and opens gated doors when a room is
 * cleared.
 *
 * Content is pure config: a room is an entry in ROOMS (config/dungeon.js), an
 * NPC an entry in CHARACTERS, a monster an entry in DOUBTS.
 * ========================================================================== */

class OverworldScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Overworld' });
  }

  create(data) {
    this.cameras.main.setBackgroundColor(0x05060c); // void colour between rooms

    this.dungeon = new DungeonMap(this).build();
    this._buildDecorations();
    this._buildNpcs();
    this._buildPlayer(data);

    // Input (must exist before CombatSystem, which reads scene.keys).
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,E,J');
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.dialogue = new DialogueBox(this);
    this.combat = new CombatSystem(this);

    this.facing = { x: 0, y: 1 };
    this.nearbyNpc = null;
    this.currentRoom = null;
    this.currentRegion = null;
    this._transition = false;

    this.input.once('pointerdown', () => AudioManager.resume());
    this.input.keyboard.once('keydown', () => AudioManager.resume());

    if (Portfolio.minimap) Portfolio.minimap.init(this.dungeon.rooms);

    // When a room's Doubts are all cleared, open its gated door.
    this.events.on('room:cleared', (roomId) => {
      if (this.dungeon.openDoor(roomId)) {
        Portfolio.toast('The way opens.', this.currentRegion ? this.currentRegion.hudColor : '#8aa0c8');
        if (Portfolio.minimap) Portfolio.minimap.markCleared(roomId);
      }
    });

    // Frame the starting room immediately.
    this._enterRoom(this.dungeon.rooms[this._startRoomId], true);
    this.cameras.main.fadeIn(450, 0, 0, 0);
  }

  // --- build -------------------------------------------------------------
  _buildDecorations() {
    const T = DUNGEON.TILE;
    Object.values(this.dungeon.rooms).forEach((room) => {
      (room.decorations || []).forEach((d) => {
        const x = (room.rect.tx + d.tx) * T;
        const y = (room.rect.ty + d.ty) * T;
        this.add.image(x, y, `${room.region}-deco-${d.type}`).setOrigin(0, 0.5).setDepth(y);
      });
    });
  }

  _buildNpcs() {
    const T = DUNGEON.TILE;
    this.npcs = [];
    Object.values(this.dungeon.rooms).forEach((room) => {
      if (!room.npc) return;
      const c = CHARACTERS[room.npc];
      if (!c) { console.warn(`Room ${room.id} has unknown npc ${room.npc}`); return; }
      const x = room.center.x;
      const y = room.px.y + 3 * T;

      const sprite = this.physics.add.staticImage(x, y, `npc-${c.id}`).setDepth(y);
      const name = this.add.text(x, y - 26, c.name, {
        fontFamily: 'monospace', fontSize: '11px', color: '#ffffff',
        backgroundColor: '#00000099', padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(y + 1);
      const bubble = this.add.image(x + 16, y - 22, 'prompt-bubble').setDepth(y + 2);
      this.tweens.add({ targets: bubble, y: bubble.y - 4, yoyo: true, repeat: -1, duration: 700 });
      const met = this.add.text(x, y - 38, '✓', {
        fontFamily: 'monospace', fontSize: '12px', color: '#7CFFb0',
      }).setOrigin(0.5).setDepth(y + 2).setVisible(GameState.hasMet(c.id));

      this.npcs.push({ character: c, sprite, name, bubble, metMark: met, room });
    });
  }

  _buildPlayer(data) {
    const T = DUNGEON.TILE;
    let startId = DUNGEON.start;
    if (data && data.spawn && this.dungeon.rooms[data.spawn]) startId = data.spawn;
    this._startRoomId = startId;
    const room = this.dungeon.rooms[startId];

    this.player = this.physics.add.sprite(room.center.x, room.center.y, 'player');
    this.player.setCollideWorldBounds(true).setSize(16, 12).setOffset(4, 18).setDepth(this.player.y);
    this.physics.add.collider(this.player, this.dungeon.wallObjects);
    this.physics.add.collider(this.player, this.dungeon.doorBodies);
    this.cameras.main.setBounds(0, 0, DUNGEON.cols * T, DUNGEON.rows * T);
  }

  // --- rooms -------------------------------------------------------------
  _updateRoom() {
    const room = this.dungeon.roomAt(this.player.x, this.player.y);
    if (!room || (this.currentRoom && room.id === this.currentRoom.id)) return;
    this._enterRoom(room, false);
  }

  _enterRoom(room, instant) {
    this.currentRoom = room;

    // Region change drives ambience + theme + toast + URL.
    if (!this.currentRegion || this.currentRegion.id !== room.region) {
      this.currentRegion = REGIONS[room.region];
      AudioManager.play(this.currentRegion);
      Portfolio.profileCard.setTheme(this.currentRegion.hudColor);
      if (Portfolio.minimap) Portfolio.minimap.setTheme(this.currentRegion.hudColor);
      Portfolio.toast(`${this.currentRegion.name} — ${this.currentRegion.subtitle}`, this.currentRegion.hudColor);
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('world', room.region);
        window.history.replaceState({}, '', url);
      } catch (e) {}
    }

    if (Portfolio.minimap) { Portfolio.minimap.reveal(room.id); Portfolio.minimap.setCurrent(room.id); }

    // Room-snap camera.
    if (instant) {
      this.cameras.main.centerOn(room.center.x, room.center.y);
    } else {
      this._transition = true;
      // Step the player off the doorway, into the new room.
      const dx = Math.sign(room.center.x - this.player.x);
      const dy = Math.sign(room.center.y - this.player.y);
      this.player.setPosition(this.player.x + dx * 18, this.player.y + dy * 18);
      this.player.body.setVelocity(0, 0);
      this.cameras.main.pan(room.center.x, room.center.y, 320, 'Sine.easeInOut', false,
        (cam, prog) => { if (prog === 1) this._transition = false; });
    }

    if (this.combat) this.combat.enterRoom(room);
  }

  // --- loop --------------------------------------------------------------
  update(time, delta) {
    if (!this.player) return;
    const blocked = this.dialogue.isOpen || Portfolio.modalOpen || this._transition;

    this._move(blocked);
    this._updateRoom();
    this._updateProximity();
    this._handleInteract(blocked);
    this.combat.update(delta, blocked);

    this.player.setDepth(this.player.y);
  }

  _move(blocked) {
    const b = this.player.body;
    if (this.combat && this.combat.playerKnocked()) return;
    b.setVelocity(0);
    if (blocked) return;

    const speed = 170;
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const up = this.cursors.up.isDown || this.keys.W.isDown;
    const down = this.cursors.down.isDown || this.keys.S.isDown;

    let fx = 0, fy = 0;
    if (left) { b.setVelocityX(-speed); fx = -1; }
    else if (right) { b.setVelocityX(speed); fx = 1; }
    if (up) { b.setVelocityY(-speed); fy = -1; }
    else if (down) { b.setVelocityY(speed); fy = 1; }
    b.velocity.normalize().scale(speed);

    if (fx || fy) {
      this.facing = { x: fx, y: fy };
      if (fx < 0) this.player.setFlipX(true);
      else if (fx > 0) this.player.setFlipX(false);
    }
  }

  _updateProximity() {
    const range = DUNGEON.TILE * 1.5;
    let found = null;
    for (const n of this.npcs) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, n.sprite.x, n.sprite.y);
      n.bubble.setVisible(d < range && !this.dialogue.isOpen);
      if (d < range && (!found || d < found.d)) found = { n, d };
    }
    this.nearbyNpc = found ? found.n : null;
    if (!this.dialogue.isOpen) {
      Portfolio.setHint(found ? `Press SPACE / E to talk to ${found.n.character.name}` : '');
    }
  }

  _handleInteract(blocked) {
    const pressed =
      Phaser.Input.Keyboard.JustDown(this.interactKey) ||
      Phaser.Input.Keyboard.JustDown(this.keys.E);
    if (!pressed) return;
    if (this.dialogue.isOpen) { this.dialogue.advance(); return; }
    if (blocked || !this.nearbyNpc) return;
    this._talkTo(this.nearbyNpc);
  }

  _talkTo(n) {
    const c = n.character;
    Portfolio.setHint('');
    this.dialogue.open(c, () => {
      GameState.recordMeeting(c);
      n.metMark.setVisible(true);
      if (c.grants === 'sword' && this.combat) this.combat.giveSword();
      if (c.panel) Portfolio.infoPanel.open(c);
    });
  }
}
