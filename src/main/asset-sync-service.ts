import { dialog } from 'electron'
import { parseBundle, exportWorkspace, redactSecrets, serviceUrl, safeName, MAX_BUNDLE_BYTES } from './security.js'
import { safeTarget, writeImportFiles } from './safe-files.js'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { existsSync, readFileSync, readdirSync, lstatSync } from 'node:fs'
import YAML from 'yaml'
import type { ConfigStore } from './config-store.js'
import type { TeamAssetBundle, AgentPresetAsset, AssetSyncStatus, BrandCustomization } from '../types/index.js'
import { DEFAULT_COMMUNITY_SETTINGS_YAML, DEFAULT_COMMUNITY_AGENT_PRESETS } from './default-templates.js'

export class AssetSyncService {
  constructor(private configStore: ConfigStore) {}

  /**
   * 解析 DeepSeek Harness 的全局家目录 ($DSH_HOME 或 ~/.dsh)
   */
  public resolveDshHome(): string {
    const envHome = process.env.DSH_HOME?.trim()
    if (envHome) {
      return envHome
    }
    return join(homedir(), '.dsh')
  }

  /**
   * 方式 1: 用户确认后导入社区示例模板。
   */
  public async provisionDefaultTemplates(force = false): Promise<{ provisioned: boolean; message: string }> {
    const home = this.resolveDshHome()
    const presets = DEFAULT_COMMUNITY_AGENT_PRESETS.filter(p => force || !existsSync(join(home, '.agent-presets', p.id)))
    const config = force || !existsSync(join(home, 'settings.yaml')) ? YAML.parse(DEFAULT_COMMUNITY_SETTINGS_YAML) : undefined
    const result = await this.importAssetBundle({ version: '1.2.0', timestamp: Date.now(), workspaces: [], agentPresets: presets, modelsConfig: config })
    return { provisioned: result.success, message: result.message }
  }

  /**
   * 方式 2: 导出团队配置资产包 (.dsh-bundle)
   */
  public async exportAssetBundle(options?: {
    includeCredentials?: boolean
    tenantName?: string
  }): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
      const dshHome = this.resolveDshHome()
      let modelsConfig: any = null
      let pluginsConfig: any = null
      let credentials: Record<string, string> | undefined = undefined
      let exportedBytes = 0

      const readExportFile = (path: string): string => {
        const info = lstatSync(path)
        if (info.isSymbolicLink() || !info.isFile()) throw new Error('Symlinks and non-files cannot be exported')
        exportedBytes += info.size
        if (exportedBytes > MAX_BUNDLE_BYTES) throw new Error('Export exceeds 2 MiB')
        return readFileSync(path, 'utf8')
      }

      const settingsFile = join(dshHome, 'settings.yaml')
      if (existsSync(settingsFile)) {
        const content = readExportFile(settingsFile)
        const parsed = YAML.parse(content) || {}
        if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid settings.yaml')
        const { plugins, ...models } = parsed
        modelsConfig = models
        pluginsConfig = plugins
      }

      if (options?.includeCredentials) throw new Error('Preview 不支持导出凭据；请在目标服务单独配置。')

      // Read authored presets in .agent-presets
      const agentPresets: AgentPresetAsset[] = []
      const presetsDir = join(dshHome, '.agent-presets')
      if (existsSync(presetsDir)) {
        const subdirs = readdirSync(presetsDir)
        if (subdirs.length > 100) throw new Error('Too many presets to export')
        for (const dirName of subdirs) {
          safeName(dirName)
          const fullPath = join(presetsDir, dirName)
          const directoryInfo = lstatSync(fullPath)
          if (directoryInfo.isSymbolicLink()) throw new Error('Preset symlinks cannot be exported')
          if (directoryInfo.isDirectory()) {
            const files: Record<string, string> = {}
            const innerFiles = readdirSync(fullPath)
            if (innerFiles.length > 100) throw new Error(`Preset ${dirName} has too many files`)
            let name = dirName
            let description = ''
            let order = 10

            for (const file of innerFiles) {
              safeName(file)
              const filePath = join(fullPath, file)
              const fileInfo = lstatSync(filePath)
              if (fileInfo.isSymbolicLink()) throw new Error('Preset file symlinks cannot be exported')
              if (fileInfo.isFile()) {
                const text = readExportFile(filePath)
                files[file] = text
                if (file === 'preset.yml') {
                  try {
                    const meta = YAML.parse(text)
                    if (meta?.name) name = meta.name
                    if (meta?.description) description = meta.description
                    if (typeof meta?.order === 'number') order = meta.order
                  } catch {}
                }
              }
            }

            agentPresets.push({
              id: dirName,
              name,
              description,
              order,
              files,
            })
          }
        }
      }

