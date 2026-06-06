import { db } from "../src/db";
import { posts } from "../src/db/schema";
import { eq } from "drizzle-orm";

const PRODUCT = "https://claude.com/product/claude-code";
const COURSE = "/claude-code-skills-package";

function linkMark(href: string) {
  const ext = href.startsWith("http");
  return {
    type: "link",
    attrs: {
      href,
      target: ext ? "_blank" : null,
      rel: ext ? "noopener noreferrer nofollow" : null,
      class: null,
    },
  };
}

function linkifyInParagraph(para: any, phrase: string, href: string): boolean {
  const out: any[] = [];
  let done = false;
  for (const n of para.content || []) {
    if (done || n.type !== "text" || !n.text.includes(phrase)) {
      out.push(n);
      continue;
    }
    const i = n.text.indexOf(phrase);
    const before = n.text.slice(0, i);
    const after = n.text.slice(i + phrase.length);
    const baseMarks = (n.marks || []).filter((m: any) => m.type !== "link");
    if (before) out.push({ ...n, text: before });
    out.push({ type: "text", text: phrase, marks: [...baseMarks, linkMark(href)] });
    if (after) out.push({ ...n, text: after });
    done = true;
  }
  para.content = out;
  return done;
}

function linkifyDeep(node: any, phrase: string, href: string): boolean {
  if (
    node.type === "paragraph" &&
    (node.content || []).some((c: any) => c.type === "text" && c.text.includes(phrase))
  ) {
    return linkifyInParagraph(node, phrase, href);
  }
  for (const ch of node.content || []) {
    if (linkifyDeep(ch, phrase, href)) return true;
  }
  return false;
}

(async () => {
  const r = await db.select().from(posts).where(eq(posts.id, 55));
  const doc = r[0].content as any;
  const paras = doc.content;

  const find = (phrase: string, from = 0) => {
    for (let k = from; k < paras.length; k++) {
      const p = paras[k];
      if (
        p.type === "paragraph" &&
        (p.content || []).some((c: any) => c.type === "text" && c.text.includes(phrase))
      )
        return k;
    }
    return -1;
  };

  let i = find("an AI-powered coding assistant");
  console.log("intro", i, linkifyInParagraph(paras[i], "Claude Code", PRODUCT));

  i = find("integrates directly into development environments");
  console.log("desktop", i, linkifyInParagraph(paras[i], "Claude Code desktop app", PRODUCT));

  i = find("updating our developer training programmes");
  console.log("academy", i, linkifyInParagraph(paras[i], "developer training programmes", COURSE));

  const bl = paras.find((p: any) => p.type === "bulletList");
  console.log("bullet", linkifyDeep(bl, "Claude Code", COURSE));

  i = find("customised corporate training programmes");
  console.log("cta", i, linkifyInParagraph(paras[i], "customised corporate training programmes", COURSE));

  await db.update(posts).set({ content: doc, updatedAt: new Date() }).where(eq(posts.id, 55));
  console.log("SAVED");
  process.exit(0);
})();
