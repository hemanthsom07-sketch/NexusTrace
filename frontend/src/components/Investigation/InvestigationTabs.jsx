import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Layers,
  Clock,
  Globe,
  Radio,
  FileSearch,
  Link2,
  Maximize2,
  X,
} from 'lucide-react'
import TimelineView from '../Inspector/TimelineView'
import GeoIpCard from '../Inspector/GeoIpCard'
import { getIpDetail } from '../../api/client'
import { GLOSSARY, portMeaning } from '../../lib/glossary'
import { formatPercent } from '../../lib/format'
import EvidenceChain from './EvidenceChain'

function formatTime(ts) {
  if (!ts && ts !== 0) return 'Unknown'

  const date = new Date(
    typeof ts === 'number' ? ts * 1000 : ts
  )

  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : date.toLocaleString()
}

// Works out which txids / ips are relevant to whatever is currently
// selected, purely from real fields already returned by the API.
function relevantIds(
  selectedEntity,
  leadDetail,
  transactionDetail,
  ipDetail
) {
  if (selectedEntity?.type === 'wallet' && leadDetail) {
    return {
      txids: leadDetail.related_txids || [],
      ips: leadDetail.related_ips || [],
    }
  }

  if (
    selectedEntity?.type === 'transaction' &&
    transactionDetail
  ) {
    return {
      txids: [transactionDetail.txid].filter(Boolean),
      ips: (transactionDetail.correlation_evidence || [])
        .map((e) => e.ip)
        .filter(Boolean),
    }
  }

  if (selectedEntity?.type === 'ip' && ipDetail) {
    return {
      txids: ipDetail.connected_transactions || [],
      ips: [selectedEntity.id],
    }
  }

  return {
    txids: [],
    ips: [],
  }
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
  const [fullscreen, setFullscreen] = useState(false)

  const { txids, ips } = useMemo(
    () =>
      relevantIds(
        selectedEntity,
        leadDetail,
        transactionDetail,
        ipDetail
      ),
    [
      selectedEntity,
      leadDetail,
      transactionDetail,
      ipDetail,
    ]
  )

  const relatedTx = useMemo(() => {
    const idSet = new Set(txids)

    return transactions.filter((tx) =>
      idSet.has(tx.txid)
    )
  }, [transactions, txids])

  const evidenceItems = useMemo(() => {
    const items = []

    relatedTx.forEach((tx) => {
      ;(tx.correlation_evidence || []).forEach((ev) => {
        items.push({
          txid: tx.txid,
          ...ev,
        })
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
        if (
          typeof tx.timestamp === 'number' &&
          typeof ev.time_delta_seconds === 'number'
        ) {
          events.push({
            label: `Network observation from ${ev.ip}${
              ev.port ? `:${ev.port}` : ''
            } — Δt=${ev.time_delta_seconds}s, confidence ${Math.round(
              (ev.confidence || 0) * 100
            )}%`,
            ts: ev.network_timestamp ?? null,
            timestamp: ev.network_timestamp ?? null,
            type: 'NETWORK',
            description: `Network observation from ${ev.ip}`,
            ip: ev.ip,
            port: ev.port ?? null,
            time_delta_seconds: ev.time_delta_seconds ?? null,
            confidence: ev.confidence ?? null,
          })
        }
      })
    })

    return events.sort(
      (a, b) =>
        (a.timestamp || a.ts || 0) -
        (b.timestamp || b.ts || 0)
    )
  }, [relatedTx])

  useEffect(() => {
    // GeoIP data is needed by both the GeoIP tab and the Evidence Chain.
    // Previously it was fetched only when the GeoIP tab was opened, which
    // made Evidence Chain show "GeoIP Source: Unavailable" until the user
    // visited GeoIP first.
    if (activeTab !== 'geoip' && activeTab !== 'chain') return

    if (
      selectedEntity?.type === 'ip' &&
      ipDetail
    ) {
      setGeoCache((prev) => ({
        ...prev,
        [selectedEntity.id]: ipDetail,
      }))
    }

    const toFetch = ips.filter(
      (ip) => !geoCache[ip]
    )

    if (toFetch.length === 0) return

    toFetch.slice(0, 8).forEach((ip) => {
      getIpDetail(ip)
        .then((res) => {
          const geo = {
            ...res,
            // The backend may expose this as geoip_source or source depending
            // on the running version. Keep both names available to the
            // Evidence Chain and GeoIP cards.
            geoip_source:
              res.geoip_source ||
              res.source ||
              (res.geoip_available
                ? 'Configured offline GeoIP database'
                : null),
            source:
              res.source ||
              res.geoip_source ||
              (res.geoip_available
                ? 'Configured offline GeoIP database'
                : null),
            geoip_explanation:
              res.geoip_available
                ? 'Resolved from the configured offline GeoIP/ASN database.'
                : 'The network-to-transaction correlation is valid, but this IP has no matching offline GeoIP record. GeoIP is enrichment only and does not affect correlation confidence.',
          }

          setGeoCache((prev) => ({
            ...prev,
            [ip]: geo,
          }))
        })
        .catch(() =>
          setGeoCache((prev) => ({
            ...prev,
            [ip]: null,
          }))
        )
    })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, ips])

  const handleSelectTx = useCallback(
    (txid) => {
      onSelectEntity({
        type: 'transaction',
        id: txid,
        fullId: `tx:${txid}`,
      })
    },
    [onSelectEntity]
  )

  const tabs = [
    {
      id: 'transactions',
      label: 'Transactions',
      icon: Layers,
      count: relatedTx.length,
    },
    {
      id: 'timeline',
      label: 'Timeline',
      icon: Clock,
      count: timelineEvents.length,
    },
    {
      id: 'geoip',
      label: 'GeoIP / ASN',
      icon: Globe,
      count: ips.length,
    },
    {
      id: 'chain',
      label: 'Evidence Chain',
      icon: Link2,
      count: evidenceItems.length,
    },
    {
      id: 'evidence',
      label: 'Evidence',
      icon: FileSearch,
      count: evidenceItems.length,
    },
  ]

  const activeTabDefinition =
    tabs.find((tab) => tab.id === activeTab) ||
    tabs[0]

  const ActiveIcon = activeTabDefinition.icon

  if (!selectedEntity) {
    return (
      <div className="investigation-tabs">
        <div className="tab-panel-empty">
          <Radio
            size={16}
            style={{
              marginRight: 8,
              opacity: 0.5,
            }}
          />
          Select an entity above to inspect its
          transactions, timeline and evidence.
        </div>
      </div>
    )
  }

  const renderTabContent = () => {
    if (activeTab === 'transactions') {
      return relatedTx.length === 0 ? (
        <div className="tab-panel-empty">
          No correlated transactions for this entity.
        </div>
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
              <th>Correlation Confidence</th>
            </tr>
          </thead>

          <tbody>
            {relatedTx.map((tx) => (
              <tr
                key={tx.txid}
                onClick={() =>
                  handleSelectTx(tx.txid)
                }
              >
                <td className="mono-cell">
                  {tx.txid}
                </td>

                <td>
                  {formatTime(tx.timestamp)}
                </td>

                <td>
                  {tx.input_addresses?.length || 0}
                </td>

                <td>
                  {tx.output_addresses?.length || 0}
                </td>

                <td>
                  {tx.btc_amount ?? 0}
                </td>

                <td>
                  {tx.fee ?? '—'}
                </td>

                <td className="mono-cell">
                  {tx.correlated_ip || '—'}
                </td>

                <td>
                  {typeof tx.confidence === 'number'
                    ? `${Math.round(
                        tx.confidence * 100
                      )}%`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    }

    if (activeTab === 'timeline') {
      return timelineEvents.length === 0 ? (
        <div className="tab-panel-empty">
          No timestamped events available for this
          entity.
        </div>
      ) : (
        <>
          <div
            className="hint-text"
            style={{ marginBottom: 10 }}
          >
            Network observations close in time to a
            transaction contribute to that
            transaction's correlation confidence.
          </div>

          <TimelineView
            evidence={timelineEvents}
          />
        </>
      )
    }

    if (activeTab === 'geoip') {
      return ips.length === 0 ? (
        <div className="tab-panel-empty">
          No correlated IP addresses for this entity.
        </div>
      ) : (
        <div className="geo-ip-grid">
          {ips.map((ip) => {
            const geo = geoCache[ip]

            if (!geo) {
              return (
                <div
                  className="geo-ip-card"
                  key={ip}
                >
                  <div className="geo-ip-header">
                    <Globe size={14} />
                    <h3>{ip}</h3>
                  </div>

                  <p
                    style={{
                      fontSize: 12,
                      color: 'var(--text-dim)',
                    }}
                  >
                    Loading GeoIP intelligence…
                  </p>
                </div>
              )
            }

            return (
              <div key={ip}>
                <div
                  className="inspector-label mono"
                  style={{ marginBottom: 6 }}
                >
                  {ip}
                </div>

                <GeoIpCard geoData={geo} />
              </div>
            )
          })}
        </div>
      )
    }

    if (activeTab === 'chain') {
      return selectedEntity?.type !== 'wallet' ? (
        <div className="tab-panel-empty">
          Select a wallet to build an evidence chain
          from entity → transaction → network
          observation → GeoIP/ASN.
        </div>
      ) : (
        <EvidenceChain
          wallet={selectedEntity.id}
          leadDetail={leadDetail}
          transactions={transactions}
          geoByIp={geoCache}
        />
      )
    }

    if (activeTab === 'evidence') {
      return evidenceItems.length === 0 ? (
        <div className="tab-panel-empty">
          No correlation evidence available for this
          entity.
        </div>
      ) : (
        <div className="evidence-list">
          {evidenceItems.map((ev, idx) => (
            <div
              className="evidence-item"
              key={idx}
            >
              <div className="evidence-item-header">
                <span className="evidence-item-title">
                  {ev.txid}
                </span>

                <span className="evidence-item-confidence">
                  {formatPercent(ev.confidence)}{' '}
                  confidence
                </span>
              </div>

              <div className="evidence-item-row">
                <span>
                  IP: <b>{ev.ip}</b>
                </span>

                <span>
                  Port: <b>{ev.port ?? '—'}</b>
                </span>

                <span>
                  Δt:{' '}
                  <b>
                    {ev.time_delta_seconds ?? '—'}s
                  </b>
                </span>
              </div>

              <div className="hint-text">
                {GLOSSARY.time_delta}{' '}
                {ev.port
                  ? portMeaning(ev.port)
                  : ''}
              </div>

              {ev.evidence && (
                <div className="evidence-item-row">
                  <span>{ev.evidence}</span>
                </div>
              )}

              <div className="hint-text">
                {GLOSSARY.confidence}
              </div>
            </div>
          ))}
        </div>
      )
    }

    return null
  }

  return (
    <>
      <div className="investigation-tabs">
        <div className="tab-bar">
          {tabs.map((tab) => {
            const Icon = tab.icon

            return (
              <button
                key={tab.id}
                className={`tab-button ${
                  activeTab === tab.id
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  setActiveTab(tab.id)
                }
              >
                <Icon size={13} />
                <span>{tab.label}</span>
                <span className="tab-count">
                  {tab.count}
                </span>
              </button>
            )
          })}

          <button
            type="button"
            className="investigation-tabs-expand"
            onClick={() => setFullscreen(true)}
            title={`Open ${activeTabDefinition.label} fullscreen`}
            aria-label={`Open ${activeTabDefinition.label} fullscreen`}
          >
            <Maximize2 size={14} />
          </button>
        </div>

        <div className="tab-panel">
          {renderTabContent()}
        </div>
      </div>

      {fullscreen && (
        <div className="investigation-tabs-fullscreen">
          <div className="investigation-tabs-fullscreen-header">
            <div className="investigation-tabs-fullscreen-title">
              <ActiveIcon size={16} />
              <div>
                <span>INVESTIGATION WORKSPACE</span>
                <strong>
                  {activeTabDefinition.label}
                </strong>
              </div>
            </div>

            <button
              type="button"
              className="investigation-tabs-close"
              onClick={() =>
                setFullscreen(false)
              }
              title="Close fullscreen"
              aria-label="Close fullscreen"
            >
              <X size={18} />
            </button>
          </div>

          <div className="investigation-tabs-fullscreen-tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon

              return (
                <button
                  key={tab.id}
                  className={`tab-button ${
                    activeTab === tab.id
                      ? 'active'
                      : ''
                  }`}
                  onClick={() =>
                    setActiveTab(tab.id)
                  }
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                  <span className="tab-count">
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="investigation-tabs-fullscreen-body">
            {renderTabContent()}
          </div>
        </div>
      )}
    </>
  )
}