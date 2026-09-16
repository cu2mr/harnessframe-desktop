# Development

Use the repository root, not the parent hybrid workspace. Node 24 and the packageManager version in package.json are the CI baseline. Install dependencies with `pnpm install --frozen-lockfile`, download Electron with `pnpm run electron:install`, then run `pnpm run dev`.

- `pnpm run typecheck`: strict TypeScript checking.
- `pnpm test`: Node regression tests for storage, URL boundaries, import validation/rollback, version ordering and server lifecycle. The POSIX termination test launches a disposable fixture child; upstream Harness acceptance remains separate.
- `pnpm run build`: builds main, preload and renderer into dist/.
- `pnpm run check`: type check, tests and production build.
- `pnpm run audit:source`: heuristic working-tree scan; never prints matched secret values.
- `node scripts/audit-source.mjs --history`: scans all locally reachable Git blobs; large blobs are flagged for separate review.
- `pnpm run source:snapshot`: creates a reviewable source-only directory and archive from the current working tree. It excludes ignored build output, dependencies and Git history, and refuses to overwrite an existing snapshot.

## External Harness engine

Build an upstream version compatible with your environment using upstream instructions. Record its commit when reporting issues. This Preview does not claim compatibility with every upstream version.

macOS shell:

```sh
export DSH_HARNESS_PATH=/absolute/path/to/built-harness
pnpm run dev
```

Windows PowerShell:

```powershell
$env:DSH_HARNESS_PATH = 'C:\path\to\built-harness'
pnpm run dev
```

Switch to managed mode in Settings. The engine must contain apps/cli/lib/bin.js and its installed runtime dependencies. Settings JSON also accepts `harnessPath` for packaged launches; do not edit the encrypted projection manually. Environment configuration is preferred in this Preview. Node can be selected in Settings. The desktop's embedded Node fallback does not guarantee the engine's Node requirements are satisfied.

## Data and migration

The default app display name is HarnessFrame. Existing DSH Desktop application data is reused when present; the config filename, app ID and deep-link schemes remain unchanged for compatibility. Back up your old user-data directory before testing a Preview. Protect that backup: old versions may contain plaintext URLs.

Legacy configuration is rewritten with encrypted settings and redacted URL projections on first load. The old diagnostic backup is rewritten with redacted settings. This cannot erase secrets from filesystem snapshots or previously exported files.

No engine configuration is written at startup. Default presets and remote bundles are explicit, confirmed operations. Backups of overwritten engine files are under `$DSH_HOME/.desktop-backups` (or `~/.dsh/.desktop-backups`); these backups may contain existing engine secrets and use restricted permissions. Imports into symlinked paths are rejected. After an import, the engine may require a restart.

## Electron development

Only the local shell and pet window receive the preload API. Guest, detached and PiP views run without Node integration or preload access. Cross-origin navigation and permission requests are denied in Preview; authentication flows requiring a cross-origin redirect may need completing in a browser first.

The desktop shell does not fetch remote fonts. Development uses Vite's React refresh preamble; production CSP allows scripts only from the packaged application. Do not expose the development server on a public interface.

## Real Harness acceptance

These opt-in tests require an independently built upstream checkout. They do not run in the default suite or fetch the engine. The local accepted checkout was at commit `d347e703908d0406b7a7ef80e3a0e594d86b2215`; see [readiness evidence](open-source-readiness.md#real-harness-acceptance) for scope and limits.

From the desktop repository on macOS:

```sh
node node_modules/typescript/bin/tsc -p tsconfig.test.json
node tests/harness-integration.mjs /absolute/path/to/built-harness
pnpm run build
pnpm exec electron tests/harness-desktop-smoke.cjs /absolute/path/to/built-harness /absolute/path/to/node
```

Both tests need permission to listen on loopback and launch child processes. The desktop test additionally opens Electron and requires a checkout without a project `.env`. They use temporary Harness home directories and remove inherited credentials; no model request is made. The desktop smoke retains its temporary profile for inspection; treat it as sensitive because it can contain temporary session credentials. The Node test cleans its temporary configuration after exit. These scripts validate the local runtime/desktop connection, not packaged installers or all upstream features.
