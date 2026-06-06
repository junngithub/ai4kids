/**
 * Render the branded cover image for a blog post and upload it to R2. The
 * SVG renderer lives in src/lib/post-cover.ts so the same code is used by
 * both this route and scripts/regenerate-post-covers.ts.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-guard";
import { getR2Config } from "@/lib/r2";
import { renderAndUploadCover } from "@/lib/post-cover";

const schema = z.object({
  query: z.string().min(1).max(300),
  slug: z.string().min(1).max(200).optional(),
  kicker: z.string().max(60).optional(),
});

export async function POST(req: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const r2 = await getR2Config();
  if (!r2) {
    return NextResponse.json(
      {
        error:
          "Cloudflare R2 not configured. Set R2 credentials in Admin → Settings → Credentials.",
      },
      { status: 400 },
    );
  }
  try {
    const { url, bytes } = await renderAndUploadCover(
      r2,
      parsed.data.query,
      parsed.data.slug ?? parsed.data.query,
      parsed.data.kicker,
    );
    return NextResponse.json({ ok: true, url, bytes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
