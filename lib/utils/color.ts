/** Deterministic seed → 6-digit hex color. Used to give entities without an
 *  explicit color a stable, distinct fallback. (Named "random" historically; it
 *  is deterministic per seed.) */
export function randomColor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) & 0xffffff;
  }
  return `#${hash.toString(16).padStart(6, "0")}`;
}
