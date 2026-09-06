import React from 'react'
import { Activity } from 'lucide-react'

const FEATURE_META = {
  transaction_velocity: { label: 'Transaction Velocity', unit: 'tx/hr', max: 3.0 },
  fan_out_count: { label: 'Fan-Out (Outgoing TXs)', unit: 'txs', max: 5.0 },
  fan_in_count: { label: 'Fan-In (Incoming TXs)', unit: 'txs', max: 5.0 },
  distinct_ip_count: { label: 'Distinct Correlated IPs', unit: 'nodes', max: 3.0 },
  total_out_amount: { label: 'Total Outgoing Volume', unit: 'BTC', max: 10.0 },
  total_in_amount: { label: 'Total Incoming Volume', unit: 'BTC', max: 10.0 },
}

export default function MetricGauge({ featureSnapshot }) {
  if (!featureSnapshot) return null

  return (
    <div className="inspector-card">
      <div className="section-title">
        <Activity size={13} />
        <span>Feature Snapshot &amp; Behavior</span>
      </div>

      <div className="feature-gauge-grid">
        {Object.entries(featureSnapshot).map(([key, rawVal]) => {
          const meta = FEATURE_META[key] || { label: key, unit: '', max: 10 }
          const val = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal) || 0
          const pct = Math.min(100, Math.max(0, (val / meta.max) * 100))
          const isElevated = pct >= 70

          return (
            <div key={key} className="metric-gauge-item">
              <div className="gauge-label-row">
                <span className="gauge-label">{meta.label}</span>
                <span className="gauge-val">
                  {val.toFixed(val % 1 === 0 ? 0 : 3)} {meta.unit}
                </span>
              </div>
              <div className="gauge-bar-track">
                <div
                  className={`gauge-bar-fill ${isElevated ? 'high-risk' : ''}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
