/**
 * Maps a game slug to its engine. Server-only (pulls in all three engines).
 * The session layer dispatches every game through this — see card-session.ts.
 */
import { GameEngine } from "./engine";
import { memory } from "./memory";
import { discard } from "./discard";
import { math } from "./math";
import { beatdie } from "./beatdie";

// The engines are typed over different state shapes; the session layer treats
// state as opaque jsonb, so an `unknown`-stated view is the honest contract.
export const ENGINES: Record<string, GameEngine<unknown>> = {
  "memory-match": memory as unknown as GameEngine<unknown>,
  "tower-tumble": discard as unknown as GameEngine<unknown>,
  "number-hunt": math as unknown as GameEngine<unknown>,
  "beat-the-die": beatdie as unknown as GameEngine<unknown>,
};

export function getEngine(slug: string): GameEngine<unknown> | undefined {
  return ENGINES[slug];
}
