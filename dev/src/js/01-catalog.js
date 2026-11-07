/* ============ Catalog: trait-set flavors, the Big Menu of Mods, reference text ============ */

/* Rating guides (short paraphrases) */
const GUIDES = {
  attributes: { 4: 'Poor', 6: 'Typical', 8: 'Excellent', 10: 'Remarkable', 12: 'Incredible' },
  skills: { 4: 'Untrained', 6: 'Competent', 8: 'Expert', 10: 'Master', 12: 'Grandmaster' },
  roles: { 4: 'Out of your depth', 6: 'Capable', 8: 'Seasoned', 10: 'Your calling', 12: 'Legendary' },
  affiliations: { 6: 'At a disadvantage', 8: 'Steady', 10: 'At your best' },
  values: { 4: 'Barely registers', 6: 'One concern among many', 8: 'Clearly on your mind', 10: 'Drives you hard', 12: 'Everything you are' },
  relationships: { 4: 'No real feeling', 6: 'Matters, like many do', 8: 'Invested', 10: 'Matters more than most', 12: 'Nobody matters more' },
  reputations: { 4: 'Unknown', 6: 'Known locally', 8: 'Well known', 10: 'Famous or infamous', 12: 'A household name' },
  powers: { 6: 'Minor', 8: 'Enhanced', 10: 'Superhuman', 12: 'Godlike' },
  specialties: { 6: 'Trained', 8: 'Expert', 10: 'Master', 12: 'Grandmaster' },
  sigassets: { 6: 'Useful', 8: 'Reliable', 10: 'Exceptional', 12: 'Legendary' }
};

