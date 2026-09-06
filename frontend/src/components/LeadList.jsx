import React, { useState, useMemo } from 'react'
import { Search, ArrowUpDown, Filter, AlertTriangle, Layers, Globe } from 'lucide-react'

export default function LeadList({ leads = [], selectedWallet, onSelectWallet }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState('ALL') // ALL | HIGH | MEDIUM | LOW
  const [sortBy, setSortBy] = useState('score') // score | velocity | fanout | amount

  // Multi-field search and filtering
  const filteredLeads = useMemo(() => {
    let result = [...leads]

    // Severity Filter
    if (severityFilter !== 'ALL') {
      result = result.filter((l) => l.severity === severityFilter)
    }

    // Search term across wallet, related_txids, and related_ips
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase()
      result = result.filter((l) => {
        if (l.wallet.toLowerCase().includes(term)) return true
        if (l.related_txids?.some((tx) => tx.toLowerCase().includes(term))) return true
        if (l.related_ips?.some((ip) => ip.toLowerCase().includes(term))) return true
        return false
      })
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'score') return b.anomaly_score - a.anomaly_score
      if (sortBy === 'velocity') {
        const vA = a.feature_snapshot?.transaction_velocity || 0
        const vB = b.feature_snapshot?.transaction_velocity || 0
        return vB - vA
      }
      if (sortBy === 'fanout') {
        const fA = a.feature_snapshot?.fan_out_count || 0
        const fB = b.feature_snapshot?.fan_out_count || 0
        return fB - fA
      }
      if (sortBy === 'amount') {
        const aA = a.feature_snapshot?.total_out_amount || 0
        const aB = b.feature_snapshot?.total_out_amount || 0
        return aB - aA
      }
      return 0
    })

    return result
  }, [leads, severityFilter, searchTerm, sortBy])

  const counts = useMemo(() => {
    return {
      ALL: leads.length,
      HIGH: leads.filter((l) => l.severity === 'HIGH').length,
      MEDIUM: leads.filter((l) => l.severity === 'MEDIUM').length,
      LOW: leads.filter((l) => l.severity === 'LOW').length,
    }
  }, [leads])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Search & Filter Toolbar */}
      <div className="search-filter-bar">
        <div className="search-input-wrapper">
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search wallet, TXID, or IP node…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="filter-pills">
            {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
              <button
                key={sev}
                className={`filter-pill ${sev.toLowerCase()} ${severityFilter === sev ? 'active' : ''}`}
                onClick={() => setSeverityFilter(sev)}
              >
                {sev} ({counts[sev] || 0})
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase' }}>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                background: '#101726',
                border: '1px solid #1E2D47',
                color: '#94A3B8',
                borderRadius: 4,
                fontSize: 11,
                padding: '2px 4px',
                outline: 'none',
              }}
            >
              <option value="score">Risk Score</option>
              <option value="velocity">Velocity</option>
              <option value="fanout">Fan-out</option>
              <option value="amount">Outgoing BTC</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Header */}
      <div className="lead-table-header">
        <span>Wallet / Indicators</span>
        <span style={{ textAlign: 'right' }}>Score</span>
        <span style={{ textAlign: 'right' }}>Severity</span>
      </div>

      {/* Table Body */}
      <div className="lead-table-body">
        {filteredLeads.length === 0 ? (
          <div className="empty-state" style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>
            No investigation leads match the active filters.
          </div>
        ) : (
          filteredLeads.map((lead) => {
            const isSelected = selectedWallet === lead.wallet
            const isHigh = lead.severity === 'HIGH'
            const txCount = lead.related_txids?.length || 0
            const ipCount = lead.related_ips?.length || 0
            const outAmount = lead.feature_snapshot?.total_out_amount ?? 0

            return (
              <button
                key={lead.wallet}
                className={`lead-item ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectWallet(lead.wallet)}
              >
                <div className="lead-wallet-col">
                  <span className="wallet-address" title={lead.wallet}>
                    {lead.wallet}
                  </span>
                  <div className="wallet-subinfo">
                    {outAmount > 0 && <span>{outAmount.toFixed(1)} BTC</span>}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Layers size={9} /> {txCount} tx
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Globe size={9} /> {ipCount} ip
                    </span>
                  </div>
                </div>

                <div className={`lead-score-col ${isHigh ? 'high' : ''}`} style={{ textAlign: 'right' }}>
                  {lead.anomaly_score.toFixed(3)}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className={`severity-tag ${lead.severity.toLowerCase()}`}>
                    {lead.severity}
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
