# Packaging and release

## Local build

```sh
pnpm install --frozen-lockfile
pnpm run check
pnpm run electron:install
pnpm run package:mac:arm64
# On Windows:
pnpm run package:win:x64
```

Install Electron explicitly before packaging so its license files are present. The builder may also download target-specific runtime archives. The beforePack hook generates complete runtime/UI license texts, including React code bundled by Vite, under dist/legal; the package also carries Electron and Chromium notices under Resources/legal. It packages only the desktop client. `dist/` and `release/` are generated and must not be committed.

To preconfigure a service, run `pnpm run package:remote -- --url=https://harness.example.com --target=mac` (or `win`). This script rejects URL queries, fragments and credentials, stops on build errors, restores any existing bundled-config.json, and never publishes. Use native CI runners for each supported platform.

## Public repository setup

1. The public source repository is `cu2mr/harnessframe-desktop`. The maintainer confirmed source and existing icon/logo distribution authorization under the current open-source plan on 2026-09-16.
2. Review the working tree and Git history. Prefer a reviewed source snapshot in a new repository: the existing local history contains historical generated/vendor artifacts and internal references. Keep the original private history intact. Do not push all old refs or mirror the private origin.
3. `release.config.json.repository` is configured as `cu2mr/harnessframe-desktop`. SECURITY.md publishes the maintainer-approved private reporting email, and GitHub private vulnerability reporting is enabled.
4. Add branch protection requiring CI and keep dependency alerts enabled.
5. Complete the checklist in release-readiness.json truthfully for binary release. sourceAndHistoryReviewed applies only to the reviewed snapshot with new public history, never to the old private refs. This is a release gate, not a substitute for review. `pnpm run release:check` must pass.
6. Commit the approved source, then create a tag matching package.json, initially `v1.1.0-preview.1`.

The tag workflow builds macOS arm64 and Windows x64, runs checks, produces SHA-256 manifests, and creates a **draft prerelease** in the same repository. Normal builds have read-only GitHub permissions; only the final draft job can write releases. No automatic updater or upstream release publishing is configured.

## Signing

For macOS, configure MAC_CSC_LINK, MAC_CSC_KEY_PASSWORD and the APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID notarization credentials. For Windows configure WINDOWS_CSC_LINK and WINDOWS_CSC_KEY_PASSWORD. Keep credentials in GitHub Secrets. Signing is performed only in the tag workflow, never in PR checks.

The repository does not contain signing certificates. Without credentials, local artifacts are unsigned or ad-hoc signed and may trigger OS warnings. Do not describe them as verified or notarized. Inspect the actual signatures and notarization result, then replace the signing placeholders in release-notes.md before public release.

## Required manual validation

- Clean checkout build and launch on each claimed OS/architecture.
- Fresh install, remote connect, workspace switch, disconnect/reconnect, quit and uninstall.
- Existing data migration; OS credential storage available/unavailable; no plaintext token in configuration, diagnostic backup or exported bundle.
- Local engine missing, incompatible runtime, occupied port, normal child-process shutdown; unrelated service survives diagnostics and restart.
- Import cancel, invalid bundle, existing configuration backup and restoration.
- Updates use the configured desktop repository and do not report success on network failure.
- Signature/notarization verification and checksum validation of the exact downloadable files.

Build CI does not replace these manual checks. Keep release-readiness.json false for checks not completed. Linux, macOS x64 and Windows arm64 stay experimental until separately verified.