/* Trait-set flavors: what each kind of set does by default (Prime Characters, pp. 46–66) */
const FLAVORS = {
  distinctions: { label: 'Distinctions', ref: 'p.50', kind: 'distinctions', prime: true, always: true,
    blurb: 'Short phrases that pitch who the character is: background, personality, role. Rated d8; every one can be used as a d4 to earn a plot point (Hinder).',
    create: { mode: 'count', count: 3 } },
  attributes: { label: 'Attributes', ref: 'p.49', kind: 'fixed', prime: true, guide: 'attributes',
    blurb: 'Raw ability and effort. Everyone has a rating in each one; raising one means lowering another.',
    create: { mode: 'trade', baseline: 8, extraBaseline: 6, baseCount: 3, min: 6, max: 10, pathStart: 6 } },
  affiliations: { label: 'Affiliations', ref: 'p.48', kind: 'fixed', prime: true, guide: 'affiliations',
    blurb: 'How well the character performs in a context: alone, with a partner, with a team, or in social estates you define.',
    create: { mode: 'trade', baseline: 8, extraBaseline: 6, baseCount: 3, min: 6, max: 10, pathStart: 6 } },
  skills: { label: 'Skills', ref: 'p.57', kind: 'fixed', prime: true, guide: 'skills',
    blurb: 'Training and experience, named as verbs. Everyone starts at the base die and spends points to step skills up.',
    create: { mode: 'points', base: 4, points: 9, cap: 10 } },
  roles: { label: 'Roles', ref: 'p.58', kind: 'fixed', prime: true, guide: 'roles',
    blurb: 'Broad skill groups (3 to 6 of them). Ratings are assigned from a fixed spread such as d10, d8, d6, d4.',
    create: { mode: 'array', auto: true, array: [10, 8, 6, 4] } },
  values: { label: 'Values', ref: 'p.60', kind: 'fixed', prime: true, guide: 'values',
    blurb: 'What drives the character. A high die means the value matters a lot to them, for better or worse.',
    create: { mode: 'trade', baseline: 8, extraBaseline: 6, baseCount: 3, min: 4, max: 10, pathStart: 6 } },
  relationships: { label: 'Relationships', ref: 'p.55', kind: 'open', prime: true, guide: 'relationships',
    blurb: 'Bonds with other characters, positive or negative. Roll one when that person is involved or on your mind.',
    create: { mode: 'peaks', peaks: [10, 8], fill: 6, cap: 10 } },
  reputations: { label: 'Reputations', ref: 'p.55', kind: 'open', prime: false, guide: 'reputations',
    blurb: 'Standing with a group, organization or culture. Works like a relationship with a crowd.',
    create: { mode: 'peaks', peaks: [8, 6, 6], fill: 4, cap: 8 } },
  sigassets: { label: 'Signature Assets', ref: 'p.64', kind: 'open', prime: false, guide: 'sigassets',
    blurb: 'Iconic gear, vehicles, pets or contacts that belong to the character. Start at d6; may carry one SFX.',
    create: { mode: 'pool', startDie: 6, entryCost: 1, cap: 8 } },
  specialties: { label: 'Specialties', ref: 'p.59', kind: 'open', prime: false, guide: 'specialties',
    blurb: 'Narrow areas of focus that stand on their own (no parent skill). If you lack one, you simply roll nothing for it.',
    create: { mode: 'pool', startDie: 8, entryCost: 1, cap: 10 } },
  resources: { label: 'Resources', ref: 'p.56', kind: 'resources', prime: false,
    blurb: 'Extras, locations, orgs and props the character can draw on. Rated as several dice that get spent and recover later.',
    create: { mode: 'pool' } },
  powersets: { label: 'Power Sets', ref: 'p.51–52', kind: 'powersets', prime: false, guide: 'powers',
    blurb: 'Themed groups of powers with a shared origin, at least one SFX and at least one limit. Each set is its own trait set.',
    create: { mode: 'powers', sets: 1, sfxPerSet: 2, limitsPerSet: 1, cap: 10 } },
  abilities: { label: 'Abilities', ref: 'p.54', kind: 'abilities', prime: false, guide: 'powers',
    blurb: 'A single rated trait carrying its own list of SFX. One SFX is free; the rest unlock over time.',
    create: { mode: 'count', count: 1, freeSfx: 1, cap: 10 } },
  talents: { label: 'Talents', ref: 'p.66', kind: 'talents', prime: false,
    blurb: 'Unrated special tricks written as Activation and Effect. Good for telling apart characters with similar dice.',
    create: { mode: 'count', count: 2 } },
  customFixed: { label: 'Custom set (everyone rated)', ref: '', kind: 'fixed', prime: true,
    blurb: 'Your own trait set with a fixed list of traits that every character is rated in.',
    create: { mode: 'trade', baseline: 8, extraBaseline: 6, baseCount: 3, min: 4, max: 12, pathStart: 6 } },
  customOpen: { label: 'Custom set (write your own)', ref: '', kind: 'open', prime: false,
    blurb: 'Your own trait set where each character writes their own entries.',
    create: { mode: 'count', count: 2, startDie: 6, cap: 12 } }
};
const FLAVOR_ORDER = ['attributes', 'affiliations', 'skills', 'roles', 'values', 'relationships', 'reputations', 'sigassets', 'specialties', 'resources', 'powersets', 'abilities', 'talents', 'customFixed', 'customOpen'];
const ROLE_ARRAYS = { 3: [10, 8, 4], 4: [10, 8, 6, 4], 5: [10, 8, 6, 6, 4], 6: [10, 8, 6, 6, 6, 4] };
const CREATE_MODES = {
  trade: 'Trade steps (raise one, lower another)',
  points: 'Point buy from a base die',
  array: 'Assign a fixed spread of dice',
  peaks: 'A few high dice, the rest at a fill die',
  pool: 'Paid from the shared creation points',
  count: 'A set number of entries',
  powers: 'Power budget (d8 powers = sets + 1)',
  free: 'No budget'
};

