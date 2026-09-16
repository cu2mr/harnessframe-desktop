import { parseBundle, exportWorkspace } from './security.js'
import type { ConfigStore } from './config-store.js'
import type { TeamAssetBundle, WorkspaceProfile } from '../types/index.js'

export class TeamSyncService {
  constructor(private configStore: ConfigStore) {}

  public exportBundle(tenantName = 'Example Team'): string {
    const workspaces = this.configStore.getWorkspaces()
    const bundle: TeamAssetBundle = {
      version: '1.0.0',
      timestamp: Date.now(),
      tenantName,
      workspaces: workspaces.map(exportWorkspace),
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
        {
          id: 'prompt-arch-review',
          title: '📐 架构解耦与设计模式评审',
          prompt: '请评估当前模块的耦合度与扩展性，推荐符合有限状态机或微内核插件模式的演进方案。',
        },
      ],
    }

    return JSON.stringify(bundle, null, 2)
  }

  public importBundle(bundleJson: string): { success: boolean; importedCount: number; message: string } {
    try {
      if (!bundleJson || typeof bundleJson !== 'string') {
        return { success: false, importedCount: 0, message: '配置包内容为空或格式无效' }
      }

      const parsed = parseBundle(bundleJson)
      if (!parsed.workspaces || !Array.isArray(parsed.workspaces)) {
        return { success: false, importedCount: 0, message: '配置包中未检测到有效的工作区配置' }
      }

      let importedCount = 0
      for (const item of parsed.workspaces) {
        if (!item.name) continue
        const profile: WorkspaceProfile = {
          id: item.id || `ws-team-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: item.name,
          mode: item.mode || 'remote',
          managedPort: item.managedPort || 8080,
          remoteUrl: item.remoteUrl || 'http://127.0.0.1:8080',
          colorBadge: item.colorBadge || '#10b981',
          description: item.description ? `[团队同步] ${item.description}` : '[团队同步工作区]',
        }

        this.configStore.saveWorkspace(profile)
        importedCount++
      }

      return {
        success: true,
        importedCount,
        message: `成功导入 ${importedCount} 个团队工作区！`,
      }
    } catch (err: any) {
      return {
        success: false,
        importedCount: 0,
        message: `导入解析失败: ${err?.message || '未知 JSON 语法错误'}`,
      }
    }
  }
}
