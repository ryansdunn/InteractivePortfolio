# Ryan Dunn — An Interactive Portrait

An explorable RPG portfolio. You wash ashore on one continuous, organic island
and **wander it** — navigating by landmark and signpost, not map markers. The
people you meet are personifications of real projects, music, and teaching,
**scattered through their biome**; the things they left behind (fragments in
dead-end paths) tell their own quiet stories. You enter as a recruiter; you leave
understanding a person.

Built with **Phaser 3 + vanilla JS** and a **Tiled** map.

## Run it

Pure static files, but browsers block `file://`, so serve it:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

**Controls:** WASD / Arrows move · `SPACE` or `E` talk · **`J` or left-click swing
the sword** · `M` toggle music. Signs reveal directions as you approach; fragments
reveal themselves when you stand near them.

### Entry points (URL parameter)

| URL | Result |
|-----|--------|
| `/` | Title → step onto the island at the crossroads (the wilds) |
| `/?world=dev` | Wash ashore near the **Dev** biome |
| `/?world=music` | …near the **Music** biome |
| `/?world=teaching` | …near the **Teaching** biome |

The biomes are not rectangular zones — they have **irregular, bleeding edges**.
Crossing between them crossfades the ambient music and re-themes the HUD; biome is
detected per-tile, so the transition follows the organic borders.

## The world is a generated, editable Tiled map

The island is authored as a real **Tiled** project so it can be opened and refined
in the Tiled editor. A one-shot Node generator bakes it from a content seed:

```bash
node tools/generate-map.mjs   # writes assets/maps/world.tmj + assets/tilesets/terrain.png
```

`tools/generate-map.mjs` reads `config/world.js` (biomes, landmark placements) and
builds an **organic island** with multi-octave value noise + a radial falloff
(coasts at the rim), assigns biomes by **domain-warped nearest-anchor** (so borders
bleed), places terrain (water, beach, grass, forest, cliffs, ruins), carves
**paths between landmarks** — including **dead-end spurs to each fragment** — and
writes Tiled **object layers** (`spawn`, `npcs`, `signs`, `fragments`) plus a
per-tile `biomeGrid`. Solid tiles get a `collides` property so the engine derives
collision automatically. Edit `config/world.js` and re-run, **or** edit
`assets/maps/world.tmj` directly in Tiled.

> **Tileset note:** no reliable mirror of Kenney's nature pack was reachable, so
> the generator paints a clean **Kenney-style CC0 terrain atlas** of its own
> (`assets/tilesets/terrain.png`). To drop in a real Kenney sheet later, replace
> that PNG and the `TILES` index map in the generator, then re-run — the rest of
> the pipeline is unchanged.

## Architecture

Runtime is data-driven: the engine reads the Tiled map's object layers, so adding
world content is editing the map (or `config/world.js` + regenerating), not code.

```
index.html                  Loads scripts in dependency order
game.js                     Phaser bootstrap + the Portfolio (Phaser↔DOM) bridge

tools/generate-map.mjs      Map generator (noise island, biomes, paths, Tiled .tmj + atlas PNG)
assets/maps/world.tmj       The generated, Tiled-editable map
assets/tilesets/terrain.png Generated Kenney-style terrain atlas

config/
  world.js                  Biomes (theming + terrain flavor) + landmark seed (npcs/signs/fragments)
  projects.js               Characters (dialogue, profile, info panel); `main:true` builds the portrait
  doubts.js                 The roaming "Doubt" monster types
  music.js                  Guideless EP — SoundCloud set + per-track metadata

core/
  TiledWorldScene.js        Loads the tilemap, smooth-scrolling camera, terrain collision,
                            per-tile biome detection, NPC/sign/fragment from object layers
  CombatSystem.js           Sword (from spawn) + forgiving roaming-Doubt hazard (no gating)
  AssetFactory.js           Generates the sprite textures (player, NPCs, Doubts, sword)
  AudioManager.js           Per-biome ambient beds + crossfade + the fragment chime
  GameState.js              Shared state (who you've met) via the Phaser registry

components/
  DialogueBox.js            In-world dialogue UI · ProfileCard.js  the living portrait
  InfoPanel.js              Project detail modal · MusicPlayer.js  SoundCloud dock
  FragmentCard.js           The environmental-storytelling popup for dead-end fragments

scenes/
  BootScene.js              Preloads the map + tileset, generates sprites, routes
  TitleScene.js             Framing intro → step onto the island
```

## Combat (forgiving, non-gating)

You carry the sword from the start — nothing is ever locked. **Doubts** (recruiter
objections like "Too junior?", "Can he ship solo?") roam each biome, chase you, and
deal contact damage; swing the sword to dispel them. Hearts regenerate, there's no
game-over, and being emptied just returns you to the crossroads. Combat is
atmosphere, not progression.

## How to extend

- **Move/add a character, sign, or fragment** → edit `config/world.js` and run
  `node tools/generate-map.mjs`, **or** edit `assets/maps/world.tmj` in Tiled
  (add an object to the `npcs`/`signs`/`fragments` layer with the right
  properties). Character copy lives in `config/projects.js`.
- **Reshape the island / biomes** → tweak the generator's noise + biome anchors
  and re-run.
- **Real Kenney art** → replace `assets/tilesets/terrain.png` + the `TILES` index
  map in the generator.

## Scope / status

- ✅ Open, organic, **Tiled-built island** — bleeding biome edges, water/cliffs/
  forest/ruins forming natural paths and obstacles; landmark navigation, no minimap
- ✅ Smooth-scrolling explorer; terrain collision; per-tile biome ambient crossfade
- ✅ NPCs scattered in biomes (dialogue → living Profile Card → project panel);
  directional **signs**; **dead-end fragments** with popup + discovery chime + tally
- ✅ Forgiving, non-gating sword combat vs. roaming Doubts; sword from spawn
- ✅ **Dev biome realized end-to-end**; Music & Teaching seeded with one character
  each + signs + fragments, to fill in by editing `config/world.js`/the Tiled map
- ✅ Verified in headless Chrome: map loads, player visible + armed, terrain
  collision, biome crossfade, NPC/sign/fragment, roaming Doubts — zero JS errors
- ℹ️ Terrain art is a generated Kenney-*style* CC0 atlas (swap path documented)
