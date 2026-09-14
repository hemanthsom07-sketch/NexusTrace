import React, { useMemo, useState } from 'react'
import {
  Sparkles,
  Maximize2,
  X,
  Copy,
  Check,
  Crosshair,
  WalletCards,
  Network,
  ArrowUpRight,
} from 'lucide-react'
import WhyFlaggedCard from './WhyFlaggedCard'
import MetricGauge from './MetricGauge'
import { explainWallet } from '../../lib/explainability'
import { formatPercent } from '../../lib/format'

const FEATURE_LABELS = {
  transaction_velocity: 'Transaction Velocity',
  fan_out_count: 'Fan-out',
  fan_in_count: 'Fan-in',
  distinct_ip_count: 'Distinct IPs',
  total_out_amount: 'Outgoing Amount',
  total_in_amount: 'Incoming Amount',
}

const FEATURE_MAX = {
  transaction_velocity: 10,
  fan_out_count: 10,
  fan_in_count: 10,
  distinct_ip_count: 10,
  total_out_amount: 10,
  total_in_amount: 10,
}

function SignalCard({ signal }) {
  return (
    <div className="signal-card">
      <div className="signal-card-header">
        <span className="signal-card-label">{signal.label}</span>
        <span className={`signal-card-value signal-direction-${signal.direction}`}>
          {signal.value}{signal.unit}
        </span>
      </div>
      <div className="signal-card-percentile">
        {signal.percentile}th percentile for this dataset ·{' '}
        {signal.direction === 'typical'
          ? 'within typical range'
          : `${signal.direction === 'high' ? 'above' : 'below'} typical range`}
      </div>
      <div className="signal-card-meaning">{signal.meaning}</div>
    </div>
  )
}

function DetailCell({ label, children }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  )
}

