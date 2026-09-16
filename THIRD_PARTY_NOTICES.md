# Third-party notices and provenance

The desktop source's MIT declaration does not override licenses or rights in dependencies, engine code, artwork or trademarks.

- Electron is MIT licensed and includes Chromium and other third-party components. Preserve the Electron LICENSE and LICENSES.chromium.html shipped with the runtime.
- React, React DOM, Vite, TypeScript, Tailwind CSS, cross-spawn and tree-kill declare MIT licenses; installed yaml 2.9.0 and lucide-react 1.37.0 declare ISC. Verify exact installed versions and transitive notices when producing a distribution.
- DeepSeek Harness is a separate upstream project. This Preview does not bundle its source or runtime. If a future distributor includes it, preserve its license, attribution and dependency notices and pin the included commit.
- On 2026-09-16, the maintainer confirmed authorization to distribute the project source and existing icons/logos under the current open-source release plan, including assets in build/ and the renderer. This records the maintainer's confirmation; it does not imply ownership of upstream names or trademarks.
- Product names and marks identify their respective owners. This community client does not imply endorsement by DeepSeek or other vendors.

Run `pnpm run notices` to generate the installed runtime/UI inventory and complete license texts in `dist/legal/`; this also runs automatically before packaging. It includes bundled React and React DOM dependencies. Electron and Chromium license files are explicitly copied into the distribution under `legal/`. Retain dependency license files in packaged node_modules. The inventory records installed declarations and does not establish rights to project artwork. The licenseAndAssetRightsConfirmed gate records the maintainer's confirmed source and asset distribution authorization.
