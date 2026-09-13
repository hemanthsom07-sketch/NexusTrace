import React from 'react'

export default function KpiBar({ stats }) {
  if (!stats) return null

  return (
    <div className="kpi-bar">
      <div className="kpi-card">
        <div className="kpi-label">Network Events</div>
        <div className="kpi-value-row">
          <span className="kpi-value cyan">
            {stats.events_ingested || 0}
          </span>
        </div>
        <div className="kpi-sub">
          {stats.events_skipped || 0} skipped
        </div>
      </div>

      <div className="kpi-card">
        <div className="kpi-label">Transactions Ingested</div>
        <div className="kpi-value-row">
          <span className="kpi-value">
            {stats.transactions_ingested || 0}
          </span>
        </div>
        <div className="kpi-sub">On-chain blocks</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-label">Correlations Found</div>
        <div className="kpi-value-row">
          <span className="kpi-value cyan">
            {stats.links_found || 0}
          </span>
        </div>
        <div className="kpi-sub">Cross-layer links</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-label">Wallets Scored</div>
        <div className="kpi-value-row">
          <span className="kpi-value">
            {stats.wallets_count || 0}
          </span>
        </div>
        <div className="kpi-sub">Isolation Forest</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-label">High-Risk Alerts</div>
        <div className="kpi-value-row">
          <span className="kpi-value high-risk">
            {stats.high_risk_count || 0}
          </span>
        </div>
        <div className="kpi-sub">Severity ≥ 0.70</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-label">Total Outgoing BTC</div>
        <div className="kpi-value-row">
          <span className="kpi-value">
            {typeof stats.total_out_amount === 'number'
              ? stats.total_out_amount.toFixed(2)
              : '0.00'}
          </span>
        </div>
        <div className="kpi-sub">Observed volume</div>
      </div>
    </div>
  )
}