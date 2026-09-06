import React, { useState } from 'react'
import {
  Copy,
  Crosshair,
  FileDown,
  ExternalLink,
  ShieldAlert,
  Layers,
  Globe,
  Wallet,
  Check,
} from 'lucide-react'
import WhyFlaggedCard from './WhyFlaggedCard'
import MetricGauge from './MetricGauge'
import RelatedChips from './RelatedChips'
import GeoIpCard from './GeoIpCard'
import TimelineView from './TimelineView'

export default function EntityInspector({
  selectedEntity,
  leadDetail,
  transactionDetail,
  ipDetail,
  onSelectWallet,
  onSelectTx,
  onSelectIp,
  onFocusInGraph,
  onShowToast,
}) {
  const [copied, setCopied] = useState(false)

  if (!selectedEntity || !selectedEntity.id) {
    return (
      <div className="inspector-panel">
        <div className="cyber-empty-state">
          <ShieldAlert size={36} color="#64748B" />
          <p style={{ fontWeight: 600, color: '#94A3B8' }}>No Entity Selected</p>
          <p style={{ fontSize: 11.5 }}>
            Select any wallet from the leads table, or click a transaction, wallet, or IP node in the graph.
          </p>
        </div>
      </div>
    )
  }

  const { type, id } = selectedEntity

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    if (onShowToast) onShowToast(`Copied ${text} to clipboard`, 'success')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExportDossier = () => {
    const data = {
      entity: selectedEntity,
      lead: leadDetail,
      transaction: transactionDetail,
      timestamp: new Date().toISOString(),
      platform: 'NexusTrace SIH26146',
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nexustrace_${type}_${id}_evidence.json`
    a.click()
    URL.revokeObjectURL(url)
    if (onShowToast) onShowToast('Investigation dossier exported', 'success')
  }

  // -------------------------------------------------------------
  // WALLET INSPECTOR VIEW
  // -------------------------------------------------------------
  if (type === 'wallet') {
    const detail = leadDetail || {}
    const severity = detail.severity || 'LOW'
    const score = typeof detail.anomaly_score === 'number' ? detail.anomaly_score : 0.0

    return (
      <div className="inspector-panel">
        {/* Header Card */}
        <div className="inspector-header-card">
          <div className="entity-eyebrow">
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Wallet size={12} color="#0EA5E9" />
              Wallet Intelligence Dossier
            </span>
            <span className={`severity-tag ${severity.toLowerCase()}`}>{severity} RISK</span>
          </div>

          <div className="entity-id-row">
            <div className="entity-title" title={id}>
              {id}
            </div>
            <div className="entity-score-display">
              <span className={`big-score ${severity === 'HIGH' ? '' : 'cyan'}`}>
                {score.toFixed(3)}
              </span>
            </div>
          </div>

          <div className="action-buttons-row">
            <button className="btn-action" onClick={() => handleCopy(id)}>
              {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button className="btn-action" onClick={() => onFocusInGraph && onFocusInGraph(`wallet:${id}`)}>
              <Crosshair size={12} />
              <span>Focus</span>
            </button>
            <button className="btn-action" onClick={handleExportDossier}>
              <FileDown size={12} />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Why Flagged Explainability Card */}
        <WhyFlaggedCard reasons={detail.reasons} />

        {/* Feature Snapshot Gauges */}
        <MetricGauge featureSnapshot={detail.feature_snapshot} />

        {/* Related Interactive Chips */}
        <RelatedChips
          relatedTxids={detail.related_txids || []}
          relatedIps={detail.related_ips || []}
          onSelectTx={onSelectTx}
          onSelectIp={onSelectIp}
        />

        {/* GeoIP Intelligence for Connected IPs */}
        {detail.related_ips_details && detail.related_ips_details[0] && (
          <GeoIpCard geoipData={detail.related_ips_details[0]} />
        )}

        {/* Cross-Layer Timeline */}
        <TimelineView
          wallet={id}
          severity={severity}
          txCount={(detail.related_txids || []).length}
        />
      </div>
    )
  }

  // -------------------------------------------------------------
  // TRANSACTION INSPECTOR VIEW
  // -------------------------------------------------------------
  if (type === 'transaction') {
    const tx = transactionDetail || {}
    const inputs = tx.input_addresses || []
    const outputs = tx.output_addresses || []
    const inSum = (tx.input_amounts || []).reduce((a, b) => a + b, 0)
    const outSum = (tx.output_amounts || []).reduce((a, b) => a + b, 0)

    return (
      <div className="inspector-panel">
        <div className="inspector-header-card">
          <div className="entity-eyebrow">
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Layers size={12} color="#06B6D4" />
              On-Chain Transaction Inspector
            </span>
            <span className="severity-tag low" style={{ color: '#06B6D4', borderColor: '#0891B2' }}>
              CONFIRMED
            </span>
          </div>

          <div className="entity-id-row">
            <div className="entity-title" title={id}>
              {id}
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: '#94A3B8', fontFamily: 'ui-monospace' }}>
              {outSum.toFixed(2)} BTC
            </div>
          </div>

          <div className="action-buttons-row">
            <button className="btn-action" onClick={() => handleCopy(id)}>
              {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
              <span>Copy TXID</span>
            </button>
            <button className="btn-action" onClick={() => onFocusInGraph && onFocusInGraph(`tx:${id}`)}>
              <Crosshair size={12} />
              <span>Focus in Graph</span>
            </button>
            <button className="btn-action" onClick={handleExportDossier}>
              <FileDown size={12} />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Transaction Telemetry */}
        <div className="inspector-card">
          <div className="section-title">
            <Layers size={13} />
            <span>Transaction Parameters</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1E2D47', paddingBottom: 4 }}>
              <span style={{ color: '#94A3B8' }}>Timestamp:</span>
              <span style={{ fontFamily: 'ui-monospace', color: '#F1F5F9' }}>
                {tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1E2D47', paddingBottom: 4 }}>
              <span style={{ color: '#94A3B8' }}>Network Fee:</span>
              <span style={{ fontFamily: 'ui-monospace', color: '#F1F5F9' }}>{tx.fee ?? 0.01} BTC</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1E2D47', paddingBottom: 4 }}>
              <span style={{ color: '#94A3B8' }}>Script Type:</span>
              <span style={{ fontFamily: 'ui-monospace', color: '#0EA5E9' }}>{tx.script_type || 'P2PKH'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94A3B8' }}>Max Link Confidence:</span>
              <span style={{ fontFamily: 'ui-monospace', color: '#10B981', fontWeight: 600 }}>
                {((tx.confidence_max ?? 1.0) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Correlation Evidence */}
        <div className="inspector-card">
          <div className="section-title">
            <Layers size={13} color="#E8542C" />
            <span>Cross-Layer Correlation Proof</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(tx.evidence || ['Δt=0.0s, port=8333 (standard)']).map((ev, i) => (
              <div key={i} className="reason-card" style={{ borderColor: 'rgba(232, 84, 44, 0.4)', background: 'rgba(232, 84, 44, 0.08)' }}>
                <span className="reason-num" style={{ color: '#E8542C', background: 'rgba(232, 84, 44, 0.2)' }}>
                  Proof
                </span>
                <span className="reason-text" style={{ fontFamily: 'ui-monospace' }}>{ev}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Inflow / Outflow Wallets */}
        <div className="inspector-card">
          <div className="section-title">
            <Wallet size={13} />
            <span>Involved Wallets</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Input Wallets (Sources):</div>
              <div className="chips-container">
                {inputs.map((w) => (
                  <button key={w} className="evidence-chip" onClick={() => onSelectWallet(w)}>
                    <Wallet size={11} />
                    <span>{w}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Output Wallets (Destinations):</div>
              <div className="chips-container">
                {outputs.map((w) => (
                  <button key={w} className="evidence-chip" onClick={() => onSelectWallet(w)}>
                    <Wallet size={11} />
                    <span>{w}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // IP NODE INSPECTOR VIEW
  // -------------------------------------------------------------
  if (type === 'ip') {
    return (
      <div className="inspector-panel">
        <div className="inspector-header-card">
          <div className="entity-eyebrow">
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Globe size={12} color="#10B981" />
              P2P Broadcast Node Intelligence
            </span>
            <span className="severity-tag low" style={{ color: '#10B981', borderColor: '#059669' }}>
              NETWORK NODE
            </span>
          </div>

          <div className="entity-id-row">
            <div className="entity-title" title={id}>
              {id}
            </div>
          </div>

          <div className="action-buttons-row">
            <button className="btn-action" onClick={() => handleCopy(id)}>
              {copied ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
              <span>Copy IP</span>
            </button>
            <button className="btn-action" onClick={() => onFocusInGraph && onFocusInGraph(`ip:${id}`)}>
              <Crosshair size={12} />
              <span>Focus in Graph</span>
            </button>
            <button className="btn-action" onClick={handleExportDossier}>
              <FileDown size={12} />
              <span>Export</span>
            </button>
          </div>
        </div>

        <GeoIpCard ipAddress={id} geoipData={ipDetail} />
      </div>
    )
  }

  return null
}
