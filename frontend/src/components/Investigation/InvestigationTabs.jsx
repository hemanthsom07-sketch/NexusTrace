import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Layers, Clock, Globe, Radio, FileSearch } from 'lucide-react'
import TimelineView from '../Inspector/TimelineView'
import GeoIpCard from '../Inspector/GeoIpCard'
import { getIpDetail } from '../../api/client'
import { GLOSSARY, portMeaning } from '../../lib/glossary'
import { formatPercent } from '../../lib/format'

function formatTime(ts) {
  if (!ts && ts !== 0) return 'Unknown'
  const date = new Date(typeof ts === 'number' ? ts * 1000 : ts)
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString()
}

// Works out which txids / ips are "relevant" to whatever is currently
// selected, purely from real fields already returned by the API -- no
// fabricated relationships.
function relevantIds(selectedEntity, leadDetail, transactionDetail, ipDetail) {
  if (selectedEntity?.type === 'wallet' && leadDetail) {
    return {
      txids: leadDetail.related_txids || [],
      ips: leadDetail.related_ips || [],
    }
  }
  if (selectedEntity?.type === 'transaction' && transactionDetail) {
    return {
      txids: [transactionDetail.txid].filter(Boolean),
      ips: (transactionDetail.correlation_evidence || []).map((e) => e.ip).filter(Boolean),
    }
  }
  if (selectedEntity?.type === 'ip' && ipDetail) {
    return {
      txids: ipDetail.connected_transactions || [],
      ips: [selectedEntity.id],
    }
  }
  return { txids: [], ips: [] }
}