/* ---------------- The Big Menu of Mods (p.248) ---------------- */
const MOD_CATS = [
  { id: 'dice', name: 'Dice & rolling', q: 'Does your setting change the core rules for rolling dice?' },
  { id: 'conflict', name: 'Conflicts', q: 'How are tests, contests and scenes resolved?' },
  { id: 'harm', name: 'Complications & harm', q: 'How does your setting handle hardship for the characters?' },
  { id: 'pp', name: 'Plot points', q: 'Does your setting change how plot points flow?' },
  { id: 'growth', name: 'Growing characters', q: 'Do characters change over time?' },
  { id: 'gmc', name: 'GM characters & tools', q: 'What characters and tools does the GM have?' }
];
const MODS = [
  // dice
  { id: 'heroDice', cat: 'dice', name: 'Hero dice', ref: 'p.30', sum: 'A heroic success lets you bank a die the size of the highest-rolling die in the opposing pool. Later, spend a plot point to roll it and add it to a total, even after the opposition has rolled.',
    opts: [{ k: 'heroAsPP', label: 'Hero dice as plot points (p.31): add before rolling for free, or spend one in place of a plot point' }, { k: 'heroAsEffect', label: 'Hero dice as effect dice (p.31): spend a plot point to swap a banked die in as your effect die' }, { k: 'heroOnePer', label: 'Only one banked hero die of each size' }] },
  { id: 'addAll', cat: 'dice', name: 'Add all the dice', ref: 'p.25', sum: 'Every die that isn\'t a hitch counts toward the total. Pair it with No effect dice or Reroll for effect, since no die is left over.' },
  { id: 'noEffect', cat: 'dice', name: 'No effect dice', ref: 'p.25', sum: 'Rolls are simply pass or fail. Assets and complications from a roll start at d6 and step up with heroic successes.' },
  { id: 'rerollEffect', cat: 'dice', name: 'Reroll for effect', ref: 'p.25', sum: 'Once the total is set, roll the pool again; the die that comes up highest is the effect die.' },
  { id: 'staticDiff', cat: 'dice', name: 'Static difficulty', ref: 'p.25', sum: 'Tests use fixed target numbers (Very easy 3, Easy 7, Challenging 11, Hard 15, Very hard 19) plus any rolled complication dice. Contests still roll.' },
  { id: 'scale', cat: 'dice', name: 'Advantage of scale', ref: 'p.99', sum: 'When one side vastly outclasses the other, it adds a d8 scale die and keeps one extra result in its total.',
    opts: [{ k: 'multiScale', label: 'Multi-level scale (p.100): scale dice from d4 to d12, which can be split into several smaller dice' }] },
  { id: 'vehicles', cat: 'dice', name: 'Vehicles', ref: 'p.216', sum: 'Vehicles get small files of their own: vehicle attributes, a distinction, signature assets, SFX and a scale die.' },
  // conflict
  { id: 'tests', cat: 'conflict', name: 'Tests', ref: 'p.18', always: true, sum: 'The GM rolls difficulty first; the player has to roll higher. A tie goes to the difficulty.' },
  { id: 'contests', cat: 'conflict', name: 'Contests', ref: 'p.19', on: true, sum: 'The initiator rolls first and sets the number to beat. Sides trade rolls until one fails or gives in; giving in after rolling earns a plot point.' },
  { id: 'actionBased', cat: 'conflict', name: 'Action-based resolution', ref: 'p.24', sum: 'Every roll is an action met by a single reaction (a defender\'s roll or difficulty dice). The reaction has to exceed the action to stop it.' },
  { id: 'groupContests', cat: 'conflict', name: 'Group contests', ref: 'p.23', sum: 'A free-for-all over a prize. Anyone can join; the highest roll wins; anyone who stays in and fails to beat the total takes a complication.' },
  { id: 'interfering', cat: 'conflict', name: 'Interfering in a contest', ref: 'p.23', on: true, sum: 'Spend a plot point to cut into someone else\'s contest. Beat the current total and it stops; fall short and the winner hands you a complication.' },
  { id: 'doom', cat: 'conflict', name: 'Doom pool', ref: 'p.32', sum: 'The GM\'s plot points become a pool of dice. It sets difficulty, grows when players roll hitches, and is spent on twists like new complications or extra GMCs.',
    opts: [{ k: 'limitedDoom', label: 'Limited doom pool: difficulty uses normal difficulty dice; doom dice only add to them' }, { k: 'doomName', label: 'Pool name', type: 'text', def: 'Doom pool' }] },
  { id: 'crisis', cat: 'conflict', name: 'Crisis pools', ref: 'p.33', sum: 'Each local threat (a fire, a runaway train) is its own small dice pool. Beat it and use a larger effect die to knock one of its dice out.' },
  { id: 'gangingUp', cat: 'conflict', name: 'Ganging up', ref: 'p.100', sum: 'Each extra opponent adds one die to the opposition. A winner can knock away one supporting die smaller than their effect die.' },
  { id: 'recovery', cat: 'conflict', name: 'Recovery tests', ref: 'p.37', on: true, sum: 'Roll against the complication or stress die plus difficulty dice to step it down or clear it.' },
  { id: 'testAssets', cat: 'conflict', name: 'Test-created assets', ref: 'p.35', on: true, sum: 'Make a test to build an asset bigger than d6. The effect die sets its size, capped by the difficulty dice the GM picked.' },
  { id: 'timed', cat: 'conflict', name: 'Timed tests', ref: 'p.101', sum: 'A countdown measured in beats. Each roll costs a beat, a failure costs two, a heroic success costs none.' },
  { id: 'turnOrder', cat: 'conflict', name: 'Turn order', ref: 'p.98', sum: 'How scenes decide who acts next.',
    opts: [{ k: 'turnMode', label: 'Method', type: 'select', choices: [['dramatic', 'Dramatic order: whoever wants something starts a contest (p.98)'], ['action', 'Action order: each actor hands off to the next (p.98)'], ['initiative', 'Taking initiative: roll or rate, highest goes first (p.99)']], def: 'action' }] },
  // harm
  { id: 'complications', cat: 'harm', name: 'Complications', ref: 'p.36', on: true, sum: 'Lasting problems rated d4–d12 that join the opposition\'s pool. Stepped past d12, they take the character out. A d4 one goes in your own pool and earns a plot point.' },
  { id: 'stress', cat: 'harm', name: 'Stress', ref: 'p.39', sum: 'Harm is tracked as stress dice on named tracks. New stress that is equal or smaller steps the track up; bigger stress replaces it. Past d12 you\'re stressed out of the scene.',
    opts: [{ k: 'pushStress', label: 'Pushing stress (p.40): spend a plot point to roll your own stress, then step it up' }, { k: 'trauma', label: 'Trauma (p.41): being stressed out leaves a lasting d6 trauma of that type' }, { k: 'shaken', label: 'Shaken & stricken (p.42): stress lands on a trait instead of a named track' }] },
  { id: 'lifePoints', cat: 'harm', name: 'Life points', ref: 'p.43', sum: 'A classic damage pool. Damage is the margin of the attack\'s success; life points come from two traits added together.',
    opts: [{ k: 'lifeMode', label: 'Method', type: 'select', choices: [['ablative', 'Ablative: subtract damage; at 0 you\'re out'], ['threshold', 'Threshold: track wounds and stun separately']], def: 'ablative' }] },
  // plot points
  { id: 'startPP', cat: 'pp', name: 'Starting plot points', ref: 'p.29', always: true, sum: 'How many plot points each player begins a session with.',
    opts: [{ k: 'ppStart', label: 'Start each session with', type: 'num', def: 1 }, { k: 'ppMode', label: 'Rule', type: 'select', choices: [['atleast', 'At least this many (unspent points carry over)'], ['add', 'Gain this many on top of what\'s left'], ['d4', 'Roll a d4 for your start'], ['rolloff', 'Prime-set roll-off: highest gets 3, lowest 1, others 2']], def: 'atleast' }] },
  { id: 'noBank', cat: 'pp', name: 'No bank', ref: 'p.29', sum: 'The GM has no private bank. When the GM spends a plot point against a player, it goes to that player.' },
  // growth
  { id: 'sessionRecords', cat: 'growth', name: 'Session records', ref: 'p.82', sum: 'Note each session\'s name on the file. Call back to one once a session for a free plot-point effect, or spend sessions to train permanent upgrades.' },
  { id: 'growth', cat: 'growth', name: 'Growth pool', ref: 'p.83', sum: 'Challenging trait statements and recovering with help add dice to a growth pool, rolled in end-of-session tag scenes to step traits up.' },
  { id: 'milestones', cat: 'growth', name: 'Milestones & XP', ref: 'p.84', sum: 'Two milestones per character, each paying 1, 3 or 10 XP. Spend XP on unlockables between scenes.' },
  // gm
  { id: 'gmMajor', cat: 'gmc', name: 'Major GMCs', ref: 'p.114', on: true, sum: 'Built like player characters, at light, medium or heavy strength.' },
  { id: 'gmMinor', cat: 'gmc', name: 'Minor GMCs', ref: 'p.115', on: true, sum: 'A name and three or more descriptive traits with dice.' },
  { id: 'gmExtras', cat: 'gmc', name: 'Extras', ref: 'p.116', on: true, sum: 'Unnamed characters with a single die.' },
  { id: 'gmMobs', cat: 'gmc', name: 'Mobs', ref: 'p.117', sum: 'A group with one mob trait rolled as several dice. Effects bigger than the mob die knock dice off.' },
  { id: 'gmBosses', cat: 'gmc', name: 'Bosses', ref: 'p.118', sum: 'A single foe with a multi-die boss trait. They aren\'t out until every boss die is gone.' },
  { id: 'gmLocations', cat: 'gmc', name: 'Location GMCs & scene distinctions', ref: 'p.116', sum: 'Places with traits that can oppose the characters, and scene distinctions anyone in the scene can use.' },
  { id: 'gmFactions', cat: 'gmc', name: 'Factions & orgs', ref: 'p.119', sum: 'Large groups that act at a scale above the characters: a multiplied mob trait, extra traits and SFX.' }
];
const MOD_BY_ID = Object.fromEntries(MODS.map(m => [m.id, m]));

