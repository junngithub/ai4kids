/**
 * Phonics Quest — data for the offline, on-device phonics adventure (ages 4–6).
 *
 * A map of phonics "worlds", each a bite-size mini-game with gamified star
 * progression. Ported from the ai4kids Android app (PhonicsContent.kt); ideas
 * adapted from the PhonixQuest concept. Everything runs client-side — sounds are
 * spoken with the browser's SpeechSynthesis, so there's no network or account
 * dependency for the core games. An optional Claude "Buddy" adds hints/praise
 * when AI is configured (see /api/learn/phonics-buddy).
 */

/** The mini-game kinds a world can use. */
export type PhonicsKind = "pop" | "build" | "rhyme" | "listen";

/** "Pop the Phoneme" round: which starting sound does this picture make? */
export type PopRound = { emoji: string; word: string; answer: string; options: string[] };

/** "Build the Word" round: spell the word for the picture from letter tiles. */
export type BuildRound = { emoji: string; word: string };

/** "Rhyme Time" round: pick the option that rhymes with the target. */
export type RhymeRound = {
  emoji: string;
  word: string;
  options: { emoji: string; word: string }[];
  answerIndex: number;
};

/** "Listen & Find" round: hear the word, then tap the matching word among
 *  similar-sounding choices (no pictures — the child decides by listening). */
export type ListenRound = {
  word: string;
  options: string[];
  answerIndex: number;
};

/** One world on the adventure map. Only the list matching `kind` is populated. */
export type PhonicsStage = {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  /** Accent token name — keyed into ACCENTS in the page for literal classes. */
  accent: AccentKey;
  kind: PhonicsKind;
  pop?: PopRound[];
  build?: BuildRound[];
  rhyme?: RhymeRound[];
  listen?: ListenRound[];
};

export type AccentKey = "bubble" | "tangerine" | "grape" | "mint" | "sky";

/** How many rounds a stage has (drives the progress bar). */
export function stageRounds(s: PhonicsStage): number {
  switch (s.kind) {
    case "pop":
      return s.pop?.length ?? 0;
    case "build":
      return s.build?.length ?? 0;
    case "rhyme":
      return s.rhyme?.length ?? 0;
    case "listen":
      return s.listen?.length ?? 0;
  }
}

/** The five worlds of Phonics Quest. */
export const PHONICS_STAGES: PhonicsStage[] = [
  {
    id: "letters-land",
    title: "Letters Land",
    subtitle: "Starting sounds",
    emoji: "🅰️",
    accent: "bubble",
    kind: "pop",
    pop: [
      { emoji: "🍎", word: "Apple", answer: "A", options: ["A", "B", "S"] },
      { emoji: "🐻", word: "Bear", answer: "B", options: ["B", "D", "M"] },
      { emoji: "🐱", word: "Cat", answer: "C", options: ["C", "K", "T"] },
      { emoji: "🐶", word: "Dog", answer: "D", options: ["D", "B", "P"] },
      { emoji: "🥚", word: "Egg", answer: "E", options: ["E", "A", "I"] },
      { emoji: "🌙", word: "Moon", answer: "M", options: ["M", "N", "W"] },
    ],
  },
  {
    id: "blend-bridge",
    title: "Blend Bridge",
    subtitle: "Build short words",
    emoji: "🌉",
    accent: "tangerine",
    kind: "build",
    build: [
      { emoji: "🐱", word: "CAT" },
      { emoji: "🐶", word: "DOG" },
      { emoji: "☀️", word: "SUN" },
      { emoji: "🎩", word: "HAT" },
      { emoji: "🚌", word: "BUS" },
    ],
  },
  {
    id: "silent-letters",
    title: "Whisper Woods",
    subtitle: "Silent letters",
    emoji: "🤫",
    accent: "grape",
    kind: "build",
    build: [
      { emoji: "🐑", word: "LAMB" }, // silent B
      { emoji: "🔪", word: "KNIFE" }, // silent K
      { emoji: "👻", word: "GHOST" }, // silent H
      { emoji: "🏰", word: "CASTLE" }, // silent T
      { emoji: "✍️", word: "WRITE" }, // silent W
    ],
  },
  {
    id: "rhyme-road",
    title: "Rhyme Road",
    subtitle: "Words that rhyme",
    emoji: "🎵",
    accent: "mint",
    kind: "rhyme",
    rhyme: [
      { emoji: "🐱", word: "Cat", options: [{ emoji: "🎩", word: "Hat" }, { emoji: "🐶", word: "Dog" }, { emoji: "☀️", word: "Sun" }], answerIndex: 0 },
      { emoji: "⭐", word: "Star", options: [{ emoji: "🚗", word: "Car" }, { emoji: "🌙", word: "Moon" }, { emoji: "🐟", word: "Fish" }], answerIndex: 0 },
      { emoji: "🌳", word: "Tree", options: [{ emoji: "🐝", word: "Bee" }, { emoji: "🐱", word: "Cat" }, { emoji: "☀️", word: "Sun" }], answerIndex: 0 },
      { emoji: "🐸", word: "Frog", options: [{ emoji: "🪵", word: "Log" }, { emoji: "🐱", word: "Cat" }, { emoji: "⭐", word: "Star" }], answerIndex: 0 },
      { emoji: "🐌", word: "Snail", options: [{ emoji: "🐳", word: "Whale" }, { emoji: "🐶", word: "Dog" }, { emoji: "🐦", word: "Bird" }], answerIndex: 0 },
    ],
  },
  {
    id: "story-kingdom",
    title: "Story Kingdom",
    subtitle: "Listen & find",
    emoji: "👑",
    accent: "sky",
    kind: "listen",
    listen: [
      { word: "Sun", options: ["Sun", "Sock", "Sand"], answerIndex: 0 },
      { word: "Dog", options: ["Dog", "Dot", "Duck"], answerIndex: 0 },
      { word: "Tree", options: ["Tree", "Try", "Train"], answerIndex: 0 },
      { word: "Cat", options: ["Cat", "Cap", "Cot"], answerIndex: 0 },
      { word: "Bear", options: ["Bear", "Bee", "Boat"], answerIndex: 0 },
    ],
  },
];

/**
 * A phonics-style utterance for a letter sound (e.g. B → "buh", S → "suh"), so
 * speech reads the *sound* as a single syllable rather than spelling the letter.
 * Ported from PhonicsGames.kt `phonemeOf`.
 */
export function phonemeOf(letter: string): string {
  const map: Record<string, string> = {
    A: "ah", B: "buh", C: "kah", D: "duh", E: "eh",
    F: "fuh", G: "guh", H: "huh", I: "e", J: "juh",
    K: "kuh", L: "luh", M: "muh", N: "nuh", O: "oh",
    P: "puh", Q: "kwuh", R: "ruh", S: "suh", T: "tuh",
    U: "uh", V: "vuh", W: "wuh", X: "ksuh", Y: "yuh", Z: "zuh",
  };
  return map[letter.toUpperCase()] ?? letter;
}

/** Stars from mistakes: 0 → 3 stars, 1–2 → 2 stars, else 1 star. */
export function starsForMistakes(mistakes: number): number {
  if (mistakes === 0) return 3;
  if (mistakes <= 2) return 2;
  return 1;
}
