import { readFileSync } from 'node:fs'
const metadata = JSON.parse(readFileSync('release.config.json', 'utf8'))
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const approval = JSON.parse(readFileSync('release-readiness.json', 'utf8'))
const failures = []
if (typeof metadata.repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(metadata.repository)) failures.push('Set release.config.json repository to the actual GitHub owner/repo')
if (process.env.GITHUB_REPOSITORY && process.env.GITHUB_REPOSITORY !== metadata.repository) failures.push('Configured repository does not match the publishing repository')
if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME !== `v${pkg.version}`) failures.push('Tag must match package.json version')
for (const [key, value] of Object.entries(approval)) if (value !== true) failures.push(`Release review incomplete: ${key}`)
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1 }
else console.log('Release metadata and review gates passed.')
