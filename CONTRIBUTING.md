# Contributing

Start with README.md and docs/development.md. Discuss large changes in an issue before implementation. Submit focused PRs explaining the problem, resulting behavior, compatibility and relevant validation.

Run `pnpm install --frozen-lockfile`, `pnpm run check` and `pnpm run audit:source`. Add regression tests for changes to credentials, IPC, process ownership, configuration imports or update logic. Record OS/architecture and engine commit for manual desktop checks. Do not commit generated packages, personal configuration, secrets or unrelated formatting changes.

Contributions must be yours to license under the project's MIT license. Preserve third-party notices and provenance. Be respectful, assume good intent, and keep review discussions focused on the work. Report vulnerabilities privately as described in SECURITY.md; do not include credentials in issues.
