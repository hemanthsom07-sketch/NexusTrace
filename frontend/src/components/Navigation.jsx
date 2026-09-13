import React from 'react'
import {
  ShieldAlert,
  Layers,
  UploadCloud,
  Clock,
  LayoutDashboard,
  Search,
  LogOut,
} from 'lucide-react'

export default function Navigation({
  activeTab,
  onTabChange,
  lastUpdated,
  hasAnalyzed,
  onLogout,
}) {
  const formatTime = (ts) => {
    if (!ts) return null
    const date = new Date(ts * 1000)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  // Journey order per spec: Dashboard/Pipeline -> Overview -> Investigate ->
  // Transactions -> Alerts. Investigate/Transactions/Alerts are gated until
  // an analysis actually exists, so the app can never look pre-populated.
  const tabs = [
    { id: 'pipeline', label: 'Dataset Input', icon: UploadCloud, gated: false },
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, gated: false },
    { id: 'investigate', label: 'Investigate', icon: Search, gated: true },
    { id: 'transactions', label: 'Transactions', icon: Layers, gated: true },
    { id: 'alerts', label: 'Alerts', icon: ShieldAlert, gated: true },
  ]

  return (
    <nav className="navigation">
      <div className="navigation-brand">
        <div className="brand-icon">
          <ShieldAlert size={17} />
        </div>
        <div>
          <h1>NEXUSTRACE</h1>
          <div className="brand-subtitle">Bitcoin Intelligence &amp; Investigation</div>
        </div>
      </div>

      <div className="navigation-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const isDisabled = tab.gated && !hasAnalyzed
          return (
            <button
              key={tab.id}
              onClick={() => !isDisabled && onTabChange(tab.id)}
              disabled={isDisabled}
              title={isDisabled ? 'Analyze a dataset first' : undefined}
              className={`navigation-tab ${isActive ? 'active' : ''}`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      <div className="navigation-right">
        <div className="pipeline-status">
          <div className={`status-dot ${hasAnalyzed ? '' : 'running'}`} />
          <span>{hasAnalyzed ? 'ANALYSIS ACTIVE' : 'NO ANALYSIS'}</span>
        </div>

        {lastUpdated && (
          <div className="last-updated">
            <Clock size={14} />
            <span>{formatTime(lastUpdated)}</span>
          </div>
        )}

        <button className="logout-button" onClick={onLogout} title="Log out">
          <LogOut size={14} />
          <span>Log Out</span>
        </button>
      </div>
    </nav>
  )
}
