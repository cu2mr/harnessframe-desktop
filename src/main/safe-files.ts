import { lstatSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from 'node:fs'
import { resolve, relative, dirname, parse, join } from 'node:path'
import { randomUUID } from 'node:crypto'

/** Reject traversal and symlinks before creating or overwriting imported files. */
export function safeTarget(root: string, path: string): string {
  const target = resolve(root, path)
  const rel = relative(resolve(root), target)
  if (!rel || rel.startsWith('..') || parse(rel).root) throw new Error('Import path escapes its root')
  let current = parse(target).root
  for (const component of target.slice(current.length).split(/[\\/]/)) {
    current = join(current, component)
    try {
      if (lstatSync(current).isSymbolicLink()) throw new Error('Symbolic links are not allowed in import targets')
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  return target
}

export function writeImportFiles(root: string, files: Map<string, string>): { backup: string; rollback: () => void } {
  // Validate every path before the first write.
  for (const path of files.keys()) safeTarget(root, path)
  const backup = `.desktop-backups/${Date.now()}-${randomUUID()}`
  const original = new Map<string, Buffer | undefined>()
  const rollback = () => {
    for (const [path, content] of original) {
      const target = safeTarget(root, path)
      if (content) writeFileSync(target, content, { mode: 0o600 })
      else if (existsSync(target)) unlinkSync(target)
    }
  }
  try {
    for (const [path, content] of files) {
      const target = safeTarget(root, path)
      const old = existsSync(target) ? readFileSync(target) : undefined
      original.set(path, old)
      if (old) {
        const destination = safeTarget(root, `${backup}/${path}`)
        mkdirSync(dirname(destination), { recursive: true, mode: 0o700 })
        writeFileSync(destination, old, { mode: 0o600, flag: 'wx' })
      }
      mkdirSync(dirname(target), { recursive: true, mode: 0o700 })
      const temporary = `${target}.${randomUUID()}.tmp`
      try {
        writeFileSync(temporary, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
        renameSync(temporary, target)
      } finally {
        if (existsSync(temporary)) unlinkSync(temporary)
      }
    }
    return { backup, rollback }
  } catch (error) {
    rollback()
    throw error
  }
}
