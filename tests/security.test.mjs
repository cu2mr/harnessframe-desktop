import test from 'node:test'
import assert from 'node:assert/strict'
import { serviceUrl, sameOrigin, redactSecrets, redactText, sealSettings, unsealSettings, parseBundle, validateSettings, exportWorkspace } from '../.test-dist/main/security.js'
import { newerVersion, repositoryName } from '../.test-dist/main/updates.js'

const workspace = { id: 'remote', name: 'Remote', mode: 'remote', remoteUrl: 'https://example.com/?token=private-value&theme=dark' }
const settings = { mode: 'remote', remoteUrl: workspace.remoteUrl, workspaces: [workspace], managedPort: 8080, nodePath: '', autoStartServer: false, launchAtStartup: false, theme: 'dark', extraArgs: '' }
const codec = { encrypt: text => Buffer.from(text).toString('base64'), decrypt: text => Buffer.from(text, 'base64').toString() }
const bundle = () => ({ version: '1.2.0', timestamp: 0, workspaces: [{ ...workspace }], agentPresets: [{ id: 'helper', files: { 'preset.yml': 'name: Helper' } }] })

test('remote URLs require HTTPS, allow exact loopback hosts, reject URL credentials', () => {
  for (const url of ['https://example.com', 'http://127.0.0.1:8080', 'http://localhost:8080', 'http://[::1]:8080']) assert.ok(serviceUrl(url))
  for (const url of ['http://127.0.0.1.evil.test', 'http://example.com/?host=127.0.0.1', 'file:///tmp/a', 'javascript:alert(1)', 'https://user:pass@example.com']) assert.throws(() => serviceUrl(url))
})
test('origin checks include port and reject substring bypasses', () => {
  assert.equal(sameOrigin('https://example.com/path', 'https://example.com'), true)
  for (const target of ['https://example.com.evil.test', 'https://example.com:444', 'https://evil.test/?next=https://example.com']) assert.equal(sameOrigin(target, 'https://example.com'), false)
})
test('disk projection redacts all workspace URLs while encrypted settings round-trip', () => {
  const stored = sealSettings(settings, codec)
  assert.equal(stored.remoteUrl.includes('private-value'), false)
  assert.equal(stored.workspaces[0].remoteUrl.includes('private-value'), false)
  assert.deepEqual(unsealSettings(stored, codec), settings)
})
test('unavailable credential storage never writes plaintext secrets', () => {
  const stored = sealSettings(settings)
  assert.equal(JSON.stringify(stored).includes('private-value'), false)
  assert.throws(() => unsealSettings(sealSettings(settings, codec)), /preserved/)
})
test('legacy encrypted tokens migrate without URL encoding corruption', () => {
  const restored = unsealSettings({ remoteUrl: 'https://example.com/?x=1', _secureToken: codec.encrypt('a&b+c%') }, codec)
  assert.equal(new URL(restored.remoteUrl).searchParams.get('token'), 'a&b+c%')
  assert.equal(JSON.stringify(sealSettings({ ...settings, ...restored })).includes('a&b'), false)
})
test('legacy plaintext workspace tokens disappear on migration', () => {
  const migrated = sealSettings({ ...settings, ...unsealSettings(settings, codec) }, codec)
  assert.equal(migrated.workspaces[0].remoteUrl.includes('token='), false)
})
test('exports remove credentials, tokens, auth headers and personal paths', () => {
  const exported = exportWorkspace({ ...workspace, workingDirectory: '/private/project' })
  assert.equal(exported.workingDirectory, undefined)
  assert.equal(exported.remoteUrl.includes('token='), false)
  const safe = redactSecrets({ credentials: { a: 'sensitive' }, models: { apiKey: 'key', apiKeyEnv: 'KEY_VAR' }, url: 'https://user:pass@example.com/?access_token=secret#token=x' })
  assert.equal(safe.credentials, undefined)
  assert.equal(JSON.stringify(safe).includes('secret'), false)
})
test('logs remove query tokens and bearer credentials', () => {
  const text = redactText('Connected https://example.com/?token=abc&x=1 Authorization: Bearer hello token=world')
  for (const value of ['abc', 'hello', 'world']) assert.equal(text.includes(value), false)
})
test('valid bundle parses and validates settings', () => {
  assert.deepEqual(parseBundle(JSON.stringify(bundle())), bundle())
  validateSettings(settings)
})
test('all presets are validated before writing, including Windows path variants', () => {
  for (const id of ['../escape', '/absolute', '..\\escape', 'C:\\escape', 'CON', 'NUL.txt', 'name.']) {
    const data = bundle(); data.agentPresets.push({ id, files: { 'preset.yml': '' } })
    assert.throws(() => parseBundle(data))
  }
  for (const name of ['../outside', '/absolute', 'a/b', 'a\\b', 'file:stream']) {
    const data = bundle(); data.agentPresets[0].files = { [name]: 'bad' }
    assert.throws(() => parseBundle(data))
  }
})
test('reject oversized, credential-bearing and malformed bundles', () => {
  assert.throws(() => parseBundle(' '.repeat(2 * 1024 * 1024 + 1)))
  for (const data of [{ ...bundle(), credentials: { key: 's' } }, { ...bundle(), version: '2.0' }, { ...bundle(), workspaces: [null] }, { ...bundle(), pluginsConfig: [] }]) assert.throws(() => parseBundle(data))
  assert.throws(() => parseBundle('{"version":"1.0","workspaces":[],"__proto__":{}}'))
})
test('reject duplicate workspaces, duplicate case-insensitive presets and invalid ports', () => {
  assert.throws(() => parseBundle({ ...bundle(), workspaces: [workspace, workspace] }))
  assert.throws(() => parseBundle({ ...bundle(), agentPresets: [{ id: 'A', files: {} }, { id: 'a', files: {} }] }))
  for (const port of [0, 65536, '8080; echo nope', 1.5]) assert.throws(() => validateSettings({ managedPort: port }))
})
test('release comparisons do not downgrade and follow prerelease precedence', () => {
  for (const [next, current] of [['1.10.0', '1.9.0'], ['1.0.0', '1.0.0-rc.1'], ['1.0.0-rc.10', '1.0.0-rc.2'], ['v2.0.0', '1.0.0']]) assert.equal(newerVersion(next, current), true)
  for (const [next, current] of [['1.0.0', '2.0.0'], ['1.0.0', '1.0.0'], ['1.0.0-preview.1', '1.0.0'], ['invalid', '1.0.0'], ['1.0.0+build2', '1.0.0+build1']]) assert.equal(newerVersion(next, current), false)
  assert.equal(repositoryName(null), undefined)
  assert.equal(repositoryName('org/repo?redirect=x'), undefined)
  assert.equal(repositoryName('org/repo'), 'org/repo')
})
