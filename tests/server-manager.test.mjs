import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ServerManager } from '../.test-dist/main/server-manager.js'

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(predicate, timeout = 2000) {
  const deadline = Date.now() + timeout
  while (!predicate()) {
    if (Date.now() >= deadline) assert.fail('Timed out waiting for lifecycle state')
    await delay(5)
  }
}
function fixture(t, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'harness-lifecycle-'))
  mkdirSync(join(dir, 'apps/cli/lib'), { recursive: true })
  writeFileSync(join(dir, 'apps/cli/lib/bin.js'), '')
  const children = [], signals = [], probes = []
  const close = child => { child.stdout.end(); child.stderr.end(); child.emit('close', 0, null) }
  const manager = new ServerManager({
    startupTimeoutMs: 150, probeIntervalMs: 5, healthIntervalMs: 10,
    requestTimeoutMs: 100, stopTimeoutMs: 30,
    spawn: () => {
      const child = new EventEmitter()
      child.pid = 70000 + children.length
      child.stdout = new PassThrough(); child.stderr = new PassThrough()
      children.push(child)
      return child
    },
    fetch: async url => { probes.push(String(url)); return { status: 200 } },
    kill: (pid, signal, cb) => {
      signals.push(signal); cb(null)
      setImmediate(() => close(children.find(child => child.pid === pid)))
    }, ...options,
  })
  const settings = { mode: 'managed', harnessPath: dir, managedPort: 18080,
    nodePath: process.execPath, remoteUrl: 'http://127.0.0.1:18080/', extraArgs: '',
    autoStartServer: false, launchAtStartup: false, theme: 'dark' }
  t.after(async () => {
    for (const child of children) close(child)
    await manager.stop()
    rmSync(dir, { recursive: true, force: true })
  })
  return { manager, settings, children, signals, probes, close, dir }
}

test('managed URL and token are buffered across chunks and logs redact the complete token', async t => {
  const f = fixture(t)
  await f.manager.start(f.settings)
  const child = f.children[0]
  child.stdout.write('dsh web: http://127.0.')
  child.stdout.write('0.1:18080/?token=split-')
  await delay(15)
  assert.equal(f.manager.getStatus().state, 'starting')
  assert.equal(f.probes.length, 0)
  child.stdout.write('secret\n')
  await until(() => f.manager.getStatus().state === 'running')
  assert.equal(f.manager.getStatus().url, 'http://127.0.0.1:18080/?token=split-secret')
  assert.equal(JSON.stringify(f.manager.getLogs()).includes('split-secret'), false)
  assert.equal(JSON.stringify(f.manager.getLogs()).includes('secret'), false)
})

test('missing announcement times out without probing a guessed port and stops owned process', async t => {
  const f = fixture(t)
  await f.manager.start(f.settings)
  await until(() => f.manager.getStatus().state === 'error')
  assert.match(f.manager.getStatus().error, /timed out/)
  assert.equal(f.manager.getStatus().pid, null)
  assert.equal(f.probes.length, 0)
  assert.deepEqual(f.signals, ['SIGTERM'])
})

test('announced but unreachable service does not become running', async t => {
  const f = fixture(t, { fetch: async () => ({ status: 503 }) })
  const states = []
  f.manager.onStatusChange(s => states.push(s.state))
  await f.manager.start(f.settings)
  f.children[0].stderr.write('dsh web: http://localhost:18080/?token=abc\n')
  await until(() => f.manager.getStatus().state === 'error')
  assert.equal(states.includes('running'), false)
  assert.match(f.manager.getStatus().error, /timed out/)
})

test('HTTP 5xx and transport errors share health failure threshold and recover', async t => {
  let failure = false, networkError = false
  const f = fixture(t, { fetch: async () => {
    if (networkError) throw Error('disconnected')
    return { status: failure ? 503 : 200 }
  } })
  await f.manager.start({ ...f.settings, mode: 'remote' })
  failure = true
  await until(() => f.manager.getStatus().state === 'starting')
  failure = false
  await until(() => f.manager.getStatus().state === 'running')
  assert.equal(f.manager.getStatus().error, null)
  networkError = true
  await until(() => f.manager.getStatus().state === 'starting')
  networkError = false
  await until(() => f.manager.getStatus().state === 'running')
})

