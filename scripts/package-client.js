#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import spawn from 'cross-spawn'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2).filter(arg => arg !== '--')
const option = name => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
const target = option('target') || (process.platform === 'darwin' ? 'mac' : 'win')
if (!['mac', 'win', 'all'].includes(target)) throw new Error('Expected --target=mac|win|all')
if (args.some(arg => !/^--(?:url|target)=/.test(arg))) throw new Error('Unknown packaging option')
const url = new URL(option('url') || process.env.DSH_DEFAULT_SERVER_URL || 'http://127.0.0.1:8080')
if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('Remote servers require HTTPS')
if (url.username || url.password || url.search || url.hash) throw new Error('Bundled URLs must not contain credentials, queries or fragments')
const path = join(root, 'bundled-config.json')
const previous = existsSync(path) ? readFileSync(path) : undefined
const run = commandArgs => {
  const result = spawn.sync('pnpm', commandArgs, { cwd: root, stdio: 'inherit', shell: false })
  if (result.error || result.status !== 0) throw new Error(`Packaging command failed (${result.status ?? result.error?.code})`)
}
try {
  writeFileSync(path, JSON.stringify({ mode: 'remote', remoteUrl: url.href, autoStartServer: false,
    activeWorkspaceId: 'ws-remote', workspaces: [{ id: 'ws-remote', name: 'Harness Server', mode: 'remote', remoteUrl: url.href }] }, null, 2), { mode: 0o600 })
  run(['run', 'build'])
  run(['exec', 'electron-builder', ...(target === 'all' ? ['-mw'] : [`--${target}`]), '--publish', 'never'])
} finally {
  if (previous) writeFileSync(path, previous)
  else if (existsSync(path)) unlinkSync(path)
}
