// Run with Electron: tests/harness-desktop-smoke.cjs /path/to/built-harness /path/to/node
const { app, webContents } = require('electron')
const assert = require('node:assert/strict')
const { mkdtempSync, mkdirSync, existsSync } = require('node:fs')
const { join, resolve } = require('node:path')
const { tmpdir } = require('node:os')
const { pathToFileURL } = require('node:url')
const { createServer } = require('node:net')
const harnessPath = resolve(process.argv[2] || '')
const nodePath = process.argv[3]
assert.ok(nodePath && existsSync(nodePath) && existsSync(join(harnessPath, 'apps/cli/lib/bin.js')), 'Pass a built checkout and Node executable')
assert.equal(existsSync(join(harnessPath, '.env')), false, 'Use a checkout without a project .env for isolated acceptance')
for (const key of Object.keys(process.env)) if (/^(DSH_|DEEPSEEK_)|KEY|SECRET|TOKEN|PASSWORD/i.test(key)) delete process.env[key]
const root = mkdtempSync(join(tmpdir(), 'harness-electron-'))
process.env.DSH_HOME = join(root, '.dsh')
process.env.DSH_AGENTS_HOME = join(root, '.agents')
process.env.DSH_TELEMETRY_DISABLED = '1'
mkdirSync(join(root, 'desktop'))
app.setPath('userData', join(root, 'desktop'))
let win, finishing = false
const timeout = setTimeout(() => finish(Error('Real Harness desktop smoke timed out')), 60000)
async function finish(error) {
  if (finishing) return
  finishing = true
  clearTimeout(timeout)
  try {
    if (win && !win.isDestroyed()) {
      const stopped = await win.webContents.executeJavaScript('window.dshDesktop.stopServer()')
      assert.equal(stopped.success, true)
    }
  } catch (cleanupError) { error ||= cleanupError }
  if (error) console.error(error)
  app.exit(error ? 1 : 0)
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function waitFor(fn) {
  const end = Date.now() + 35000
  while (Date.now() < end) { const value = await fn(); if (value) return value; await delay(100) }
  throw Error('Desktop state did not settle')
}
app.once('browser-window-created', (_event, window) => {
  win = window
  win.once('ready-to-show', () => win.hide())
  win.webContents.once('did-finish-load', async () => {
    try {
      await win.webContents.executeJavaScript(`window.dshDesktop.saveSettings(${JSON.stringify({ mode: 'managed', harnessPath, nodePath, managedPort: port })})`)
      assert.equal((await win.webContents.executeJavaScript('window.dshDesktop.startServer()')).success, true)
      const status = await waitFor(async () => {
        const s = await win.webContents.executeJavaScript('window.dshDesktop.getServerStatus()')
        if (s.state === 'error') throw Error(s.error)
        return s.state === 'running' ? s : null
      })
      const origin = new URL(status.url).origin
      const guest = await waitFor(async () => webContents.getAllWebContents().find(c => c !== win.webContents && c.getURL().startsWith(origin) && !c.isLoading()))
      const result = await guest.executeJavaScript(`(async () => {
        const response = await fetch('/api/settings/describe', {method:'POST', headers:{'content-type':'application/json'},
          body:JSON.stringify({type:'client-request',rpcId:'electron-acceptance',method:'settings/describe',payload:{args:{}}})});
        return {status:response.status, body:await response.json(), bridge:typeof window.dshDesktop, node:typeof require};
      })()`)
      assert.equal(result.status, 200)
      assert.equal(result.body.result.ok, true)
      assert.equal(result.bridge, 'undefined')
      assert.equal(result.node, 'undefined')
      const beforePid = status.pid
      const stopped = await win.webContents.executeJavaScript('window.dshDesktop.stopServer()')
      assert.equal(stopped.success, true)
      assert.throws(() => process.kill(beforePid, 0), {code:'ESRCH'})
      console.log(JSON.stringify({result:'passed', checks:['real Harness managed startup through desktop IPC', 'guest token exchange and authenticated API', 'guest has no desktop bridge or Node access', 'desktop stop reaps real Harness process']}))
      await finish()
    } catch (error) { await finish(error) }
  })
})
let port
const reservation = createServer()
reservation.on('error', finish)
reservation.listen(0, '127.0.0.1', () => {
  port = reservation.address().port
  reservation.close(() => {
    import(pathToFileURL(join(process.cwd(), 'dist/main/index.js')).href).catch(finish)
  })
})
