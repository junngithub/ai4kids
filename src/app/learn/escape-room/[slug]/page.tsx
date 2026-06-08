import { notFound } from "next/navigation";
import { getEscapeRoom } from "@/lib/escape-rooms";
import { EscapeRoomPlayer } from "./EscapeRoomPlayer";

export default async function EscapeRoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const room = getEscapeRoom(slug);
  if (!room) notFound();

  return <EscapeRoomPlayer room={room} />;
}
