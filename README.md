# Ryan Dunn — An Interactive Portrait

A Zelda-style RPG portfolio built as a small **top-down dungeon**. You arrive as
a recruiter or curious stranger in a central hub, where a Guide hands you a
sword. Three wings branch off it; in each, you cut through the *Doubts* guarding
a locked door ("Too junior?", "Can he ship solo?"), and the door opens onto the
character who lives beyond — each the personification of a real project, song, or
experience. You enter as a recruiter; you leave understanding a person.

```
        [teach_inner]
        [teach_entry]        (gated door — clear the room's Doubts to open)
[dev_inner][dev_entry][HUB][music_entry][music_inner]
```

> The spine: a builder who shows up fully — in code, in music, in a classroom in
> Spain. Everything asks the same question underneath: how do we become who we're
> meant to be, and how do we help others do the same?

Built with **Phaser 3 + vanilla JS**, no build step. Drop it on GitHub Pages and
it runs.

## Run it

Pure static files, but browsers block `file://` script loading, so serve it:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

**Controls:** WASD / Arrows move · `SPACE` or `E` talk · **`J` or left-click swing
the sword** · `M` toggle the music player. A minimap (bottom-left) reveals rooms
as you enter them.

### Entry points (URL parameter)

| URL | Result |
|-----|--------|
| `/` | Title screen → enter at the **hub** room |
| `/?world=dev` | Deep-link into the **Dev** wing's entry room |
| `/?world=music` | Deep-link into the **Music** wing |
| `/?world=teaching` | Deep-link into the **Teaching** wing |

The dungeon is one tile map of walled **rooms** linked by doorways. A room-snap
camera frames one room at a time; stepping through a doorway pans to the next.
Each room belongs to a **region** (Dev / Music / Teaching / hub) that sets its
palette, ambient music (crossfaded on entry), and HUD theme.

## Architecture — everything is data-driven

Content lives in **config files**. The engine reads them to build the map,
spawn NPCs and monsters, drive dialogue, assemble the profile card, and theme
the UI. **Adding a region, character, or monster means adding one object to a
config — no engine changes.**

```
index.html                  Entry point; loads scripts in dependency order
game.js                     Phaser bootstrap + the Portfolio (Phaser↔DOM) bridge

config/
  dungeon.js                ROOMS graph: rects, doors (+gates), per-room doubts,
                            npc, decorations, minimap cells + DUNGEON map meta
  worlds.js                 REGIONS: palette, ambient, hudColor, name (theming)
  projects.js               Every NPC/character (dialogue, profile, info panel).
                            `main:true` = builds the portrait; the Guide grants the sword
  doubts.js                 Monster types (the hiring objections) — hp, speed, damage
  music.js                  Guideless EP — SoundCloud set + per-track metadata

core/                       The engine (never edited to add content)
  OverworldScene.js         The dungeon scene: room detection, room-snap camera,
                            NPC interaction, opens gated doors on room-cleared
  DungeonMap.js             Builds geometry from ROOMS: floors/walls, doorways,
                            merged-rectangle colliders, locked doors, room registry
  CombatSystem.js           Sword, hearts, forgiving damage/respawn, ROOM encounters
                            (finite spawns, emits room:cleared)
  AssetFactory.js           Generates all placeholder pixel-art textures at runtime
  AudioManager.js           Per-region ambient beds + crossfade on region change
  GameState.js              Shared state (who you've met) via the Phaser registry

components/
  DialogueBox.js            In-world Phaser dialogue UI (typewriter, paged)
  ProfileCard.js            The "living portrait" that assembles as you explore
  InfoPanel.js              Post-conversation detail modal (tech stack + links)
  MusicPlayer.js            SoundCloud embed dock, track-by-track, plays over ambience
  Minimap.js                Reveal-on-enter dungeon minimap (DOM canvas)

scenes/
  BootScene.js              Generates textures, routes to title or a room spawn
  TitleScene.js             Framing intro → enter the dungeon at the hub
```

## The dungeon map

`DungeonMap` reads the `ROOMS` graph and, on one `DUNGEON.cols × DUNGEON.rows`
tile grid, classifies every tile as **floor** (inside a room), **wall** (room
perimeter), or **void**; carves 2-tile **doorways** between connected rooms;
paints floors + walls (region-themed) into one RenderTexture; builds collision as
a few **merged-rectangle** static bodies (not per-tile); and drops a locked-door
sprite + collider on each gated doorway. Decoration/NPC positions are **relative
to each room's rect**. The scene detects the room containing the player each
frame and **snaps the camera** to frame it (panning on transitions), which also
drives the ambient crossfade, HUD theme, toast, URL, and minimap reveal.

## Combat (forgiving, room encounters)

The Guide gives you the sword in the hub. Entering an uncleared room that has
**Doubts** spawns a *finite* set once; they chase you and deal contact damage.
Swing the sword (`J` / click) to knock them back and dispel them — each pops with
its objection struck through. Clearing all of a room's Doubts emits
`room:cleared`, which **opens that room's gated door** to the inner room beyond.
Forgiving by design: hearts regenerate, no game-over, and being emptied respawns
you in the room with its encounter re-armed. Combat doesn't touch dialogue or the
profile card — it's progression, not story.

## How to extend

- **Add a room** → entry in `ROOMS` (`config/dungeon.js`) with a non-overlapping
  `rect`, a `map` cell, and a `door` wired to it. Optionally `npc`, `doubts`,
  `decorations`. Walls, doorways, collision, and minimap update automatically.
- **Add a character** → object in `CHARACTERS` (`config/projects.js`); set a
  room's `npc` to its id. `main:true` makes it build the portrait.
- **Add a monster** → entry in `DOUBTS` (`config/doubts.js`); reference it from a
  room's `doubts: [{ type, count }]` (a finite encounter).
- **Add/retheme a region** → entry in `REGIONS` (`config/worlds.js`) — palette,
  ambient, hudColor; rooms point at it via `region`.
- **Finish the Music wing** → add `down_to_earth` and `guideless` characters and
  give them rooms off `music_inner`; the MusicPlayer already plays the set.

## Placeholder assets (swappable)

To stay dependency-free, textures are **generated at runtime** from palettes
(`core/AssetFactory.js`) and ambient audio is **synthesized** (`core/AudioManager.js`).
Both are structured for a clean swap to real assets later:

- **Pixel art (Kenney.nl):** preload spritesheets in `BootScene` and point the
  engine at the texture keys (already namespaced `<region>-floor`, `npc-<id>`,
  `doubt-<id>`, …).
- **Music:** replace `AudioManager._makeVoice` with an `<audio>` element loading
  `ambient.src` per region; the crossfade logic is unchanged.

## Status

- ✅ Top-down dungeon: hub + three 2-room wings, walled rooms, doorways,
  room-snap camera, reveal-on-enter minimap
- ✅ Gated doors that open when a room's finite Doubts are cleared (room
  encounters); forgiving combat (hearts/regen/knockback/respawn, no game-over)
- ✅ Per-room region theming: palette, ambient crossfade, HUD theme on entry
- ✅ Dev wing (Identikeys) complete; Music & Teaching wings seeded with one
  character each, ready to fill in
- ✅ Profile card, dialogue, info panels, SoundCloud player all carried over
- ✅ Verified in headless Chrome: 7 rooms / 162 merged wall colliders / 3 gated
  doors, wall collision, room-snap + region crossfade, sword grant, finite
  encounter → room cleared → door opens, minimap reveal — zero JS errors
