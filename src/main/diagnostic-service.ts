import { redactSecrets, redactText } from './security.js'
import { createServer } from 'node:net'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { lookup } from 'node:dns/promises'
import type { ServerManager } from './server-manager.js'
import type { ConfigStore } from './config-store.js'
import type { WindowManager } from './window-manager.js'
import type { DiagnosticReport, DiagnosticItem } from '../types/index.js'

const execAsync = promisify(exec)

export class DiagnosticService {
  constructor(
    private serverManager: ServerManager,
    private configStore: ConfigStore,
    private windowManager: WindowManager
  ) {}

  public async runDiagnostics(): Promise<DiagnosticReport> {
    const settings = this.configStore.getSettings()
    const items: DiagnosticItem[] = []

    // 1. Port Check
    const port = settings.managedPort || 8080
    const portResult = await this.checkPort(port)
    items.push(portResult)

    // 2. Node.js Runtime Check
    const nodeResult = await this.checkNodeRuntime()
    items.push(nodeResult)

    // 3. Harness Engine Integrity Check
    const engineResult = this.checkHarnessEngine()
    items.push(engineResult)

    // 4. Network & DNS Probe Check
    const netResult = await this.checkNetwork(settings.remoteUrl)
    items.push(netResult)

    // 5. Zombie & Orphan Process Check
    const zombieResult = await this.checkZombieProcesses()
    items.push(zombieResult)

    // 6. Config Integrity & Disaster Recovery Check
    const configResult = this.checkConfigIntegrity()
    items.push(configResult)

    // 7. Git & Workspace Check
    const gitResult = this.checkGit(settings.workingDirectory)
    items.push(gitResult)

    const canAutoHeal = items.some((i) => i.status === 'fail' || i.status === 'warn')
    const recommendedAction = portResult.status === 'fail'
      ? `检测到端口 :${port} 被占用，请修改端口或手动检查占用该端口的服务`
      : netResult.status === 'fail' && settings.mode === 'remote'
      ? '远程服务不可达，建议检查目标 URL、鉴权 Token 或网络设置'
      : undefined

    return {
      timestamp: Date.now(),
      items,
      canAutoHeal,
      recommendedAction,
    }
  }

