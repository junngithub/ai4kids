/**
 * Sample AI Escape Rooms for the kids learning portal.
 *
 * Each room is a little *scene* you explore: a character walks up to clickable
 * objects ("stations"), and each object triggers a short, kid-friendly,
 * educational puzzle. Solve every object's puzzle to unlock the door and escape.
 *
 * Themes are simplified from the AI Vault escape-room project
 * (junngithub/escaperooms) — AI basics, data & patterns, and AI ethics / online
 * safety — re-pitched for ages 7–12.
 *
 * Content is fully static (no AI/API at play time). Each room maps 1:1 to a row
 * in the `activities` table via `activitySlug` (see scripts/seed-portal.ts) and
 * to a route at /learn/escape-room/<slug>.
 */

// TODO: Make the rooms more engaging and less repetitive. Every room currently
// follows the same 4-station mcq → order → code → wordsearch template with the
// same object positions. Ideas: vary the number/layout of stations per room;
// add new puzzle kinds (matching pairs, slider/maze, drag-to-sort, cipher,
// spot-the-difference, audio/phonics); branching or sequential locks where one
// puzzle reveals a clue for the next; per-room narrative beats and a timer or
// star rating; richer scene interactivity (hotspots, inventory items).

export type EscapeRoomPuzzle =
  | {
      kind: "mcq";
      prompt: string;
      emoji?: string;
      options: string[];
      answerIndex: number;
      hint: string;
      /** Friendly fact shown after the puzzle is solved. */
      learn: string;
    }
  | {
      kind: "code";
      prompt: string;
      emoji?: string;
      /** Accepted answer; matched case-insensitively after trimming. */
      answer: string;
      /** The clue shown on the lock screen. */
      clue: string;
      hint: string;
      learn: string;
    }
  | {
      kind: "order";
      prompt: string;
      emoji?: string;
      /** Items listed in the CORRECT order; shown shuffled to the player. */
      items: string[];
      hint: string;
      learn: string;
    }
  | {
      kind: "wordsearch";
      prompt: string;
      emoji?: string;
      /** Words to find (letters only); a grid is generated around them. */
      words: string[];
      /** Optional grid size; defaults to fit the longest word (min 7). */
      size?: number;
      hint: string;
      learn: string;
    };

/** A clickable object in the room that opens a puzzle. */
export type Station = {
  id: string;
  emoji: string;
  /** Short name shown under the object. */
  label: string;
  /** Position in the scene, 0–100 (% from left / top). */
  x: number;
  y: number;
  puzzle: EscapeRoomPuzzle;
};

/** A non-interactive piece of scenery painted into the room background. */
export type Decor = {
  emoji: string;
  /** Position, 0–100 (% from left / top). */
  x: number;
  y: number;
  /** Font size in rem (default 2.5). */
  size?: number;
  /** 0–1 opacity (default 1). */
  opacity?: number;
  /** Slowly rotate (gears, fans). */
  spin?: boolean;
  /** Gently bob up and down (clouds, balloons). */
  float?: boolean;
};

export type EscapeRoom = {
  /** Route param, e.g. "robot-lab" → /learn/escape-room/robot-lab */
  slug: string;
  /** Matching row in the `activities` table. */
  activitySlug: string;
  title: string;
  emoji: string;
  tagline: string;
  ageRange: string;
  /** Tailwind accent classes for the room header (bg + text). */
  accent: string;
  ring: string;
  /** Tailwind gradient classes for the scene wall / back of the room. */
  wall: string;
  /** Tailwind gradient classes for the scene floor strip. */
  floor: string;
  /** Themed texture painted over the wall. */
  pattern: "circuit" | "dots" | "leaves" | "none";
  /** Themed look for the floor strip. */
  floorKind: "metal" | "tile" | "wood";
  /** Scenery emojis that set the mood (purely decorative). */
  decor: Decor[];
  /** Emoji avatar that explores the room. */
  character: string;
  /** Story setup shown before entering. */
  intro: string;
  /** Cheer shown when the learner escapes. */
  outro: string;
  stations: Station[];
};

