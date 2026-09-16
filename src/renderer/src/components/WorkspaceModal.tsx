import React, { useState } from 'react'
import type { WorkspaceProfile, BrandPresetIcon } from '@shared-types/index.js'
import { X, Server, Cloud, Terminal, Code2, Check, Trash2, Folder, Sparkles, Cpu, Shield, Bot, Palette } from 'lucide-react'

interface Props {
  isOpen: boolean
  isDark?: boolean
  onClose: () => void
  onSave: (profile: WorkspaceProfile) => void
  onDelete?: (id: string) => void
  initialProfile?: WorkspaceProfile | null
}

const COLOR_OPTIONS = ['#38bdf8', '#10b981', '#a855f7', '#f43f5e', '#f59e0b', '#06b6d4']

export const WorkspaceModal: React.FC<Props> = ({
  isOpen,
  isDark = true,
  onClose,
  onSave,
  onDelete,
  initialProfile,
}) => {
  const isEditing = !!initialProfile
  const [name, setName] = useState(initialProfile?.name || '')
  const [mode, setMode] = useState<'managed' | 'remote'>(initialProfile?.mode || 'managed')
  const [port, setPort] = useState(initialProfile?.managedPort || 8080)
  const [remoteUrl, setRemoteUrl] = useState(initialProfile?.remoteUrl || 'http://127.0.0.1:8080')
  const [workingDir, setWorkingDir] = useState(initialProfile?.workingDirectory || '')
  const [colorBadge, setColorBadge] = useState(initialProfile?.colorBadge || '#38bdf8')
  const [desc, setDesc] = useState(initialProfile?.description || '')

  // Brand customization override (optional per workspace)
  const [hasCustomBrand, setHasCustomBrand] = useState(!!initialProfile?.brandCustomization)
  const [brandTitle, setBrandTitle] = useState(initialProfile?.brandCustomization?.title || '')
  const [brandBadge, setBrandBadge] = useState(initialProfile?.brandCustomization?.badge || '')
  const [hideBadge, setHideBadge] = useState(initialProfile?.brandCustomization?.hideBadge || false)
  const [presetIcon, setPresetIcon] = useState<BrandPresetIcon>(initialProfile?.brandCustomization?.presetIcon || 'huazhu')
  const [customLogoUrl, setCustomLogoUrl] = useState(initialProfile?.brandCustomization?.customLogoUrl || '')

  if (!isOpen) return null

  const handleSelectDir = async () => {
    if (window.dshDesktop) {
      const selected = await window.dshDesktop.openDirectoryDialog()
      if (selected) setWorkingDir(selected)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const profile: WorkspaceProfile = {
      id: initialProfile?.id || `ws-${Date.now()}`,
      name: name.trim(),
      mode,
      managedPort: mode === 'managed' ? Number(port) : undefined,
      remoteUrl: mode === 'remote' ? remoteUrl.trim() : undefined,
      workingDirectory: workingDir.trim() || undefined,
      colorBadge,
      description: desc.trim() || undefined,
      brandCustomization: hasCustomBrand ? {
        title: brandTitle.trim() || undefined,
        badge: brandBadge.trim() || undefined,
        hideBadge,
        presetIcon,
        customLogoUrl: customLogoUrl.trim() || undefined,
      } : undefined,
    }

    onSave(profile)
    onClose()
  }

  const handleOpenTerminal = () => {
    if (window.dshDesktop) {
      void window.dshDesktop.openInTerminal(workingDir || undefined)
    }
  }

  const handleOpenVSCode = () => {
    if (window.dshDesktop) {
      void window.dshDesktop.openInEditor(workingDir || undefined)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 cursor-pointer"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div
        className={`relative w-full max-w-lg rounded-xl border shadow-2xl z-10 flex flex-col max-h-[85vh] ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900 shadow-slate-300/50'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colorBadge }} />
            <h2 className="text-sm font-semibold">
              {isEditing ? '编辑工作空间 / 实例' : '新建工作空间 / 实例'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-md transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Name & Color */}
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">工作空间名称</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：本地代码仓 / 企业算力集群"
                required
                className={`flex-1 px-3 py-2 rounded-lg border text-xs outline-none focus:ring-1 focus:ring-sky-500 ${
                  isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
              {/* Color picker pills */}
              <div className="flex items-center gap-1">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColorBadge(c)}
                    className="w-5 h-5 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                    style={{ backgroundColor: c }}
                  >
                    {colorBadge === c && <Check size={10} className="text-white drop-shadow" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mode Switcher */}
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">实例协同架构</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('managed')}
                className={`p-3 rounded-lg border flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                  mode === 'managed'
                    ? isDark
                      ? 'border-sky-500 bg-sky-950/30 text-sky-300'
                      : 'border-sky-500 bg-sky-50 text-sky-900'
                    : isDark
                    ? 'border-slate-800 bg-slate-950/60 text-slate-400'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                <Server size={18} className="shrink-0" />
                <div>
                  <div className="font-semibold text-xs">本地引擎 (Managed)</div>
                  <div className="text-[10px] text-slate-500">启动外部安装并构建好的本地引擎</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('remote')}
                className={`p-3 rounded-lg border flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                  mode === 'remote'
                    ? isDark
                      ? 'border-emerald-500 bg-emerald-950/30 text-emerald-300'
                      : 'border-emerald-500 bg-emerald-50 text-emerald-900'
                    : isDark
                    ? 'border-slate-800 bg-slate-950/60 text-slate-400'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                <Cloud size={18} className="shrink-0" />
                <div>
                  <div className="font-semibold text-xs">远程/云端 (Attach)</div>
                  <div className="text-[10px] text-slate-500">直连 GPU 算力集群或私有云</div>
                </div>
              </button>
            </div>
          </div>

          {/* Mode-specific Fields */}
          {mode === 'managed' ? (
            <div>
              <label className="block text-slate-400 mb-1.5 font-medium">本地监听端口</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className={`w-full px-3 py-2 rounded-lg border text-xs outline-none focus:ring-1 focus:ring-sky-500 font-mono ${
                  isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>
          ) : (
            <div>
              <label className="block text-slate-400 mb-1.5 font-medium">远程访问地址 (支持带 token=...)</label>
              <input
                type="url"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                placeholder="http://127.0.0.1:3080 或 https://harness.example.com"
                required
                className={`w-full px-3 py-2 rounded-lg border text-xs outline-none focus:ring-1 focus:ring-sky-500 font-mono ${
                  isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>
          )}

          {/* Working Directory */}
          <div>
            <label className="block text-slate-400 mb-1.5 font-medium">本地工程工作目录 (可选)</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={workingDir}
                onChange={(e) => setWorkingDir(e.target.value)}
                placeholder="代码工程的绝对路径"
                className={`flex-1 px-3 py-2 rounded-lg border text-xs outline-none focus:ring-1 focus:ring-sky-500 font-mono ${
                  isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
              <button
                type="button"
                onClick={handleSelectDir}
                className={`px-3 py-2 rounded-lg border flex items-center gap-1 cursor-pointer transition-colors ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 border-slate-300'
                }`}
              >
                <Folder size={14} />
                <span>浏览...</span>
              </button>
            </div>
          </div>

          {/* Optional Brand Customization Override */}
          <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800/80 bg-slate-950/40' : 'border-slate-200 bg-slate-50/50'}`}>
            <label className="flex items-center justify-between cursor-pointer select-none">
              <div className="flex items-center gap-2">
                <Palette size={14} className="text-sky-400" />
                <span className="font-semibold text-xs">专属侧边栏品牌定制</span>
                <span className="text-[10px] text-slate-500">（可选覆盖全局品牌）</span>
              </div>
              <input
                type="checkbox"
                checked={hasCustomBrand}
                onChange={(e) => setHasCustomBrand(e.target.checked)}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
            </label>

            {hasCustomBrand && (
              <div className="mt-3 space-y-3 pt-3 border-t border-slate-800/50">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">品牌名称 (标题)</label>
                    <input
                      type="text"
                      value={brandTitle}
                      onChange={(e) => setBrandTitle(e.target.value)}
                      placeholder="HarnessFrame"
                      className={`w-full px-2.5 py-1.5 rounded-md border text-xs outline-none focus:ring-1 focus:ring-sky-500 ${
                        isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 text-[11px]">版本徽标 (Badge)</label>
                    <input
                      type="text"
                      value={brandBadge}
                      disabled={hideBadge}
                      onChange={(e) => setBrandBadge(e.target.value)}
                      placeholder="Community Preview"
                      className={`w-full px-2.5 py-1.5 rounded-md border text-xs outline-none focus:ring-1 focus:ring-sky-500 ${
                        isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-300 text-slate-900'
                      } ${hideBadge ? 'opacity-40 cursor-not-allowed' : ''}`}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hideBadge}
                      onChange={(e) => setHideBadge(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-sky-600"
                    />
                    <span>隐藏徽标标签</span>
                  </label>

                  {/* Preset icon selector */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500 mr-1">图标:</span>
                    {(
                      [
                        { id: 'huazhu', label: 'HZ' },
                        { id: 'sparkles', label: '星芒' },
                        { id: 'cpu', label: '算力' },
                        { id: 'shield', label: '安全' },
                        { id: 'bot', label: '智脑' },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPresetIcon(item.id)}
                        className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors cursor-pointer ${
                          presetIcon === item.id
                            ? 'bg-sky-500/20 border-sky-500 text-sky-300 font-medium'
                            : isDark
                            ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Developer Tooling */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenTerminal}
              className={`flex-1 py-2 px-3 rounded-lg border flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                isDark ? 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300' : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700'
              }`}
            >
              <Terminal size={13} className="text-emerald-400" />
              <span>在系统终端打开</span>
            </button>

            <button
              type="button"
              onClick={handleOpenVSCode}
              className={`flex-1 py-2 px-3 rounded-lg border flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                isDark ? 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300' : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700'
              }`}
            >
              <Code2 size={13} className="text-sky-400" />
              <span>在 VS Code 打开</span>
            </button>
          </div>

          {/* Footer Actions */}
          <div className={`pt-4 border-t flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
            {isEditing && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(initialProfile.id)
                  onClose()
                }}
                className="px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
                <span>删除此工作区</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 rounded-lg border text-xs cursor-pointer ${
                  isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                }`}
              >
                取消
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs shadow-md shadow-sky-900/30 cursor-pointer"
              >
                保存并生效
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
