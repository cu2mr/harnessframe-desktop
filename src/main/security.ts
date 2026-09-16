import type { AppSettings, TeamAssetBundle, WorkspaceProfile } from '../types/index.js'

const secretKey = /^(?!.*(?:Env|EnvVar|EnvironmentVariable)$).*?(?:token|password|secret|credential|authorization|api[-_]?key).*$/i
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor'])
export const MAX_BUNDLE_BYTES = 2 * 1024 * 1024

export function serviceUrl(value: unknown): URL {
  if (typeof value !== 'string' || value.length > 8192) throw new Error('Invalid service URL')
  const url = new URL(value)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('Use HTTPS for remote services; HTTP is only allowed on loopback')
  }
  if (url.username || url.password) throw new Error('URL username/password authentication is not supported')
  return url
}

export function sameOrigin(target: string, trusted: string): boolean {
  try { return serviceUrl(target).origin === serviceUrl(trusted).origin } catch { return false }
}

export function redactText(text: string): string {
  return text
    .replace(/https?:\/\/[^\s<>"']+/gi, (value) => {
      try {
        const url = new URL(value)
        url.username = ''; url.password = ''
        for (const key of [...url.searchParams.keys()]) {
          if (secretKey.test(key)) url.searchParams.delete(key)
        }
        // Authentication material can also be embedded in fragments.
        url.hash = ''
        return url.toString()
      } catch { return '[invalid URL]' }
    })
    .replace(/((?:api[-_]?key|access[-_]?token|refresh[-_]?token|token|password|secret)\s*[=:]\s*)[^\s,;"']+/gi, '$1[REDACTED]')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]')
}

export function redactSecrets<T>(value: T): T {
  if (typeof value === 'string') return redactText(value) as T
  if (Array.isArray(value)) return value.map(redactSecrets) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !secretKey.test(key) && !unsafeKeys.has(key))
      .map(([key, item]) => [key, redactSecrets(item)])) as T
  }
  return value
}

export interface SettingsCodec { encrypt(value: string): string; decrypt(value: string): string }
export type StoredSettings = Partial<AppSettings> & { _encryptedSettings?: string; _secureToken?: string }

export function sealSettings(settings: AppSettings, codec?: SettingsCodec): StoredSettings {
  const publicSettings = redactSecrets(settings)
  return codec ? { ...publicSettings, _encryptedSettings: codec.encrypt(JSON.stringify(settings)) } : publicSettings
}

export function unsealSettings(stored: StoredSettings, codec?: SettingsCodec): Partial<AppSettings> {
  if (stored._encryptedSettings) {
    if (!codec) throw new Error('OS credential storage is unavailable; existing encrypted settings were preserved')
    return JSON.parse(codec.decrypt(stored._encryptedSettings))
  }
  const { _secureToken, _encryptedSettings, ...settings } = stored
  if (_secureToken && settings.remoteUrl && codec) {
    const url = new URL(settings.remoteUrl)
    if (!url.searchParams.has('token')) url.searchParams.set('token', codec.decrypt(_secureToken))
    settings.remoteUrl = url.toString()
  }
  return settings
}

function object(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function safeName(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)
    || value.endsWith('.') || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)) {
    throw new Error('Invalid ID or filename')
  }
}

export function validateWorkspace(value: unknown): asserts value is WorkspaceProfile {
  if (!object(value)) throw new Error('Invalid workspace')
  safeName(value.id)
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 200) throw new Error('Invalid workspace name')
  if (!['managed', 'remote'].includes(value.mode)) throw new Error('Invalid workspace mode')
  if (value.remoteUrl) serviceUrl(value.remoteUrl)
  if (value.managedPort !== undefined && (!Number.isInteger(value.managedPort) || value.managedPort < 1 || value.managedPort > 65535)) throw new Error('Invalid port')
  if (value.brandCustomization) validateBrand(value.brandCustomization)
}

