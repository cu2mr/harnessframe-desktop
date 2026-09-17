# Open-source readiness review

Review date: 2026-09-16. This records the current Preview preparation, not a certification of security or upstream compatibility.

## Decision

The source-only Preview is published from the reviewed snapshot at `cu2mr/harnessframe-desktop`. Binary release preparation remains incomplete. Do not make the existing private Git repository public or push its historical refs. Source/asset distribution authorization and the security reporting email were confirmed by the maintainer on 2026-09-16. Publishing source as an explicitly experimental Preview does not require signed installers or Windows certification; publishing tested desktop binaries requires separate platform acceptance.

## Verified evidence

- The latest implementation check passed TypeScript, 26 regression tests and main/preload/renderer builds.
- Both production-only and full-lockfile npm vulnerability queries returned no known vulnerabilities at review time. This is a dependency database result, not a source-code security assessment.
- The working-tree heuristic scan passed for the 95 files present after adding real Harness acceptance scripts and the notice generator.
- A macOS arm64 application directory was built. The Electron smoke script passed using a simulated loopback HTTP service.
- That smoke script checks renderer/preload behavior, remote connection behavior and configuration redaction. It does not launch an actual upstream Harness, verify token authentication against it, or exercise managed shutdown.
- The first public GitHub CI run passed on macOS, Windows and Linux for commit `17a23169444b3dcf58f88839972b3d51ce8ec0cf`.
- The packaging hook now collects complete license texts from 14 installed runtime/UI packages, including bundled React code. Electron and Chromium notices are copied explicitly. These were verified inside the latest macOS arm64 application directory; source and artwork distribution authorization was subsequently confirmed by the maintainer.

## Lifecycle fixes and regression evidence

The four source-review findings have been fixed and covered by automated regression tests:

| Area | Current behavior | Verification |
| --- | --- | --- |
| Managed readiness | Waits up to 30 seconds for an announced URL and an HTTP reachability response below 500; never guesses a port. Timeout stops the owned child and reports an error. | Missing URL and HTTP 503 startup cases remain non-running and time out. |
| Startup URL parsing | Buffers complete UTF-8 lines from stdout and stderr before URL parsing or redacted logging; discards oversized lines whole. | Split URL/token chunks produce one complete authenticated URL without token fragments in logs. |
| Managed shutdown/restart | Serializes operations, waits for child close, escalates after five seconds, and retains ownership/errors if forced shutdown also times out. Replacement cannot start after failed termination. | Delayed close, failed signal delivery, stale close events, startup cancellation and a real POSIX child ignoring SIGTERM. |
| Health state | HTTP 5xx and transport errors share the two-failure threshold. Checks do not overlap; results from previous lifecycles are ignored. | Failure/recovery and late response cases across stop and replacement. |

Application quit now remains open with an error when managed shutdown cannot be confirmed. Diagnostics propagate stop failure instead of reporting unconditional success.

The suite contains 26 tests, including ten new lifecycle cases. The real-child test uses a purpose-built fixture and simulated HTTP reachability; it is not an upstream Harness compatibility test and is skipped on Windows because POSIX signal behavior differs. The Electron desktop smoke script also passed again after these changes using its simulated service.

Reachability is not proof of authentication: HTTP 401/403 can still require login in the Harness view. The real authentication and coexistence results below supplement the lifecycle tests; exact packaged-artifact acceptance remains outstanding.

## Real Harness acceptance

On macOS arm64 with Node 22.18.0 and Electron 44.4.1, the existing external built checkout at commit `d347e703908d0406b7a7ef80e3a0e594d86b2215` passed the following opt-in tests. Its Git worktree was clean before and after. The checkout was not rebuilt for this run, so these results describe the local artifacts tested, not reproducibility of every artifact from that commit.

`tests/harness-integration.mjs` passed:

- managed startup through the real built CLI;
- unauthenticated settings API rejection, Token-to-Cookie exchange and authenticated API success;
- Attach disconnect preserving the service owned by another manager;
- restart with the previous PID reaped and the replacement authenticated;
- owned-process shutdown;
- occupied-port startup failure without stopping the unrelated listener;
- independently launched `dsh web` staying authenticated after desktop Attach disconnect;
- standalone CLI help after desktop lifecycle operations.

`tests/harness-desktop-smoke.cjs` passed:

- managed startup through real desktop preload IPC;
- authentication inside the Electron Harness guest view and access to the protected settings API;
- guest isolation from desktop preload APIs and Node;
- desktop stop returning only after the real Harness PID exited.

Both scripts isolate Harness home and remove inherited credentials. The Node integration script also uses a temporary project working directory; the Electron test refuses a checkout containing a project `.env`. No model request was made. Tests do not establish provider/tool coverage, Windows behavior, installer/uninstaller behavior, or signed release acceptance. Reproduction commands are in [development.md](development.md#real-harness-acceptance).


## Latest macOS package inspection

The application directory rebuilt on 2026-09-16 contains the lifecycle fixes and generated notices. Its ASAR has 4,377 entries, including 14 package license records and 16,896 bytes of complete dependency license texts. Electron and Chromium notices exist outside ASAR under Resources/legal. No Harness checkout, Git metadata, .env or bundled-config.json was found in the archive. Info.plist keeps NSAllowsArbitraryLoads false with loopback HTTP exceptions.

The main executable reports only an ad-hoc linker signature, no TeamIdentifier and no sealed bundle resources. No Developer ID signing or notarization has been established. This is an application-directory inspection, not a DMG install/uninstall or Gatekeeper test; macOS full acceptance remains false. Windows signature and installation status remain unverified.

## Historical source review

The scan of all local Git refs examined 14,817 blobs and reported 279 heuristic findings: 63 large-file reviews, 15 internal-address matches, 198 personal-path matches and 3 private-key-pattern matches. The private-key-pattern matches were located in dependency documentation and test fixtures; these matches alone do not establish leaked live credentials. The history also contains dependency trees and built application artifacts. Large blobs and binary payloads are not fully inspected by this scanner.

The sourceAndHistoryReviewed gate applies only to the reviewed public snapshot and its newly initialized history. It does not approve publishing any old private refs. The snapshot inventory, credential/internal-address scan, configuration examples, source/asset authorization, and packaged dependency notices have been reviewed.

Keep the private history intact. Use the source-snapshot script to prepare the public repository content, review that content, then initialize a separate public history. A clean working-tree scan does not clear the old Git history for publication.

## Maintainer confirmations

On 2026-09-16, the maintainer explicitly authorized publishing angelo.cyj@gmail.com in SECURITY.md and confirmed that the source, icons and logos are authorized for distribution under the current open-source plan. The corresponding two readiness gates are true. This records the supplied authorization; it does not clear the private Git history or certify platform acceptance.

## Uncompleted release prerequisites

- The public repository, authenticated publishing access, MIT license detection, 95-file remote tree and private vulnerability reporting were verified on 2026-09-17.
- Broaden compatibility beyond the recorded local macOS build as needed. Provider/tool behavior and other upstream revisions remain unverified.
- Complete macOS arm64 and Windows x64 acceptance on the exact intended artifacts, including installation and shutdown behavior. The macOS gate is false because its full acceptance checklist has not been completed; successful build and simulated smoke evidence are retained above.
- Record actual signing/notarization status. Signing is not a prerequisite for source publication; any unsigned Preview binary must be described accurately.

The binary release gate remains failing deliberately. The public repository uses a new history created from the reviewed snapshot; no private history was copied. Source publication does not imply that downloadable installers are ready.
