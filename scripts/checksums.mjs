import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
const files = readdirSync('release').filter(name => /\.(dmg|zip|exe|blockmap)$/.test(name)).sort()
if (!files.length) throw new Error('No release artifacts')
writeFileSync(`release/SHA256SUMS-${process.platform}.txt`, files.map(name => `${createHash('sha256').update(readFileSync(`release/${name}`)).digest('hex')}  ${name}`).join('\n') + '\n')
