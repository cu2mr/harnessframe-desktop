import React, { useState, useEffect, useRef } from 'react'
import type { ServerStatus, WorkspaceProfile, LogEntry } from '@shared-types/index.js'
import {
  X,
  Folder,
  MessageSquarePlus,
  Globe,
  Terminal,
  ChevronRight,
  Sparkles,
  Bot,
  User,
  RotateCcw,
  ExternalLink,
  Code2,
  CheckCircle2,
  FileCode,
  FileText,
  FolderOpen,
  Shield,
} from 'lucide-react'
import { CodexPet } from './CodexPet.js'

interface Props {
  isOpen: boolean
  isDark?: boolean
  status: ServerStatus
  activeWorkspace?: WorkspaceProfile | null
  activeTab?: TabType
  onTabChange?: (tab: TabType) => void
  onClose: () => void
  onOpenLogs?: () => void
  onOpenBrowser?: () => void
  onOpenEnterprise?: () => void
}

type TabType = 'home' | 'pet' | 'files' | 'chat' | 'browser' | 'terminal'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export const SidePanel: React.FC<Props> = ({
  isOpen,
  isDark = true,
  status,
  activeWorkspace,
  activeTab: controlledTab,
  onTabChange,
  onClose,
  onOpenLogs,
  onOpenBrowser,
  onOpenEnterprise,
}) => {
  const [internalTab, setInternalTab] = useState<TabType>('home')
  const activeTab = controlledTab ?? internalTab

  const setActiveTab = (tab: TabType) => {
    setInternalTab(tab)
    if (onTabChange) onTabChange(tab)
  }
  const messages: ChatMessage[] = [
    {
      id: 'msg-1',
      role: 'assistant',
      content: '社区预览版尚未接入侧边聊天模型。请在主 Harness 页面中使用其聊天能力。',
      timestamp: '刚刚',
    },
  ]
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Real-time logs stream
  const [logs, setLogs] = useState<LogEntry[]>([])

  useEffect(() => {
    if (!window.dshDesktop) return
    const unsubscribe = window.dshDesktop.onServerLog((entry) => {
      setLogs((prev) => [...prev.slice(-99), entry])
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeTab])

  if (!isOpen) return null

  const handleOpenTerminal = () => {
    if (window.dshDesktop) {
      void window.dshDesktop.openInTerminal(activeWorkspace?.workingDirectory)
    }
  }

  const handleOpenVSCode = () => {
    if (window.dshDesktop) {
      void window.dshDesktop.openInEditor(activeWorkspace?.workingDirectory)
    }
  }

  return (
    <aside
      className={`w-[380px] h-[calc(100vh-var(--titlebar-height))] flex flex-col border-l transition-all select-none z-30 ${
        isDark
          ? 'bg-slate-900/95 border-slate-800/80 text-slate-200'
          : 'bg-white/95 border-slate-200 text-slate-800'
      }`}
    >
      {/* Top Header & Tab Navigation */}
      <div
        className={`px-3 py-2.5 border-b flex items-center justify-between shrink-0 ${
          isDark ? 'border-slate-800/80 bg-slate-950/40' : 'border-slate-100 bg-slate-50/70'
        }`}
      >
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('home')}
            className={`px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'home'
                ? isDark
                  ? 'bg-slate-800 text-sky-400 font-semibold'
                  : 'bg-white text-sky-700 font-semibold shadow-2xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            主页
          </button>
          <button
            onClick={() => setActiveTab('pet')}
            className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'pet'
                ? isDark
                  ? 'bg-slate-800 text-amber-400 font-semibold'
                  : 'bg-white text-amber-700 font-semibold shadow-2xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🐾</span>
            <span>萌宠</span>
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'chat'
                ? isDark
                  ? 'bg-slate-800 text-sky-400 font-semibold'
                  : 'bg-white text-sky-700 font-semibold shadow-2xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles size={12} />
            <span>侧边聊天</span>
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'files'
                ? isDark
                  ? 'bg-slate-800 text-sky-400 font-semibold'
                  : 'bg-white text-sky-700 font-semibold shadow-2xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Folder size={12} />
            <span>工程文件</span>
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
              activeTab === 'terminal'
                ? isDark
                  ? 'bg-slate-800 text-emerald-400 font-semibold'
                  : 'bg-white text-emerald-700 font-semibold shadow-2xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal size={12} />
            <span>终端日志</span>
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className={`p-1 rounded-md transition-colors cursor-pointer ${
            isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'
          }`}
          title="收起侧边栏 (Cmd/Ctrl + B)"
        >
          <X size={15} />
        </button>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* VIEW 1: HOME (Codex Style Shortcuts Menu) */}
        {activeTab === 'home' && (
          <div className="p-4 space-y-6 flex-1">
            {/* Active Workspace Info Banner */}
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between ${
                isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      activeWorkspace?.colorBadge ||
                      (activeWorkspace?.mode === 'managed' ? '#38bdf8' : '#10b981'),
                  }}
                />
                <div>
                  <div className="text-xs font-semibold">{activeWorkspace?.name || '本地工作区'}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {activeWorkspace?.mode === 'managed'
                      ? `本地端口 :${activeWorkspace?.managedPort || 8080}`
                      : activeWorkspace?.remoteUrl || '远程集群'}
                  </div>
                </div>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                {status.state === 'running' ? '运行中' : '就绪'}
              </span>
            </div>

            {/* Quick Actions List (Matching Codex Screenshot) */}
            <div className="space-y-2">
              <div className="text-[11px] font-medium text-slate-400 px-1">生产力快捷操作</div>

              {/* 1. 文件 */}
              <button
                onClick={() => setActiveTab('files')}
                className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer group text-left ${
                  isDark
                    ? 'bg-slate-950/40 hover:bg-slate-800/80 border-slate-800/80 text-slate-200 hover:border-slate-700'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 group-hover:scale-110 transition-transform">
                    <Folder size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-medium">文件</div>
                    <div className="text-[10px] text-slate-500">浏览工程代码与目录结构</div>
                  </div>
                </div>
                <kbd
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-slate-400'
                      : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  ⌘P
                </kbd>
              </button>

              {/* 2. 侧边聊天 */}
              <button
                onClick={() => setActiveTab('chat')}
                className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer group text-left ${
                  isDark
                    ? 'bg-slate-950/40 hover:bg-slate-800/80 border-slate-800/80 text-slate-200 hover:border-slate-700'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 group-hover:scale-110 transition-transform">
                    <MessageSquarePlus size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-medium">侧边聊天（未接入）</div>
                    <div className="text-[10px] text-slate-500">请使用主 Harness 页面中的聊天功能</div>
                  </div>
                </div>
                <kbd
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-slate-400'
                      : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  ⌥⌘S
                </kbd>
              </button>

              {/* 3. 浏览器 */}
              <button
                onClick={() => {
                  if (onOpenBrowser) onOpenBrowser()
                  else if (status.url && window.dshDesktop) window.dshDesktop.openExternalUrl(status.url)
                }}
                className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer group text-left ${
                  isDark
                    ? 'bg-slate-950/40 hover:bg-slate-800/80 border-slate-800/80 text-slate-200 hover:border-slate-700'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                    <Globe size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-medium">浏览器</div>
                    <div className="text-[10px] text-slate-500">在系统默认浏览器中独立打开</div>
                  </div>
                </div>
                <kbd
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-slate-400'
                      : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  ⌘T
                </kbd>
              </button>

              {/* 4. 终端 */}
              <button
                onClick={() => setActiveTab('terminal')}
                className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer group text-left ${
                  isDark
                    ? 'bg-slate-900/40 hover:bg-slate-800/80 border-slate-800/80 text-slate-200 hover:border-slate-700'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
                    <Terminal size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-medium">终端 & 日志</div>
                    <div className="text-[10px] text-slate-500">实时控制台日志与系统终端</div>
                  </div>
                </div>
                <kbd
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    isDark
                      ? 'bg-slate-900 border-slate-700 text-slate-400'
                      : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  ^`
                </kbd>
              </button>

              {/* 5. Preview tools and authentication status */}
              {onOpenEnterprise && (
                <button
                  onClick={onOpenEnterprise}
                  className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer group text-left ${
                    isDark
                      ? 'bg-slate-950/40 hover:bg-slate-800/80 border-slate-800/80 text-slate-200 hover:border-emerald-800/60'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                      <Shield size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-medium flex items-center gap-1.5">
                        <span>实验工具与认证状态</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          PREVIEW
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500">SSO 尚未实现 · 文本规则测试 · 团队配置</div>
                    </div>
                  </div>
                  <kbd
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      isDark
                        ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-400'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}
                  >
                    DLP
                  </kbd>
                </button>
              )}
            </div>

            {/* Codex Coding Pet Companion Widget */}
            <div className="pt-2">
              <div className="text-[11px] font-medium text-slate-400 px-1 mb-2">Codex 编程伴侣</div>
              <CodexPet
                status={status}
                isDark={isDark}
                mode="panel"
              />
            </div>
          </div>
        )}

        {/* VIEW: CODEX PET PLAYGROUND (伴写萌宠乐园) */}
        {activeTab === 'pet' && (
          <div className="p-4 space-y-4 flex-1">
            <CodexPet
              status={status}
              isDark={isDark}
              mode="panel"
            />
            {/* Companion Tips Card */}
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                isDark ? 'bg-slate-950/40 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                <span>💡</span>
                <span>关于 Codex 伴写萌宠</span>
              </div>
              <ul className="list-disc list-inside text-[11px] space-y-1.5 text-slate-400 leading-relaxed">
                <li><strong className="text-slate-300">状态共鸣：</strong>服务启动敲代码时萌宠会戴上眼镜同步打字；服务报错时会头上冒出感叹号警惕排查。</li>
                <li><strong className="text-slate-300">小鸭调试法：</strong>输入卡壳逻辑，萌宠会用本地规则给出几个梳理问题，不会把内容发送给模型。</li>
                <li><strong className="text-slate-300">经验升级：</strong>每次抚摸与喂食均可累积 EXP 提升亲密度与等级。</li>
              </ul>
            </div>
          </div>
        )}

        {/* VIEW 2: Side chat availability notice */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="flex-1 p-3.5 overflow-y-auto space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs ${
                      msg.role === 'user'
                        ? 'bg-sky-600 text-white'
                        : isDark
                        ? 'bg-slate-800 text-sky-400'
                        : 'bg-slate-200 text-sky-700'
                    }`}
                  >
                    {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                  </div>
                  <div
                    className={`max-w-[82%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-sky-600 text-white rounded-tr-xs'
                        : isDark
                        ? 'bg-slate-800/90 border border-slate-700/60 text-slate-100 rounded-tl-xs'
                        : 'bg-slate-100 border border-slate-200 text-slate-800 rounded-tl-xs'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    <div
                      className={`text-[9px] mt-1 text-right ${
                        msg.role === 'user' ? 'text-sky-200' : 'text-slate-400'
                      }`}
                    >
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              ))}

              <div ref={chatEndRef} />
            </div>

            {/* Input Box */}
            <div
              className={`p-3 border-t flex items-center gap-2 ${
                isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <input
                type="text"
                disabled
                placeholder="社区预览版尚未接入侧边聊天"
                className={`flex-1 px-3 py-2 rounded-lg border text-xs outline-none focus:ring-1 focus:ring-sky-500 ${
                  isDark
                    ? 'bg-slate-900 border-slate-700/80 text-slate-100'
                    : 'bg-white border-slate-300 text-slate-900'
                }`}
              />
            </div>
          </div>
        )}

        {/* VIEW 3: FILES (Workspace Project File Tree) */}
        {activeTab === 'files' && (
          <div className="p-3.5 space-y-4 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">工程工作目录</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleOpenVSCode}
                  className={`p-1.5 rounded-md text-xs border flex items-center gap-1 cursor-pointer ${
                    isDark ? 'hover:bg-slate-800 border-slate-800' : 'hover:bg-slate-100 border-slate-200'
                  }`}
                  title="在 VS Code 中打开"
                >
                  <Code2 size={13} className="text-sky-400" />
                  <span className="text-[11px]">VS Code</span>
                </button>
                <button
                  onClick={handleOpenTerminal}
                  className={`p-1.5 rounded-md text-xs border flex items-center gap-1 cursor-pointer ${
                    isDark ? 'hover:bg-slate-800 border-slate-800' : 'hover:bg-slate-100 border-slate-200'
                  }`}
                  title="在系统终端中打开"
                >
                  <Terminal size={13} className="text-emerald-400" />
                  <span className="text-[11px]">终端</span>
                </button>
              </div>
            </div>

            <div
              className={`p-3 rounded-lg border font-mono text-[11px] truncate ${
                isDark ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              {activeWorkspace?.workingDirectory || '默认混合工程沙箱目录'}
            </div>

            {/* Quick File Categories */}
            <div className="space-y-1.5 text-xs">
              <div className="p-2 rounded-lg hover:bg-slate-800/40 flex items-center gap-2 cursor-pointer">
                <FolderOpen size={15} className="text-amber-400" />
                <span className="font-medium">src / main</span>
                <span className="text-[10px] text-slate-500 ml-auto">主进程架构</span>
              </div>
              <div className="p-2 rounded-lg hover:bg-slate-800/40 flex items-center gap-2 cursor-pointer">
                <FolderOpen size={15} className="text-sky-400" />
                <span className="font-medium">src / renderer</span>
                <span className="text-[10px] text-slate-500 ml-auto">React 界面层</span>
              </div>
              <div className="p-2 rounded-lg hover:bg-slate-800/40 flex items-center gap-2 cursor-pointer">
                <FileCode size={15} className="text-emerald-400" />
                <span className="font-medium">package.json</span>
                <span className="text-[10px] text-slate-500 ml-auto">依赖与脚本</span>
              </div>
              <div className="p-2 rounded-lg hover:bg-slate-800/40 flex items-center gap-2 cursor-pointer">
                <FileText size={15} className="text-slate-400" />
                <span className="font-medium">README.md</span>
                <span className="text-[10px] text-slate-500 ml-auto">文档指南</span>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: TERMINAL & LOGS */}
        {activeTab === 'terminal' && (
          <div className="flex-1 flex flex-col h-full bg-slate-950 font-mono text-[11px] p-3 text-slate-300 overflow-y-auto space-y-1">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-slate-500">
              <span>实时服务日志流</span>
              <button
                onClick={handleOpenTerminal}
                className="hover:text-emerald-400 text-xs flex items-center gap-1 cursor-pointer"
              >
                <ExternalLink size={11} />
                <span>独立终端</span>
              </button>
            </div>
            {logs.length === 0 ? (
              <div className="text-slate-500 py-8 text-center">暂无实时日志输出</div>
            ) : (
              logs.slice(-30).map((l, i) => (
                <div key={i} className="leading-relaxed">
                  <span className="text-slate-600">[{l.timestamp}]</span>{' '}
                  <span
                    className={
                      l.level === 'error'
                        ? 'text-rose-400'
                        : l.level === 'warn'
                        ? 'text-amber-400'
                        : 'text-slate-300'
                    }
                  >
                    {l.message}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
