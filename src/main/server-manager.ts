import { serviceUrl, redactText } from './security.js'
import { StringDecoder } from 'node:string_decoder'
import { spawn, type ChildProcess } from 'node:child_process'
import { join, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import treeKill from 'tree-kill'
import type { ServerStatus, LogEntry, AppSettings } from '../types/index.js'

interface RuntimeOptions {
  resourcesPath?: string
  getAppPath?: () => string
  spawn?: typeof spawn
  fetch?: typeof fetch
  kill?: typeof treeKill
  startupTimeoutMs?: number
  probeIntervalMs?: number
  healthIntervalMs?: number
  requestTimeoutMs?: number
  stopTimeoutMs?: number
}

type OperationResult = { success: boolean; error?: string }

export class ServerManager {
  private status: ServerStatus = {
    state: 'stopped',
    mode: 'remote',
    url: null,
    port: 8080,
    pid: null,
    error: null,
    startedAt: null,
  }

  private process: ChildProcess | null = null
  private logs: LogEntry[] = []
  private onStatusChangeCallbacks: Set<(status: ServerStatus) => void> = new Set()
  private onLogCallbacks: Set<(log: LogEntry) => void> = new Set()
  private healthCheckTimer: NodeJS.Timeout | null = null

  private operations: Promise<unknown> = Promise.resolve()
  private generation = 0
  private lifecycle = new AbortController()
  private readonly runtime: Required<RuntimeOptions>

  constructor(options: RuntimeOptions = {}) {
    this.runtime = {
      getAppPath: () => process.cwd(), resourcesPath: process.cwd(), spawn, fetch, kill: treeKill,
      startupTimeoutMs: 30000, probeIntervalMs: 500, healthIntervalMs: 8000,
      requestTimeoutMs: 4000, stopTimeoutMs: 5000, ...options,
    }
    this.addLog('info', 'Desktop log initialized. Managed process output and Attach connection events appear here.', 'desktop')
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.operations.then(operation)
    this.operations = next.catch(() => {})
    return next
  }

  private resetLifecycle(): number {
    this.lifecycle.abort()
    this.lifecycle = new AbortController()
    this.stopHealthCheck()
    return ++this.generation
  }

  private async probe(url: string, signal: AbortSignal): Promise<boolean> {
    try {
      const response = await this.runtime.fetch(serviceUrl(url), {
        method: 'HEAD', redirect: 'manual',
        signal: AbortSignal.any([signal, AbortSignal.timeout(this.runtime.requestTimeoutMs)]),
      })
      // Reachability is not proof of authentication. The Harness view handles login.
      return response.status < 500
    } catch { return false }
  }

  public getStatus(): ServerStatus {
    return { ...this.status }
  }

  public getLogs(): LogEntry[] {
    return [...this.logs]
  }

  public clearLogs(): void {
    this.logs = []
  }

  public onStatusChange(callback: (status: ServerStatus) => void): () => void {
    this.onStatusChangeCallbacks.add(callback)
    callback(this.getStatus())
    return () => this.onStatusChangeCallbacks.delete(callback)
  }

  public onLog(callback: (log: LogEntry) => void): () => void {
    this.onLogCallbacks.add(callback)
    return () => this.onLogCallbacks.delete(callback)
  }

  private emitStatus(partial: Partial<ServerStatus>): void {
    this.status = { ...this.status, ...partial }
    for (const cb of this.onStatusChangeCallbacks) {
      try {
        cb(this.getStatus())
      } catch (err) {
        console.error('[ServerManager] Error in status callback:', err)
      }
    }
  }

  private addLog(level: LogEntry['level'], message: string, source: LogEntry['source'] = 'server'): void {
    message = redactText(message)
    console.log(`[${source.toUpperCase()}:${level}] ${message}`)
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      level,
      message,
      source,
    }
    this.logs.push(entry)
    if (this.logs.length > MAX_LOGS_COUNT) {
      this.logs.shift()
    }
    for (const cb of this.onLogCallbacks) {
      try {
        cb(entry)
      } catch (err) {
        console.error('[ServerManager] Error in log callback:', err)
      }
    }
  }

  public getHarnessPath(configured?: string): string {
    if (configured) return resolve(configured)
    if (process.env.DSH_HARNESS_PATH) return resolve(process.env.DSH_HARNESS_PATH)
    const candidates = [
      // 1. Packaged resource directory (Production)
      join(this.runtime.resourcesPath, 'deepseek-harness'),
      // 2. Unpacked asar directory
      join(this.runtime.resourcesPath, 'app.asar.unpacked/deepseek-harness'),
      // 3. Development sibling directory
      resolve(this.runtime.getAppPath(), '../deepseek-harness'),
      // 4. Current working directory
      resolve(process.cwd(), 'deepseek-harness'),
      // 5. Direct app path
      join(this.runtime.getAppPath(), 'deepseek-harness'),
    ]

    for (const p of candidates) {
      if (existsSync(p)) return p
    }

    // Fallback to development sibling
    return resolve(this.runtime.getAppPath(), '../deepseek-harness')
  }

  public findNodeBinary(customNodePath?: string): {
    executable: string
    isStandaloneElectronNode: boolean
    source: 'custom' | 'bundled' | 'system' | 'builtin-electron'
  } {
    // Tier 1: User explicitly configured custom Node binary path
    if (customNodePath && existsSync(customNodePath)) {
      return { executable: customNodePath, isStandaloneElectronNode: false, source: 'custom' }
    }

    const isWin = process.platform === 'win32'
    const binName = isWin ? 'node.exe' : 'node'

    // Tier 2: Bundled portable Node binary in app resources (Enterprise green package)
    const bundledCandidates = [
      join(this.runtime.resourcesPath, 'bin', binName),
      join(this.runtime.resourcesPath, 'nodejs', binName),
      join(this.runtime.getAppPath(), 'bin', binName),
    ]
    for (const b of bundledCandidates) {
      if (existsSync(b)) {
        return { executable: b, isStandaloneElectronNode: false, source: 'bundled' }
      }
    }

    // Tier 3: Standard system locations based on platform
    if (isWin) {
      const candidates = [
        'C:\\Program Files\\nodejs\\node.exe',
        'C:\\Program Files (x86)\\nodejs\\node.exe',
      ]
      for (const c of candidates) {
        if (existsSync(c)) return { executable: c, isStandaloneElectronNode: false, source: 'system' }
      }
    } else {
      const candidates = [
        '/opt/homebrew/bin/node',
        '/usr/local/bin/node',
        '/usr/bin/node',
        '/bin/node',
      ]
      for (const c of candidates) {
        if (existsSync(c)) return { executable: c, isStandaloneElectronNode: false, source: 'system' }
      }
    }

    // Tier 4: Zero-Dependency Fallback: Use Electron's own built-in V8/Node.js runtime
    return {
      executable: process.execPath,
      isStandaloneElectronNode: true,
      source: 'builtin-electron',
    }
  }

  public async getNodeVersionInfo(nodeInfo: ReturnType<typeof this.findNodeBinary>): Promise<string> {
    return new Promise((resolvePromise) => {
      try {
        const env: NodeJS.ProcessEnv = { ...process.env }
        if (nodeInfo.isStandaloneElectronNode) {
          env.ELECTRON_RUN_AS_NODE = '1'
        }
        const child = spawn(nodeInfo.executable, ['-v'], {
          env,
          stdio: ['ignore', 'pipe', 'ignore'],
        })
        let output = ''
        child.stdout?.on('data', (d) => {
          output += d.toString('utf8')
        })
        child.on('close', (code) => {
          if (code === 0 && output.trim()) {
            const tag = nodeInfo.isStandaloneElectronNode ? ' (Electron 内置免安装运行时)' : ''
            resolvePromise(`${output.trim()}${tag}`)
          } else {
            resolvePromise(nodeInfo.isStandaloneElectronNode ? `v${process.versions.node} (Electron 内置)` : '未知版本')
          }
        })
        child.on('error', () => {
          resolvePromise(nodeInfo.isStandaloneElectronNode ? `v${process.versions.node} (Electron 内置)` : '未知版本')
        })
      } catch {
        resolvePromise(nodeInfo.isStandaloneElectronNode ? `v${process.versions.node} (Electron 内置)` : '未知版本')
      }
    })
  }

  public start(settings: AppSettings): Promise<OperationResult> {
    return this.enqueue(() => this.startInternal(settings))
  }

  private async startInternal(settings: AppSettings): Promise<OperationResult> {
    if (this.status.state === 'running' || this.status.state === 'starting') return { success: true }
    if (this.process) {
      const stopped = await this.stopInternal()
      if (!stopped.success) return stopped
    }
    const generation = this.resetLifecycle()
    this.emitStatus({ state: 'starting', mode: settings.mode, error: null, url: null,
      startedAt: null, port: settings.managedPort })
    return settings.mode === 'remote'
      ? this.connectRemote(settings.remoteUrl, generation)
      : this.startManagedMode(settings, generation)
  }

  public startRemoteMode(remoteUrl: string): Promise<OperationResult> {
    return this.enqueue(async () => {
      const stopped = await this.stopInternal()
      if (!stopped.success) return stopped
      const generation = this.resetLifecycle()
      this.emitStatus({ state: 'starting', mode: 'remote', error: null })
      return this.connectRemote(remoteUrl, generation)
    })
  }

  private async connectRemote(remoteUrl: string, generation: number): Promise<OperationResult> {
    try {
      const endpoint = serviceUrl(remoteUrl)
      this.addLog('info', `Attach: testing connection to ${endpoint.origin}.`, 'desktop')
      if (!await this.probe(remoteUrl, this.lifecycle.signal)) throw new Error('Harness service is unavailable')
      if (generation !== this.generation) return { success: false, error: 'Connection cancelled' }
      this.emitStatus({ state: 'running', mode: 'remote', url: remoteUrl,
        startedAt: Date.now(), pid: null, error: null })
      this.addLog('info', `Attach: connected to ${endpoint.origin}. The external Harness process remains unmanaged.`, 'desktop')
      this.startHealthCheck(remoteUrl, generation)
      return { success: true }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      if (generation === this.generation) {
        this.emitStatus({ state: 'error', mode: 'remote', error })
        this.addLog('warn', `Attach: connection failed (${error}).`, 'desktop')
      }
      return { success: false, error }
    }
  }

  private async startManagedMode(settings: AppSettings, generation: number): Promise<OperationResult> {
    const harnessDir = this.getHarnessPath(settings.harnessPath)
    const binJs = join(harnessDir, 'apps/cli/lib/bin.js')
    if (!existsSync(binJs)) {
      const error = '本地引擎尚未构建。请设置 DSH_HARNESS_PATH 指向已构建的 Harness，或使用远程连接模式。'
      this.emitStatus({ state: 'error', error })
      return { success: false, error }
    }
    const nodeInfo = this.findNodeBinary(settings.nodePath)
    const port = settings.managedPort || 8080
    const args = [binJs, 'web', '--no-open', '--port', String(port),
      ...(settings.extraArgs?.split(/\s+/).filter(Boolean) || [])]
    try {
      const env: NodeJS.ProcessEnv = { ...process.env, DSH_DESKTOP_WRAPPED: '1' }
      if (nodeInfo.isStandaloneElectronNode) env.ELECTRON_RUN_AS_NODE = '1'
      const child = this.runtime.spawn(nodeInfo.executable, args, {
        cwd: harnessDir, env, stdio: ['ignore', 'pipe', 'pipe'],
      })
      this.process = child
      this.emitStatus({ pid: child.pid ?? null, port })
      const signal = this.lifecycle.signal
      const isCurrent = () => this.process === child && generation === this.generation
      let announcedUrl: string | undefined
      const acceptLine = (line: string, level: 'info' | 'warn') => {
        if (!isCurrent() || !line.trim()) return
        const clean = line.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '').trim()
        this.addLog(level, clean, 'server')
        const match = clean.match(/https?:\/\/(?:127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\]):\d+[^\s'"`]*/i)
        if (match && !announcedUrl) {
          try { announcedUrl = serviceUrl(match[0].replace('://0.0.0.0:', '://127.0.0.1:')).href }
          catch { /* Ignore malformed announcements; startup remains bounded. */ }
        }
      }
      // Keep UTF-8 and token boundaries intact. Oversized lines are discarded whole.
      for (const [stream, level] of [[child.stdout, 'info'], [child.stderr, 'warn']] as const) {
        const decoder = new StringDecoder('utf8')
        let pending = ''
        let discard = false
        const consume = (text: string) => {
          for (const part of text.split(/(?<=\n)/)) {
            const complete = part.endsWith('\n')
            if (!discard) {
              pending += part
              if (pending.length > 65536) { pending = ''; discard = true }
            }
            if (complete) {
              if (!discard) acceptLine(pending, level)
              pending = ''; discard = false
            }
          }
        }
        stream?.on('data', (chunk: Buffer) => consume(decoder.write(chunk)))
        stream?.on('end', () => { consume(decoder.end()); if (!discard) acceptLine(pending, level) })
      }
      child.on('error', (err) => {
        if (this.process !== child) return
        this.resetLifecycle()
        this.emitStatus({ state: 'error', error: `Failed to spawn Harness process: ${err.message}` })
      })
      child.on('close', (code) => {
        if (this.process !== child) return
        const stopping = this.status.state === 'stopping'
        const priorError = this.status.error
        this.process = null
        this.resetLifecycle()
        this.emitStatus({ state: stopping ? 'stopped' : 'error', pid: null, url: null,
          startedAt: null, error: stopping ? null : priorError || `Harness exited before disconnect (code ${code})` })
      })
      void (async () => {
        const deadline = Date.now() + this.runtime.startupTimeoutMs
        while (isCurrent() && !signal.aborted && Date.now() < deadline) {
          // Never guess a fallback URL: it may belong to an unrelated process.
          const url = announcedUrl
          if (url && await this.probe(url, AbortSignal.any([signal,
            AbortSignal.timeout(Math.max(1, deadline - Date.now()))]))) {
            if (!isCurrent() || signal.aborted) return
            this.emitStatus({ state: 'running', url, startedAt: Date.now(), error: null })
            this.startHealthCheck(url, generation)
            return
          }
          await new Promise<void>(resolve => {
            const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve() }
            const timer = setTimeout(done, this.runtime.probeIntervalMs)
            signal.addEventListener('abort', done, { once: true })
            if (signal.aborted) done()
          })
        }
        if (!isCurrent() || signal.aborted) return
        await this.enqueue(async () => {
          if (!isCurrent()) return
          const stopped = await this.stopInternal()
          this.emitStatus({ state: 'error', error: 'Harness startup timed out: no reachable announced URL.' +
            (stopped.success ? '' : ` ${stopped.error}`) })
        })
      })()
      return { success: true }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      this.emitStatus({ state: 'error', error })
      return { success: false, error }
    }
  }

  private startHealthCheck(url: string, generation: number): void {
    this.stopHealthCheck()
    const signal = this.lifecycle.signal
    let failures = 0
    const check = async () => {
      const healthy = await this.probe(url, signal)
      if (signal.aborted || generation !== this.generation) return
      failures = healthy ? 0 : failures + 1
      if (healthy && this.status.state === 'starting') {
        this.emitStatus({ state: 'running', error: null })
      } else if (failures >= 2) {
        this.emitStatus({ state: 'starting', error: '服务短暂离线，正在尝试自动重新连接...' })
      }
      this.healthCheckTimer = setTimeout(check, this.runtime.healthIntervalMs)
    }
    this.healthCheckTimer = setTimeout(check, this.runtime.healthIntervalMs)
  }

  private stopHealthCheck(): void {
    if (this.healthCheckTimer) clearTimeout(this.healthCheckTimer)
    this.healthCheckTimer = null
  }

  public stop(): Promise<OperationResult> {
    return this.enqueue(() => this.stopInternal())
  }

  private async stopInternal(): Promise<OperationResult> {
    this.resetLifecycle()
    const child = this.process
    if (!child) {
      if (this.status.mode === 'remote' && this.status.state !== 'stopped') {
        this.addLog('info', 'Attach: disconnected. The external Harness process was left running.', 'desktop')
      }
      this.emitStatus({ state: 'stopped', pid: null, url: null, error: null, startedAt: null })
      return { success: true }
    }
    this.emitStatus({ state: 'stopping' })
    const result = await new Promise<OperationResult>(resolve => {
      let settled = false
      let forced = false
      let lastError = ''
      let timer: ReturnType<typeof setTimeout>
      const finish = (result: OperationResult) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        child.removeListener('close', closed)
        resolve(result)
      }
      const closed = () => finish({ success: true })
      child.once('close', closed)
      const force = () => {
        if (settled || forced) return
        forced = true
        clearTimeout(timer)
        timer = setTimeout(() => finish({ success: false,
          error: `Harness did not close after termination${lastError ? ': ' + lastError : ''}` }), this.runtime.stopTimeoutMs)
        send('SIGKILL')
      }
      const send = (signal: string) => {
        if (!child.pid) return // A failed spawn still emits close; keep the bounded wait.
        try {
          this.runtime.kill(child.pid, signal, (err) => {
            if (settled || !err) return
            lastError = err.message
            if (!forced) force()
          })
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err)
          if (!forced) force()
        }
      }
      timer = setTimeout(force, this.runtime.stopTimeoutMs)
      send('SIGTERM')
    })
    if (!result.success) {
      // Keep ownership so a later stop can retry; never launch a replacement yet.
      this.emitStatus({ state: 'error', error: result.error || 'Failed to stop Harness' })
    }
    return result
  }

  public restart(settings: AppSettings): Promise<OperationResult> {
    return this.enqueue(async () => {
      const stopped = await this.stopInternal()
      return stopped.success ? this.startInternal(settings) : stopped
    })
  }

  public applySettings(newSettings: AppSettings, oldSettings?: AppSettings): Promise<void> {
    return this.enqueue(async () => {
      const changed = !oldSettings || ['mode', 'remoteUrl', 'managedPort', 'nodePath', 'harnessPath', 'extraArgs']
        .some(key => newSettings[key as keyof AppSettings] !== oldSettings[key as keyof AppSettings])
      if (!changed) return
      const active = this.status.state === 'running' || this.status.state === 'starting' || !!this.process
      if (active) {
        const stopped = await this.stopInternal()
        if (!stopped.success) return
        await this.startInternal(newSettings)
      } else this.emitStatus({ mode: newSettings.mode, port: newSettings.managedPort })
    })
  }
}

const MAX_LOGS_COUNT = 1000