/* Creation methods (p.67–81) */
const METHODS = {
  scratch: { name: 'Scratch-built', ref: 'p.70', sum: 'Players build from the setting\'s budgets: adjust the prime sets, pick distinctions and SFX, spend skill points, then spend the shared creation points.' },
  archetypes: { name: 'Archetypes', ref: 'p.68', sum: 'Pick a partly built character you designed: preset dice, distinctions with SFX to unlock, and a choice of signature assets.' },
  pathways: { name: 'Pathways', ref: 'p.73', sum: 'Build the group together over several stages, adding people, places and situations to a shared map while traits grow stage by stage.' }
};

/* Default pathways table (p.75) */
const PATHWAY_TABLE = [
  { name: 'Origin', type: 'major', opts: 'Rich, Ordinary, Gifted, Strange, Alien' },
  { name: 'Youth', type: 'standard', opts: 'Jock, Average, Geek, Outsider, Paragon' },
  { name: 'Focus', type: 'meta', opts: 'Money, Life, Status, Technology, Paranormal' },
  { name: 'Road', type: 'standard', opts: 'Risky, Straight & Narrow, Lofty, Underground, Ethical' },
  { name: 'Life-Changing Event', type: 'major', opts: 'Advancement, Tragedy, Manifestation, First Contact, Destiny' },
  { name: 'Priority', type: 'standard', opts: 'Friends & Family, Work, Moving Forward, Looking Back, Performance' },
  { name: 'Modus Operandi', type: 'meta', opts: 'Loyalty, Shady Business, Against the Grain, Outside Normal Channels, Special Gifts' },
  { name: 'Motivation', type: 'standard', opts: 'Others, Self, The Cause, The Job, The World' },
  { name: 'Identity', type: 'major', opts: 'The Sidekick, The Foil, The Rebel, The Specialist, The Hero' }
];
/* default grants for the 5-stage build in the handbook's example (p.78) */
const PATHWAY_GRANTS5 = [
  { dist: 1, points: 2, trade: 0, pool: 1, sfx: 0 },
  { dist: 0, points: 2, trade: 1, pool: 1, sfx: 0 },
  { dist: 1, points: 2, trade: 0, pool: 1, sfx: 1 },
  { dist: 0, points: 2, trade: 1, pool: 1, sfx: 0 },
  { dist: 1, points: 1, trade: 1, pool: 1, sfx: 1 }
];
const ELEMENT_TYPES = [
  ['circle', 'Secondary character'], ['triangle', 'Situation'], ['extra', 'Resource: extra'], ['org', 'Resource: organization'], ['prop', 'Resource: prop'], ['location', 'Resource: location']
];