function validateBrand(value: unknown): void {
  if (!object(value)) throw new Error('Invalid brand settings')
  for (const key of ['title', 'badge', 'customLogoUrl']) {
    if (value[key] !== undefined && (typeof value[key] !== 'string' || value[key].length > 8192)) throw new Error('Invalid brand text')
  }
  if (value.customLogoUrl) serviceUrl(value.customLogoUrl)
}

export function validateSettings(value: Partial<AppSettings>): void {
  if (!object(value)) throw new Error('Invalid settings')
  if (value.mode !== undefined && !['remote', 'managed'].includes(value.mode)) throw new Error('Invalid mode')
  if (value.remoteUrl) serviceUrl(value.remoteUrl)
  if (value.remoteSyncUrl) serviceUrl(value.remoteSyncUrl)
  if (value.managedPort !== undefined && (!Number.isInteger(value.managedPort) || value.managedPort < 1 || value.managedPort > 65535)) throw new Error('Invalid port')
  if (value.workspaces !== undefined) {
    if (!Array.isArray(value.workspaces) || value.workspaces.length > 100) throw new Error('Invalid workspaces')
    value.workspaces.forEach(validateWorkspace)
    if (new Set(value.workspaces.map(w => w.id)).size !== value.workspaces.length) throw new Error('Duplicate workspace IDs')
  }
  if (value.brandCustomization) validateBrand(value.brandCustomization)
  for (const key of ['autoStartServer', 'launchAtStartup', 'remoteSyncEnabled', 'autoProvisionDefaults'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') throw new Error('Invalid boolean setting')
  }
  for (const key of ['nodePath', 'harnessPath', 'workingDirectory', 'extraArgs', 'activeWorkspaceId'] as const) {
    if (value[key] !== undefined && (typeof value[key] !== 'string' || value[key]!.length > 8192 || value[key]!.includes('\0'))) throw new Error('Invalid text setting')
  }
}

export function parseBundle(input: unknown): TeamAssetBundle {
  const text = typeof input === 'string' ? input : JSON.stringify(input)
  if (!text || Buffer.byteLength(text) > MAX_BUNDLE_BYTES) throw new Error('Bundle exceeds 2 MiB')
  const bundle = JSON.parse(text, (key, value) => {
    if (unsafeKeys.has(key)) throw new Error('Unsafe object key')
    return value
  })
  if (!object(bundle) || typeof bundle.version !== 'string' || !/^1\./.test(bundle.version)) throw new Error('Unsupported bundle version')
  if (bundle.credentials) throw new Error('Credential import is disabled; configure credentials directly in your engine')
  if (!Array.isArray(bundle.workspaces) || bundle.workspaces.length > 100) throw new Error('Invalid workspaces')
  bundle.workspaces.forEach(validateWorkspace)
  if (new Set(bundle.workspaces.map((w: WorkspaceProfile) => w.id)).size !== bundle.workspaces.length) throw new Error('Duplicate workspace IDs')
  if (bundle.brandCustomization) validateBrand(bundle.brandCustomization)
  for (const key of ['modelsConfig', 'pluginsConfig']) {
    if (bundle[key] !== undefined && bundle[key] !== null && !object(bundle[key])) throw new Error('Invalid configuration object')
  }
  if (bundle.agentPresets !== undefined) {
    if (!Array.isArray(bundle.agentPresets) || bundle.agentPresets.length > 100) throw new Error('Invalid presets')
    const ids = new Set()
    for (const preset of bundle.agentPresets) {
      if (!object(preset)) throw new Error('Invalid preset')
      safeName(preset.id)
      if (ids.has(preset.id.toLowerCase())) throw new Error('Duplicate preset IDs')
      ids.add(preset.id.toLowerCase())
      if (!object(preset.files) || Object.keys(preset.files).length > 100) throw new Error('Invalid preset files')
      for (const [name, content] of Object.entries(preset.files)) {
        safeName(name)
        if (typeof content !== 'string') throw new Error('Invalid file content')
      }
    }
  }
  return bundle as unknown as TeamAssetBundle
}

export function exportWorkspace(workspace: WorkspaceProfile): WorkspaceProfile {
  const { workingDirectory, ...safe } = redactSecrets(workspace)
  return safe
}
