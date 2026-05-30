/* =============================================================================
 * config/projects.js
 * -----------------------------------------------------------------------------
 * Every NPC / character is the personification of a real project, experience,
 * or piece of art. The engine reads these objects to spawn sprites, drive
 * dialogue, assemble the profile card, and build the info panel.
 *
 * To add a project: drop a new object into CHARACTERS and reference its id from
 * a world's `npcs` array in config/worlds.js. Nothing else changes.
 *
 * SCHEMA
 *   id        unique key (matches the CHARACTERS map key)
 *   name      display name shown in the dialogue header
 *   role      one-line descriptor under the name
 *   world     home world id (for back-references / the title screen)
 *   position  { tx, ty } tile coordinates where the sprite stands
 *   sprite    { body, accent, hair } hex colors for the placeholder sprite
 *   dialogue  array of pages, written in the CHARACTER'S voice. The closing
 *             cross-world `prompt` is appended automatically as a final page.
 *   prompt    a line gesturing toward the other worlds
 *   profile   { tag, sentence } — what gets added to the living Profile Card
 *   panel     the detail panel opened after the conversation
 *               { title, kind, description, tech[], links[], note }
 * ========================================================================== */

const CHARACTERS = {
  /* ===================================================================== *
   *  HUB — The Guide (hands you the sword; not a "main" portrait character)
   * ===================================================================== */
  guide: {
    id: 'guide',
    name: 'The Guide',
    role: 'keeper of the crossroads',
    world: 'hub',
    grants: 'sword', // completing this conversation gives the player the sword
    position: { tx: 9, ty: 4 }, // relative to the hub origin (just above spawn)
    sprite: { body: 0x55607a, accent: 0x8aa0c8, hair: 0xd8e2f2 },
    dialogue: [
      "Hold on, traveler. You came to find out who Ryan is — but you won't get " +
        "far defenseless. Out here, doubts take shape and they bite.",
      "Every reason not to hire him wanders these fields with teeth: \"too " +
        "junior,\" \"just a coder,\" \"will he even stay.\" They'll chase you " +
        "the moment you stop paying attention.",
      "So take this. It's dangerous to go alone.\n\n" +
        "Swing it (press J, or click) and you can cut a doubt down. The more of " +
        "Ryan you discover, the smaller they get. Now — go meet him.",
    ],
    prompt:
      "Three paths lead out from here: the lab to the west, a memory to the " +
      "east, a sunlit plaza to the south. Wander. I'll keep the lamps lit.",
  },

  /* ===================================================================== *
   *  DEV WORLD — Identikeys
   * ===================================================================== */
  identikeys: {
    id: 'identikeys',
    name: 'Identikeys',
    role: 'a habit-forging companion',
    world: 'dev',
    main: true,
    position: { tx: 12, ty: 8 }, // relative to the dev region origin
    sprite: { body: 0x4f7cff, accent: 0x6ad0ff, hair: 0xe8eefc },
    dialogue: [
      "You found me in the dark, monitors still humming. Good. " +
        "Before I tell you what I am — answer me something.\n\n" +
        "What did you do with your first waking hour today?",
      "Don't worry, I'm not here to judge it. I'm here because most people " +
        "never get asked. We drift. We let the day happen to us.\n\n" +
        "I believe something simpler and harder than that: you are not your " +
        "intentions. You are your repetitions.",
      "That's what I'm built around. I watch the time you actually spend — " +
        "through Apple's Screen Time API — and I turn it into a game you can " +
        "win. Focus timers. A multimedia journal. A music player to score the " +
        "work. Every kept promise is a key.",
      "Your habits are the keys to your identity and your future self. " +
        "Unlock enough of them and you stop wondering who you are. " +
        "You start recognizing the person showing up.\n\n" +
        "Ryan built me in Swift, with Claude Code, and I'm live in TestFlight " +
        "right now. Go meet the future version of you. He's waiting.",
    ],
    prompt:
      "Ryan isn't only the discipline, though. There's a softer room in him. " +
      "Have you been to the Music World yet?",
    profile: {
      tag: 'Disciplined builder',
      sentence:
        'Ryan builds tools that turn daily habits into identity — shipping ' +
        'Identikeys solo in Swift, now live in TestFlight.',
    },
    panel: {
      title: 'Identikeys',
      kind: 'iOS App · TestFlight Beta',
      description:
        'A habit and focus app built on the belief that your habits are the ' +
        'keys to your identity and your future self. Identikeys gamifies real ' +
        'behavior — measured through the Apple Screen Time API — with focus ' +
        'timers, a multimedia journal, and a built-in music player so the ' +
        'work has a soundtrack. Designed, coded, and shipped by Ryan using ' +
        'Claude Code.',
      tech: [
        'Swift',
        'Apple Screen Time API',
        'Gamification',
        'Focus Timer',
        'Multimedia Journal',
        'Custom Music Player',
        'Built with Claude Code',
      ],
      links: [
        { label: 'ryansdunn.com', url: 'https://ryansdunn.com' },
        { label: 'Join the TestFlight Beta', url: 'https://testflight.apple.com/' },
      ],
      note: 'Currently in TestFlight beta — built end to end by one person.',
    },
  },

  /* ===================================================================== *
   *  MUSIC WING — Swimming Pool (track 1 of the Guideless EP)
   *  STUB: the music wing ships with this one character. Down to Earth /
   *  Memories and Guideless slot in by adding two more objects here and
   *  giving them rooms (config/dungeon.js) — e.g. extra rooms off music_inner.
   * ===================================================================== */
  swimming_pool: {
    id: 'swimming_pool',
    name: 'Swimming Pool',
    role: 'track one — entering the dark',
    world: 'music',
    main: true,
    trackIndex: 0, // index into the Guideless SoundCloud set
    position: { tx: 12, ty: 10 }, // relative to the music region origin
    sprite: { body: 0x6a4fb0, accent: 0x9a7bff, hair: 0x1b1430 },
    dialogue: [
      "Oh. Someone's here. People don't usually wander this far into a " +
        "memory.\n\nIt's alright. Stay a minute. Can you hear it — that low " +
        "pulse under everything?",
      "I'm the first part of a story called Guideless. Three tracks. This one " +
        "is the going-under. The dark, searching part, all electronics and " +
        "held breath.\n\nIt's about losing yourself inside something too big " +
        "to hold — grief, mostly.",
      "Ryan wrote this after losing a friend to suicide, and from his own long " +
        "nights asking the unanswerable thing: how do you keep faith in the " +
        "goodness of a world that has hurt you?\n\n" +
        "Press play if you'd like. You can keep walking while it plays.",
    ],
    prompt:
      "There are two more of us deeper in — one who found a reason, and one " +
      "who found peace. And if it's the builder you came for, the Dev World " +
      "is just back through the door.",
    profile: {
      tag: 'Songwriter',
      sentence:
        'Ryan writes music that sits in the liminal space between narrative ' +
        'and autobiography — Guideless is his EP about grief, faith, and ' +
        'finding a way back.',
    },
    panel: {
      title: 'Guideless — an EP',
      kind: 'Original Music · 3 tracks',
      description:
        'A musical story about the loss of oneself in the scope of tragedy, ' +
        'and the question underneath it: how do you have faith in the goodness ' +
        'of a world that has hurt you? It lives between narrative and ' +
        'autobiography, informed by real experiences — including the loss of a ' +
        'friend to suicide. Swimming Pool is the descent into the dark; the EP ' +
        'moves through memory toward a fragile, hard-won peace.',
      tech: ['Songwriting', 'Production', 'Sound design', 'Field recordings', 'Piano'],
      links: [
        { label: 'Listen on SoundCloud', url: 'https://soundcloud.com/ryan-dunn-446811128/sets/guideless' },
      ],
      note: 'Use the player in the corner to listen track by track while you explore.',
      openMusicPlayer: true,
    },
  },

  /* ===================================================================== *
   *  TEACHING WORLD — NALCAP
   * ===================================================================== */
  nalcap: {
    id: 'nalcap',
    name: 'Señorita NALCAP',
    role: 'a classroom that got unlocked',
    world: 'teaching',
    main: true,
    position: { tx: 12, ty: 8 }, // relative to the teaching region origin
    sprite: { body: 0xe8772e, accent: 0xffd98a, hair: 0x3a2410 },
    dialogue: [
      "¡Hola! You made it to Almassora — near Valencia, all terracotta and " +
        "sun. Come in, come in. The music room's just through that window.\n\n" +
        "I carry the energy of a room that's been unlocked. Let me show you " +
        "what that means.",
      "We did English through karaoke. ¿Te imaginas? Thirty kids who'd never " +
        "raise a hand, suddenly singing — because a song is a hiding place you " +
        "can be brave inside.\n\nGames, movement, music. That's how Ryan pulls " +
        "students out of their shells.",
      "There was a field trip to Valencia. One girl — she'd barely spoken all " +
        "year. And somewhere between the museum and the music, she just... " +
        "opened. Started telling me about the art she loved, the songs.\n\n" +
        "That's the whole job, ¿sabes? You don't fill the room. You make space " +
        "in it, and you wait.",
    ],
    prompt:
      "It's the same Ryan everywhere — the code, the music, this classroom. " +
      "Always the same question: how do we become who we're meant to be, and " +
      "help others do the same? Go meet the other rooms of him.",
    profile: {
      tag: 'Teacher in Spain',
      sentence:
        'Ryan teaches English through music and movement in Almassora, Spain ' +
        '(NALCAP) — making space for students to find their own voice.',
    },
    panel: {
      title: 'NALCAP — Almassora, Spain',
      kind: 'Teaching · Oct 2025 – May 2026',
      description:
        'A cultural and language assistant placement near Valencia. Ryan leads ' +
        'karaoke-based music and English classes, pulling students out of ' +
        'their shells through games, movement, and song. The belief underneath ' +
        "it: you don't fill a room — you make space in it, and you wait for " +
        'people to step forward. A quiet student opening up about music and art ' +
        'on a Valencia field trip is what the work is for.',
      tech: ['Bilingual instruction', 'Music-based learning', 'Game design for class', 'Cultural exchange'],
      links: [
        { label: 'ryansdunn.com', url: 'https://ryansdunn.com' },
      ],
      note:
        'Ryan believes the most important thing a teacher builds is space — ' +
        'room for someone else to become who they are.',
    },
  },
};
