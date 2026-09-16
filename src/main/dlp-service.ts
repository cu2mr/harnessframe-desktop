import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import type { DlpSettings, DlpScanResult, DlpMatch, DlpRuleType } from '../types/index.js'

const DEFAULT_DLP_SETTINGS: DlpSettings = {
  enabled: true,
  mode: 'mask',
  scanApiKeys: true,
  scanPii: true,
  scanInternalIps: true,
}

interface DlpRuleDefinition {
  type: DlpRuleType
  label: string
  pattern: RegExp
}

export class DlpService {
  private settings: DlpSettings
  private settingsPath: string
  private auditLogPath: string
  private rules: DlpRuleDefinition[] = []

  constructor() {
    const userData = app.getPath('userData')
    this.settingsPath = join(userData, 'dsh-dlp-settings.json')
    this.auditLogPath = join(userData, 'dsh-audit.log')
    this.settings = this.loadSettings()
    this.initRules()
  }

  private loadSettings(): DlpSettings {
    try {
      if (existsSync(this.settingsPath)) {
        const raw = readFileSync(this.settingsPath, 'utf8')
        return { ...DEFAULT_DLP_SETTINGS, ...JSON.parse(raw) }
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_DLP_SETTINGS }
  }

  public getSettings(): DlpSettings {
    return { ...this.settings }
  }

  public updateSettings(partial: Partial<DlpSettings>): DlpSettings {
    this.settings = { ...this.settings, ...partial }
    try {
      writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), { encoding: 'utf8', mode: 0o600 })
    } catch (err) {
      console.error('[DlpService] Failed to persist DLP settings:', err)
    }
    return { ...this.settings }
  }

  private initRules(): void {
    this.rules = [
      // 1. API Keys & Cloud Access Tokens
      {
        type: 'api-key',
        label: 'LLM / Cloud API 密钥',
        pattern: /\b(sk-[a-zA-Z0-9]{32,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36})\b/g,
      },
      // 2. Private Keys
      {
        type: 'private-key',
        label: 'RSA / SSH 私钥证书',
        pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
      },
      // 3. PII: Mobile Phones
      {
        type: 'phone',
        label: '个人手机号',
        pattern: /(?<!\d)1[3-9]\d{9}(?!\d)/g,
      },
      // 4. PII: Mainland 18-digit IDs
      {
        type: 'id-card',
        label: '大陆居民身份证',
        pattern: /(?<!\d)[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/g,
      },
      // 5. Internal Network RFC1918 IPs
      {
        type: 'private-ip',
        label: '企业内网 IP 地址',
        pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/g,
      },
    ]
  }

  public scan(text: string): DlpScanResult {
    if (!this.settings.enabled || !text) {
      return {
        hasSensitiveData: false,
        matches: [],
        maskedText: text,
        auditAction: 'pass',
      }
    }

    const matches: DlpMatch[] = []
    let masked = text

    for (const r of this.rules) {
      if (r.type === 'api-key' || r.type === 'private-key') {
        if (!this.settings.scanApiKeys) continue
      } else if (r.type === 'phone' || r.type === 'id-card') {
        if (!this.settings.scanPii) continue
      } else if (r.type === 'private-ip') {
        if (!this.settings.scanInternalIps) continue
      }

      const regex = new RegExp(r.pattern.source, r.pattern.flags)
      let m: RegExpExecArray | null
      while ((m = regex.exec(text)) !== null) {
        matches.push({
          rule: r.type,
          label: r.label,
          matchedText: m[0],
          index: m.index,
          length: m[0].length,
        })
      }
    }

    if (matches.length === 0) {
      return {
        hasSensitiveData: false,
        matches: [],
        maskedText: text,
        auditAction: 'pass',
      }
    }

    // Process action based on DLP mode
    let auditAction: 'pass' | 'masked' | 'blocked' = 'masked'
    if (this.settings.mode === 'block') {
      auditAction = 'blocked'
    } else if (this.settings.mode === 'warn') {
      auditAction = 'pass'
    } else {
      // mode: 'mask'
      auditAction = 'masked'
      // Replace sensitive matches in maskedText
      for (const item of matches) {
        const maskLabel = `[DLP_PROTECTED_${item.rule.toUpperCase()}]`
        masked = masked.split(item.matchedText).join(maskLabel)
      }
    }

    // Write audit log entry
    this.writeAuditLog({
      timestamp: Date.now(),
      matchCount: matches.length,
      action: auditAction,
      types: [...new Set(matches.map((m) => m.rule))],
    })

    return {
      hasSensitiveData: true,
      matches,
      maskedText: masked,
      auditAction,
    }
  }

  private writeAuditLog(entry: any): void {
    try {
      const line = `[${new Date(entry.timestamp).toISOString()}] [DLP-${entry.action.toUpperCase()}] Matches: ${entry.matchCount}, Rules: ${entry.types.join(',')}\n`
      appendFileSync(this.auditLogPath, line, { encoding: 'utf8', mode: 0o600 })
    } catch {
      // ignore
    }
  }
}
