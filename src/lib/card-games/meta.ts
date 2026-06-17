/**
 * Catalogue metadata for the three card games. Safe to import on the client
 * (no engine/state, no server deps) — drives the hub cards, lobby copy and the
 * `activities` rows.
 */
export type CardGameMode = "solo" | "coop" | "versus";

export type CardGameMeta = {
  slug: string;
  /** activity slug used for completions / leaderboard. */
  activitySlug: string;
  title: string;
  emoji: string;
  tagline: string;
  blurb: string;
  /** Accent classes (bg/text) for the kids theme. */
  accent: string;
  ring: string;
  modes: CardGameMode[];
  minPlayers: number; // for the multiplayer modes
  maxPlayers: number;
  /** Short rules, shown in the lobby. */
  how: string[];
};

export const CARD_GAMES: CardGameMeta[] = [
  {
    slug: "memory-match",
    activitySlug: "cards-memory-match",
    title: "Memory Match",
    emoji: "🧠",
    tagline: "Flip and find the pairs",
    blurb: "Flip the cards two at a time and match each word with its picture. Play solo, team up, or race a friend.",
    accent: "bg-grape/15 text-grape",
    ring: "ring-grape/30",
    modes: ["solo", "coop", "versus"],
    minPlayers: 2,
    maxPlayers: 4,
    how: [
      "On your turn, flip two cards.",
      "Match a word with its matching picture (like “plant” and 🌱) to win the pair.",
      "Match or miss, your turn then passes to the next player.",
      "Co-op: clear the whole board as a team. Versus: most pairs wins!",
    ],
  },
  {
    slug: "tower-tumble",
    activitySlug: "cards-tower-tumble",
    title: "Tower Tumble",
    emoji: "🃏",
    tagline: "Climb the piles, empty your hand",
    blurb: "Stack cards higher and higher on four piles. Play a 10 to topple a tower! First to run out of cards wins.",
    accent: "bg-coral/15 text-coral",
    ring: "ring-coral/30",
    modes: ["solo", "versus"],
    minPlayers: 2,
    maxPlayers: 4,
    how: [
      "Place a card HIGHER than the top of any pile.",
      "Play a 10 to clear a pile — then anyone can start it fresh.",
      "Stuck with no move? You pass.",
      "First player to empty their hand wins. Solo: beat the clock!",
    ],
  },
  {
    slug: "number-hunt",
    activitySlug: "cards-number-hunt",
    title: "Number Hunt",
    emoji: "🔢",
    tagline: "Make the target number",
    blurb: "Hunt for cards that hit the target — one card that equals it, or two that add or subtract to it. Empty your hand to win!",
    accent: "bg-sky/15 text-sky-600",
    ring: "ring-sky/30",
    modes: ["solo", "versus"],
    minPlayers: 2,
    maxPlayers: 4,
    how: [
      "Discard ONE card that equals the target number.",
      "Or discard TWO cards that add up to — or subtract to — the target.",
      "Can't discard? Draw a card and pass.",
      "First to empty their hand wins. Solo: race the clock!",
    ],
  },
  {
    slug: "beat-the-die",
    activitySlug: "cards-beat-the-die",
    title: "Beat the Die",
    emoji: "🎲",
    tagline: "Roll, then beat it",
    blurb: "Roll the dice, then throw down one or two cards that add up to at least the roll. Can't beat it? Draw. First to empty their hand wins!",
    accent: "bg-mint/15 text-emerald-600",
    ring: "ring-mint/30",
    modes: ["solo", "versus"],
    minPlayers: 2,
    maxPlayers: 4,
    how: [
      "Roll the 6-sided die at the start of your turn.",
      "Discard ONE or TWO cards that add up to at least the roll.",
      "Can't beat the die? Draw a card instead.",
      "First to empty their hand wins. Solo: race the clock!",
    ],
  },
  {
    slug: "card-showdown",
    activitySlug: "cards-card-showdown",
    title: "Card Showdown",
    emoji: "⭐",
    tagline: "Clash for victory stars",
    blurb: "Everyone plays cards in secret, then reveals at once. Highest total wins a star — but hands those cards to the lowest player! First to 3 stars, or last standing, wins.",
    accent: "bg-bubble/15 text-bubble",
    ring: "ring-bubble/30",
    modes: ["versus"],
    minPlayers: 3,
    maxPlayers: 4,
    how: [
      "Everyone secretly plays ONE or TWO cards at the same time.",
      "Highest total wins a ⭐ — and gives those cards to the lowest player, who discards what they played. Everyone else keeps theirs.",
      "Tie for lowest? They ALL collect the winning cards. Tie for highest? They each win a ⭐, and the lowest collects every card they played.",
      "Everyone plays the same total? It's a draw — nothing happens.",
      "Run out of cards and you're out. First to 3 ⭐ — or last standing — wins!",
    ],
  },
  {
    slug: "matching-colours",
    activitySlug: "cards-matching-colours",
    title: "Matching Colours",
    emoji: "🌈",
    tagline: "Quick! Tap the right colour",
    blurb: "Each round the four colours get new numbers. A number is called — race to tap the matching colour the fastest! Most points after 10 rounds wins.",
    accent: "bg-sky/15 text-sky-600",
    ring: "ring-sky/30",
    modes: ["versus"],
    minPlayers: 2,
    maxPlayers: 4,
    how: [
      "You hold four colour cards: 🟥 🟦 🟩 🟨.",
      "Each round the colours are tied to the numbers 1–4 — memorise them in the 3-second countdown!",
      "A number is called. Tap the colour it matches within 5 seconds.",
      "Fastest correct tap gains 3 points, second fastest gains 2 points. Slower but correct taps gives 1 point. Being wrong or too slow gives 0 points.",
      "Most points after 10 rounds wins. A tie? A sudden-death round decides it!",
    ],
  },
];

export const CARD_GAME_BY_SLUG: Record<string, CardGameMeta> = Object.fromEntries(
  CARD_GAMES.map((g) => [g.slug, g]),
);

export function getCardGame(slug: string): CardGameMeta | undefined {
  return CARD_GAME_BY_SLUG[slug];
}

export function modeLabel(mode: CardGameMode): string {
  return mode === "solo" ? "Solo" : mode === "coop" ? "Co-op" : "Versus";
}
