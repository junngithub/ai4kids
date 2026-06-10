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
      /**
       * Optional fixed grid (rows of single uppercase letters). When set, the
       * generator is skipped — used for deterministic puzzles where the words
       * must cross at a known cell.
       */
      layout?: string[][];
      /**
       * 0-indexed [row, col] where the words all cross. When set, the grid
       * shows numbered axes, highlights the crossing once solved, and its
       * 1-indexed Column/Row become the room's exit-door code.
       */
      intersection?: [number, number];
      hint: string;
      learn: string;
    }
  | {
      kind: "cipher";
      prompt: string;
      emoji?: string;
      /**
       * A substitution legend: `symbols[i]` always stands for `letters[i]`.
       * It is NOT a uniform shift (Caesar) — every symbol maps to its own
       * letter, so the only way to read the message is to look each one up.
       */
      symbols: string[];
      letters: string[];
      /** The secret word written in symbols (each drawn from `symbols`). */
      coded: string[];
      /** What `coded` decodes to via the legend; the player types this in. */
      answer: string;
      hint: string;
      learn: string;
    }
  | {
      kind: "circuit";
      prompt: string;
      emoji?: string;
      /**
       * Grid of pipe tiles. `sides` are the open edges at rotation 0; `rot`
       * (0-3) is the starting quarter-turn. Tapping a tile rotates it 90° CW.
       * Solved when an unbroken path links `start` to `end`.
       */
      tiles: { sides: Dir[]; rot: number }[][];
      /** Power source plugs into this cell from its `from` edge. */
      start: { r: number; c: number; from: Dir };
      /** Bulb plugs out of this cell on its `to` edge. */
      end: { r: number; c: number; to: Dir };
      hint: string;
      learn: string;
    }
  | {
      kind: "sort";
      prompt: string;
      emoji?: string;
      /** The two bins to drop statements into. */
      bins: [SortBin, SortBin];
      /** Each item belongs in bin 0 or bin 1. */
      items: { text: string; bin: number }[];
      hint: string;
      learn: string;
    }
  | {
      kind: "maze";
      prompt: string;
      emoji?: string;
      /** Rows of equal length: '#' wall, '.' path, 'S' start, 'G' goal. */
      grid: string[];
      /** Scenario signposts shown when the hero stands on a given cell. */
      signs?: { at: [number, number]; text: string }[];
      /** Emoji drawn on the goal cell (default 💙). */
      goalEmoji?: string;
      /** Walking-hint caption under the maze (default mentions the honest path). */
      caption?: string;
      /** Caption shown once the hero reaches the goal (default honesty wording). */
      wonText?: string;
      hint: string;
      learn: string;
    }
  | {
      kind: "fair";
      prompt: string;
      emoji?: string;
      /** Animals to feed (emoji); each must end with the same number of treats. */
      animals: string[];
      /** Treat emoji. */
      treat: string;
      /** Total treats to share out (should divide evenly among the animals). */
      total: number;
      hint: string;
      learn: string;
    };

/** Compass edge of a circuit tile. */
export type Dir = "N" | "E" | "S" | "W";

/** Which hand-drawn SVG backdrop a room paints behind its scene. */
export type SceneKind = "lab" | "hero" | "eco" | "history" | "festival" | "nature";

/** One bin in a `sort` puzzle. */
export type SortBin = { label: string; emoji: string };

/**
 * A clue a station hands out the moment its puzzle is solved, chaining the
 * room's puzzles together. A `word` clue unlocks a target in another station's
 * word search; it surfaces only as a picture clue (`emoji`) — never the
 * spelled-out word — so the player still has to work out what to hunt for.
 */
export type StationClue = { kind: "word"; to: string; word: string; emoji: string };

/**
 * A door unlocked by decoding a substitution cipher. Each named station's solve
 * reveals one piece — the key symbols, the key letters, or the coded message —
 * and only with all three can the player decrypt `answer` and type it in.
 */
