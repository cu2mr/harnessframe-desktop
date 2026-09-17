import React, { useState, useEffect } from 'react'
import type { ServerStatus, WorkspaceProfile } from '@shared-types/index.js'
import { HeaderBar } from './components/HeaderBar.js'
import { LoadingSplash } from './components/LoadingSplash.js'
import { OfflineView } from './components/OfflineView.js'
import { LogViewerModal } from './components/LogViewerModal.js'
import { SettingsModal } from './components/SettingsModal.js'
import { CommandPalette } from './components/CommandPalette.js'
import { WorkspaceModal } from './components/WorkspaceModal.js'
import { DiagnosticsModal } from './components/DiagnosticsModal.js'
import { SidePanel } from './components/SidePanel.js'
import { UpdateModal } from './components/UpdateModal.js'

export const App: React.FC = () => {
  const [status, setStatus] = useState<ServerStatus>({
    state: 'starting',
    mode: 'remote',
    url: null,
    port: 8080,
    pid: null,
    error: null,
    startedAt: null,
  })

  const [workspaces, setWorkspaces] = useState<WorkspaceProfile[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('ws-remote')
  const [showSidePanel, setShowSidePanel] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'brand' | 'sync' | 'enterprise'>('general')
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState<WorkspaceProfile | null>(null)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [sidePanelTab, setSidePanelTab] = useState<
    'home' | 'pet' | 'files' | 'chat' | 'browser' | 'terminal'
  >('home')
  // Match the synchronous bootstrap class so shell components never render one
  // theme while the document and guest view start in the other.
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('light')
      ? 'light'
      : 'dark'
  )

  useEffect(() => {
    if (!window.dshDesktop) return

    // Get initial status
    void window.dshDesktop.getServerStatus().then(setStatus)

    // Load initial theme and session state
    void window.dshDesktop.getSettings().then((s) => {
      if (s?.theme) setTheme(s.theme)
      if (s?.workspaces) setWorkspaces(s.workspaces)
      if (s?.activeWorkspaceId) setActiveWorkspaceId(s.activeWorkspaceId)
    })

    void window.dshDesktop.getSessionState().then((ss) => {
      if (typeof ss?.isSidePanelOpen === 'boolean') {
        setShowSidePanel(ss.isSidePanelOpen)
      }
    })

    // Listen to real-time status changes
    const unsubStatus = window.dshDesktop.onServerStatusChange((newStatus) => {
      setStatus(newStatus)
    })

    // Listen to native menu bar accelerators and actions
    const unsubWsSwitch = window.dshDesktop.onWorkspaceSwitchRequest((wsId) => {
      handleSwitchWorkspace(wsId)
    })

    const unsubSideToggle = window.dshDesktop.onToggleSidePanelRequest(() => {
      setShowSidePanel((prev) => !prev)
    })

    const unsubUpdates = window.dshDesktop.onCheckUpdatesRequest?.(() => {
      setShowUpdateModal(true)
    })

    const unsubSettings = window.dshDesktop.onOpenSettingsRequest?.((tab?: string) => {
      setSettingsInitialTab(tab === 'enterprise' ? 'enterprise' : 'general')
      setShowSettings(true)
    })

    const unsubDiag = window.dshDesktop.onOpenDiagnosticsRequest?.(() => {
      setShowDiagnostics(true)
    })

    return () => {
      unsubStatus()
      unsubWsSwitch()
      unsubSideToggle()
      unsubUpdates?.()
      unsubSettings?.()
      unsubDiag?.()
    }
  }, [])

  const applyTheme = (t: 'dark' | 'light' | 'system') => {
    const isDark =
      t === 'dark' ||
      (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    if (isDark) {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
      try {
        localStorage.setItem('dsh_desktop_theme', 'dark')
      } catch {}
    } else {
      document.documentElement.classList.remove('dark')
      document.documentElement.classList.add('light')
      try {
        localStorage.setItem('dsh_desktop_theme', 'light')
      } catch {}
    }
  }

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    if (window.dshDesktop) {
      void window.dshDesktop.saveSettings({ theme: next })
    }
  }

  const handleSelectDirectory = async () => {
    if (!window.dshDesktop) return
    const dir = await window.dshDesktop.openDirectoryDialog()
    if (dir) {
      console.log('[Desktop] Selected working directory:', dir)
      await window.dshDesktop.saveSettings({ nodePath: dir })
      handleStartServer()
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowCommandPalette((prev) => !prev)
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        setShowLogs((prev) => !prev)
      } else if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setShowSettings((prev) => !prev)
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 't') {
        e.preventDefault()
        handleToggleTheme()
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        setShowDiagnostics((prev) => !prev)
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setShowSidePanel((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [theme])

  // Sync side panel width to WebContentsView bounds and persist session state
  useEffect(() => {
    if (window.dshDesktop) {
      void window.dshDesktop.setSidePanelWidth(showSidePanel ? 380 : 0)
      void window.dshDesktop.saveSessionState({ isSidePanelOpen: showSidePanel })
    }
  }, [showSidePanel])

  const handleStartServer = () => {
    if (window.dshDesktop) {
      void window.dshDesktop.startServer()
    }
  }

  const handleRestartServer = () => {
    if (window.dshDesktop) {
      void window.dshDesktop.restartServer()
    }
  }

  const handleOpenBrowser = () => {
    if (status.url && window.dshDesktop) {
      void window.dshDesktop.openExternalUrl(status.url)
    }
  }

  const handleSettingsSaved = () => {
    if (window.dshDesktop) {
      void window.dshDesktop.getSettings().then((s) => {
        if (s?.workspaces) setWorkspaces(s.workspaces)
        if (s?.activeWorkspaceId) setActiveWorkspaceId(s.activeWorkspaceId)
      })
    }
  }

  // Workspaces Switching & Management
  const handleSwitchWorkspace = async (id: string) => {
    if (!window.dshDesktop || id === activeWorkspaceId) return
    setActiveWorkspaceId(id)
    const res = await window.dshDesktop.switchWorkspace(id)
    if (res.success) {
      const updated = await window.dshDesktop.getSettings()
      if (updated.workspaces) setWorkspaces(updated.workspaces)
    }
  }

  const handleSaveWorkspace = async (profile: WorkspaceProfile) => {
    if (!window.dshDesktop) return
    const updatedList = await window.dshDesktop.saveWorkspace(profile)
    setWorkspaces(updatedList)
    await handleSwitchWorkspace(profile.id)
  }

  const handleDeleteWorkspace = async (id: string) => {
    if (!window.dshDesktop) return
    const updatedList = await window.dshDesktop.deleteWorkspace(id)
    setWorkspaces(updatedList)
    const active = await window.dshDesktop.getActiveWorkspaceId()
    setActiveWorkspaceId(active)
  }

  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false)

  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  const isModalOpen =
    showSettings ||
    showLogs ||
    showCommandPalette ||
    showWorkspaceModal ||
    showDiagnostics ||
    showUpdateModal ||
    isWorkspaceMenuOpen

  const handleTogglePiP = () => {
    if (window.dshDesktop && status.url) {
      void window.dshDesktop.togglePiPWindow(status.url)
    }
  }

  // Coordinate WebContentsView URL and Visibility
  useEffect(() => {
    if (!window.dshDesktop) return

    if (status.state === 'running' && status.url) {
      void window.dshDesktop.setGuestView({
        url: status.url,
        visible: !isModalOpen,
      })
    } else {
      void window.dshDesktop.setGuestViewVisible(false)
    }
  }, [status.state, status.url, isModalOpen])

  // Sync theme to WebContentsView whenever isDark changes
  useEffect(() => {
    if (window.dshDesktop) {
      void window.dshDesktop.syncGuestViewTheme(isDark)
    }
  }, [isDark])

  const handleReloadWebview = () => {
    if (window.dshDesktop) {
      void window.dshDesktop.reloadGuestView()
    }
  }

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0] || null

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-200">
      {/* Top Custom Header */}
      <HeaderBar
        status={status}
        currentTheme={theme}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        isSidePanelOpen={showSidePanel}
        onToggleSidePanel={() => setShowSidePanel((prev) => !prev)}
        onTogglePiP={handleTogglePiP}
        onCheckUpdates={() => setShowUpdateModal(true)}
        onOpenPetTab={() => {
          setShowSidePanel(true)
          setSidePanelTab('pet')
        }}
        onSwitchWorkspace={handleSwitchWorkspace}
        onAddWorkspace={() => {
          setEditingWorkspace(null)
          setShowWorkspaceModal(true)
        }}
        onEditWorkspace={(ws) => {
          setEditingWorkspace(ws)
          setShowWorkspaceModal(true)
        }}
        onWorkspaceMenuOpenChange={setIsWorkspaceMenuOpen}
        onOpenDiagnostics={() => setShowDiagnostics(true)}
        onOpenEnterprise={() => {
          setSettingsInitialTab('enterprise')
          setShowSettings(true)
        }}
        onToggleTheme={handleToggleTheme}
        onOpenLogs={() => setShowLogs(true)}
        onOpenSettings={() => {
          setSettingsInitialTab('general')
          setShowSettings(true)
        }}
        onReloadWebview={handleReloadWebview}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
      />

      {/* Main View Area: Left is WebContentsView / OfflineView, Right is Codex Side Panel */}
      <div className="flex-1 w-full h-[calc(100vh-var(--titlebar-height))] relative flex flex-row overflow-hidden">
        <main className="flex-1 h-full relative flex flex-col overflow-hidden">
          {status.state === 'starting' ? (
            <LoadingSplash
              status={status}
              isDark={isDark}
              onOpenLogs={() => setShowLogs(true)}
              onOpenSettings={() => {
                setSettingsInitialTab('general')
                setShowSettings(true)
              }}
            />
          ) : status.state !== 'running' ? (
            <OfflineView
              status={status}
              isDark={isDark}
              onStartServer={handleStartServer}
              onOpenLogs={() => setShowLogs(true)}
              onOpenSettings={() => {
                setSettingsInitialTab('general')
                setShowSettings(true)
              }}
              onSelectWorkspace={(dir) => {
                console.log('[Desktop] Workspace directory dropped:', dir)
                handleStartServer()
              }}
            />
          ) : null}
        </main>

        {/* Codex-style Right Side Panel */}
        <SidePanel
          isOpen={showSidePanel}
          isDark={isDark}
          status={status}
          activeWorkspace={activeWorkspace}
          activeTab={sidePanelTab}
          onTabChange={setSidePanelTab}
          onClose={() => setShowSidePanel(false)}
          onOpenLogs={() => setShowLogs(true)}
          onOpenBrowser={handleOpenBrowser}
          onOpenEnterprise={() => {
            setSettingsInitialTab('enterprise')
            setShowSettings(true)
          }}
        />
      </div>

      {/* Command Palette (Cmd/Ctrl + K) */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onOpenLogs={() => setShowLogs(true)}
        onOpenSettings={() => {
          setSettingsInitialTab('general')
          setShowSettings(true)
        }}
        onOpenEnterprise={() => {
          setSettingsInitialTab('enterprise')
          setShowSettings(true)
        }}
        onReload={handleReloadWebview}
        onRestartServer={handleRestartServer}
        onOpenBrowser={handleOpenBrowser}
        onSelectDirectory={handleSelectDirectory}
        onToggleTheme={handleToggleTheme}
        currentTheme={theme}
      />

      {/* Real-time Logs Modal */}
      <LogViewerModal
        isOpen={showLogs}
        isDark={isDark}
        onClose={() => setShowLogs(false)}
      />

      {/* Preferences / Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        status={status}
        isDark={isDark}
        initialTab={settingsInitialTab}
        onClose={() => setShowSettings(false)}
        onSaved={handleSettingsSaved}
      />

      {/* Workspace / Profile Modal */}
      <WorkspaceModal
        isOpen={showWorkspaceModal}
        isDark={isDark}
        initialProfile={editingWorkspace}
        onClose={() => {
          setShowWorkspaceModal(false)
          setEditingWorkspace(null)
        }}
        onSave={handleSaveWorkspace}
        onDelete={handleDeleteWorkspace}
      />

      {/* Diagnostics & Self-Healing Modal */}
      <DiagnosticsModal
        isOpen={showDiagnostics}
        isDark={isDark}
        onClose={() => setShowDiagnostics(false)}
        onRestartNeeded={handleRestartServer}
      />

      {/* Version & Auto-Update Modal */}
      <UpdateModal
        isOpen={showUpdateModal}
        isDark={isDark}
        onClose={() => setShowUpdateModal(false)}
      />
    </div>
  )
}
