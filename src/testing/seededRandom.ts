/**
 * Make Math.random repeatable inside a test, so games that shuffle and deal
 * play out the same way every run.
 *
 * Why: strategic bots playing only each other can occasionally cycle cards
 * forever late in a game (draw pile empty, nobody willing to burn). Tests
 * that play whole bot-only games would then fail at random. A fixed seed
 * keeps those tests deterministic.
 */
export function seedRandom(seed: number): () => void {
  const original = Math.random;
  let a = seed >>> 0;
  Math.random = () => {
    // mulberry32
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => {
    Math.random = original;
  };
}
