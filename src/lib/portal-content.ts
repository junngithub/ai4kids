/**
 * Shared taxonomy for the kids-AI portal: the six program/activity categories
 * and the four age bands. Used by public pages, admin forms, and the seed.
 */
export type CategorySlug =
  | "storytelling"
  | "coding"
  | "game-dev"
  | "phonics"
  | "escape-room"
  | "free-games";

export type CategoryDef = {
  slug: CategorySlug;
  title: string;
  emoji: string;
  /** Tailwind classes for the card accent (bg + text). */
  accent: string;
  ring: string;
  blurb: string;
};

export const CATEGORIES: CategoryDef[] = [
  {
    slug: "storytelling",
    title: "AI Storytelling",
    emoji: "📖",
    accent: "bg-coral/15 text-coral",
    ring: "ring-coral/30",
    blurb: "Dream up magical tales and watch AI illustrate them, page by page.",
  },
  {
    slug: "coding",
    title: "AI Coding",
    emoji: "💻",
    accent: "bg-sky/15 text-sky-600",
    ring: "ring-sky/30",
    blurb: "Build apps, websites and bots with a friendly AI coding buddy.",
  },
  {
    slug: "game-dev",
    title: "AI Game Dev",
    emoji: "🎮",
    accent: "bg-grape/15 text-grape",
    ring: "ring-grape/30",
    blurb: "Design characters, worlds and rules — then code your own games.",
  },
  {
    slug: "phonics",
    title: "AI Phonics",
    emoji: "🔤",
    accent: "bg-mint/15 text-emerald-600",
    ring: "ring-mint/30",
    blurb: "Letters, sounds and first words through playful AI mini-games.",
  },
  {
    slug: "escape-room",
    title: "AI Escape Rooms",
    emoji: "🗝️",
    accent: "bg-sunny/20 text-amber-600",
    ring: "ring-sunny/40",
    blurb: "Crack codes and solve AI puzzles to break out of the room.",
  },
  {
    slug: "free-games",
    title: "Free Games",
    emoji: "🕹️",
    accent: "bg-bubble/15 text-bubble",
    ring: "ring-bubble/30",
    blurb: "Brain-tickling games — free to play for every age group.",
  },
];

export const CATEGORY_BY_SLUG: Record<string, CategoryDef> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c]),
);

export type AgeBand = { slug: string; label: string; min: number; max: number; emoji: string };

export const AGE_BANDS: AgeBand[] = [
  { slug: "4-6", label: "Explorers", min: 4, max: 6, emoji: "🐣" },
  { slug: "7-9", label: "Makers", min: 7, max: 9, emoji: "🚀" },
  { slug: "10-12", label: "Builders", min: 10, max: 12, emoji: "🛠️" },
  { slug: "13-16", label: "Creators", min: 13, max: 16, emoji: "🧠" },
];

export function ageBandForAge(age: number): AgeBand | null {
  return AGE_BANDS.find((b) => age >= b.min && age <= b.max) ?? null;
}

export function formatPrice(cents: number): string {
  if (!cents) return "Free";
  return "$" + (cents / 100).toFixed(0);
}
