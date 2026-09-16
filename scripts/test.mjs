import { spawnSync } from 'node:child_process'
import { readdirSync, rmSync } from 'node:fs'

rmSync('.test-dist', { recursive: true, force: true })
for (const args of [
  ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.test.json'],
  ['--test', ...readdirSync('tests').filter(name => name.endsWith('.test.mjs')).map(name => `tests/${name}`)],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' })
  if (result.error || result.status !== 0) process.exit(result.status || 1)
}
