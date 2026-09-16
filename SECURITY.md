# Security

This project is in Preview. Enterprise authentication and DLP enforcement are not implemented. Use the Harness server's own authentication and authorization. Remote services require HTTPS; HTTP is limited to loopback.

## Reporting

Report security issues privately to [angelo.cyj@gmail.com](mailto:angelo.cyj@gmail.com). Include the affected version, reproduction steps, impact and redacted logs. Do not publish secrets, exploit payloads or sensitive logs in public issues.

The maintainer confirmed this public security contact on 2026-09-16. GitHub private vulnerability reporting may also be enabled for `cu2mr/harnessframe-desktop`; its availability has not yet been verified.

## Data handling

OS-encrypted configuration is used when available; credentials are memory-only otherwise. Legacy plaintext files are migrated, but previous exports, backups and filesystem snapshots are not retroactively secured. Rotate any real credentials exposed in historical commits or shared logs.

Exports and diagnostics use heuristic redaction, not a guarantee that arbitrary model configuration or prompt text contains no secrets. Manually inspect shared bundles. Credential import/export is disabled in Preview. Local engine backups may contain secrets and must not be shared.

Imported plugins and agent presets may execute code through the engine. Only accept trusted bundles. Remote pages have no desktop preload API, no Node integration, denied permissions and restricted navigation. The local shell remains trusted; a compromised local shell or OS user account is outside these boundaries.
