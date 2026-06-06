import { db } from "@/db";
import { media } from "@/db/schema";
import { desc } from "drizzle-orm";
import { MediaUploader } from "@/components/admin/MediaUploader";

export default async function MediaAdmin() {
  const list = await db.select().from(media).orderBy(desc(media.uploadedAt));
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Media</h1>
      <MediaUploader />
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {list.map((m) => (
          <a
            key={m.id}
            href={m.path}
            target="_blank"
            rel="noopener noreferrer"
            className="glass rounded-lg overflow-hidden block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.path} alt={m.alt ?? m.filename} className="w-full h-32 object-cover" />
            <div className="p-2 text-xs text-white/70 truncate">{m.filename}</div>
          </a>
        ))}
        {list.length === 0 && (
          <p className="text-white/50 col-span-full">No media uploaded yet.</p>
        )}
      </div>
    </div>
  );
}
