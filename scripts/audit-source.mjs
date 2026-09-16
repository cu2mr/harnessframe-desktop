import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, statSync } from 'node:fs'

// Heuristic review aid: never prints matched contents or credential values.
const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/],
  ['cloud-access-key', /\bAKIA[A-Z0-9]{16}\b/],
  ['internal-address', /(?:internal\.[A-Za-z0-9.-]+|hzonetech\.(?:cn|com)|homeszone\.cn)/i],
  ['personal-path', /\/(?:Users|home)\/[A-Za-z0-9_-]+\//],
]
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const findings = []
let scanned = 0
function scan(label, buffer) {
  scanned++
  if (buffer.length > 1024 * 1024) findings.push({ file: label, rule: 'large-file-review' })
  if (buffer.includes(0)) return
  const text = buffer.toString('utf8')
  for (const [rule, pattern] of rules) if (pattern.test(text)) findings.push({ file: label, rule })
}
if (process.argv.includes('--history')) {
  const entries = git(['rev-list', '--objects', '--all']).trim().split('\n').map(line => {
    const space = line.indexOf(' ')
    return { id: space < 0 ? line : line.slice(0, space), name: space < 0 ? '' : line.slice(space + 1) }
  })
  const labels = new Map(entries.map(item => [item.id, item.name]))
  const metadata = execFileSync('git', ['cat-file', '--batch-check'], { input: entries.map(item => item.id).join('\n'), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  const blobs = []
  for (const line of metadata.trim().split('\n')) {
    const [id, type, sizeText] = line.split(' ')
    if (type !== 'blob') continue
    const label = `${id.slice(0, 12)}:${labels.get(id)}`
    if (Number(sizeText) > 1024 * 1024) { scanned++; findings.push({ file: label, rule: 'large-file-review' }); continue }
    blobs.push(id)
  }
  for (let offset = 0; offset < blobs.length; offset += 100) {
    const output = execFileSync('git', ['cat-file', '--batch'], { input: blobs.slice(offset, offset + 100).join('\n') + '\n', maxBuffer: 128 * 1024 * 1024 })
    let cursor = 0
    while (cursor < output.length) {
      const end = output.indexOf(10, cursor)
      const [id, , sizeText] = output.subarray(cursor, end).toString().split(' ')
      const size = Number(sizeText)
      scan(`${id.slice(0, 12)}:${labels.get(id)}`, output.subarray(end + 1, end + 1 + size))
      cursor = end + 2 + size
    }
  }
} else {
  const files = new Set(git(['ls-files', '-co', '--exclude-standard', '-z']).split('\0').filter(Boolean))
  // This ignored file is intentionally consumed by package:remote, so audit it when present.
  if (existsSync('bundled-config.json')) files.add('bundled-config.json')
  for (const file of files) {
    if (existsSync(file) && statSync(file).isFile()) scan(file, readFileSync(file))
  }
}
console.log(JSON.stringify({ scope: process.argv.includes('--history') ? 'all local Git refs' : 'working tree', scanned, findings, limitation: 'Heuristic scan; manual provenance and secret review remain required.' }, null, 2))
if (findings.length) process.exitCode = 1