export type RoomCipherExit = {
  kind: "cipher";
  symbols: string[];
  letters: string[];
  coded: string[];
  answer: string;
  /** Station id whose solve reveals the legend symbols. */
  revealSymbols: string;
  /** Station id whose solve reveals the legend letters. */
  revealLetters: string;
  /** Station id whose solve reveals the coded message to decrypt. */
  revealCoded: string;
};

/**
 * A door unlocked by unscrambling several words. Each station's solve reveals
 * one scrambled word (its "core"); unscrambling every word opens the door.
 */
export type RoomUnscrambleExit = {
  kind: "unscramble";
  words: {
    /** The correct word the player types. */
    answer: string;
    /** The shuffled letters shown once `reveal` is solved. */
    scrambled: string;
    /** Station id whose solve reveals this word. */
    reveal: string;
    /** Core emoji + name shown beside the word. */
    emoji: string;
    core: string;
  }[];
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
  /** Clues revealed once this station's puzzle is solved (see StationClue). */
  provides?: StationClue[];
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
  /** Hand-drawn SVG backdrop illustration for the room (no emojis). */
  scene: SceneKind;
  /** Legacy emoji scenery (no longer painted; kept for back-compat). */
  decor: Decor[];
  /** Emoji avatar that explores the room. */
  character: string;
  /** Story setup shown before entering. */
  intro: string;
  /** Cheer shown when the learner escapes. */
  outro: string;
  stations: Station[];
  /** Optional special exit mechanism (otherwise: solve all, walk out). */
  exit?: RoomCipherExit | RoomUnscrambleExit;
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
    scene: "lab",
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
      "Beep boop! You're exploring Professor Pixel's Robot Lab when the door clicks shut. Fix the three machines to light up three secret words on the display — where they all cross is the code that opens the door!",
    outro: "The exit hums to life and slides open! The robot gives you a high-five. 🙌",
    stations: [
      {
        id: "panel",
        emoji: "🎛️",
        label: "Control Panel",
        x: 16,
        y: 30,
        // Lights up the word ROBOT (as a 🤖 picture clue) on the poster.
        provides: [{ kind: "word", to: "poster", word: "ROBOT", emoji: "🤖" }],
        puzzle: {
          kind: "code",
          emoji: "🔢",
          prompt: "Robots are hiding among the other machines. Count the 🤖 robots and type how many.",
          clue: "⚙️ 🤖 🤖 🛰️ 🤖 🪐 🤖 ✨ 🔋 🤖 ⚙️ 🤖",
          answer: "6",
          hint: "Touch each 🤖 as you count — skip the gears, planets and other machines.",
          learn: "Great counting! 🤖 The word ROBOT lights up on the word display — go hunt for it!",
        },
      },
      {
        id: "robot",
        emoji: "🤖",
        label: "Robot Helper",
        x: 44,
        y: 22,
        // Lights up the word LEARN (as a 📚 picture clue) on the poster.
        provides: [{ kind: "word", to: "poster", word: "LEARN", emoji: "📚" }],
        puzzle: {
          kind: "order",
          emoji: "🐱",
          prompt: "Teach the robot to spot cats. Tap the 3 steps in the right order:",
          items: [
            "Show the robot lots of cat photos",
            "The robot spots the pattern",
            "The robot guesses 'cat!' on a new photo",
          ],
          hint: "First it looks, then it thinks, then it answers.",
          learn: "That's how machines learn — from lots of examples! 📚 The word LEARN lights up on the display.",
        },
      },
      {
        id: "decoder",
        emoji: "🔣",
        label: "Symbol Decoder",
        x: 72,
        y: 30,
        // Decrypts the secret word GEAR and lights it up (as a ⚙️ clue) on the poster.
        provides: [{ kind: "word", to: "poster", word: "GEAR", emoji: "⚙️" }],
        puzzle: {
          kind: "cipher",
          emoji: "🔣",
          prompt: "Use the decoder key to read the secret word, then type it in.",
          // Substitution legend: each symbol = its own letter (not a shift). The
          // answer's letters (G,E,A,R) are scattered through the key on purpose,
          // so you have to hunt each symbol down rather than read them in a row.
          symbols: ["💡", "⚙️", "🛰️", "🔋", "📡", "🪐", "🤖", "🔌", "✨", "🔧", "🧲", "🔩"],
          letters: ["S", "G", "O", "E", "T", "N", "A", "L", "I", "R", "D", "C"],
          coded: ["⚙️", "🔋", "🤖", "🔧"],
          answer: "GEAR",
          hint: "Find each message symbol in the key and jot its letter — they're spread all over.",
          learn: "You cracked the code! ⚙️ The secret word GEAR lights up on the display.",
        },
      },
      {
        id: "poster",
        emoji: "🖥️",
        label: "Word Display",
        x: 42,
        y: 56,
        puzzle: {
          kind: "wordsearch",
          emoji: "🔎",
          prompt: "Three pictures will light up on this display. Find all three words — they all cross at one square!",
          words: ["ROBOT", "LEARN", "GEAR"],
          // Deterministic grid: ROBOT (→), LEARN (↓) and GEAR (↘) all share the
          // R at row 4, col 3 (0-indexed) → exit code Column 4, Row 5.
          layout: [
            ["Z", "X", "Q", "K", "V", "W", "Y", "J"],
            ["G", "P", "D", "L", "H", "U", "F", "M"],
            ["C", "E", "V", "E", "K", "X", "Q", "Z"],
            ["W", "Y", "A", "A", "J", "P", "D", "H"],
            ["K", "V", "Q", "R", "O", "B", "O", "T"],
            ["X", "Z", "J", "N", "C", "W", "Y", "F"],
            ["M", "P", "U", "D", "K", "V", "Q", "X"],
            ["H", "F", "C", "Z", "J", "W", "Y", "P"],
          ],
          intersection: [4, 3],
          hint: "ROBOT goes across, LEARN goes down, GEAR goes slanted — find where they meet.",
          learn: "ROBOT, LEARN and GEAR all cross at one square! Read that square's Column and Row, then key them into the door. 🔢",
        },
      },
    ],
  },
  {
    slug: "kindness-castle",
    activitySlug: "escape-kindness-castle",
    title: "The Superhero Suit",
    emoji: "🦸",
    tagline: "Power three hero cores to charge up the suit and escape!",
    ageRange: "8–11",
    accent: "bg-grape/15 text-grape",
    ring: "ring-grape/30",
    wall: "from-fuchsia-200 via-purple-200 to-indigo-200",
    floor: "from-stone-400 to-stone-600",
    pattern: "dots",
    floorKind: "tile",
    scene: "hero",
    decor: [
      { emoji: "🦸", x: 84, y: 16, size: 3.2 },
      { emoji: "⚡", x: 50, y: 8, size: 2, float: true },
      { emoji: "💥", x: 20, y: 16, size: 2, opacity: 0.9, float: true },
      { emoji: "🦾", x: 13, y: 50, size: 2.2, opacity: 0.95 },
      { emoji: "⭐", x: 74, y: 40, size: 1.4, opacity: 0.85 },
      { emoji: "✨", x: 92, y: 46, size: 2, opacity: 0.9, float: true },
      { emoji: "🛡️", x: 60, y: 12, size: 1.8, opacity: 0.85 },
    ],
    character: "🦸",
    intro:
      "The hero suit is out of power! It needs three cores — Kindness, Honesty and Fairness. Charge up each core, then use them to unscramble the suit's secret words and power the door open!",
    outro: "The suit lights up and zooms you out the door — you're a true superhero! 🦸",
    // The suit door: each core (station) reveals one scrambled word to crack.
    exit: {
      kind: "unscramble",
      words: [
        { answer: "KIND", scrambled: "DNIK", reveal: "kindness", emoji: "💚", core: "Kindness Core" },
        { answer: "TRUE", scrambled: "ETUR", reveal: "honesty", emoji: "💙", core: "Honesty Core" },
        { answer: "FAIR", scrambled: "RIAF", reveal: "fairness", emoji: "💛", core: "Fairness Core" },
      ],
    },
    stations: [
      {
        id: "kindness",
        emoji: "💚",
        label: "Kindness Core",
        x: 17,
        y: 30,
        puzzle: {
          kind: "sort",
          emoji: "💚",
          prompt: "Drop each thing someone said into the correct bin to charge the Kindness Core.",
          bins: [
            { label: "Kind", emoji: "💚" },
            { label: "Mean", emoji: "💢" },
          ],
          items: [
            { text: "Want to play with us?", bin: 0 },
            { text: "You can't sit here!", bin: 1 },
            { text: "Great try — well done!", bin: 0 },
            { text: "Nobody likes you.", bin: 1 },
            { text: "Here, let me help you up.", bin: 0 },
            { text: "That's a dumb idea.", bin: 1 },
          ],
          hint: "Kind words help and include people; mean words hurt or leave people out.",
          learn: "Kind words make people feel good and included — that's the Kindness Core charged! 💚",
        },
      },
      {
        id: "honesty",
        emoji: "💙",
        label: "Honesty Core",
        x: 46,
        y: 22,
        puzzle: {
          kind: "maze",
          emoji: "💙",
          prompt: "Find the honest path to the core. At each fork, the truthful choice goes forward — a lie is a dead end!",
          grid: [
            "###########",
            "#S..#.....#",
            "###.#####.#",
            "#.#.#.....#",
            "#.#.#.###.#",
            "#...#.#...#",
            "#.###.#.###",
            "#...#.#.#G#",
            "###.#.#.#.#",
            "#.....#...#",
            "###########",
          ],
          signs: [
            {
              at: [5, 1],
              text: "🤔 You forgot your homework. ⬆️ up: 'Pretend you lost it' (a lie). ⬇️ down: 'Tell the teacher the truth'.",
            },
            {
              at: [3, 9],
              text: "🤔 You knocked over a plant. ⬆️ up: 'Blame the cat' (a lie). ⬇️ down: 'Own up and help clean it'.",
            },
            {
              at: [9, 3],
              text: "🤔 You found a friend's lost pen. ⬅️ left: 'Keep it secretly' (a lie). ➡️ right: 'Give it back honestly'.",
            },
          ],
          hint: "Read each signpost — the honest choice is the way forward.",
          learn: "Telling the truth, even when it's hard, is what honesty means — Honesty Core charged! 💙",
        },
      },
      {
        id: "fairness",
        emoji: "💛",
        label: "Fairness Core",
        x: 72,
        y: 31,
        puzzle: {
          kind: "fair",
          emoji: "💛",
          prompt: "Share the apples so every animal gets exactly the same. Be fair!",
          animals: ["🐶", "🐱", "🐰"],
          treat: "🍎",
          total: 9,
          hint: "Nine apples shared between three friends — how many does each one get?",
          learn: "Sharing equally so everyone gets the same is what being fair means — Fairness Core charged! 💛",
        },
      },
    ],
  },
  {
    slug: "green-lab",
    activitySlug: "escape-green-lab",
    title: "The Recycling Plant",
    emoji: "♻️",
    tagline: "Switch the power back on and recycle your way out!",
    ageRange: "9–12",
    accent: "bg-mint/15 text-emerald-600",
    ring: "ring-mint/30",
    wall: "from-teal-100 via-emerald-100 to-lime-100",
    floor: "from-amber-700 to-amber-900",
    pattern: "leaves",
    floorKind: "wood",
    scene: "eco",
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
      "Welcome to the recycling plant! A power cut has shut the doors and powered down the exit decoder. Fix the three machines to power the plant back up — then crack the decoder code to get out!",
    outro: "The recycling plant whirs back to life and the doors slide open — you're an Earth hero! ♻️",
    // Cipher-locked door: each machine powers one part of the decoder.
    exit: {
      kind: "cipher",
      // Scattered substitution legend; the answer's symbols (P,O,W,E,R) sit at
      // positions 2,4,7,10,14 so they're spread across the key, not in a row.
      symbols: ["💧", "🔋", "🗑️", "☀️", "🍃", "🥤", "💨", "🌍", "📦", "♻️", "⚡", "🔌", "🌳", "🌱", "🌿"],
      letters: ["S", "P", "T", "O", "N", "A", "W", "Y", "C", "E", "G", "I", "D", "R", "L"],
      coded: ["🔋", "☀️", "💨", "♻️", "🌱"], // P O W E R
      answer: "POWER",
      revealSymbols: "circuit", // circuit connector → decoder symbols
      revealLetters: "bins", // recycling bins → decoder letters
      revealCoded: "panel", // solar panel → the coded message
    },
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
          learn: "Solar, wind and water are renewable energy — clean power that won't run out! ☀️ The door's secret message lights up.",
        },
      },
      {
        id: "bins",
        emoji: "♻️",
        label: "Recycling Plant",
        x: 46,
        y: 22,
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
          learn: "Recycling turns old bottles into new things and keeps rubbish out of nature! ♻️ The decoder's letters light up.",
        },
      },
      {
        id: "circuit",
        emoji: "🔌",
        label: "Power Circuit",
        x: 72,
        y: 31,
        puzzle: {
          kind: "circuit",
          emoji: "🔌",
          prompt: "The power's out! Tap the pipes to spin them and connect ⚡ to the 💡.",
          // 3×3 of pipe tiles; rotate the path tiles to link start → end.
          tiles: [
            [
              { sides: ["E", "S"], rot: 0 },
              { sides: ["S", "W"], rot: 2 },
              { sides: ["N", "W"], rot: 1 },
            ],
            [
              { sides: ["N", "W"], rot: 1 },
              { sides: ["N", "E"], rot: 1 },
              { sides: ["E", "W"], rot: 1 },
            ],
            [
              { sides: ["N", "E"], rot: 2 },
              { sides: ["E", "W"], rot: 3 },
              { sides: ["N", "W"], rot: 1 },
            ],
          ],
          start: { r: 1, c: 0, from: "W" },
          end: { r: 1, c: 2, to: "E" },
          hint: "Each tap turns a pipe a quarter-turn. Make one unbroken line from ⚡ to 💡.",
          learn: "You fixed the circuit — clean power flows again! ⚡ The decoder's symbols light up.",
        },
      },
    ],
  },
  {
    slug: "sg-history",
    activitySlug: "escape-sg-history",
    title: "The Singapore History Vault",
    emoji: "🦁",
    tagline: "Decode the old stone tablet to unlock the vault!",
    ageRange: "8–11",
    accent: "bg-coral/15 text-coral",
    ring: "ring-coral/30",
    wall: "from-amber-100 via-orange-100 to-red-100",
    floor: "from-stone-400 to-stone-600",
    pattern: "dots",
    floorKind: "tile",
    scene: "history",
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
      "The History Vault is sealed by an ancient stone tablet carved in mystery symbols. Explore old Singapore — answer the Merlion, sort the old days from today, and wind through the river lanes — to light up the tablet's key, then decode the secret word to escape!",
    outro: "You decode the tablet and the vault grinds open — the Merlion roars hello! 🦁",
    // Stone-tablet door: three discoveries light up the cipher's pieces.
    exit: {
      kind: "cipher",
      // Old-Singapore legend; the answer's symbols (I,S,L,A,N,D) sit at scattered
      // positions so the player must hunt each one down in the key.
      symbols: ["🦁", "🏛️", "🛺", "📜", "🕰️", "🇸🇬", "⚓", "🏘️", "🚢", "⛩️", "👑", "🗺️", "🪔", "🎆"],
      letters: ["L", "T", "A", "R", "I", "S", "N", "O", "D", "H", "K", "E", "U", "G"],
      coded: ["🕰️", "🇸🇬", "🦁", "🛺", "⚓", "🚢"], // I S L A N D
      answer: "ISLAND",
      revealSymbols: "river", // river maze → the tablet's symbol key
      revealLetters: "timeline", // sort the eras → the tablet's letter key
      revealCoded: "merlion", // the Merlion → the coded carving itself
    },
    stations: [
      {
        id: "merlion",
        emoji: "🦁",
        label: "Merlion Statue",
        x: 17,
        y: 30,
        puzzle: {
          kind: "mcq",
          emoji: "🦁",
          prompt: "Singapore's old name 'Singapura' means…",
          options: ["Lion City", "Sunny Island", "Big Harbour"],
          answerIndex: 0,
          hint: "Look at the Merlion's head for a clue!",
          learn: "'Singapura' means 'Lion City'! 🦁 The carved word on the stone tablet lights up.",
        },
      },
      {
        id: "timeline",
        emoji: "🗳️",
        label: "Old & New Box",
        x: 46,
        y: 22,
        puzzle: {
          kind: "sort",
          emoji: "🗳️",
          prompt: "Sort each thing into Long Ago or Today to charge the tablet's letters.",
          bins: [
            { label: "Long Ago", emoji: "🕰️" },
            { label: "Today", emoji: "🏙️" },
          ],
          items: [
            { text: "Kampong house on stilts", bin: 0 },
            { text: "Riding the MRT train", bin: 1 },
            { text: "Trishaw on the street", bin: 0 },
            { text: "Tapping a phone to pay", bin: 1 },
            { text: "Sampan boat on the river", bin: 0 },
            { text: "Tall glass skyscrapers", bin: 1 },
          ],
          hint: "Long ago = kampongs, trishaws, sampans. Today = MRT, phones, skyscrapers.",
          learn: "Singapore grew from kampongs and sampans into a modern city! The tablet's letters glow. 🔡",
        },
      },
      {
        id: "river",
        emoji: "🚣",
        label: "River Lanes",
        x: 72,
        y: 30,
        puzzle: {
          kind: "maze",
          emoji: "🚣",
          prompt: "Wind through the old river lanes to find the vault key. You can only see the lanes right around you!",
          goalEmoji: "🗝️",
          caption: "Use the arrows to find your way to 🗝️ through the old lanes.",
          wonText: "🗝️ You found the vault key down the river lanes!",
          grid: [
            "###########",
            "#S#.....#.#",
            "#.###.#.#.#",
            "#.#...#.#.#",
            "#.#.###.#.#",
            "#.#...#.#.#",
            "#.###.#.#.#",
            "#.....#...#",
            "#########.#",
            "#G........#",
            "###########",
          ],
          signs: [
            { at: [3, 3], text: "🏘️ Old kampong houses once stood on stilts along here." },
            { at: [7, 4], text: "🚢 The busy harbour traded spices, silk and tin." },
            { at: [2, 7], text: "🏛️ Grand riverside buildings from long ago line the bend." },
          ],
          hint: "Only the lanes next to you light up — explore carefully to reach 🗝️.",
          learn: "You traced the old Singapore River to the vault key! 🗝️ The tablet's symbol key lights up.",
        },
      },
    ],
  },
  {
    slug: "sg-culture",
    activitySlug: "escape-sg-culture",
    title: "The Festival Street Party",
    emoji: "🎉",
    tagline: "Light the lanterns and unscramble the party words!",
    ageRange: "7–10",
    accent: "bg-bubble/15 text-bubble",
    ring: "ring-bubble/30",
    wall: "from-rose-100 via-amber-100 to-violet-100",
    floor: "from-amber-700 to-amber-900",
    pattern: "dots",
    floorKind: "wood",
    scene: "festival",
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
      "Welcome to the Festival Street Party! The gate stays shut until the party is ready. Serve the hawker food, wire up the festival lanterns and count the parade drums — then unscramble the three party words to swing the gate open!",
    outro: "The street erupts in music and glowing lanterns — you're a Singapore culture star! 🎉",
    // Party gate: each station reveals one scrambled party word to unscramble.
    exit: {
      kind: "unscramble",
      words: [
        { answer: "SATAY", scrambled: "TAYAS", reveal: "hawker", emoji: "🍢", core: "Yummy Word" },
        { answer: "LIGHT", scrambled: "GHILT", reveal: "lights", emoji: "💡", core: "Glowing Word" },
        { answer: "DRUMS", scrambled: "MURDS", reveal: "drums", emoji: "🥁", core: "Loud Word" },
      ],
    },
    stations: [
      {
        id: "hawker",
        emoji: "🍚",
        label: "Hawker Stall",
        x: 17,
        y: 30,
        puzzle: {
          kind: "order",
          emoji: "🍗",
          prompt: "Eat at a hawker centre! Put the steps in order:",
          items: [
            "Order your chicken rice",
            "Pay with coins",
            "Find a seat and enjoy!",
          ],
          hint: "Order, then pay, then eat.",
          learn: "Hawker centres serve yummy, cheap food like chicken rice and satay! 🍢 A scrambled word lights up on the gate.",
        },
      },
      {
        id: "lights",
        emoji: "💡",
        label: "Festival Lights",
        x: 46,
        y: 22,
        puzzle: {
          kind: "circuit",
          emoji: "💡",
          prompt: "The festival lights are dark! Tap the wires to spin them and connect ⚡ to the 💡 lights.",
          // 3×3 wiring; rotate the pipes to link the power source to the lights.
          tiles: [
            [
              { sides: ["E", "S"], rot: 1 },
              { sides: ["E", "W"], rot: 1 },
              { sides: ["N", "W"], rot: 1 },
            ],
            [
              { sides: ["N", "S"], rot: 1 },
              { sides: ["N", "E"], rot: 0 },
              { sides: ["S", "W"], rot: 0 },
            ],
            [
              { sides: ["N", "S"], rot: 1 },
              { sides: ["N", "S"], rot: 0 },
              { sides: ["N", "W"], rot: 0 },
            ],
          ],
          start: { r: 2, c: 0, from: "S" },
          end: { r: 0, c: 2, to: "N" },
          hint: "Each tap turns a wire a quarter-turn. Make one unbroken line from ⚡ up to the lights💡.",
          learn: "The festival lights glow to life! 💡 A scrambled word lights up on the gate.",
        },
      },
      {
        id: "drums",
        emoji: "🥁",
        label: "Drum Beat",
        x: 72,
        y: 30,
        puzzle: {
          kind: "code",
          emoji: "🥁",
          prompt: "The parade drums are mixed in with other party things. Count the 🥁 drums and type how many.",
          clue: "🥁 🎶 🥁 🪔 🥁 🎉 🥁 🏮 🥁",
          answer: "5",
          hint: "Touch each 🥁 as you count — skip the music notes, lamps and lanterns.",
          learn: "Five drums set the festival beat! 🥁 The last scrambled word lights up on the gate.",
        },
      },
    ],
  },
  {
    slug: "sg-nature",
    activitySlug: "escape-sg-nature",
    title: "The Garden City Trail",
    emoji: "🌳",
    tagline: "Find the trail words and read the map to escape!",
    ageRange: "8–11",
    accent: "bg-mint/15 text-emerald-600",
    ring: "ring-mint/30",
    wall: "from-sky-200 via-emerald-100 to-lime-100",
    floor: "from-amber-700 to-amber-900",
    pattern: "leaves",
    floorKind: "wood",
    scene: "nature",
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
      "You're on the Garden City Trail when the park gate clicks shut! Meet the otters, grow a tree and crack the ranger's code to light up three words on the trail map — where they all cross is the gate code!",
    outro: "The gate opens to a chorus of birds and a wave from the otters — what a nature explorer! 🌳",
    stations: [
      {
        id: "river",
        emoji: "🦦",
        label: "Otter River",
        x: 16,
        y: 30,
        // Lights up OTTER (as a 🦦 picture clue) on the trail map.
        provides: [{ kind: "word", to: "trailmap", word: "OTTER", emoji: "🦦" }],
        puzzle: {
          kind: "mcq",
          emoji: "🦦",
          prompt: "Which playful animal swims in Singapore's rivers in families?",
          options: ["Otters", "Penguins", "Polar bears"],
          answerIndex: 0,
          hint: "They're furry and love to splash together.",
          learn: "Singapore's smooth-coated otters live in families! 🦦 The word OTTER lights up on the trail map.",
        },
      },
      {
        id: "seed",
        emoji: "🌱",
        label: "Growing Tree",
        x: 44,
        y: 22,
        // Lights up GARDEN (as a 🌳 picture clue) on the trail map.
        provides: [{ kind: "word", to: "trailmap", word: "GARDEN", emoji: "🌳" }],
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
          learn: "Trees make Singapore a green Garden City! 🌳 The word GARDEN lights up on the trail map.",
        },
      },
      {
        id: "ranger",
        emoji: "🔣",
        label: "Ranger's Code",
        x: 72,
        y: 30,
        // Decodes RIVER and lights it up (as a 🌊 clue) on the trail map.
        provides: [{ kind: "word", to: "trailmap", word: "RIVER", emoji: "🌊" }],
        puzzle: {
          kind: "cipher",
          emoji: "🔣",
          prompt: "Use the ranger's nature key to read the secret place, then type it in.",
          // Substitution legend; the answer's symbols (R,I,V,E,R) are scattered
          // through the key, so you have to look each one up.
          symbols: ["🦋", "🌳", "🦦", "🌺", "🍃", "🐟", "🌊", "🦜", "🌱", "🐢", "🪺", "🌴", "🍄", "🐝"],
          letters: ["A", "T", "R", "O", "N", "I", "S", "V", "E", "L", "D", "G", "U", "H"],
          coded: ["🦦", "🐟", "🦜", "🌱", "🦦"], // R I V E R
          answer: "RIVER",
          hint: "Find each message symbol in the key and jot its letter — they're spread all over.",
          learn: "You cracked the ranger's code! 🌊 The word RIVER lights up on the trail map.",
        },
      },
      {
        id: "trailmap",
        emoji: "🗺️",
        label: "Trail Map",
        x: 42,
        y: 56,
        puzzle: {
          kind: "wordsearch",
          emoji: "🔎",
          prompt: "Three pictures will light up on the map. Find all three words — they all cross at one square!",
          words: ["OTTER", "GARDEN", "RIVER"],
          // Deterministic grid: OTTER (→), GARDEN (↓) and RIVER (↘) all share the
          // E at row 4, col 3 (0-indexed) → exit code Column 4, Row 5.
          layout: [
            ["K", "X", "Q", "G", "H", "U", "F", "M"],
            ["R", "Z", "L", "A", "J", "W", "Y", "B"],
            ["C", "I", "K", "R", "X", "P", "U", "H"],
            ["M", "W", "V", "D", "Q", "Z", "J", "F"],
            ["O", "T", "T", "E", "R", "K", "Y", "C"],
            ["H", "U", "P", "N", "R", "W", "X", "Q"],
            ["D", "Z", "K", "J", "V", "C", "Y", "F"],
            ["P", "M", "H", "W", "Q", "U", "F", "Z"],
          ],
          intersection: [4, 3],
          hint: "OTTER goes across, GARDEN goes down, RIVER goes slanted — find where they meet.",
          learn: "OTTER, GARDEN and RIVER all cross at one square! Read that square's Column and Row, then key them into the gate. 🔢",
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