      const workspaces = this.configStore.getWorkspaces()
      const currentSettings = this.configStore.getSettings()

      const bundle: TeamAssetBundle = {
        version: '1.2.0',
        timestamp: Date.now(),
        tenantName: options?.tenantName || 'Example Team',
        workspaces: workspaces.map(exportWorkspace),
        brandCustomization: currentSettings.brandCustomization,
        modelsConfig,
        credentials,
        pluginsConfig,
        agentPresets,
        customPrompts: [
          {
            id: 'prompt-refactor',
            title: '⚡ 代码重构指南',
            prompt: '请根据企业代码规范进行重构：要求函数单一职责、TS严格类型、完备单元测试。',
          },
          {
            id: 'prompt-security-audit',
            title: '🛡️ 安全审查示例',
            prompt: '请对以下代码进行深度安全审查：重点关注 SQL/命令注入、XSS、未授权访问及敏感数据泄露。',
          },
        ],
      }

      const data = JSON.stringify(redactSecrets(bundle), null, 2)
      if (Buffer.byteLength(data, 'utf8') > MAX_BUNDLE_BYTES) throw new Error('Export exceeds 2 MiB')
      return { success: true, data }
    } catch (err: any) {
      return {
        success: false,
        error: `导出资产包失败: ${err?.message || err}`,
      }
    }
  }

  /**
   * 方式 2: 导入团队配置资产包并实时合并注入
   */
  public async importAssetBundle(
    input: string | TeamAssetBundle,
    _options: { merge?: boolean } = { merge: true }
  ): Promise<{ success: boolean; message: string; stats: any }> {
    try {
      const bundle = parseBundle(input)
      const home = this.resolveDshHome()
      const files = new Map<string, string>()
      const settingsPath = safeTarget(home, 'settings.yaml')
      if (bundle.modelsConfig || bundle.pluginsConfig) {
        // Invalid existing YAML is an error, never silently replaced.
        if (existsSync(settingsPath) && lstatSync(settingsPath).size > MAX_BUNDLE_BYTES) throw new Error('Existing settings.yaml exceeds 2 MiB')
        const existing = existsSync(settingsPath) ? YAML.parse(readFileSync(settingsPath, 'utf8')) : {}
        if (!existing || typeof existing !== 'object' || Array.isArray(existing)) throw new Error('Invalid existing settings.yaml')
        const merged = { ...existing, ...bundle.modelsConfig }
        if (bundle.pluginsConfig) merged.plugins = { ...existing.plugins, ...bundle.pluginsConfig }
        files.set('settings.yaml', YAML.stringify(merged))
      }
      for (const preset of bundle.agentPresets || []) {
        for (const [name, content] of Object.entries(preset.files)) files.set(`.agent-presets/${preset.id}/${name}`, content)
      }
      for (const path of files.keys()) safeTarget(home, path)
      const choice = await dialog.showMessageBox({
        type: 'warning', buttons: ['取消', '导入'], defaultId: 0, cancelId: 0,
        message: '导入此配置包？',
        detail: `${bundle.workspaces.length} 个工作区，${files.size} 个文件。已有文件会备份。模型、插件和预设可能改变引擎行为或执行代码；仅导入可信来源。\n${[...files.keys()].join('\n')}`,
      })
      if (choice.response !== 1) return { success: false, message: '已取消导入', stats: {} }
      const previous = this.configStore.getSettings()
      const workspaces = [...this.configStore.getWorkspaces()]
      for (const workspace of bundle.workspaces) {
        const index = workspaces.findIndex(w => w.id === workspace.id)
        if (index < 0) workspaces.push(workspace)
        else workspaces[index] = workspace
      }
      const transaction = writeImportFiles(home, files)
      try {
        this.configStore.updateSettings({ workspaces, brandCustomization: bundle.brandCustomization || previous.brandCustomization })
      } catch (error) {
        transaction.rollback()
        throw error
      }
      return { success: true, message: `配置已导入；文件备份位于 ${transaction.backup}。引擎可能需要重启。`, stats: { workspacesImported: bundle.workspaces.length, presetsImported: bundle.agentPresets?.length || 0 } }
    } catch (error: any) {
      return { success: false, message: `导入失败: ${error.message}`, stats: {} }
    }
  }

  /**
   * 方式 3: 用户触发的远程配置拉取。
   */
  public async syncFromRemote(customUrl?: string): Promise<{ success: boolean; message: string; version?: string }> {
    const settings = this.configStore.getSettings()
    const targetUrl = customUrl || settings.remoteSyncUrl || ''

    try {
      serviceUrl(targetUrl)
      console.log('[AssetSync] Fetching user-configured remote configuration')


      const res = await fetch(targetUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'DSH-Desktop/1.1',
        },
        signal: AbortSignal.timeout(8000),
        redirect: 'error',
      })


      if (!res.ok) {
        console.warn(`[AssetSync] Remote endpoint returned HTTP ${res.status}`)
        return {
          success: false,
          message: `云端配置服务返回 HTTP ${res.status} (${res.statusText})`,
        }
      }

      if (!res.body) throw new Error('Empty response')
      const reader = res.body.getReader()
      const chunks: Uint8Array[] = []
      let size = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > MAX_BUNDLE_BYTES) { await reader.cancel(); throw new Error('Bundle exceeds 2 MiB') }
        chunks.push(value)
      }
      const remoteBundle = parseBundle(Buffer.concat(chunks).toString('utf8'))
      const importResult = await this.importAssetBundle(remoteBundle)

      if (importResult.success) {
        const now = Date.now()
        this.configStore.updateSettings({
          lastSyncTime: now,
          syncVersion: remoteBundle.version || '1.0.0',
        })
        return {
          success: true,
          message: `云端同步成功：${importResult.message}`,
          version: remoteBundle.version || '1.0.0',
        }
      } else {
        return {
          success: false,
          message: `云端配置解析错误: ${importResult.message}`,
        }
      }
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError'
      const errDetail = isAbort ? '请求超时 (8s)' : err?.message || String(err)
      console.warn(`[AssetSync] Cloud sync note: ${errDetail}`)
      return {
        success: false,
        message: `未能连接到云端配置中心 (${errDetail})，已维持本地现有配置正常使用`,
      }
    }
  }

  /**
   * 获取当前配置状态统计
   */
  public async getSyncStatus(): Promise<AssetSyncStatus> {
    const dshHome = this.resolveDshHome()
    const settings = this.configStore.getSettings()
    const settingsFile = join(dshHome, 'settings.yaml')
    let modelCount = 0
    let hasLocalConfig = false

    if (existsSync(settingsFile)) {
      hasLocalConfig = true
      try {
        const parsed = YAML.parse(readFileSync(settingsFile, 'utf8')) || {}
        for (const [k, v] of Object.entries(parsed)) {
          if (k !== 'plugins' && (v as any)?.models) {
            modelCount += Object.keys((v as any).models).length
          }
        }
      } catch {}
    }

    let presetCount = 0
    const presetsDir = join(dshHome, '.agent-presets')
    if (existsSync(presetsDir)) {
      try {
        const list = readdirSync(presetsDir).filter((d) => {
          try {
            const info = lstatSync(join(presetsDir, d))
            return !info.isSymbolicLink() && info.isDirectory()
          } catch {
            return false
          }
        })
        presetCount = list.length
      } catch {}
    }

    return {
      lastSyncTime: settings.lastSyncTime,
      syncVersion: settings.syncVersion,
      remoteSyncEnabled: false,
      remoteSyncUrl: settings.remoteSyncUrl || '',
      hasLocalConfig,
      modelCount,
      presetCount,
    }
  }
}
