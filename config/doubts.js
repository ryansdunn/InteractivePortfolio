/* =============================================================================
 * config/doubts.js
 * -----------------------------------------------------------------------------
 * The monsters. Each Doubt is a recruiter's real hiring objection, given a body
 * and set loose to chase the player. They're flavor/atmosphere — pure action,
 * with no link to dialogue or the profile card. You fight them off with the
 * sword. Regions reference these by id (config/worlds.js `doubts`) with a cap.
 *
 * SCHEMA
 *   id        unique key
 *   text      the objection, shown floating over the monster + on dispel
 *   palette   { body, accent } hex colors for the generated sprite
 *   hp        sword hits to dispel
 *   speed     chase speed (px/s)
 *   damage    hearts removed on contact
 *   knockback impulse applied to the player on contact (px/s)
 * ========================================================================== */

const DOUBTS = {
  too_junior: {
    id: 'too_junior', text: 'Too junior?',
    palette: { body: 0x6b3a52, accent: 0xff6b9d },
    hp: 2, speed: 62, damage: 1, knockback: 230,
  },
  ships_solo: {
    id: 'ships_solo', text: 'Can he ship solo?',
    palette: { body: 0x33406b, accent: 0x6ad0ff },
    hp: 3, speed: 50, damage: 1, knockback: 210,
  },
  just_a_coder: {
    id: 'just_a_coder', text: 'Just a coder?',
    palette: { body: 0x4a3a6b, accent: 0xc9a8ff },
    hp: 2, speed: 58, damage: 1, knockback: 220,
  },
  will_he_stay: {
    id: 'will_he_stay', text: 'Will he stay?',
    palette: { body: 0x2f2a4a, accent: 0x9a7bff },
    hp: 2, speed: 70, damage: 1, knockback: 240,
  },
  culture_fit: {
    id: 'culture_fit', text: 'Culture fit?',
    palette: { body: 0x6b4a2a, accent: 0xffd98a },
    hp: 2, speed: 60, damage: 1, knockback: 220,
  },
};
