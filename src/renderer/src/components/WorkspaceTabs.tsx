import React from 'react'
import type { WorkspaceProfile } from '@shared-types/index.js'
import { Plus, Server, Cloud, Laptop } from 'lucide-react'

interface Props {
  workspaces: WorkspaceProfile[]
  activeId: string
  isDark?: boolean
  onSwitch: (id: string) => void
  onAddWorkspace: () => void
}

export const WorkspaceTabs: React.FC<Props> = ({
  workspaces,
  activeId,
  isDark = true,
  onSwitch,
  onAddWorkspace,
}) => {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-[480px]">
      {workspaces.map((ws) => {
        const isActive = ws.id === activeId
        const badgeColor = ws.colorBadge || (ws.mode === 'managed' ? '#38bdf8' : '#10b981')

        return (
          <button
            key={ws.id}
            onClick={() => onSwitch(ws.id)}
            title={`${ws.name} (${ws.mode === 'managed' ? `本地 :${ws.managedPort || 8080}` : ws.remoteUrl || '远程'})`}
            className={`group px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
              isActive
                ? isDark
                  ? 'bg-slate-800/90 text-slate-100 border-slate-700 shadow-sm'
                  : 'bg-white text-slate-900 border-slate-300 shadow-sm'
                : isDark
                ? 'bg-transparent text-slate-400 border-transparent hover:bg-slate-900/60 hover:text-slate-200'
                : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-100/80 hover:text-slate-900'
            }`}
          >
            {/* Environment icon / colored status dot */}
            <span
              className="w-2 h-2 rounded-full shrink-0 transition-transform group-hover:scale-125"
              style={{ backgroundColor: badgeColor }}
            />

            {ws.mode === 'managed' ? (
              <Laptop size={12} className={isActive ? 'text-sky-400' : 'text-slate-500'} />
            ) : (
              <Cloud size={12} className={isActive ? 'text-emerald-400' : 'text-slate-500'} />
            )}

            <span className="truncate max-w-[110px]">{ws.name}</span>
          </button>
        )
      })}

      {/* Add new workspace button */}
      <button
        onClick={onAddWorkspace}
        title="添加新的工作空间或远程实例"
        className={`p-1 rounded-md text-xs flex items-center justify-center transition-colors cursor-pointer border ${
          isDark
            ? 'text-slate-400 hover:text-sky-400 hover:bg-slate-900 border-transparent hover:border-slate-800'
            : 'text-slate-500 hover:text-sky-600 hover:bg-slate-100 border-transparent hover:border-slate-200'
        }`}
      >
        <Plus size={13} />
      </button>
    </div>
  )
}
