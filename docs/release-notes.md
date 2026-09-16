HarnessFrame community Preview

This desktop client connects to your own Harness service. The engine is not bundled. Enterprise SSO and automatic DLP enforcement are unavailable; the DLP panel is a manual text tester.

Initial release targets: macOS arm64 and Windows x64. Other platforms are experimental. Download the installer for your architecture and verify it against the corresponding SHA256SUMS file.

Local validation on 2026-09-16:

- 26 regression tests, TypeScript and production builds passed.
- Real Harness authentication, Managed/Attach coexistence, restart, shutdown and occupied-port isolation passed on macOS arm64 against the existing local upstream build at commit d347e703908d0406b7a7ef80e3a0e594d86b2215.
- The latest macOS arm64 application directory includes 14 runtime/UI dependency license texts plus Electron and Chromium notices. Its ASAR contains no Harness checkout, Git history, .env or bundled configuration.
- The inspected macOS executable has only an ad-hoc linker signature: no Developer ID, no TeamIdentifier, and no sealed bundle resources. No notarized installer has been validated. Treat this local artifact as unsigned for distribution purposes.
- Windows artifacts, signatures and real-machine installation have not been validated.

Before publishing, replace or supplement these local results with acceptance of the exact downloadable installer/ZIP files and their checksums. Local directory packaging does not establish installation, uninstall, Gatekeeper or SmartScreen acceptance.

See CHANGELOG.md for changes and docs/development.md for data migration and backup behavior.
