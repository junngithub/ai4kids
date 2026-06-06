/**
 * Admin file upload — pushes content to Cloudflare R2. Content uploads NEVER
 * touch the VPS disk: if R2 isn't configured we return 503 rather than
 * silently spilling to /public/uploads. The one exception is `?as-logo=1`,
 * which also writes the same bytes to /public/{icon,apple-icon,favicon}
 * because Next.js auto-serves those filenames as the site's favicons.
 */
import { NextResponse } from "next/server";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { isAdminRequest } from "@/lib/admin-guard";
import { db } from "@/db";
import { media } from "@/db/schema";
import { getR2Config, uploadToR2 } from "@/lib/r2";

const PUBLIC_DIR = path.join(process.cwd(), "public");

export async function POST(req: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const asLogo = url.searchParams.get("as-logo") === "1";

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const r2 = await getR2Config();
  if (!r2) {
    return NextResponse.json(
      {
        error:
          "Cloudflare R2 not configured. Set R2 credentials in Admin → Settings → Credentials before uploading — uploads do not save to the VPS disk.",
      },
      { status: 503 },
    );
  }

  const ext = path.extname(file.name) || "";
  const base = path.basename(file.name, ext).replace(/[^a-z0-9-_]/gi, "-");
  const filename = `${Date.now()}-${base}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const key = `uploads/${filename}`;
  const publicPath = await uploadToR2(r2, key, buffer, file.type);

  // Favicons are special: Next.js auto-serves /icon.png, /apple-icon.png,
  // and /favicon.ico from the public directory. Mirror the bytes there so
  // a logo update actually changes the browser-tab icon.
  if (asLogo) {
    try {
      await writeFile(path.join(PUBLIC_DIR, "icon.png"), buffer);
      await writeFile(path.join(PUBLIC_DIR, "apple-icon.png"), buffer);
      await writeFile(path.join(PUBLIC_DIR, "favicon.ico"), buffer);
    } catch (e) {
      console.error("[upload as-logo] favicon mirror failed", e);
    }
  }

  const [row] = await db
    .insert(media)
    .values({
      filename,
      path: publicPath,
      mime: file.type,
      sizeBytes: buffer.byteLength,
      uploadedById: null,
    })
    .returning();

  return NextResponse.json({ ok: true, media: row });
}
