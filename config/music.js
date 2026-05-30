/* =============================================================================
 * config/music.js
 * -----------------------------------------------------------------------------
 * The Guideless EP — SoundCloud set + per-track metadata. The MusicPlayer
 * component reads this to embed the playlist and let visitors listen track by
 * track without leaving the game. Each character in the Music World maps to a
 * track via its `trackIndex`.
 * ========================================================================== */

const MUSIC = {
  set: {
    title: 'Guideless',
    artist: 'Ryan Dunn',
    // The full set/playlist embedded by the MusicPlayer.
    url: 'https://soundcloud.com/ryan-dunn-446811128/sets/guideless',
  },

  // Ordered to match the EP's emotional arc. trackIndex on a character points
  // here. `url` is optional per-track; the player primarily drives the set.
  tracks: [
    {
      index: 0,
      title: 'Swimming Pool',
      mood: 'dark · searching · electronic',
      blurb: 'Entering the darkness. Dark-pop energy, moving through something heavy.',
    },
    {
      index: 1,
      title: 'Down to Earth / Memories',
      mood: 'quiet · revelatory · ambient',
      blurb:
        'Layered with real recorded sounds and family videos. The character has ' +
        'found something — a reason. Warm but fragile.',
    },
    {
      index: 2,
      title: 'Guideless',
      mood: 'tender · resolved · musical-theater ballad',
      blurb:
        'Piano and voice. Though her father is no longer here to guide her, the ' +
        'love he left is enough. She knows now: she will be okay.',
    },
  ],
};
