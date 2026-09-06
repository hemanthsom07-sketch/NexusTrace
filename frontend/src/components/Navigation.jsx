import React from 'react'
import {
  ShieldAlert,
  Activity,
  GitGraph,
  Layers,
  UploadCloud,
  Play,
  RotateCw,
  Clock,
  User,
  LayoutDashboard,
  Search,
} from 'lucide-react'

export default function Navigation({
  activeTab,
  onTabChange,
  pipelineStatus,
  lastUpdated,
  onRunPipeline,
  isRunning,
}) {
  const formatTime = (ts) => {
    if (!ts) return 'Never'
    const date = new Date(ts * 1000)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'investigate', label: 'Investigate', icon: Search },
    { id: 'transactions', label: 'Transactions', icon: Layers },
    { id: 'graph', label: 'Network Graph', icon: GitGraph },
    { id: 'alerts', label: 'Alerts', icon: ShieldAlert },
    { id: 'pipeline', label: 'Data / Pipeline', icon: UploadCloud },
  ]

  return (
    <header className="top-nav">
      <div className="nav-brand">
        <div className="brand-icon">
          <ShieldAlert size={18} />
        </div>
        <div className="brand-title">
          <span>NexusTrace</span>
          <span className="brand-badge">SIH26146</span>
        </div>
      </div>

      <nav className="nav-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              className={`nav-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="nav-actions">
        <div className="pipeline-status-badge">
          <span
            className={`status-dot ${isRunning ? 'running' : pipelineStatus === 'error' ? 'error' : ''}`}
          />
          <span>{isRunning ? 'RUNNING' : (pipelineStatus || 'READY').toUpperCase()}</span>
        </div>

        {lastUpdated && (
          <div className="analyst-badge" title="Last dataset synchronization">
            <Clock size={12} />
            <span>{formatTime(lastUpdated)}</span>
          </div>
        )}

        <button
          className="btn-primary"
          onClick={onRunPipeline}
          disabled={isRunning}
          title="Re-run cross-layer correlation pipeline"
        >
          {isRunning ? <RotateCw size={13} className="spin" /> : <Play size={13} fill="currentColor" />}
          <span>{isRunning ? 'Processing…' : 'Run Pipeline'}</span>
        </button>

        <div className="analyst-badge">
          <User size={13} />
          <span>Analyst #NT-842</span>
        </div>
      </div>
    </header>
  )
}