/* Growth tables */
const TRAINING_DEFAULT = [
  { label: 'Turn a session asset into a signature asset (or relationship)', cost: 1 },
  { label: 'Swap a distinction (or trait statement) for a new one', cost: 1 },
  { label: 'Step up a signature asset (or relationship)', cost: 2 },
  { label: 'Add a new specialty', cost: 2 },
  { label: 'Unlock a new SFX', cost: 2 },
  { label: 'Step up a skill (or resource, role, value or power)', cost: 3 },
  { label: 'Step up one attribute (or affiliation) and step down another', cost: 4 }
];
const UNLOCK_DEFAULT = [
  { label: 'Train a new specialty at d8', cost: 5 }, { label: 'Unlock an SFX', cost: 5 }, { label: 'Add a d6 signature asset', cost: 5 }, { label: 'Step up a trait from d6 to d8', cost: 5 },
  { label: 'Add a d8 signature asset', cost: 10 }, { label: 'Add a new locked SFX to a distinction or signature asset', cost: 10 }, { label: 'Step up a trait from d8 to d10', cost: 10 },
  { label: 'Step up a d8 specialty to d10', cost: 15 }, { label: 'Add a d10 signature asset', cost: 15 }, { label: 'Step up a trait from d10 to d12', cost: 15 },
  { label: 'Step up a d10 specialty to d12', cost: 20 }, { label: 'Add a d12 signature asset', cost: 20 }
];
const GROWTH_TYPE_DIE = [['Attribute or affiliation', 12], ['Distinction, role or power', 10], ['Skill, SFX or value', 8], ['Relationship, resource or signature asset', 6]];

