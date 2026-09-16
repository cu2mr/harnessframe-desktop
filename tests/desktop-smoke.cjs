const { app, BrowserWindow } = require('electron')
const { mkdtempSync, realpathSync, readFileSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')
const { createServer } = require('node:http')
const assert = require('node:assert/strict')
const userData = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-smoke-')))
app.setPath('userData', userData)
const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html' })
  response.end('<!doctype html><title>Harness test service</title>')
})
const expectedRepository = 'cu2mr/harnessframe-desktop'
const originalFetch = globalThis.fetch
let updateRequests = 0
globalThis.fetch = async (input, options) => {
  if (String(input).startsWith('https://api.github.com/')) {
    assert.equal(String(input), `https://api.github.com/repos/${expectedRepository}/releases?per_page=20`)
    updateRequests++
    // No network dependency: exercise the configured-repository/no-release case.
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return originalFetch(input, options)
}
let targetUrl
const timeout = setTimeout(() => { console.error('Desktop smoke timed out'); app.exit(1) }, 20000)
app.once('browser-window-created', (_event, win) => {
  win.once('ready-to-show', () => win.hide())
  win.webContents.once('did-finish-load', async () => {
    try {
      const result = await win.webContents.executeJavaScript(`(async () => {
        const api = window.dshDesktop;
        const settings = await api.getSettings();
        const version = await api.checkForUpdates();
        const sso = await api.loginSSO('feishu');
        await api.saveSettings({remoteUrl: ${JSON.stringify(targetUrl)}});
        const started = await api.startServer();
        const status = await api.getServerStatus();
        await api.stopServer();
        await api.saveWorkspace({id: 'second', name: 'Second', mode: 'remote', remoteUrl: 'http://127.0.0.1:9'});
        await api.switchWorkspace('second');
        const switched = await api.getServerStatus();
        await api.saveSettings({mode: 'remote', remoteUrl: 'http://127.0.0.1:9'});
        const unreachable = await api.startServer();
        return {settings, version, sso, started, status, switched, unreachable, hasRoot: !!document.querySelector('#root')?.children.length};
      })()`)
      assert.equal(result.settings.mode, 'remote')
      assert.equal(result.settings.autoStartServer, false)
      assert.equal(result.version.status, 'error')
      assert.equal(result.version.hasUpdate, false)
      assert.equal(result.version.releaseUrl, `https://github.com/${expectedRepository}/releases`)
      assert.ok(updateRequests > 0)
      assert.equal(result.sso.success, false)
      assert.equal(result.started.success, true)
      assert.equal(result.status.state, 'running')
      assert.equal(result.switched.state, 'stopped')
      assert.equal(result.unreachable.success, false)
      assert.equal(result.hasRoot, true)
      const disk = readFileSync(join(userData, 'dsh-desktop-config.json'), 'utf8')
      assert.equal(disk.includes('smoke-secret'), false)
      const guest = new BrowserWindow({ show: false, webPreferences: { sandbox: true, nodeIntegration: false } })
      await guest.loadURL('data:text/html,<p>untrusted</p>')
      assert.equal(await guest.webContents.executeJavaScript('typeof window.dshDesktop'), 'undefined')
      guest.destroy()
      writeFileSync(join(userData, 'desktop.png'), (await win.webContents.capturePage()).toPNG())
      console.log(JSON.stringify({ result: 'passed', checks: ['sandboxed preload IPC', 'renderer mounted', 'remote defaults', 'configured repository with no published release', 'SSO disabled', 'no plaintext token on disk', 'untrusted view has no bridge'], userData }))
      clearTimeout(timeout)
      server.close()
      app.exit(0)
    } catch (error) { console.error(error); clearTimeout(timeout); server.close(); app.exit(1) }
  })
})
server.listen(0, '127.0.0.1', () => {
  const address = server.address()
  targetUrl = `http://127.0.0.1:${address.port}/?token=smoke-secret`
  import(pathToFileURL(join(process.cwd(), 'dist/main/index.js')).href).catch(error => {
    console.error(error)
    server.close()
    app.exit(1)
  })
})
