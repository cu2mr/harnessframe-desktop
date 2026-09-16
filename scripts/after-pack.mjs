import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

export default function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const plist = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Info.plist')
  // electron-builder injects NSAllowsArbitraryLoads=true after extendInfo is merged.
  // Enforce the project policy before signing: HTTPS remotely, HTTP only on loopback.
  execFileSync('/usr/bin/plutil', [
    '-replace',
    'NSAppTransportSecurity.NSAllowsArbitraryLoads',
    '-bool',
    'NO',
    plist,
  ])
}
