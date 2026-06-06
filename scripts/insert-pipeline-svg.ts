import { db } from '../src/db';
import { posts } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'fs';

async function main() {
  const svg = readFileSync('/tmp/pipeline.html', 'utf-8').trim();
  const [row] = await db.select().from(posts).where(eq(posts.id, 66));
  if (!row) throw new Error('not found');
  const marker = '<h3>1. Auto-search for ideas</h3>';
  if (!row.contentHtml || !row.contentHtml.includes(marker)) throw new Error('marker missing');
  if (row.contentHtml.includes('DAILY AUTONOMOUS VIDEO PIPELINE')) { console.log('already inserted'); return; }
  const newHtml = row.contentHtml.replace(marker, `${svg}\n\n${marker}`);
  await db.update(posts).set({ contentHtml: newHtml, updatedAt: new Date() }).where(eq(posts.id, 66));
  console.log('updated, new length', newHtml.length);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
