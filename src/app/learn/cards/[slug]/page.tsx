import { notFound } from "next/navigation";
import { getCardGame } from "@/lib/card-games/meta";
import { CardGamePlayer } from "./CardGamePlayer";

export default async function CardGamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = getCardGame(slug);
  if (!game) notFound();

  return <CardGamePlayer game={game} />;
}
