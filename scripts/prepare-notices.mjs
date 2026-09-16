import { createRequire } from 'node:module'
import { readFileSync, readdirSync, realpathSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const manifestPath = join(root, 'package.json')

/** Preserve full runtime/UI license texts, including code bundled into the renderer. */
export default function prepareNotices() {
  const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const seen = new Set()
  const packages = []
  function collect(name, parent) {
    const require = createRequire(parent)
    let manifest
    try { manifest = require.resolve(`${name}/package.json`) }
    catch {
      let dir = dirname(require.resolve(name))
      while (true) {
        try {
          const candidate = join(dir, 'package.json')
          if (JSON.parse(readFileSync(candidate, 'utf8')).name === name) { manifest = candidate; break }
        } catch { /* Continue to the owning package directory. */ }
        const next = dirname(dir)
        if (next === dir) throw Error(`Cannot resolve license owner: ${name}`)
        dir = next
      }
    }
    manifest = realpathSync(manifest)
    if (seen.has(manifest)) return
    seen.add(manifest)
    const info = JSON.parse(readFileSync(manifest, 'utf8'))
    const directory = dirname(manifest)
    const licenses = readdirSync(directory).filter(file => /^(licen[cs]e|copying|notice)(\.|$)/i.test(file))
    if (!licenses.length) throw Error(`Missing license text: ${info.name}@${info.version}`)
    packages.push({ name: info.name, version: info.version, license: info.license ?? null,
      texts: licenses.sort().map(file => ({ file, text: readFileSync(join(directory, file), 'utf8') })) })
    for (const child of Object.keys(info.dependencies || {})) collect(child, manifest)
  }
  // React is bundled by Vite even though it is a development dependency.
  for (const name of [...Object.keys(pkg.dependencies), 'react', 'react-dom']) collect(name, manifestPath)
  packages.sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`))
  const output = join(root, 'dist', 'legal')
  mkdirSync(output, { recursive: true })
  writeFileSync(join(output, 'THIRD_PARTY_LICENSES.txt'), packages.map(p =>
    `${p.name}@${p.version} (${p.license})\n${p.texts.map(t => `${t.file}\n${t.text}`).join('\n')}`).join('\n\n'))
  writeFileSync(join(output, 'dependencies.json'), JSON.stringify(packages.map(({ texts, ...p }) => p), null, 2) + '\n')
  console.log(`Prepared complete license texts for ${packages.length} runtime/UI packages`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) prepareNotices()
