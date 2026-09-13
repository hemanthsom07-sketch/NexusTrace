import React, { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { formatPercent } from '../lib/format'

const SORT_OPTIONS = [
  { id: 'risk', label: 'Risk Score', get: (l) => l.anomaly_score || 0 },
  { id: 'velocity', label: 'Velocity', get: (l) => l.feature_snapshot?.transaction_velocity || 0 },
  { id: 'fanout', label: 'Fan-out', get: (l) => l.feature_snapshot?.fan_out_count || 0 },
  { id: 'fanin', label: 'Fan-in', get: (l) => l.feature_snapshot?.fan_in_count || 0 },
  { id: 'outgoing', label: 'Outgoing BTC', get: (l) => l.feature_snapshot?.total_out_amount || 0 },
]

function topIndicators(lead) {
  // Reuses the real, backend-generated reasons -- shortened to a couple of
  // scannable chips instead of full sentences. No invented indicators.
  return (lead.reasons || []).slice(0, 2).map((r) => {
    const short = r.split('(')[0].trim()
    return short.charAt(0).toUpperCase() + short.slice(1)
  })
}

export default function LeadList({ leads = [], selectedWallet, onSelectWallet }) {
  const [filter, setFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('risk')

  const filteredLeads = useMemo(() => {
    const sortFn = SORT_OPTIONS.find((s) => s.id === sortBy)?.get || (() => 0)
    const query = searchQuery.trim().toLowerCase()
    return leads
      .filter((lead) => {
        const matchesSeverity = filter === 'ALL' || lead.severity === filter
        const matchesSearch =
          !query ||
          lead.wallet.toLowerCase().includes(query) ||
          (lead.related_txids || []).some((tx) => tx.toLowerCase().includes(query)) ||
          (lead.related_ips || []).some((ip) => ip.toLowerCase().includes(query))
        return matchesSeverity && matchesSearch
      })
      .slice()
      .sort((a, b) => sortFn(b) - sortFn(a))
  }, [leads, filter, searchQuery, sortBy])

  return (
    <div className="lead-list">
      <div className="lead-list-header">
        <div className="lead-list-title-row">
          <h2>Investigation Queue</h2>
          <span className="lead-count">{filteredLeads.length}</span>
        </div>

        <div className="search-box">
          <Search size={14} />
          <input
            type="text"
            placeholder="Search wallet, TXID or IP"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="severity-filters">
        {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
          <button
            key={sev}
            onClick={() => setFilter(sev)}
            className={filter === sev ? 'active' : ''}
          >
            {sev}
          </button>
        ))}
      </div>

      <div className="queue-sort">
        <span>Sort</span>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>

      {filteredLeads.length === 0 ? (
        <div className="empty-state">
          <p>
            {leads.length === 0
              ? 'Analysis completed but no wallets were flagged in this dataset.'
              : 'No investigation leads match your filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="lead-table">
          {filteredLeads.map((lead) => {
            const isSelected = selectedWallet === lead.wallet
            const sev = (lead.severity || 'LOW').toLowerCase()

            return (
              <button
                key={lead.wallet}
                onClick={() => onSelectWallet(lead.wallet)}
                className={`queue-card ${isSelected ? 'selected' : ''}`}
              >
                <div className="queue-card-top">
                  <span className={`severity severity-${sev}`}>{lead.severity}</span>
                  <span className={`queue-card-score severity-${sev}`}>
                    {formatPercent(lead.anomaly_score)}
                  </span>
                </div>

                <div>
                  <div className="queue-card-id">{lead.wallet}</div>
                  <div className="queue-card-type">WALLET</div>
                </div>

                <div className="queue-card-meta">
                  <span>{lead.related_txids?.length || 0} TX</span>
                  <span>•</span>
                  <span>{lead.related_ips?.length || 0} IP</span>
                </div>

                {topIndicators(lead).length > 0 && (
                  <div className="queue-card-indicators">
                    {topIndicators(lead).map((ind, i) => (
                      <span key={i} className="queue-indicator-chip">{ind}</span>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
