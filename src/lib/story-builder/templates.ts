/**
 * Story Builder — the offline story engine. The child picks a hero, place, magic
 * item and mood; this weaves a short branching tale from randomized beats, so the
 * same picks read differently each time. Ported from the ai4kids Android app
 * (StoryBuilderScreen.kt). When AI is configured the API writes a fresh story in
 * the same shape (see /api/learn/story-builder), falling back to this on failure.
 */

export type Choice = { emoji: string; name: string };

export const HEROES: Choice[] = [
  { emoji: "🦊", name: "Fox" }, { emoji: "🐉", name: "Dragon" },
  { emoji: "🤖", name: "Robot" }, { emoji: "🦄", name: "Unicorn" },
];
export const PLACES: Choice[] = [
  { emoji: "🏰", name: "castle" }, { emoji: "🌋", name: "volcano" },
  { emoji: "🌌", name: "galaxy" }, { emoji: "🏝️", name: "island" },
];
export const OBJECTS: Choice[] = [
  { emoji: "🗝️", name: "golden key" }, { emoji: "🔮", name: "magic orb" },
  { emoji: "🎈", name: "balloon" }, { emoji: "📕", name: "spell book" },
];
// A mood/trait is threaded through the prose so the same hero can feel brave one
// time and silly the next — changing the whole tone of the story.
export const MOODS: Choice[] = [
  { emoji: "🦁", name: "brave" }, { emoji: "🤪", name: "silly" },
  { emoji: "😴", name: "sleepy" }, { emoji: "🤔", name: "curious" },
];

/** One way the child can solve the mid-story problem. */
export type Branch = { emoji: string; label: string; pages: string[] };

/** A branching story. `pre` are the pages read before the fork; `problem` is the
 *  fork page where the child picks `choiceA` or `choiceB` to resolve the tale. */
