import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, realpathSync, readFileSync, writeFileSync, existsSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { safeTarget, writeImportFiles } from '../.test-dist/main/safe-files.js'

function fixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-import-test-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return root
}
test('import backs up overwritten files and rolls back new and existing files', t => {
  const root = fixture(t)
  writeFileSync(join(root, 'settings.yaml'), 'old')
  const tx = writeImportFiles(root, new Map([['settings.yaml', 'new'], ['.agent-presets/hello/preset.yml', 'name: Hi']]))
  assert.equal(readFileSync(join(root, tx.backup, 'settings.yaml'), 'utf8'), 'old')
  assert.equal(readFileSync(join(root, 'settings.yaml'), 'utf8'), 'new')
  tx.rollback()
  assert.equal(readFileSync(join(root, 'settings.yaml'), 'utf8'), 'old')
  assert.equal(existsSync(join(root, '.agent-presets/hello/preset.yml')), false)
})
test('invalid later paths are rejected before the first mutation', t => {
  const root = fixture(t)
  writeFileSync(join(root, 'settings.yaml'), 'old')
  assert.throws(() => writeImportFiles(root, new Map([['settings.yaml', 'new'], ['../escape', 'bad']])))
  assert.equal(readFileSync(join(root, 'settings.yaml'), 'utf8'), 'old')
})
test('existing symlink targets are rejected', { skip: process.platform === 'win32' }, t => {
  const root = fixture(t), outside = fixture(t)
  symlinkSync(outside, join(root, 'linked'))
  assert.throws(() => safeTarget(root, 'linked/config.yml'), /Symbolic/)
  assert.equal(existsSync(join(outside, 'config.yml')), false)
})