export const ESCAPE_ROOMS: EscapeRoom[] = [
  {
    slug: "robot-lab",
    activitySlug: "escape-robot-lab",
    title: "The Robot Lab",
    emoji: "🤖",
    tagline: "Explore the lab and fix the machines to escape!",
    ageRange: "7–9",
    accent: "bg-sky/15 text-sky-600",
    ring: "ring-sky/30",
    wall: "from-slate-800 via-indigo-900 to-indigo-950",
    floor: "from-slate-500 to-slate-700",
    pattern: "circuit",
    floorKind: "metal",
    decor: [
      { emoji: "🪐", x: 84, y: 15, size: 3.2, float: true },
      { emoji: "🛰️", x: 22, y: 13, size: 2.2, float: true },
      { emoji: "⚙️", x: 9, y: 47, size: 2.6, opacity: 0.85, spin: true },
      { emoji: "⚙️", x: 92, y: 58, size: 1.8, opacity: 0.8, spin: true },
      { emoji: "📡", x: 60, y: 12, size: 1.8, opacity: 0.85 },
      { emoji: "✨", x: 36, y: 10, size: 1.1, opacity: 0.8 },
      { emoji: "✨", x: 74, y: 40, size: 0.9, opacity: 0.7 },
    ],
    character: "🧑‍🚀",
    intro:
      "Beep boop! You're exploring Professor Pixel's Robot Lab when the door clicks shut. Walk up to each machine, solve its puzzle, and power up the exit!",
    outro: "The exit hums to life and slides open! The robot gives you a high-five. 🙌",
    stations: [
      {
        id: "panel",
        emoji: "🎛️",
        label: "Control Panel",
        x: 16,
        y: 30,
        puzzle: {
          kind: "mcq",
          emoji: "🔤",
          prompt: "The screen asks: what do the letters in 'AI' stand for?",
          options: ["Artificial Intelligence", "Apple Ice-cream", "Amazing Internet"],
          answerIndex: 0,
          hint: "It means a clever, thinking machine.",
          learn: "AI stands for Artificial Intelligence — computers that learn and make choices, a bit like a brain!",
        },
      },
      {
        id: "robot",
        emoji: "🤖",
        label: "Robot Helper",
        x: 45,
        y: 22,
        puzzle: {
          kind: "order",
          emoji: "🐱",
          prompt: "The robot is learning. Tap the steps in the right order:",
          items: [
            "Show the robot lots of cat photos",
            "The robot spots the pattern",
            "The robot guesses 'cat!' on a new photo",
          ],
          hint: "First it sees, then it thinks, then it answers.",
          learn: "This is called machine learning — AI gets smart by studying lots of examples!",
        },
      },
      {
        id: "keypad",
        emoji: "🔢",
        label: "Door Keypad",
        x: 70,
        y: 32,
        puzzle: {
          kind: "code",
          emoji: "🔢",
          prompt: "The keypad loves number patterns. What number comes next?",
          clue: "2, 4, 6, 8, ___",
          answer: "10",
          hint: "Count up by twos!",
          learn: "Spotting patterns is a superpower that both you and AI share. 🌟",
        },
      },
      {
        id: "poster",
        emoji: "🧩",
        label: "Word Poster",
        x: 40,
        y: 54,
        puzzle: {
          kind: "wordsearch",
          emoji: "🔎",
          prompt: "Find the three robot words hidden in the grid:",
          words: ["ROBOT", "CODE", "LEARN"],
          size: 8,
          hint: "Look across, down and diagonally.",
          learn: "Robots run on CODE, and the best ones can LEARN — just like you!",
        },
      },
    ],
  },
  {
    slug: "kindness-castle",
    activitySlug: "escape-kindness-castle",
    title: "The Kindness Castle",
    emoji: "🏰",
    tagline: "Make good choices to unlock the castle gate!",
    ageRange: "8–11",
    accent: "bg-grape/15 text-grape",
    ring: "ring-grape/30",
    wall: "from-fuchsia-200 via-purple-200 to-indigo-200",
    floor: "from-stone-400 to-stone-600",
    pattern: "dots",
    floorKind: "tile",
    decor: [
      { emoji: "🏰", x: 84, y: 16, size: 3.2 },
      { emoji: "👑", x: 50, y: 8, size: 2, float: true },
      { emoji: "💛", x: 20, y: 16, size: 2, opacity: 0.9, float: true },
      { emoji: "🤝", x: 13, y: 50, size: 2.2, opacity: 0.95 },
      { emoji: "🌟", x: 74, y: 40, size: 1.4, opacity: 0.85 },
      { emoji: "🎈", x: 92, y: 46, size: 2, opacity: 0.9, float: true },
      { emoji: "🛡️", x: 60, y: 12, size: 1.8, opacity: 0.85 },
    ],
    character: "🦸",
    intro:
      "Welcome to the Kindness Castle! The gate only opens for someone with a good heart. Visit each spot and make the kind, honest and fair choice to escape!",
    outro: "The castle gate swings open with a golden sparkle — you're a true Kindness Hero! 🌟",
    stations: [
      {
        id: "purse",
        emoji: "👛",
        label: "Lost Purse",
        x: 17,
        y: 28,
        puzzle: {
          kind: "mcq",
          emoji: "💰",
          prompt: "You find a lost purse with money in the playground. What's the right thing to do?",
          options: [
            "Hand it to a teacher to find the owner",
            "Keep the money quietly",
            "Spend it before anyone sees",
          ],
          answerIndex: 0,
          hint: "Honesty means it isn't yours to keep.",
          learn: "Being honest — returning what isn't yours — is always the right choice. 💛",
        },
      },
      {
        id: "bench",
        emoji: "🪑",
        label: "Sad Friend",
        x: 46,
        y: 21,
        puzzle: {
          kind: "order",
          emoji: "🫂",
          prompt: "A friend is sitting alone and sad. Put the kind steps in order:",
          items: [
            "Notice that they feel sad",
            "Ask if they are okay",
            "Cheer them up and include them",
          ],
          hint: "First see it, then ask, then help.",
          learn: "Noticing how others feel and helping them is called empathy — a kindness superpower!",
        },
      },
      {
        id: "lock",
        emoji: "🔤",
        label: "Letter Lock",
        x: 71,
        y: 31,
        puzzle: {
          kind: "code",
          emoji: "🔤",
          prompt: "The gate spells the word you say after a mistake. Unscramble it:",
          clue: "Y - R - R - O - S  →  _____",
          answer: "sorry",
          hint: "You say it to show you feel bad about a mistake.",
          learn: "Saying SORRY and forgiving others helps fix mistakes and keep friendships strong.",
        },
      },
      {
        id: "banner",
        emoji: "🧩",
        label: "Castle Banner",
        x: 40,
        y: 54,
        puzzle: {
          kind: "wordsearch",
          emoji: "🔎",
          prompt: "Find the three good-character words on the banner:",
          words: ["KIND", "FAIR", "HONEST"],
          size: 8,
          hint: "All three make a great friend.",
          learn: "Being KIND, FAIR and HONEST makes you a wonderful friend and a true hero!",
        },
      },
    ],
  },
  {
    slug: "green-lab",
    activitySlug: "escape-green-lab",
    title: "The Green Energy Lab",
    emoji: "🌍",
    tagline: "Power up clean energy and recycle your way out!",
    ageRange: "9–12",
    accent: "bg-mint/15 text-emerald-600",
    ring: "ring-mint/30",
    wall: "from-teal-100 via-emerald-100 to-lime-100",
    floor: "from-amber-700 to-amber-900",
    pattern: "leaves",
    floorKind: "wood",
    decor: [
      { emoji: "☀️", x: 86, y: 13, size: 3, float: true },
      { emoji: "♻️", x: 16, y: 15, size: 2.4, spin: true },
      { emoji: "🌳", x: 11, y: 52, size: 2.6, opacity: 0.95 },
      { emoji: "🌬️", x: 60, y: 12, size: 2, opacity: 0.85, float: true },
      { emoji: "🦋", x: 72, y: 26, size: 1.6, opacity: 0.9, float: true },
      { emoji: "🌻", x: 92, y: 48, size: 2, opacity: 0.9 },
      { emoji: "🔋", x: 50, y: 8, size: 1.8, opacity: 0.9 },
    ],
    character: "🧑‍🔬",
    intro:
      "Welcome to the Green Energy Lab! The door locks to save power. Help the lab run on clean energy and sort the recycling to switch the exit back on!",
    outro: "The exit lights up with clean solar power — you're an Earth hero! 🌍",
    stations: [
      {
        id: "panel",
        emoji: "☀️",
        label: "Solar Panel",
        x: 17,
        y: 30,
        puzzle: {
          kind: "mcq",
          emoji: "⚡",
          prompt: "Which power comes from the sun and never runs out?",
          options: ["Solar power", "Burning coal", "Plastic bags"],
          answerIndex: 0,
          hint: "Look up on a sunny day!",
          learn: "Solar, wind and water are renewable energy — clean power that won't run out!",
        },
      },
      {
        id: "bins",
        emoji: "♻️",
        label: "Recycling Bins",
        x: 46,
        y: 21,
        puzzle: {
          kind: "order",
          emoji: "🍶",
          prompt: "Recycle a plastic bottle the right way. Put the steps in order:",
          items: [
            "Empty and rinse the bottle",
            "Drop it in the recycling bin",
            "It's made into something new!",
          ],
          hint: "Clean it first, then sort it, then it gets reused.",
          learn: "Recycling turns old bottles into new things and keeps rubbish out of nature!",
        },
      },
      {
        id: "meter",
        emoji: "🌳",
        label: "Tree Meter",
        x: 71,
        y: 31,
        puzzle: {
          kind: "code",
          emoji: "🌳",
          prompt: "Each tree cleans 2 bags of air. How many bags do 5 trees clean?",
          clue: "5 trees × 2 bags = ___",
          answer: "10",
          hint: "Count by twos five times: 2, 4, 6, 8, 10.",
          learn: "Trees and plants clean our air — more trees means a healthier planet!",
        },
      },
      {
        id: "poster",
        emoji: "🧩",
        label: "Eco Poster",
        x: 40,
        y: 54,
        puzzle: {
          kind: "wordsearch",
          emoji: "🔎",
          prompt: "Find the three Earth-friendly words in the grid:",
          words: ["SOLAR", "RECYCLE", "PLANET"],
          size: 8,
          hint: "Look across, down and diagonally.",
          learn: "Using SOLAR power, RECYCLE-ing, and caring for the PLANET keeps Earth green!",
        },
      },
    ],
  },
  {
    slug: "sg-history",
    activitySlug: "escape-sg-history",
    title: "The Singapore History Vault",
    emoji: "🦁",
    tagline: "Travel back in time to unlock old Singapore!",
    ageRange: "8–11",
    accent: "bg-coral/15 text-coral",
    ring: "ring-coral/30",
    wall: "from-amber-100 via-orange-100 to-red-100",
    floor: "from-stone-400 to-stone-600",
    pattern: "dots",
    floorKind: "tile",
    decor: [
      { emoji: "🦁", x: 84, y: 16, size: 3.2 },
      { emoji: "🏛️", x: 16, y: 15, size: 2.4, opacity: 0.9 },
      { emoji: "🛺", x: 12, y: 52, size: 2.6, opacity: 0.95 },
      { emoji: "🕰️", x: 60, y: 12, size: 2, opacity: 0.85, float: true },
      { emoji: "📜", x: 92, y: 48, size: 2, opacity: 0.9 },
      { emoji: "🇸🇬", x: 50, y: 8, size: 1.8, opacity: 0.9 },
      { emoji: "⚓", x: 74, y: 40, size: 1.4, opacity: 0.8 },
    ],
    character: "🧑‍🎓",
    intro:
      "The History Vault door has locked! Explore old Singapore — from kampong villages to the busy harbour — and solve each puzzle to travel back to today.",
    outro: "The vault opens and the Merlion roars hello — you're a Singapore history hero! 🦁",
    stations: [
      {
        id: "merlion",
        emoji: "🦁",
        label: "Merlion Statue",
        x: 17,
        y: 28,
        puzzle: {
          kind: "mcq",
          emoji: "🦁",
          prompt: "Singapore's old name 'Singapura' means…",
          options: ["Lion City", "Sunny Island", "Big Harbour"],
          answerIndex: 0,
          hint: "Look at the Merlion's head for a clue!",
          learn: "'Singapura' means 'Lion City' — that's why the Merlion has a lion's head!",
        },
      },
      {
        id: "timeline",
        emoji: "🛖",
        label: "Old Photos",
        x: 46,
        y: 21,
        puzzle: {
          kind: "order",
          emoji: "🏙️",
          prompt: "Put old Singapore in order, from long ago to today:",
          items: [
            "A small fishing village (kampong)",
            "A busy trading port with trishaws",
            "A modern city with tall towers",
          ],
          hint: "Villages came first, skyscrapers came last.",
          learn: "Singapore grew from a small fishing village into a busy port, then a modern city!",
        },
      },
      {
        id: "calendar",
        emoji: "🔢",
        label: "National Day Lock",
        x: 71,
        y: 31,
        puzzle: {
          kind: "code",
          emoji: "🎆",
          prompt: "Singapore's birthday (National Day) is on the 9th of August. Type the day number.",
          clue: "National Day = ___ August",
          answer: "9",
          hint: "Look at the date: the 9th!",
          learn: "Singapore became its own country on 9 August 1965 — we celebrate every National Day!",
        },
      },
      {
        id: "scroll",
        emoji: "🧩",
        label: "History Scroll",
        x: 40,
        y: 54,
        puzzle: {
          kind: "wordsearch",
          emoji: "🔎",
          prompt: "Find the three old-Singapore words in the grid:",
          words: ["LION", "RAFFLES", "KAMPONG"],
          size: 8,
          hint: "A KAMPONG is a traditional village.",
          learn: "Sir RAFFLES helped start modern Singapore, families lived in a KAMPONG, and the LION named the city!",
        },
      },
    ],
  },
  {
    slug: "sg-culture",
    activitySlug: "escape-sg-culture",
    title: "The Festival Street Party",
    emoji: "🎉",
    tagline: "Join the festivals and food to dance your way out!",
    ageRange: "7–10",
    accent: "bg-bubble/15 text-bubble",
    ring: "ring-bubble/30",
    wall: "from-rose-100 via-amber-100 to-violet-100",
    floor: "from-amber-700 to-amber-900",
    pattern: "dots",
    floorKind: "wood",
    decor: [
      { emoji: "🏮", x: 84, y: 14, size: 2.8, float: true },
      { emoji: "🧧", x: 20, y: 16, size: 2, opacity: 0.9, float: true },
      { emoji: "🥮", x: 13, y: 50, size: 2.2, opacity: 0.95 },
      { emoji: "🍜", x: 92, y: 46, size: 2.2, opacity: 0.95 },
      { emoji: "🎶", x: 60, y: 12, size: 1.8, opacity: 0.85, float: true },
      { emoji: "🪔", x: 50, y: 8, size: 1.8, opacity: 0.9 },
      { emoji: "🥁", x: 74, y: 40, size: 1.6, opacity: 0.85 },
    ],
    character: "👧",
    intro:
      "Welcome to the Festival Street Party! The gate is locked with a happy puzzle. Celebrate Singapore's festivals, languages and food to open it!",
    outro: "The street erupts in music and lights — you're a Singapore culture star! 🎉",
    stations: [
      {
        id: "flower",
        emoji: "🌺",
        label: "Flower Stall",
        x: 17,
        y: 28,
        puzzle: {
          kind: "mcq",
          emoji: "🌺",
          prompt: "Singapore's national flower is a kind of…",
          options: ["Orchid", "Rose", "Sunflower"],
          answerIndex: 0,
          hint: "It's a pretty purple flower called Vanda Miss Joaquim.",
          learn: "Singapore's national flower is an orchid called Vanda Miss Joaquim!",
        },
      },
      {
        id: "hawker",
        emoji: "🍚",
        label: "Hawker Stall",
        x: 46,
        y: 21,
        puzzle: {
          kind: "order",
          emoji: "🍗",
          prompt: "Eat at a hawker centre! Put the steps in order:",
          items: [
            "Order your chicken rice",
            "Pay with coins or a tap",
            "Find a seat and enjoy!",
          ],
          hint: "Order, then pay, then eat.",
          learn: "Hawker centres serve yummy, cheap food like chicken rice — a Singapore favourite!",
        },
      },
      {
        id: "languages",
        emoji: "🔢",
        label: "Language Lock",
        x: 71,
        y: 31,
        puzzle: {
          kind: "code",
          emoji: "🗣️",
          prompt: "Singapore's four official languages are English, Malay, Mandarin and Tamil. How many is that?",
          clue: "English, Malay, Mandarin, Tamil = ___",
          answer: "4",
          hint: "Count them: one, two, three, four.",
          learn: "Singapore has 4 official languages, and Malay is the national language!",
        },
      },
      {
        id: "menu",
        emoji: "🧩",
        label: "Food Menu",
        x: 40,
        y: 54,
        puzzle: {
          kind: "wordsearch",
          emoji: "🔎",
          prompt: "Find the three tasty Singapore words in the grid:",
          words: ["ORCHID", "SATAY", "LAKSA"],
          size: 8,
          hint: "SATAY is grilled meat on a stick.",
          learn: "SATAY and LAKSA are local favourites, and the ORCHID is our national flower!",
        },
      },
    ],
  },
  {
    slug: "sg-nature",
    activitySlug: "escape-sg-nature",
    title: "The Garden City Trail",
    emoji: "🌳",
    tagline: "Explore the Garden City and meet its wild friends!",
    ageRange: "8–11",
    accent: "bg-mint/15 text-emerald-600",
    ring: "ring-mint/30",
    wall: "from-sky-200 via-emerald-100 to-lime-100",
    floor: "from-amber-700 to-amber-900",
    pattern: "leaves",
    floorKind: "wood",
    decor: [
      { emoji: "🦦", x: 16, y: 15, size: 2.4, opacity: 0.95, float: true },
      { emoji: "🌳", x: 12, y: 52, size: 2.6, opacity: 0.95 },
      { emoji: "🦜", x: 72, y: 26, size: 1.8, opacity: 0.9, float: true },
      { emoji: "🌺", x: 92, y: 48, size: 2, opacity: 0.9 },
      { emoji: "☀️", x: 86, y: 13, size: 3, float: true },
      { emoji: "🦋", x: 60, y: 12, size: 1.6, opacity: 0.85, float: true },
      { emoji: "🌿", x: 50, y: 8, size: 1.8, opacity: 0.9 },
    ],
    character: "👦",
    intro:
      "You're on the Garden City Trail when the park gate clicks shut! Discover Singapore's parks, trees and animals to find your way out.",
    outro: "The gate opens to a chorus of birds and a wave from the otters — what a nature explorer! 🌳",
    stations: [
      {
        id: "river",
        emoji: "🦦",
        label: "Otter River",
        x: 17,
        y: 28,
        puzzle: {
          kind: "mcq",
          emoji: "🦦",
          prompt: "Which playful animal swims in Singapore's rivers in families?",
          options: ["Otters", "Penguins", "Polar bears"],
          answerIndex: 0,
          hint: "They're furry and love to splash together.",
          learn: "Singapore's smooth-coated otters live in families and swim through our rivers and canals!",
        },
      },
      {
        id: "signboard",
        emoji: "🌱",
        label: "Growing Tree",
        x: 46,
        y: 21,
        puzzle: {
          kind: "order",
          emoji: "🌳",
          prompt: "Help a seed grow into a big tree. Put the steps in order:",
          items: [
            "Plant the tiny seed",
            "A green shoot pops up",
            "It grows into a tall tree",
          ],
          hint: "Seed first, then a shoot, then a tree.",
          learn: "Trees clean our air and give shade — that's why Singapore is a green Garden City!",
        },
      },
      {
        id: "supertree",
        emoji: "🔢",
        label: "Supertree Lock",
        x: 71,
        y: 31,
        puzzle: {
          kind: "code",
          emoji: "🌴",
          prompt: "At Gardens by the Bay you count 3 Supertrees, then 3 more. How many Supertrees in all?",
          clue: "3 Supertrees + 3 Supertrees = ___",
          answer: "6",
          hint: "Add 3 and 3 together.",
          learn: "Gardens by the Bay's Supertrees are giant tree-shaped towers with real plants growing on them!",
        },
      },
      {
        id: "trailmap",
        emoji: "🧩",
        label: "Trail Map",
        x: 40,
        y: 54,
        puzzle: {
          kind: "wordsearch",
          emoji: "🔎",
          prompt: "Find the three nature words in the grid:",
          words: ["OTTER", "GARDEN", "JUNGLE"],
          size: 8,
          hint: "Look across, down and diagonally.",
          learn: "Spot an OTTER, wander a GARDEN, and explore the JUNGLE — nature is all around Singapore!",
        },
      },
    ],
  },
];