/* Difficulty */
const DIFFICULTY = [
  { name: 'Very easy', dice: [4, 4], stat: 3 }, { name: 'Easy', dice: [6, 6], stat: 7 }, { name: 'Challenging', dice: [8, 8], stat: 11 }, { name: 'Hard', dice: [10, 10], stat: 15 }, { name: 'Very hard', dice: [12, 12], stat: 19 }
];

/* SFX helpers (p.62–63) */
const STD_SFX = [
  { name: 'The Exchange', text: 'Step up or double one helpful die for the scene, and step down another of your dice until you recover.' },
  { name: 'The Price', text: 'Step up or double one helpful die for the scene (or take a d8 asset for the scene), but also take a d8 complication.' },
  { name: 'The Swap', text: 'Spend a PP to roll a different trait than would usually apply, because of this distinction.' },
  { name: 'The Edit', text: 'Spend a PP to declare a helpful detail true in the story, because of this distinction.' },
  { name: 'The Folly', text: 'Earn a PP when you choose to do something unwise that fits this distinction.' },
  { name: 'The Shutdown', text: 'Earn a PP when you declare that, because of this distinction, one of your traits can\'t be used this scene.' }
];
const SFX_COSTS = ['spend a PP to', 'step down one of your helpful dice to', 'step up a complication on you to', 'take a d8 complication to', 'shut down a trait (until you recover it) to', '(no cost) —'];
const SFX_BENEFITS = ['add a d6 to your pool', 'step up [trait]', 'double [trait]', 'reroll one die', 'step down a complication', 'create a d8 asset for the scene', 'keep an extra effect die', 'include one more die in your total', 'step up your effect die', 'introduce a helpful story detail', 'rename a complication', 'earn a PP'];
const POWER_EFFECTS = ['Attack', 'Sensory', 'Movement', 'Control', 'Defense', 'Enhancement'];

/* Terminology (renameable) */
const TERMS_DEFAULT = {
  pp: 'Plot Point', pps: 'Plot Points', ppAbbr: 'PP', gm: 'GM', gmc: 'GMC', distinction: 'Distinction', distinctions: 'Distinctions',
  sfx: 'SFX', stress: 'Stress', trauma: 'Trauma', hero: 'Hero Die', xp: 'XP', file: 'Character File', asset: 'Asset', complication: 'Complication', limit: 'Limit'
};
const TERM_LABELS = {
  pp: 'Plot point (one)', pps: 'Plot points', ppAbbr: 'Plot point abbreviation', gm: 'Game moderator', gmc: 'GM character', distinction: 'Distinction (one)', distinctions: 'Distinctions',
  sfx: 'Special effects', stress: 'Stress', trauma: 'Trauma', hero: 'Hero die', xp: 'Experience', file: 'Character file', asset: 'Asset', complication: 'Complication', limit: 'Limit'
};

