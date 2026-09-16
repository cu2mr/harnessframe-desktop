export function repositoryName(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value) ? value : undefined
}

/** Compare numeric versions and SemVer prerelease identifiers, ignoring build metadata. */
export function newerVersion(candidate: string, current: string): boolean {
  const parse = (value: string) => /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\w.-]+))?(?:\+[\w.-]+)?$/.exec(value)
  const a = parse(candidate), b = parse(current)
  if (!a || !b) return false
  for (let i = 1; i <= 3; i++) {
    if (BigInt(a[i]) !== BigInt(b[i])) return BigInt(a[i]) > BigInt(b[i])
  }
  if (!a[4] || !b[4]) return !a[4] && !!b[4]
  const ap = a[4].split('.'), bp = b[4].split('.')
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    if (ap[i] === undefined) return false
    if (bp[i] === undefined) return true
    if (ap[i] === bp[i]) continue
    const an = /^\d+$/.test(ap[i]), bn = /^\d+$/.test(bp[i])
    if (an && bn) return BigInt(ap[i]) > BigInt(bp[i])
    if (an !== bn) return !an
    return ap[i] > bp[i]
  }
  return false
}
