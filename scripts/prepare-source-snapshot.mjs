import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const snapshotName = `${pkg.name}-${pkg.version}`
const outputRoot = join(root, 'release', 'source')
const snapshotDir = join(outputRoot, snapshotName)
const archivePath = join(outputRoot, `${snapshotName}.tar.gz`)

if (existsSync(snapshotDir) || existsSync(archivePath)) {
  throw new Error(`Refusing to overwrite an existing source snapshot: ${snapshotName}`)
}

const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
}).split('\0').filter(Boolean).sort()

if (!files.length) throw new Error('No source files found')
mkdirSync(snapshotDir, { recursive: true, mode: 0o755 })

const manifest = []
for (const relative of files) {
  const source = join(root, relative)
  if (!existsSync(source)) continue
  const info = lstatSync(source)
  if (info.isSymbolicLink()) throw new Error(`Refusing to snapshot symlink: ${relative}`)
  if (!info.isFile()) continue
  const destination = join(snapshotDir, relative)
  mkdirSync(dirname(destination), { recursive: true, mode: 0o755 })
  copyFileSync(source, destination)
  const digest = createHash('sha256').update(readFileSync(source)).digest('hex')
  manifest.push(`${digest}  ${relative}`)
}

writeFileSync(join(snapshotDir, 'SOURCE_SHA256SUMS'), `${manifest.join('\n')}\n`, { mode: 0o644 })
const tar = spawnSync('tar', ['-czf', archivePath, '-C', outputRoot, snapshotName], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, COPYFILE_DISABLE: '1' },
})
if (tar.status !== 0) throw new Error(`tar failed: ${tar.stderr || tar.stdout}`)

// macOS tar otherwise adds AppleDouble metadata absent from the source manifest.
const entries = execFileSync('tar', ['-tzf', archivePath], { encoding: 'utf8' })
  .trim().split('\n').filter(name => !name.endsWith('/')).sort()
const expected = [...manifest.map(line => `${snapshotName}/${line.slice(66)}`),
  `${snapshotName}/SOURCE_SHA256SUMS`].sort()
if (JSON.stringify(entries) !== JSON.stringify(expected)) {
  throw new Error('Archive entries differ from the source manifest; do not distribute this archive')
}

const archiveDigest = createHash('sha256').update(readFileSync(archivePath)).digest('hex')
writeFileSync(`${archivePath}.sha256`, `${archiveDigest}  ${snapshotName}.tar.gz\n`, { mode: 0o644 })
console.log(JSON.stringify({ snapshotDir, archivePath, files: manifest.length, sha256: archiveDigest }, null, 2))
