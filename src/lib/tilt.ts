/**
 * Deterministic tilt for a magazine on the rack. The same key always yields the
 * same angle, so layouts are stable between builds and never shift on deploy.
 */
export function tiltFor(key: string, maxDegrees = 1.6): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const unit = (hash >>> 0) / 0xffffffff;
  return Math.round((unit * 2 - 1) * maxDegrees * 10) / 10;
}