test('late health response cannot resurrect a stopped or replaced connection', async t => {
  let complete, calls = 0
  const f = fixture(t, { fetch: async () => {
    if (++calls === 2) return new Promise(resolve => { complete = resolve })
    return { status: 200 }
  } })
  await f.manager.start({ ...f.settings, mode: 'remote' })
  await until(() => complete)
  await f.manager.stop()
  await f.manager.start({ ...f.settings, mode: 'remote', remoteUrl: 'http://localhost:18081/' })
  complete({ status: 503 })
  await delay(20)
  assert.equal(f.manager.getStatus().url, 'http://localhost:18081/')
  assert.equal(f.manager.getStatus().state, 'running')
  assert.equal(f.signals.length, 0)
})

test('stop waits for close, escalates ignored SIGTERM, and restart follows close', async t => {
  let f
  f = fixture(t, { kill: (pid, signal, cb) => {
    f.signals.push(signal); cb(null)
    if (signal === 'SIGKILL') setTimeout(() => f.close(f.children.find(c => c.pid === pid)), 5)
  } })
  await f.manager.start(f.settings)
  const oldChild = f.children[0]
  const restarting = f.manager.restart(f.settings)
  await until(() => f.signals.includes('SIGTERM'))
  assert.equal(f.manager.getStatus().state, 'stopping')
  assert.equal(f.children.length, 1)
  assert.equal((await restarting).success, true)
  assert.deepEqual(f.signals, ['SIGTERM', 'SIGKILL'])
  assert.equal(f.children.length, 2)
  oldChild.emit('close', 0)
  assert.equal(f.manager.getStatus().pid, f.children[1].pid)
  assert.equal(f.manager.getStatus().state, 'starting')
})

test('failed termination keeps process ownership and blocks a replacement', async t => {
  let f
  f = fixture(t, { kill: (pid, signal, cb) => {
    f.signals.push(signal); cb(Error('denied'))
  } })
  await f.manager.start(f.settings)
  const result = await f.manager.restart(f.settings)
  assert.equal(result.success, false)
  assert.match(result.error, /denied/)
  assert.equal(f.children.length, 1)
  assert.equal(f.manager.getStatus().pid, f.children[0].pid)
  assert.equal(f.manager.getStatus().state, 'error')
})

test('stop cancels pending startup probing and old startup timers cannot change new state', async t => {
  let complete, calls = 0
  const f = fixture(t, { fetch: async () => {
    if (++calls === 1) return new Promise(resolve => { complete = resolve })
    return { status: 200 }
  } })
  await f.manager.start(f.settings)
  f.children[0].stdout.write('http://localhost:18080/?token=old\n')
  await until(() => complete)
  await f.manager.stop()
  await f.manager.start({ ...f.settings, mode: 'remote', remoteUrl: 'http://localhost:18081/' })
  complete({ status: 200 })
  await delay(180)
  assert.equal(f.manager.getStatus().state, 'running')
  assert.equal(f.manager.getStatus().url, 'http://localhost:18081/')
})

test('managed startup fails accurately on spawn error or early exit', async t => {
  const f = fixture(t)
  await f.manager.start(f.settings)
  f.children[0].emit('error', Error('spawn failed'))
  f.close(f.children[0])
  assert.equal(f.manager.getStatus().state, 'error')
  assert.match(f.manager.getStatus().error, /spawn failed/)
  await f.manager.start(f.settings)
  f.close(f.children[1])
  assert.equal(f.manager.getStatus().state, 'error')
  assert.match(f.manager.getStatus().error, /exited/)
})

test('real managed child ignoring SIGTERM is killed and reaped before stop succeeds', {
  skip: process.platform === 'win32' ? 'POSIX signal behavior; Windows acceptance is separate' : false,
}, async t => {
  const dir = mkdtempSync(join(tmpdir(), 'harness-process-'))
  mkdirSync(join(dir, 'apps/cli/lib'), { recursive: true })
  writeFileSync(join(dir, 'apps/cli/lib/bin.js'), `
    process.on('SIGTERM', () => {});
    console.log('http://127.0.0.1:18080/?token=fixture');
    setInterval(() => {}, 1000);
  `)
  const manager = new ServerManager({ stopTimeoutMs: 150, probeIntervalMs: 10,
    fetch: async () => ({ status: 200 }), startupTimeoutMs: 3000 })
  t.after(async () => { await manager.stop(); rmSync(dir, { recursive: true, force: true }) })
  await manager.start({ mode: 'managed', harnessPath: dir, nodePath: process.execPath,
    managedPort: 18080, extraArgs: '' })
  await until(() => manager.getStatus().state === 'running')
  const pid = manager.getStatus().pid
  assert.equal((await manager.stop()).success, true)
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' })
  assert.equal(manager.getStatus().pid, null)
})