/* Core rules quick reference (paraphrased; page refs to the 2nd printing) */
const CORE_RULES = [
  { h: 'Dice and steps', ref: 'p.16', t: 'Every trait has a die rating from d4 to d12. Stepping up swaps it for the next size; stepping down swaps it for the previous one. A d4 stepped down is gone.' },
  { h: 'Building a pool', ref: 'p.26', t: 'Take one trait from each trait set that applies, including a distinction, plus any assets that help. Each additional trait from a set you already used costs a plot point.' },
  { h: 'Rolling', ref: 'p.16–17', t: 'Roll the pool. Any 1 is a hitch: it doesn\'t count and can\'t be your effect die. Add two dice for your total, then choose one remaining die as your effect die. Only its size matters. If nothing is left, your effect die is a d4.' },
  { h: 'Hitches and botches', ref: 'p.17', t: 'The GM can hand you a plot point to turn a hitch into a d6 complication, stepped up once for each extra hitch. All 1s is a botch: the GM gets that complication for free.' },
  { h: 'Tests', ref: 'p.18', t: 'The GM rolls difficulty dice (Very easy d4d4, Easy d6d6, Challenging d8d8, Hard d10d10, Very hard d12d12) plus any GMC or scene traits. Beat the total to succeed; a tie fails.' },
  { h: 'Contests', ref: 'p.19', t: 'The initiator rolls first. The other side must beat that total, then the initiator must beat theirs, and so on. Giving in after you\'ve rolled earns a plot point; failing lets the winner decide how you lose.' },
  { h: 'Heroic success', ref: 'p.20', t: 'Beat the opposing total by 5 or more and the effect die steps up once for every 5 points.' },
  { h: 'Effect dice in contests', ref: 'p.21', t: 'In a high-stakes scene, a winner whose effect die is bigger than the loser\'s takes them out (they can spend a plot point to take a complication instead). Otherwise the loser takes a complication the size of the effect die, stepped down if their own effect die was as big or bigger.' },
  { h: 'Earning plot points', ref: 'p.28', t: 'When the GM activates your hitch; when you give in during a contest; when you use a distinction as a d4 (Hinder); when you include a d4 complication or stress in your own pool; from SFX; and for great moments at the table.' },
  { h: 'Spending plot points', ref: 'p.28–29', t: 'Add another trait from a set you already used; keep one more die in your total; keep an extra effect die; create a d6 asset for the scene (a second point keeps it for the session); activate an SFX; stay in the fight by taking a complication; step something with a GM opportunity (a 1 the GM rolled).' },
  { h: 'Assets', ref: 'p.34', t: 'Temporary helpful traits. Usable by whoever created them unless given away or opened to everyone for another plot point. They fade at the end of the scene unless kept.' }
];

/* Paraphrased mod notes for trait-level options */
const TRAIT_MODS = {
  statements: { name: 'Trait statements', ref: 'p.65', sum: 'A short belief or truth attached to a trait. Act against it to challenge it: triple the die for that roll, then step it down until you rewrite the statement or keep the lower die.' },
  sfx: { name: 'SFX on this set', ref: 'p.61', sum: 'Traits in this set can carry special effects.' },
  highlight: { name: 'Highlight traits', ref: 'p.50', sum: 'Each distinction names traits in another set that get a free step up when you take it.' },
  pyramid: { name: 'Skill pyramid', ref: 'p.59', sum: 'To have a d10 you need two d8s and three d6s; a d12 needs two d10s, three d8s and four d6s.' },
  specialties: { name: 'Specialties', ref: 'p.59', sum: 'Narrow focuses inside a trait that add a bonus d6 when they apply.' },
  multiLevel: { name: 'Multi-level specialties', ref: 'p.59', sum: 'Specialties can be raised to d8, d10 or d12, or to several dice.' },
  split: { name: 'Skill and specialty split', ref: 'p.59', sum: 'Traits in this set can\'t go above d6 on their own. Anything higher is a specialty, which replaces the trait\'s die when it applies.' },
  limits: { name: 'Limits', ref: 'p.63', sum: 'Weaknesses that earn a plot point, usually by shutting down a power or set until a stated recovery.' }
};