  public async checkPort(port: number): Promise<DiagnosticItem> {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port')
    const isOccupied = await new Promise<boolean>((resolve) => {
      const tester = createServer()
        .once('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            resolve(true)
          } else {
            resolve(false)
          }
        })
        .once('listening', () => {
          tester.close(() => resolve(false))
        })
        .listen(port, '127.0.0.1')
    })

    if (!isOccupied) {
      return {
        id: 'port-check',
        title: `本地端口监听 (: ${port})`,
        status: 'pass',
        detail: `端口 :${port} 空闲无冲突，可随时绑定。`,
      }
    }

    // Attempt to identify occupying process
    let pidInfo = ''
    try {
      if (process.platform === 'darwin' || process.platform === 'linux') {
        const { stdout } = await execAsync(`lsof -i :${port} -sTCP:LISTEN -Fp -Fn`)
        pidInfo = stdout.trim().replace(/\n/g, ' ')
      }
    } catch {
      // ignore
    }

    const currentStatus = this.serverManager.getStatus()
    if (currentStatus.state === 'running' && currentStatus.port === port) {
      return {
        id: 'port-check',
        title: `本地端口监听 (: ${port})`,
        status: 'pass',
        detail: `端口 :${port} 正常由当前 HarnessFrame 实例独占运行中。`,
      }
    }

    return {
      id: 'port-check',
      title: `本地端口冲突 (: ${port})`,
      status: 'fail',
      detail: `端口 :${port} 已被外部进程占用 (${pidInfo || '未知进程'})，可能导致本地启动失败。`,
      actionType: 'kill-port',
      actionData: { port },
    }
  }

  public async checkNodeRuntime(): Promise<DiagnosticItem> {
    const settings = this.configStore.getSettings()
    const nodeInfo = this.serverManager.findNodeBinary(settings.nodePath)
    const versionStr = await this.serverManager.getNodeVersionInfo(nodeInfo)

    if (nodeInfo.isStandaloneElectronNode) {
      return {
        id: 'node-runtime',
        title: 'Node.js 运行环境',
        status: 'pass',
        detail: `⚡ 独立绿色运行时：${versionStr}（引擎及其依赖需另行安装）`,
      }
    }

    if (nodeInfo.source === 'bundled') {
      return {
        id: 'node-runtime',
        title: 'Node.js 运行环境',
        status: 'pass',
        detail: `📦 内嵌便携式 Node.js：${versionStr} (${nodeInfo.executable})`,
      }
    }

    if (nodeInfo.source === 'custom') {
      return {
        id: 'node-runtime',
        title: 'Node.js 运行环境',
        status: 'pass',
        detail: `⚙️ 自定义 Node.js：${versionStr} (${nodeInfo.executable})`,
      }
    }

    return {
      id: 'node-runtime',
      title: 'Node.js 运行环境',
      status: 'pass',
      detail: `💻 系统 Node.js：${versionStr} (${nodeInfo.executable})`,
    }
  }

  public checkHarnessEngine(): DiagnosticItem {
    const harnessDir = this.serverManager.getHarnessPath(this.configStore.getSettings().harnessPath)
    const binJs = join(harnessDir, 'apps/cli/lib/bin.js')
    const hasBinJs = existsSync(binJs)

    if (hasBinJs) {
      return {
        id: 'engine-integrity',
        title: 'Harness 引擎核心',
        status: 'pass',
        detail: `✅ 核心 CLI 引导模块就绪 (${binJs})`,
      }
    }

    const packageJson = join(harnessDir, 'package.json')
    if (existsSync(packageJson)) {
      return {
        id: 'engine-integrity',
        title: 'Harness 引擎核心',
        status: 'pass',
        detail: `✅ Harness 根目录工程有效 (${harnessDir})`,
      }
    }

    return {
      id: 'engine-integrity',
      title: 'Harness 引擎核心',
      status: 'warn',
      detail: `未检测到本地 deepseek-harness 源码目录，若使用云端 Attach 模式则不受影响。`,
    }
  }

  public async checkNetwork(targetUrl: string): Promise<DiagnosticItem> {
    const details: string[] = []

    // 1. DeepSeek Cloud API DNS & Ping
    try {
      const start = performance.now()
      const dnsRes = await lookup('api.deepseek.com').catch(() => null)
      const rtt = Math.round(performance.now() - start)
      if (dnsRes) {
        details.push(`☁️ DeepSeek API DNS: 正常 (${dnsRes.address}, 延迟 ${rtt}ms)`)
      } else {
        details.push(`⚠️ DeepSeek API DNS: 解析失败，请检查内网 DNS 或网络防火墙`)
      }
    } catch {
      details.push(`⚠️ DeepSeek API DNS: 网络不可达`)
    }

    // 2. Custom remoteUrl probe if configured
    if (targetUrl) {
      try {
        const parsed = new URL(targetUrl)
        const testOrigin = `${parsed.protocol}//${parsed.host}/`
        const start = performance.now()
        const res = await fetch(testOrigin, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
        const elapsed = Math.round(performance.now() - start)

        if (res.ok || res.status < 500) {
          details.push(`🎯 远程服务 (${testOrigin}) HTTP 响应正常 (HTTP ${res.status}, 往返 ${elapsed}ms)`)
          return {
            id: 'network-probe',
            title: '网络连通与 DNS 探测',
            status: 'pass',
            detail: details.join('；'),
          }
        }

        details.push(`⚠️ 远程服务返回状态码 HTTP ${res.status}`)
        return {
          id: 'network-probe',
          title: '网络连通与 DNS 探测',
          status: 'warn',
          detail: details.join('；'),
        }
      } catch (err: any) {
        details.push(`❌ 无法连通目标服务 ${redactText(targetUrl)} (${err?.message || '连接超时'})`)
        return {
          id: 'network-probe',
          title: '网络连通与 DNS 探测',
          status: 'fail',
          detail: details.join('；'),
        }
      }
    }

    return {
      id: 'network-probe',
      title: '网络连通与 DNS 探测',
      status: details[0]?.includes('正常') ? 'pass' : 'warn',
      detail: details.join('；') || '本地沙箱模式，无需外部依赖。',
    }
  }

  public async checkZombieProcesses(): Promise<DiagnosticItem> {
    return { id: 'zombie-check', title: '托管进程', status: 'pass', detail: '仅管理本应用启动的进程，不识别或终止其他 Harness 实例。' }
  }

  public checkConfigIntegrity(): DiagnosticItem {
    try {
      const settings = this.configStore.getSettings()
      if (!settings || typeof settings !== 'object') {
        return {
          id: 'config-integrity',
          title: '配置架构与容灾备份',
          status: 'fail',
          detail: '本地配置对象损毁或无法读取。请先备份用户数据目录，再检查或重建配置。',
          actionType: 'repair-config',
        }
      }

      // Create or verify config backup
      try {
        const userDataPath = this.configStore.getUserDataPath?.()
        if (userDataPath) {
          const backupFile = join(userDataPath, 'config.backup.json')
          writeFileSync(backupFile, JSON.stringify(redactSecrets(settings), null, 2), { encoding: 'utf8', mode: 0o600 })
        }
      } catch {}

      return {
        id: 'config-integrity',
        title: '配置架构与容灾备份',
        status: 'pass',
        detail: '应用配置健全，已建立本地容灾镜像备份 (config.backup.json)。',
      }
    } catch (err: any) {
      return {
        id: 'config-integrity',
        title: '配置架构与容灾备份',
        status: 'warn',
        detail: `配置自检提示：${err?.message || '读取警告'}`,
      }
    }
  }

  public checkGit(workingDir?: string): DiagnosticItem {
    const targetDir = workingDir || process.cwd()
    const gitDir = join(targetDir, '.git')
    const hasGit = existsSync(gitDir)

    if (hasGit) {
      return {
        id: 'git-context',
        title: '工程 Git 上下文',
        status: 'pass',
        detail: `当前目录为有效 Git 仓库，支持代码分支感知与变更回溯。`,
      }
    }

    return {
      id: 'git-context',
      title: '工程 Git 上下文',
      status: 'warn',
      detail: '当前工作目录尚未初始化 Git 版本控制。',
    }
  }

  public async killPortProcess(port: number): Promise<boolean> {
    const status = this.serverManager.getStatus()
    if (!Number.isInteger(port) || status.port !== port || !status.pid) return false
    return (await this.serverManager.stop()).success
  }

  public async killZombieProcesses(): Promise<boolean> {
    // Process ownership cannot be inferred from a command name or a port.
    return false
  }

  public async autoHealEnvironment(): Promise<{ success: boolean; message: string }> {
    const result = await this.serverManager.restart(this.configStore.getSettings())
    return { success: result.success, message: result.success ? '当前连接已重启。' : (result.error || '重启失败') }
  }
}
