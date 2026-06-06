import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { categories, posts } from "../src/db/schema";
import { slugify } from "../src/lib/slugify";

const CATS = [
  { name: "LMS & TMS", description: "Learning & Training Management systems, WSQ, TPG, SkillsFuture" },
  { name: "AI & Automation", description: "AI agents, Copilot, MCP, RAG, agentic workflows" },
  { name: "Compliance & Audit", description: "TPQA, TRAQOM, OpenCerts, audit-ready training" },
  { name: "Training Guides", description: "Top training providers and curated lists in Singapore" },
  { name: "EdTech Trends", description: "Generative AI in education, future of learning" },
];

const ASSIGN: Record<string, string[]> = {
  "LMS & TMS": [
    "Why Skills Mapping Is Becoming Essential for Training Providers in 2025",
    "Beyond LMS: Building Audit-Ready Systems for WSQ and TPQA Success",
    "The Role of Training Centres in Singapore’s SkillsFuture Ecosystem",
    "Why WSQ Providers Need a TPQA-Compliant, TPG-Integrated Training Management System",
  ],
  "AI & Automation": [
    "Transform Work Processes with Agentic AI",
    "Improve AI Chatbots with Retrieval Augmented Generation (RAG)",
    "Improve Workplace Productivity with Microsoft Copilot 365",
    "Improve HR Processes with Microsoft Copilot Agents",
    "How Will MCP Server Enhance AI Agent Capability?",
  ],
  "Compliance & Audit": [
    "How Training Providers Can Automate TPQA Compliance in 2025",
    "Eliminate TRAQOM Chaos: Automate Compliance with a Cloud-Based Feedback Dashboard",
    "Go Beyond PDFs: Deploy Blockchain-Verified OpenCerts for WSQ Compliance and Learner Trust",
    "How to Be a TPQA Compliant Training Provider",
  ],
  "Training Guides": [
    "Top 10 Best Adult Training Centers in Singapore",
    "Top 10 Best Digital Marketing Trainings in Singapore",
    "Top 10 Best IT Trainings in Singapore",
    "Top 10 Best AI Trainings in Singapore",
    "Top 10 Best Finance Trainings in Singapore",
    "Top 10 Best Blockchain Trainings in Singapore",
    "Top 10 Best Sustainability Trainings in Singapore",
    "Top 10 Best eCommerce Trainings in Singapore",
    "Top 10 Best Autodesk Trainings in Singapore",
    "Top 10 Best AWS Trainings in Singapore",
  ],
  "EdTech Trends": [
    "Beyond Traditional LMS: How AI and Ed Tech Are Redefining Adult Learning",
    "The Impact of Generative AI on Education",
  ],
};

async function main() {
  for (const c of CATS) {
    await db
      .insert(categories)
      .values({ name: c.name, slug: slugify(c.name), description: c.description })
      .onConflictDoNothing();
  }
  const all = await db.select().from(categories);
  const byName = new Map(all.map((c) => [c.name, c.id]));
  console.log("Categories:", all.map((c) => `${c.id}=${c.name}`).join(", "));

  let assigned = 0;
  for (const [catName, titles] of Object.entries(ASSIGN)) {
    const catId = byName.get(catName);
    if (!catId) {
      console.warn(`Missing category: ${catName}`);
      continue;
    }
    const res = await db
      .update(posts)
      .set({ categoryId: catId })
      .where(inArray(posts.title, titles))
      .returning({ id: posts.id });
    assigned += res.length;
    console.log(`  ${catName}: ${res.length} posts → ${titles.length} expected`);
  }
  console.log(`Assigned ${assigned} posts to categories.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
