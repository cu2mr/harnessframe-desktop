# Changelog

## 1.1.0-preview.1 — Unreleased

- Replaced assumed managed readiness with bounded announced-URL probing; buffer split startup output before parsing and redaction.
- Wait for owned process close before restart, retain termination failures, guard stale callbacks and prevent quit when shutdown fails.
- Apply health failure thresholds to HTTP 5xx as well as transport errors, with lifecycle regression coverage.

- Renamed the project to HarnessFrame to distinguish its detachable desktop-host architecture from similarly named DSH desktop projects.
- Reworked the project overview around replaceable Harness runtimes, simple workspace attachment, platform status, architecture and community contribution paths.
- Standalone remote desktop packaging, with externally configured local-engine support.
- Community defaults and documentation; no startup template writes or remote configuration imports.
- Encrypted settings and redacted legacy URL migration, exports, logs and diagnostic backups.
- Validated, confirmed configuration imports with backups and rollback.
- Trusted IPC senders, restricted navigation and sandboxed shell/guest windows.
- Removed simulated SSO success and unrelated-process termination; labeled DLP as a text tester.
- Configurable update repository and accurate unavailable/error states.
- Generate and package full runtime/UI license texts and explicitly preserve Electron/Chromium notices.
- Regression tests, opt-in real Harness and Electron authentication/coexistence acceptance scripts, cross-platform CI and gated draft-release workflow.
- Updated Electron to 44.4.1, electron-builder to 26.15.3 and Vite to 6.4.3.

Existing internal versions and their private history are not public releases.
