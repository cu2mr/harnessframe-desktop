// Explicit opt-in: node tests/harness-integration.mjs /absolute/path/to/built-harness
// Compile test modules first with: node node_modules/typescript/bin/tsc -p tsconfig.test.json
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { createServer } from 'node:net'
import { ServerManager } from '../.test-dist/main/server-manager.js'

if (!process.argv[2]) throw Error('Pass the path of an independently built Harness checkout')
const harnessPath = resolve(process.argv[2])
const root = mkdtempSync(join(tmpdir(), 'harness-integration-'))
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  ['PATH', 'TMPDIR', 'TEMP', 'TMP', 'SystemRoot', 'WINDIR', 'COMSPEC'].includes(key)))
Object.assign(env, { DSH_HOME: join(root, '.dsh'), DSH_AGENTS_HOME: join(root, '.agents'),
  DSH_TELEMETRY_DISABLED: '1', NODE_NO_WARNINGS: '1' })
const checks = []
const children = []
const managers = []
const manager = () => {
  const value = new ServerManager({ spawn: (executable, args, options) => {
    // Isolate project .env and user profiles without changing the external checkout.
    const child = spawn(executable, args, { ...options, cwd: root, env })
    children.push(child)
    return child
  } })
  managers.push(value)
  return value
}
async function freePort() {
  const server = createServer()
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}
async function running(m) {
  const deadline = Date.now() + 35000
  while (m.getStatus().state === 'starting' && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal(m.getStatus().state, 'running', m.getStatus().error || 'Harness did not become ready')
  return m.getStatus().url
}
async function authenticated(url) {
  const target = new URL(url)
  assert.ok(target.searchParams.get('token'), 'Announced URL must contain authentication token')
  const call = cookie => fetch(new URL('/api/settings/describe', url), { method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ type: 'client-request', rpcId: 'desktop-acceptance', method: 'settings/describe', payload: { args: {} } }),
    signal: AbortSignal.timeout(5000) })
  assert.equal((await call()).status, 401)
  const exchange = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5000) })
  assert.equal(exchange.status, 303)
  const cookie = exchange.headers.get('set-cookie')?.split(';')[0]
  assert.ok(cookie, 'Token exchange must return a cookie')
  const response = await call(cookie)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).result.ok, true)
  return cookie
}
let occupied
try {
  const port = await freePort()
  const settings = { mode: 'managed', harnessPath, nodePath: process.execPath, managedPort: port,
    extraArgs: '', remoteUrl: '', autoStartServer: false, launchAtStartup: false, theme: 'dark' }
  const managed = manager()
  assert.equal((await managed.start(settings)).success, true)
  const first = await running(managed)
  await authenticated(first)
  checks.push('managed real CLI startup and authenticated API')
  const attached = manager()
  assert.equal((await attached.start({ ...settings, mode: 'remote', remoteUrl: first })).success, true)
  await authenticated(attached.getStatus().url)
  assert.equal((await attached.stop()).success, true)
  assert.equal(managed.getStatus().state, 'running')
  await authenticated(first)
  checks.push('Attach disconnect preserves independently owned service')
  const oldPid = managed.getStatus().pid
  assert.equal((await managed.restart(settings)).success, true)
  const second = await running(managed)
  await authenticated(second)
  assert.throws(() => process.kill(oldPid, 0), { code: 'ESRCH' })
  checks.push('managed restart reaps old process and authenticates new server')
  const lastPid = managed.getStatus().pid
  assert.equal((await managed.stop()).success, true)
  assert.throws(() => process.kill(lastPid, 0), { code: 'ESRCH' })
  checks.push('managed shutdown reaps owned process')
  // An unrelated listener must survive a failed Harness launch on its occupied port.
  occupied = createServer(socket => socket.end())
  await new Promise((resolve, reject) => { occupied.once('error', reject); occupied.listen(port, '127.0.0.1', resolve) })
  const blocked = manager()
  await blocked.start(settings)
  const deadline = Date.now() + 35000
  while (blocked.getStatus().state === 'starting' && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal(blocked.getStatus().state, 'error')
  assert.equal(occupied.listening, true)
  assert.equal((await blocked.stop()).success, true)
  assert.equal(occupied.listening, true)
  checks.push('occupied-port failure leaves unrelated listener alive')
  const standalone = spawn(process.execPath, [join(harnessPath, 'apps/cli/lib/bin.js'),
    'web', '--no-open', '--port', '0'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
  children.push(standalone)
  let startup = ''
  const standaloneUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Standalone Harness startup timed out')), 35000)
    const append = chunk => {
      startup = (startup + chunk.toString()).slice(-65536)
      const match = startup.match(/dsh web: (http:\/\/[^\s]+)[\r\n]/)
      if (match) { clearTimeout(timer); resolve(match[1]) }
    }
    standalone.stdout.on('data', append)
    standalone.stderr.on('data', append)
    standalone.once('error', error => { clearTimeout(timer); reject(error) })
    standalone.once('close', () => { clearTimeout(timer); reject(Error('Standalone Harness exited during acceptance')) })
  })
  const externalAttach = manager()
  await authenticated(standaloneUrl)
  assert.equal((await externalAttach.start({ ...settings, mode: 'remote', remoteUrl: standaloneUrl })).success, true)
  assert.equal((await externalAttach.stop()).success, true)
  assert.equal(standalone.exitCode, null)
  await authenticated(standaloneUrl)
  const closed = new Promise(resolve => standalone.once('close', resolve))
  standalone.kill('SIGTERM')
  const force = setTimeout(() => standalone.kill('SIGKILL'), 5000)
  await closed
  clearTimeout(force)
  checks.push('standalone dsh web remains authenticated after desktop Attach disconnect')
  const help = execFileSync(process.execPath, [join(harnessPath, 'apps/cli/lib/bin.js'), '--help'],
    { cwd: root, env, encoding: 'utf8', timeout: 15000 })
  assert.match(help, /profile/)
  checks.push('standalone CLI help remains available')
  const commit = execFileSync('git', ['-C', harnessPath, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  console.log(JSON.stringify({ result: 'passed', upstreamCommit: commit, checks }, null, 2))
} finally {
  for (const m of managers) await m.stop()
  for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  if (occupied) await new Promise(resolve => occupied.close(resolve))
  rmSync(root, { recursive: true, force: true })
}