export type Story = { pre: string[]; problem: string; choiceA: Branch; choiceB: Branch };

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function buildStory(h: Choice, p: Choice, o: Choice, m: Choice): Story {
  const opening = pick([
    `Once upon a time, a ${m.name} ${h.name} ${h.emoji} lived near a ${p.name} ${p.emoji}.`,
    `Long ago, in a faraway ${p.name} ${p.emoji}, there lived a ${m.name} little ${h.name} ${h.emoji}.`,
    `Every morning, a ${m.name} ${h.name} ${h.emoji} woke up right beside a ${p.name} ${p.emoji}.`,
    `In a cozy corner of the ${p.name} ${p.emoji}, a ${m.name} ${h.name} ${h.emoji} was just waking up.`,
    `There once was a ${m.name} ${h.name} ${h.emoji} who loved the ${p.name} ${p.emoji} more than anywhere else.`,
    `Far past the clouds, a ${m.name} ${h.name} ${h.emoji} made a home by a ${p.name} ${p.emoji}.`,
  ]);
  const discovery = pick([
    `One sunny day, the ${h.name} found a ${o.name} ${o.emoji} hidden in the tall grass!`,
    `While exploring the ${p.name}, the ${h.name} ${h.emoji} spotted a ${o.name} ${o.emoji}!`,
    `Then, with a twinkle, a ${o.name} ${o.emoji} appeared right in front of the ${h.name}!`,
    `As the ${h.name} ${h.emoji} skipped along, a shiny ${o.name} ${o.emoji} caught the light!`,
    `Tucked under an old tree, the ${h.name} ${h.emoji} discovered a ${o.name} ${o.emoji}.`,
    `What's this? The ${h.name} ${h.emoji} had never seen a ${o.name} ${o.emoji} quite like it before.`,
  ]);
  const journey = pick([
    `The ${m.name} ${h.name} ${h.emoji} tucked the ${o.name} ${o.emoji} away and set off deep into the ${p.name} ${p.emoji}.`,
    `Step by step, the ${h.name} ${h.emoji} wandered further into the ${p.name} ${p.emoji}, the ${o.name} ${o.emoji} glowing softly.`,
    `Full of wonder, the ${h.name} ${h.emoji} explored every winding corner of the ${p.name} ${p.emoji}.`,
    `Holding the ${o.name} ${o.emoji} close, the ${h.name} ${h.emoji} marched bravely on through the ${p.name} ${p.emoji}.`,
    `The ${o.name} ${o.emoji} seemed to point the way, so the ${h.name} ${h.emoji} followed it across the ${p.name} ${p.emoji}.`,
    `Humming a happy tune, the ${m.name} ${h.name} ${h.emoji} skipped deeper into the ${p.name} ${p.emoji}.`,
  ]);
  const trouble = pick([
    `But then — uh oh! A grumpy troll stomped across the ${p.name} ${p.emoji} and blocked the way.`,
    `Suddenly a big storm cloud rolled over the ${p.name} ${p.emoji}, and everything went dark.`,
    `Just then, a tiny lost cub began to cry at the edge of the ${p.name} ${p.emoji}.`,
    `Oh no! A wobbly old bridge over the ${p.name} ${p.emoji} began to creak and sway.`,
    `All at once, a thick fog rolled across the ${p.name} ${p.emoji} and hid the path.`,
    `Then a sleepy giant snored so loudly that the whole ${p.name} ${p.emoji} shook!`,
  ]);
  const problem = `${trouble}\nWhat should the ${m.name} ${h.name} ${h.emoji} do?`;

  const celebration = [
    `Everyone cheered for the ${h.name} ${h.emoji}! The ${p.name} ${p.emoji} sparkled brighter than ever. ✨`,
    `What a day! The ${h.name} ${h.emoji} laughed and danced with all the new friends. 🎶`,
    `The ${o.name} ${o.emoji} hummed a happy tune, and the whole ${p.name} ${p.emoji} joined in. 🎵`,
    `Hooray! The ${h.name} ${h.emoji} jumped for joy as the ${p.name} ${p.emoji} filled with giggles. 😄`,
    `Confetti swirled through the ${p.name} ${p.emoji} as everyone thanked the ${h.name} ${h.emoji}. 🎊`,
    `The ${o.name} ${o.emoji} glittered happily, and the ${p.name} ${p.emoji} felt warm and bright. 🌟`,
  ];
  const ending = [
    `With a happy heart, the ${m.name} ${h.name} ${h.emoji} shared the magic with every friend. The End! 🎉`,
    `And so the ${h.name} ${h.emoji} and all the friends celebrated together. The End! 🎉`,
    `From that day on, the ${p.name} ${p.emoji} was the happiest place of all. The End! 🎉`,
    `And the ${m.name} ${h.name} ${h.emoji} went home with the best story to tell. The End! 🎉`,
    `Tucked in that night, the ${h.name} ${h.emoji} smiled, dreaming of new adventures. The End! 🌙`,
    `Forever after, the ${h.name} ${h.emoji} and the ${p.name} ${p.emoji} were the best of friends. The End! 🎉`,
  ];

  // Branch A — be clever and use the magic item.
  const choiceA: Branch = {
    emoji: o.emoji,
    label: `Use the ${o.name}`,
    pages: [
      pick([
        `The ${h.name} ${h.emoji} held up the ${o.name} ${o.emoji}. With a bright flash of magic, the trouble melted away! ✨`,
        `Quick as a wink, the ${h.name} ${h.emoji} waved the ${o.name} ${o.emoji} — and poof! the problem was gone. ✨`,
        `The clever ${h.name} ${h.emoji} pointed the ${o.name} ${o.emoji} just right, and everything turned out perfectly! ✨`,
      ]),
      pick(celebration),
      pick(ending),
    ],
  };
  // Branch B — be kind and call friends for help.
  const choiceB: Branch = {
    emoji: "🤝",
    label: "Call for friends",
    pages: [
      pick([
        `The ${h.name} ${h.emoji} called out for help. Friends came running, and together they fixed everything in no time! 🤝`,
        `The ${h.name} ${h.emoji} whistled, and kind friends arrived to lend a hand. Together, they sorted it out! 🤝`,
        `With a big friendly shout, the ${h.name} ${h.emoji} gathered everyone, and as a team they made it all okay! 🤝`,
      ]),
      pick(celebration),
      pick(ending),
    ],
  };

  return { pre: [opening, discovery, journey], problem, choiceA, choiceB };
}