export function getEscapeRoom(slug: string): EscapeRoom | null {
  return ESCAPE_ROOMS.find((r) => r.slug === slug) ?? null;
}

/**
 * Build a square letter grid that contains every word, placed horizontally,
 * vertically or diagonally (forwards). Empty cells are filled with random
 * letters. Used by the word-search puzzle. Returns uppercase single letters.
 */
export function generateWordGrid(words: string[], size?: number): string[][] {
  const W = words.map((w) => w.toUpperCase().replace(/[^A-Z]/g, "")).filter(Boolean);
  const dim = Math.max(size ?? 0, 7, ...W.map((w) => w.length));
  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const dirs = [
    [0, 1], // →
    [1, 0], // ↓
    [1, 1], // ↘
  ];

  for (let attempt = 0; attempt < 250; attempt++) {
    const grid: (string | null)[][] = Array.from({ length: dim }, () =>
      Array<string | null>(dim).fill(null),
    );
    let allPlaced = true;

    for (const word of W) {
      let placed = false;
      for (let t = 0; t < 120 && !placed; t++) {
        const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
        const r0 = Math.floor(Math.random() * (dim - (dr ? word.length - 1 : 0)));
        const c0 = Math.floor(Math.random() * (dim - (dc ? word.length - 1 : 0)));
        let fits = true;
        for (let i = 0; i < word.length; i++) {
          const cur = grid[r0 + dr * i][c0 + dc * i];
          if (cur !== null && cur !== word[i]) {
            fits = false;
            break;
          }
        }
        if (!fits) continue;
        for (let i = 0; i < word.length; i++) grid[r0 + dr * i][c0 + dc * i] = word[i];
        placed = true;
      }
      if (!placed) {
        allPlaced = false;
        break;
      }
    }

    if (allPlaced) {
      return grid.map((row) => row.map((ch) => ch ?? ALPHA[Math.floor(Math.random() * 26)]));
    }
  }

  // Fallback: stack the words in rows and pad with random letters.
  const ALPHA2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length: dim }, (_, r) => {
    const base = (W[r] ?? "") + ALPHA2.repeat(dim);
    return base.slice(0, dim).split("");
  });
}
