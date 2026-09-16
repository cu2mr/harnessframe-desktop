import type { AgentPresetAsset } from '../types/index.js'

/**
 * Optional community example settings (settings.yaml).
 */
export const DEFAULT_COMMUNITY_SETTINGS_YAML = `# ==============================================================================
# HarnessFrame - community example configuration
# Review every provider, model and plugin before importing it into DeepSeek Harness.
# ==============================================================================

# 模型路由与提供方配置
deepseek:
  displayName: DeepSeek 官方
  baseURL: https://api.deepseek.com
  protocol: deepseek
  apiKeyEnv: DEEPSEEK_API_KEY
  models:
    deepseek-chat:
      displayName: DeepSeek-V3 (通用高智商大模型)
      contextWindow: 65536
      maxOutputTokens: 8192
    deepseek-reasoner:
      displayName: DeepSeek-R1 (深度推理思维链模型)
      contextWindow: 65536
      maxOutputTokens: 8192
      reasoningEfforts:
        - low
        - medium
        - high

# 本地 Ollama 私有算力引擎 (可选备用)
ollama-local:
  displayName: 本地 Ollama 算力集群
  baseURL: http://127.0.0.1:11434/v1
  protocol: openai
  apiKeyEnv: OLLAMA_API_KEY
  models:
    deepseek-r1:8b:
      displayName: DeepSeek-R1-8B (本地轻量推理)
      contextWindow: 32768
      maxOutputTokens: 4096
    qwen2.5-coder:7b:
      displayName: Qwen2.5-Coder-7B (本地高密代码)
      contextWindow: 32768
      maxOutputTokens: 4096

# 插件全局策略与参数
plugins:
  terminal:
    timeoutMs: 60000
  subagent-model-selection:
    enabled: true
    allowedModels:
      - provider: deepseek
        model: deepseek-chat
      - provider: deepseek
        model: deepseek-reasoner
  web-search:
    provider: deepseek
`

/**
 * Optional community example agent presets.
 */
export const DEFAULT_COMMUNITY_AGENT_PRESETS: AgentPresetAsset[] = [
  {
    id: 'community-development',
    name: '社区研发示例智能体',
    description: '用于演示配置格式的研发智能体；导入前请按团队规范审查。',
    order: 1,
    files: {
      'preset.yml': `name: 社区研发示例智能体
description: 用于演示配置格式的研发智能体；导入前请按团队规范审查。
order: 1
`,
      'agent.cordis.yml': `# 示例研发智能体运行时编排
- id: system-prompt-community
  name: cordis:group
  config:
    - id: prompt-community
      name: '@deepseek-ai/dsh-system-prompt-static'
      config:
        text: |
          你是一个代码与架构研发助手示例。
          在响应任务时，请坚持以下准则：
          1. 遵循团队代码规范，保证高内聚、低耦合、完备的错误处理与严格类型系统。
          2. 代码重构优先采用可维护的面向对象或函数式组合模式。
          3. 积极使用本地工具检索与验证，确保每一次变更均通过自动化构建与测试。
`,
    },
  },
  {
    id: 'community-security-review',
    name: '社区安全审查示例智能体',
    description: '用于演示安全审查提示词；不构成完整的安全审计或合规保证。',
    order: 2,
    files: {
      'preset.yml': `name: 社区安全审查示例智能体
description: 用于演示安全审查提示词；不构成完整的安全审计或合规保证。
order: 2
`,
      'agent.cordis.yml': `# Community security review example
- id: system-prompt-security
  name: cordis:group
  config:
    - id: prompt-security
      name: '@deepseek-ai/dsh-system-prompt-static'
      config:
        text: |
          你是一个安全与代码审查助手示例。
          你的职责是协助团队识别潜在的安全漏洞、合规隐患和敏感数据泄露：
          1. 严格检查 SQL 注入、OS 命令执行、SSRF、XSS 及不安全反序列化漏洞。
          2. 检查硬编码密钥、内部 IP、敏感个人身份数据（DLP 规范）。
          3. 审查身份认证与权限控制逻辑，确保不存在越权访问（IDOR）与权限逃逸。
`,
    },
  },
]
