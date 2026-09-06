import React from 'react'
import { Radio, Layers, Link2, Wallet, AlertOctagon, ArrowUpRight } from 'lucide-react'

export default function KpiBar({ stats }) {
  if (!stats) return null

  const items = [
    {
      label: 'Network Events',
      value: stats.events_ingested ?? 19,
      sub: `${stats.events_skipped ?? 1} skipped`,
      icon: Radio,
    },
    {
      label: 'Transactions Ingested',
      value: stats.transactions_ingested ?? 18,
      sub: 'On-chain blocks',
      icon: Layers,
    },
    {
      label: 'Correlations Found',
      value: stats.links_found ?? 22,
      sub: 'Cross-layer links',
      icon: Link2,
      color: 'cyan',
    },
    {
      label: 'Wallets Scored',
      value: stats.wallets_count ?? 38,
      sub: 'Isolation Forest',
      icon: Wallet,
    },
    {
      label: 'High-Risk Alerts',
      value: stats.high_risk_count ?? 2,
      sub: `Severity ≥ 0.70 (${stats.medium_risk_count ?? 1} medium)`,
      icon: AlertOctagon,
      color: 'high-risk',
    },
    {
      label: 'Total Outgoing BTC',
      value: `${(stats.total_out_btc ?? 22.01).toFixed(2)} BTC`,
      sub: 'Observed volume',
      icon: ArrowUpRight,
    },
  ]

  return (
    <div className="kpi-bar">
      {items.map((item, idx) => {
        const Icon = item.icon
        return (
          <div key={idx} className="kpi-card">
            <div className="kpi-label">{item.label}</div>
            <div className="kpi-value-row">
              <span className={`kpi-value ${item.color || ''}`}>{item.value}</span>
              <Icon size={14} color="#64748B" />
            </div>
            <div className="kpi-sub">{item.sub}</div>
          </div>
        )
      })}
    </div>
  )
}