export default function InvestigationTabs({
  selectedEntity,
  leadDetail,
  transactionDetail,
  ipDetail,
  transactions = [],
  onSelectEntity,
}) {
  const [activeTab, setActiveTab] = useState('transactions')
  const [geoCache, setGeoCache] = useState({})

  const { txids, ips } = useMemo(
    () => relevantIds(selectedEntity, leadDetail, transactionDetail, ipDetail),
    [selectedEntity, leadDetail, transactionDetail, ipDetail]
  )

  const relatedTx = useMemo(() => {
    const idSet = new Set(txids)
    return transactions.filter((tx) => idSet.has(tx.txid))
  }, [transactions, txids])

  const evidenceItems = useMemo(() => {
    // Every tx already carries its own correlation_evidence array from the
    // backend -- flatten that, tagged with the parent txid, for the
    // Evidence tab. Nothing here is invented.
    const items = []
    relatedTx.forEach((tx) => {
      (tx.correlation_evidence || []).forEach((ev) => {
        items.push({ txid: tx.txid, ...ev })
      })
    })
    return items
  }, [relatedTx])

  const timelineEvents = useMemo(() => {
    const events = []
    relatedTx.forEach((tx) => {
      events.push({
        timestamp: tx.timestamp,
        type: 'TRANSACTION',
        description: `${tx.txid} · ${tx.btc_amount ?? 0} BTC`,
      })
        ;(tx.correlation_evidence || []).forEach((ev) => {
          if (typeof tx.timestamp === 'number' && typeof ev.time_delta_seconds === 'number') {
            events.push({
              timestamp: tx.timestamp - ev.time_delta_seconds,
              type: 'NETWORK OBSERVATION',
              description: `${ev.ip} broadcast observed (Δt ${ev.time_delta_seconds}s, ${formatPercent(ev.confidence)} confidence)`,
            })
          }
        })
    })
    return events.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
  }, [relatedTx])

  useEffect(() => {
    if (activeTab !== 'geoip') return
    // Reuse ipDetail we already fetched for an IP-type selection instead
    // of re-requesting it.
    if (selectedEntity?.type === 'ip' && ipDetail) {
      setGeoCache((prev) => ({ ...prev, [selectedEntity.id]: ipDetail }))
    }
    const toFetch = ips.filter((ip) => !geoCache[ip])
    if (toFetch.length === 0) return
    toFetch.slice(0, 8).forEach((ip) => {
      getIpDetail(ip)
        .then((res) => setGeoCache((prev) => ({ ...prev, [ip]: res })))
        .catch(() => setGeoCache((prev) => ({ ...prev, [ip]: null })))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, ips])

  const handleSelectTx = useCallback(
    (txid) => onSelectEntity({ type: 'transaction', id: txid, fullId: `tx:${txid}` }),
    [onSelectEntity]
  )

  const tabs = [
    { id: 'transactions', label: 'Transactions', icon: Layers, count: relatedTx.length },
    { id: 'timeline', label: 'Timeline', icon: Clock, count: timelineEvents.length },
    { id: 'geoip', label: 'GeoIP / ASN', icon: Globe, count: ips.length },
    { id: 'evidence', label: 'Evidence', icon: FileSearch, count: evidenceItems.length },
  ]

  if (!selectedEntity) {
    return (
      <div className="investigation-tabs">
        <div className="tab-panel-empty">
          <Radio size={16} style={{ marginRight: 8, opacity: 0.5 }} />
          Select an entity above to inspect its transactions, timeline and evidence.
        </div>
      </div>
    )
  }

  return (
    <div className="investigation-tabs">
      <div className="tab-bar">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={13} />
              <span>{tab.label}</span>
              <span className="tab-count">{tab.count}</span>
            </button>
          )
        })}
      </div>

      <div className="tab-panel">
        {activeTab === 'transactions' && (
          relatedTx.length === 0 ? (
            <div className="tab-panel-empty">No correlated transactions for this entity.</div>
          ) : (
            <table className="tx-tab-table">
              <thead>
                <tr>
                  <th>TXID</th>
                  <th>Time</th>
                  <th>Inputs</th>
                  <th>Outputs</th>
                  <th>BTC</th>
                  <th>Fee</th>
                  <th>Correlated IP</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {relatedTx.map((tx) => (
                  <tr key={tx.txid} onClick={() => handleSelectTx(tx.txid)}>
                    <td className="mono-cell">{tx.txid}</td>
                    <td>{formatTime(tx.timestamp)}</td>
                    <td>{tx.input_addresses?.length || 0}</td>
                    <td>{tx.output_addresses?.length || 0}</td>
                    <td>{tx.btc_amount ?? 0}</td>
                    <td>{tx.fee ?? '—'}</td>
                    <td className="mono-cell">{tx.correlated_ip || '—'}</td>
                    <td>{typeof tx.confidence === 'number' ? `${Math.round(tx.confidence * 100)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {activeTab === 'timeline' && (
          timelineEvents.length === 0 ? (
            <div className="tab-panel-empty">No timestamped events available for this entity.</div>
          ) : (
            <>
              <div className="hint-text" style={{ marginBottom: 10 }}>
                Network observations close in time to a transaction contribute to that transaction's correlation confidence.
              </div>
              <TimelineView evidence={timelineEvents} />
            </>
          )
        )}

        {activeTab === 'geoip' && (
          ips.length === 0 ? (
            <div className="tab-panel-empty">No correlated IP addresses for this entity.</div>
          ) : (
            <div className="geo-ip-grid">
              {ips.map((ip) => {
                const geo = geoCache[ip]
                if (!geo) {
                  return (
                    <div className="geo-ip-card" key={ip}>
                      <div className="geo-ip-header"><Globe size={14} /><h3>{ip}</h3></div>
                      <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Loading GeoIP intelligence…</p>
                    </div>
                  )
                }
                return (
                  <div key={ip}>
                    <div className="inspector-label mono" style={{ marginBottom: 6 }}>{ip}</div>
                    <GeoIpCard geoData={geo} />
                  </div>
                )
              })}
            </div>
          )
        )}

        {activeTab === 'evidence' && (
          evidenceItems.length === 0 ? (
            <div className="tab-panel-empty">No correlation evidence available for this entity.</div>
          ) : (
            <div className="evidence-list">
              {evidenceItems.map((ev, idx) => (
                <div className="evidence-item" key={idx}>
                  <div className="evidence-item-header">
                    <span className="evidence-item-title">{ev.txid}</span>
                    <span className="evidence-item-confidence">
                      {formatPercent(ev.confidence)} confidence
                    </span>
                  </div>
                  <div className="evidence-item-row">
                    <span>IP: <b>{ev.ip}</b></span>
                    <span>Port: <b>{ev.port ?? '—'}</b></span>
                    <span>Δt: <b>{ev.time_delta_seconds ?? '—'}s</b></span>
                  </div>
                  <div className="hint-text">
                    {GLOSSARY.time_delta} {ev.port ? portMeaning(ev.port) : ''}
                  </div>
                  {ev.evidence && (
                    <div className="evidence-item-row"><span>{ev.evidence}</span></div>
                  )}
                  <div className="hint-text">{GLOSSARY.confidence}</div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
