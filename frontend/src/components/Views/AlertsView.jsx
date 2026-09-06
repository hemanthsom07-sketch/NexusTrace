import React, { useState } from 'react'
import { AlertOctagon, ShieldAlert, ArrowRight, Download, Filter } from 'lucide-react'

export default function AlertsView({ leads = [], onInvestigateWallet, onShowToast }) {
  const [activeSeverity, setActiveSeverity] = useState('HIGH') // HIGH | MEDIUM | LOW | ALL

  const filtered = leads.filter((l) => activeSeverity === 'ALL' || l.severity === activeSeverity)

  const counts = {
    HIGH: leads.filter((l) => l.severity === 'HIGH').length,
    MEDIUM: leads.filter((l) => l.severity === 'MEDIUM').length,
    LOW: leads.filter((l) => l.severity === 'LOW').length,
    ALL: leads.length,
  }

  const handleExportAlerts = () => {
    const jsonStr = JSON.stringify(filtered, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nexustrace_${activeSeverity.toLowerCase()}_alerts.json`
    a.click()
    URL.revokeObjectURL(url)
    if (onShowToast) onShowToast(`Exported ${filtered.length} alert records`, 'success')
  }

  return (
    <div className="full-view-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9', marginBottom: 2 }}>
            Investigation Alerts Queue
          </h2>
          <p style={{ fontSize: 12, color: '#94A3B8' }}>
            Flagged behavioral anomalies prioritized by isolation forest decision boundary score.
          </p>
        </div>

        <button className="btn-secondary" onClick={handleExportAlerts}>
          <Download size={13} />
          <span>Export {activeSeverity} Queue</span>
        </button>
      </div>

      {/* Severity Triage Filter Tabs */}
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { key: 'HIGH', label: 'High Risk Alert Queue', color: '#EF4444', desc: 'Score ≥ 0.70' },
          { key: 'MEDIUM', label: 'Medium Risk Review', color: '#F59E0B', desc: '0.40 ≤ Score < 0.70' },
          { key: 'LOW', label: 'Low Risk Baseline', color: '#10B981', desc: 'Score < 0.40' },
          { key: 'ALL', label: 'All Scored Entities', color: '#0EA5E9', desc: 'Total dataset' },
        ].map((item) => (
          <div
            key={item.key}
            onClick={() => setActiveSeverity(item.key)}
            className="kpi-card"
            style={{
              flex: 1,
              cursor: 'pointer',
              border: activeSeverity === item.key ? `1px solid ${item.color}` : '1px solid #1E2D47',
              background: activeSeverity === item.key ? 'rgba(14, 165, 233, 0.06)' : '#101726',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: item.color }}>{item.label}</span>
              <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'ui-monospace', color: item.color }}>
                {counts[item.key] || 0}
              </span>
            </div>
            <div style={{ fontSize: 10, color: '#64748B' }}>{item.desc}</div>
          </div>
        ))}
      </div>

      {/* Alerts Table */}
      <div className="data-table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Wallet</th>
              <th>Risk Score</th>
              <th>Severity</th>
              <th>Primary Explanation Reason</th>
              <th>Connected TXs</th>
              <th>Connected IPs</th>
              <th style={{ textAlign: 'right' }}>Investigation</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>
                  No alerts in this severity category.
                </td>
              </tr>
            ) : (
              filtered.map((lead) => (
                <tr key={lead.wallet}>
                  <td style={{ fontFamily: 'ui-monospace', fontWeight: 600, color: '#38BDF8' }}>
                    {lead.wallet}
                  </td>
                  <td style={{ fontFamily: 'ui-monospace', fontWeight: 700, color: lead.severity === 'HIGH' ? '#EF4444' : '#F1F5F9' }}>
                    {lead.anomaly_score.toFixed(3)}
                  </td>
                  <td>
                    <span className={`severity-tag ${lead.severity.toLowerCase()}`}>{lead.severity}</span>
                  </td>
                  <td style={{ fontSize: 12, color: '#CBD5E1', maxWidth: 360 }}>
                    {lead.reasons?.[0] || 'Flagged by multivariate feature pattern'}
                  </td>
                  <td style={{ fontFamily: 'ui-monospace' }}>
                    {lead.related_txids?.length || 0}
                  </td>
                  <td style={{ fontFamily: 'ui-monospace' }}>
                    {lead.related_ips?.length || 0}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn-primary"
                      style={{ fontSize: 11, padding: '3px 9px', marginLeft: 'auto' }}
                      onClick={() => onInvestigateWallet(lead.wallet)}
                    >
                      <span>Triage</span>
                      <ArrowRight size={11} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