function EntityContent({
  selectedEntity,
  leads,
  transactions,
  clusters,
  leadDetail,
  transactionDetail,
  ipDetail,
  onSelectEntity,
  copied,
  onCopy,
}) {
  const explanation = useMemo(() => {
    if (selectedEntity?.type !== 'wallet' || !leadDetail) return null
    return explainWallet(leads, selectedEntity.id)
  }, [leads, selectedEntity, leadDetail])

  const correlationEvidence = useMemo(() => {
    if (!leadDetail?.related_txids?.length) return null

    for (const txid of leadDetail.related_txids) {
      const tx = transactions.find((t) => t.txid === txid)
      const ev = tx?.correlation_evidence?.[0]
      if (ev) return { ...ev, txid }
    }

    return null
  }, [leadDetail, transactions])

  const severity = leadDetail?.severity
  const hasScore = typeof leadDetail?.anomaly_score === 'number'

  if (!selectedEntity) {
    return (
      <div className="entity-inspector empty">
        <div className="empty-inspector">
          <h3>No Investigation Selected</h3>
          <p>Select a lead from the queue or a node in the graph to inspect its risk profile.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="entity-inspector">
      {leadDetail && (
        <>
          <div className="risk-summary">
            <div className="risk-summary-header">
              <span>Risk Score</span>
              <strong className={`severity-${(severity || 'low').toLowerCase()}`}>
                {hasScore ? formatPercent(leadDetail.anomaly_score) : 'N/A'}
              </strong>
            </div>
            <span className={`pill severity-${(severity || 'low').toLowerCase()}`}>
              {severity || 'LOW'}
            </span>
            <div className="explanation-note">
              Risk Score is a dataset-relative anomaly ranking; 100% means most anomalous
              in this analysis, not 100% certainty of illicit activity.
            </div>
          </div>

          {explanation && (
            <div className="ai-explanation-card">
              <div className="ai-explanation-header">
                <Sparkles size={12} /> Why This Wallet Was Flagged
              </div>
              <p className="ai-explanation-text">{explanation.summary}</p>
              <div className="explanation-note">
                Evidence-based percentile ranking computed from this dataset — not a
                claimed exact model attribution.
              </div>
            </div>
          )}

          <WhyFlaggedCard reasons={leadDetail.reasons || []} />

          {selectedEntity.type === 'wallet' && (() => {
            const cluster = clusters.find((item) =>
              item.wallets?.includes(selectedEntity.id)
            )

            if (!cluster) return null

            return (
              <div className="inspector-section">
                <h3>Entity Cluster</h3>
                <div className="cluster-card">
                  <div className="cluster-card-top">
                    <strong>{cluster.cluster_id}</strong>
                    <span>{cluster.wallets.length} wallets</span>
                  </div>

                  <p>
                    Common-input ownership heuristic grouped these wallets as a
                    potentially controlled entity.
                  </p>

                  <div className="cluster-wallets">
                    {cluster.wallets.map((wallet) => (
                      <button
                        key={wallet}
                        type="button"
                        className="cluster-wallet"
                        onClick={() =>
                          onSelectEntity?.({
                            type: 'wallet',
                            id: wallet,
                            fullId: `wallet:${wallet}`,
                          })
                        }
                      >
                        {wallet}
                      </button>
                    ))}
                  </div>

                  {cluster.associated_ips?.length > 0 && (
                    <div className="cluster-associated">
                      Associated IPs: {cluster.associated_ips.join(', ')}
                    </div>
                  )}

                  <div className="explanation-note">
                    Forensic heuristic, not an ML classification. Co-spending alone does
                    not prove common control.
                  </div>
                </div>
              </div>
            )
          })()}

          <div className="inspector-section">
            <h3>Model Signals</h3>
            <div className="behavioral-features">
              {explanation ? (
                explanation.signals.map((signal) => (
                  <SignalCard key={signal.feature} signal={signal} />
                ))
              ) : leadDetail.feature_snapshot &&
                typeof leadDetail.feature_snapshot === 'object' ? (
                Object.entries(leadDetail.feature_snapshot)
                  .filter(([key]) => FEATURE_LABELS[key])
                  .map(([key, value]) => (
                    <MetricGauge
                      key={key}
                      label={FEATURE_LABELS[key]}
                      value={
                        typeof value === 'number'
                          ? Number(value.toFixed(2))
                          : value
                      }
                      max={Math.max(
                        FEATURE_MAX[key] || 10,
                        typeof value === 'number' ? value : 0
                      )}
                      isHighRisk={severity === 'HIGH'}
                    />
                  ))
              ) : (
                <p>No behavioral features available.</p>
              )}
            </div>
          </div>

          {correlationEvidence && (
            <div className="inspector-section">
              <h3>Correlation Evidence</h3>
              <div className="detail-grid">
                <DetailCell label="IP">{correlationEvidence.ip}</DetailCell>
                <DetailCell label="Δt">
                  {correlationEvidence.time_delta_seconds ?? 'N/A'}s
                </DetailCell>
                <DetailCell label="Correlation Confidence">
                  {formatPercent(correlationEvidence.confidence)}
                </DetailCell>
                <DetailCell label="Transaction">
                  {correlationEvidence.txid}
                </DetailCell>
              </div>

              <p style={{ marginTop: 8 }}>
                This network observation is tied to a blockchain transaction by the
                stored correlation evidence. The Evidence Chain below provides the
                complete cross-layer path.
              </p>
            </div>
          )}
        </>
      )}

      {transactionDetail && (
        <div className="inspector-section">
          <h3>Transaction Summary</h3>
          <div className="detail-grid">
            <DetailCell label="Amount">
              {typeof transactionDetail.btc_amount === 'number'
                ? `${transactionDetail.btc_amount} BTC`
                : 'Unknown'}
            </DetailCell>
            <DetailCell label="Fee">
              {transactionDetail.fee ?? 'Unknown'}
            </DetailCell>
            <DetailCell label="Script Type">
              {transactionDetail.script_type || 'Unknown'}
            </DetailCell>
            <DetailCell label="Correlation Confidence">
              {typeof transactionDetail.confidence === 'number'
                ? `${Math.round(transactionDetail.confidence * 100)}%`
                : 'N/A'}
            </DetailCell>
          </div>

          <p style={{ marginTop: 8 }}>
            Full transaction, timeline and evidence detail is available in the
            investigation tabs below.
          </p>
        </div>
      )}

      {ipDetail && (
        <div className="inspector-section">
          <h3>Network Node Summary</h3>
          <div className="detail-grid">
            <DetailCell label="Classification">
              {ipDetail.classification || 'Unknown'}
            </DetailCell>
            <DetailCell label="Country">
              {ipDetail.country ||
                (ipDetail.geoip_available ? 'Unknown' : 'Unavailable')}
            </DetailCell>
            <DetailCell label="Connected TX">
              {ipDetail.connected_transactions?.length || 0}
            </DetailCell>
            <DetailCell label="Connected Wallets">
              {ipDetail.connected_wallets?.length || 0}
            </DetailCell>
          </div>

          <p style={{ marginTop: 8 }}>
            GeoIP / ASN is supporting network context. It does not establish the
            identity or physical location of a person.
          </p>
        </div>
      )}
    </div>
  )
}

export default function EntityInspector({
  selectedEntity,
  leads = [],
  transactions = [],
  clusters = [],
  leadDetail,
  transactionDetail,
  ipDetail,
  onSelectEntity,
}) {
  const [fullscreen, setFullscreen] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async (value) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  if (!selectedEntity) {
    return (
      <div className="entity-inspector empty">
        <div className="empty-inspector">
          <h3>No Investigation Selected</h3>
          <p>Select a lead from the queue or a node in the graph to inspect its risk profile.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="entity-inspector-shell" style={{ height: '100%', minHeight: 0 }}>
        <div
          className="inspector-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <span className="inspector-type">{selectedEntity.type}</span>
            <h2 style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selectedEntity.id}
            </h2>
          </div>

          <button
            type="button"
            className="investigation-inspector-expand"
            onClick={() => setFullscreen(true)}
            title="Open entity inspector fullscreen"
            aria-label="Open entity inspector fullscreen"
          >
            <Maximize2 size={14} />
          </button>
        </div>

        <div
          className="investigation-inspector-content"
          style={{ height: 'calc(100% - 55px)' }}
        >
          <EntityContent
            selectedEntity={selectedEntity}
            leads={leads}
            transactions={transactions}
            clusters={clusters}
            leadDetail={leadDetail}
            transactionDetail={transactionDetail}
            ipDetail={ipDetail}
            onSelectEntity={onSelectEntity}
            copied={copied}
            onCopy={handleCopy}
          />
        </div>
      </div>

      {fullscreen && (
        <div className="entity-inspector-fullscreen">
          <div className="entity-inspector-fullscreen-header">
            <div className="entity-inspector-fullscreen-title">
              <div className="entity-inspector-fullscreen-icon">
                {selectedEntity.type === 'wallet' ? (
                  <WalletCards size={16} />
                ) : selectedEntity.type === 'ip' ? (
                  <Network size={16} />
                ) : (
                  <ArrowUpRight size={16} />
                )}
              </div>

              <div>
                <span>INVESTIGATION WORKSPACE</span>
                <strong>Entity Inspector · {selectedEntity.id}</strong>
              </div>
            </div>

            <button
              type="button"
              className="entity-inspector-fullscreen-close"
              onClick={() => setFullscreen(false)}
              title="Close fullscreen"
              aria-label="Close fullscreen"
            >
              <X size={18} />
            </button>
          </div>

          <div className="entity-inspector-fullscreen-body">
            <div className="entity-inspector-fullscreen-content">
              <EntityContent
                selectedEntity={selectedEntity}
                leads={leads}
                transactions={transactions}
                clusters={clusters}
                leadDetail={leadDetail}
                transactionDetail={transactionDetail}
                ipDetail={ipDetail}
                onSelectEntity={(entity) => {
                  onSelectEntity?.(entity)
                  setFullscreen(false)
                }}
                copied={copied}
                onCopy={handleCopy}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
