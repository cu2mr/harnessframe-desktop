import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  copied: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    copied: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, copied: false }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught React exception:', error, errorInfo)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleCopy = () => {
    if (this.state.error) {
      void navigator.clipboard.writeText(
        `[Think Harness Error]\nMessage: ${this.state.error.message}\nStack: ${this.state.error.stack}`
      )
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    }
  }

  public render() {
    if (this.state.hasError) {
      const isDark = typeof document !== 'undefined' ? !document.documentElement.classList.contains('light') : true

      return (
        <div className={`w-screen h-screen flex items-center justify-center p-6 select-none ${
          isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
        }`}>
          <div className={`max-w-lg w-full p-6 rounded-xl border shadow-2xl space-y-4 ${
            isDark ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200 shadow-slate-200/50'
          }`}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h1 className="text-sm font-bold">桌面界面遇到意外异常</h1>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  系统已自动拦截崩溃并保护后台服务安全运行。
                </p>
              </div>
            </div>

            <div className={`p-3 rounded-lg border text-xs font-mono max-h-36 overflow-y-auto ${
              isDark ? 'bg-slate-950 border-slate-800 text-rose-300' : 'bg-rose-50/50 border-rose-200 text-rose-700'
            }`}>
              {this.state.error?.message || '未知渲染错误'}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleCopy}
                className={`px-3 py-1.5 rounded-md text-xs border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isDark
                    ? 'border-slate-700 hover:bg-slate-800 text-slate-300'
                    : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {this.state.copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                <span>{this.state.copied ? '已复制' : '复制错误日志'}</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-1.5 rounded-md text-xs bg-sky-600 hover:bg-sky-500 text-white font-medium flex items-center gap-1.5 shadow-md shadow-sky-900/20 transition-colors cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>重新加载应用界面</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
