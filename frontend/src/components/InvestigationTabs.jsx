import React, { useState } from 'react'

const TABS = ['Transactions', 'Timeline', 'GeoIP', 'ASN', 'Evidence']

function IntelField({ label, value, available = true }) {
  return (
    <div className="intel-field">
      <span className="label-mono">{label}</span>
      <div className={`intel-value${available ? '' : ' unavailable'}`}>
        {available ? value : 'Unavailable'}
      </div>
    </div>
  )
}

export default function InvestigationTabs({ selectedEntity, leadDetail, transactionDetail, ipDetail, onSelectEntity }) {
  const [tab, setTab] = useState('Transactions')

  const renderTransactions = () => {
    if (selectedEntity?.type === 'wallet' && leadDetail) {
      const txids = leadDetail.related_txids || []
      if (txids.length === 0) return <div className="empty-state">No correlated transactions for this wallet.</div>
      return txids.map((txid) => (
        <div key={txid} className="tx-row" onClick={() => onSelectEntity({ type: 'transaction', id: txid, fullId: `tx:${txid}` })}>
          <span className="mono">{txid}</span>
          <span className="metadata">wallet correlation</span>
        </div>
      ))
    }
    if (selectedEntity?.type === 'transaction' && transactionDetail) {
      return (
        <div className="tx-row">
          <span className="mono">{transactionDetail.txid}</span>
          <span>{typeof transactionDetail.btc_amount === 'number' ? `${transactionDetail.btc_amount} BTC` : '—'}</span>
          <span>{transactionDetail.fee ?? '—'} fee</span>
          <span>{transactionDetail.script_type || '—'}</span>
          <span className="mono">{transactionDetail.correlated_ip || '—'}</span>
        </div>
      )
    }
    if (selectedEntity?.type === 'ip' && ipDetail) {
      const txids = ipDetail.connected_transactions || []
      if (txids.length === 0) return <div className="empty-state">No transactions correlated with this IP.</div>
      return txids.map((txid) => (
        <div key={txid} className="tx-row" onClick={() => onSelectEntity({ type: 'transaction', id: txid, fullId: `tx:${txid}` })}>
          <span className="mono">{txid}</span>
          <span className="metadata">IP correlation</span>
        </div>
      ))
    }
    return <div className="empty-state">Select an entity to see its transactions.</div>
  }

  const renderTimeline = () => {
    if (selectedEntity?.type === 'transaction' && transactionDetail) {
      const events = []
      if (transactionDetail.timestamp) {
        events.push({ label: `Transaction ${transactionDetail.txid} observed on-chain`, ts: transactionDetail.timestamp })
      }
      for (const ev of transactionDetail.correlation_evidence || []) {
        events.push({
          label: `Network observation from ${ev.ip}${ev.port ? `:${ev.port}` : ''} — Δt=${ev.time_delta_seconds}s, confidence ${Math.round((ev.confidence || 0) * 100)}%`,
          ts: transactionDetail.timestamp ? transactionDetail.timestamp - ev.time_delta_seconds : null,
        })
      }
      events.sort((a, b) => (a.ts || 0) - (b.ts || 0))
      if (events.length === 0) return <div className="empty-state">No timestamped events for this transaction.</div>
      return (
        <div className="timeline-list">
          {events.map((e, i) => (
            <div className="timeline-entry" key={i}>
              <div className="timeline-time">{e.ts ? new Date(e.ts * 1000).toLocaleTimeString() : 'time unknown'}</div>
              <div className="timeline-label">{e.label}</div>
            </div>
          ))}
        </div>
      )
    }
    return <div className="empty-state">Select a transaction to see its chronological timeline.</div>
  }

  const renderGeoIp = () => {
    if (selectedEntity?.type !== 'ip' || !ipDetail) {
      return <div className="empty-state">Select an IP address to view GeoIP intelligence.</div>
    }
    return (
      <div className="intel-grid">
        <IntelField label="IP Address" value={ipDetail.ip} />
        <IntelField label="Classification" value={(ipDetail.classification || 'unknown').toUpperCase()} />
        <IntelField label="Country" value={ipDetail.country} available={!!ipDetail.country} />
        <IntelField label="City" value={ipDetail.city} available={!!ipDetail.city} />
      </div>
    )
  }

  const renderAsn = () => {
    if (selectedEntity?.type !== 'ip' || !ipDetail) {
      return <div className="empty-state">Select an IP address to view ASN intelligence.</div>
    }
    return (
      <div className="intel-grid">
        <IntelField label="ASN" value={ipDetail.asn} available={!!ipDetail.asn} />
        <IntelField label="GeoIP Database" value={ipDetail.geoip_available ? 'Loaded' : 'Not configured'} available={ipDetail.geoip_available} />
      </div>
    )
  }

  const renderEvidence = () => {
    if (selectedEntity?.type === 'wallet' && leadDetail) {
      return (leadDetail.reasons || []).map((r, i) => (
        <div key={i} className="evidence-trace-row">
          <span>{r}</span>
        </div>
      ))
    }
    if (selectedEntity?.type === 'transaction' && transactionDetail) {
      return (transactionDetail.correlation_evidence || []).map((ev, i) => (
        <div key={i} className="evidence-trace-row">
          <span>{ev.evidence || `${ev.ip} — Δt=${ev.time_delta_seconds}s`}</span>
          <span className="provenance">confidence {Math.round((ev.confidence || 0) * 100)}%</span>
        </div>
      ))
    }
    return <div className="empty-state">Select a wallet or transaction to view supporting evidence.</div>
  }

  const renderers = {
    Transactions: renderTransactions,
    Timeline: renderTimeline,
    GeoIP: renderGeoIp,
    ASN: renderAsn,
    Evidence: renderEvidence,
  }

  return (
    <div className="investigation-tabs">
      <div className="tab-strip">
        {TABS.map((t) => (
          <button key={t} className={`tab-strip-item${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="tab-panel">{renderers[tab]()}</div>
    </div>
  )
}
