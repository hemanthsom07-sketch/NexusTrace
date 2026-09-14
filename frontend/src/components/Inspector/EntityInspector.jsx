import React, { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
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

// Rough display ceilings so the bars are legible -- purely a rendering
// scale, the underlying numbers shown are always the real backend values.
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
        {signal.percentile}th percentile for this dataset · {signal.direction === 'typical' ? 'within typical range' : `${signal.direction === 'high' ? 'above' : 'below'} typical range`}
      </div>
      <div className="signal-card-meaning">{signal.meaning}</div>
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
  const explanation = useMemo(() => {
    if (selectedEntity?.type !== 'wallet' || !leadDetail) return null
    return explainWallet(leads, selectedEntity.id)
  }, [leads, selectedEntity, leadDetail])

  // First piece of real correlation evidence tied to this wallet's own
  // transactions -- cross-referenced from the transaction records the
  // backend already returned, never invented. Kept to one representative
  // item here; the Evidence tab below has the full list.
  const correlationEvidence = useMemo(() => {
    if (!leadDetail?.related_txids?.length) return null
    for (const txid of leadDetail.related_txids) {
      const tx = transactions.find((t) => t.txid === txid)
      const ev = tx?.correlation_evidence?.[0]
      if (ev) return { ...ev, txid }
    }
    return null
  }, [leadDetail, transactions])

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

  const severity = leadDetail?.severity
  const hasScore = typeof leadDetail?.anomaly_score === 'number'

  return (
    <div className="entity-inspector">
      <div className="inspector-header">
        <span className="inspector-type">{selectedEntity.type}</span>
        <h2>{selectedEntity.id}</h2>
      </div>

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
            <div className="explanation-note">Risk Score is a dataset-relative anomaly ranking; 100% means most anomalous in this analysis, not 100% certainty of illicit activity.</div>
          </div>

          {explanation && (
            <div className="ai-explanation-card">
              <div className="ai-explanation-header"><Sparkles size={12} /> Why This Wallet Was Flagged</div>
              <p className="ai-explanation-text">{explanation.summary}</p>
              <div className="explanation-note">
                Evidence-based percentile ranking computed from this dataset — not a claimed exact model attribution.
              </div>
            </div>
          )}

          <WhyFlaggedCard reasons={leadDetail.reasons || []} />

          {selectedEntity.type === 'wallet' && (() => {
            const cluster = clusters.find((item) => item.wallets?.includes(selectedEntity.id))
            if (!cluster) return null
            return (
              <div className="inspector-section">
                <h3>Entity Cluster</h3>
                <div className="cluster-card">
                  <div className="cluster-card-top">
                    <strong>{cluster.cluster_id}</strong>
                    <span>{cluster.wallets.length} wallets</span>
                  </div>
                  <p>Common-input ownership heuristic grouped these wallets as a potentially controlled entity.</p>
                  <div className="cluster-wallets">
                    {cluster.wallets.map((wallet) => (
                      <span key={wallet} className="cluster-wallet">{wallet}</span>
                    ))}
                  </div>
                  {cluster.associated_ips?.length > 0 && (
                    <div className="cluster-associated">Associated IPs: {cluster.associated_ips.join(', ')}</div>
                  )}
                  <div className="explanation-note">Forensic heuristic, not an ML classification. Co-spending alone does not prove common control.</div>
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
              ) : leadDetail.feature_snapshot && typeof leadDetail.feature_snapshot === 'object' ? (
                Object.entries(leadDetail.feature_snapshot)
                  .filter(([key]) => FEATURE_LABELS[key])
                  .map(([key, value]) => (
                    <MetricGauge
                      key={key}
                      label={FEATURE_LABELS[key]}
                      value={typeof value === 'number' ? Number(value.toFixed(2)) : value}
                      max={Math.max(FEATURE_MAX[key] || 10, typeof value === 'number' ? value : 0)}
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
                <div>
                  <span>IP</span>
                  <strong>{correlationEvidence.ip}</strong>
                </div>
                <div>
                  <span>Δt</span>
                  <strong>{correlationEvidence.time_delta_seconds ?? 'N/A'}s</strong>
                </div>
                <div>
                  <span>Correlation Confidence</span>
                  <strong>{formatPercent(correlationEvidence.confidence)}</strong>
                </div>
                <div>
                  <span>Transaction</span>
                  <strong>{correlationEvidence.txid}</strong>
                </div>
              </div>
              <p style={{ marginTop: 4 }}>
                Observed network telemetry correlated with this wallet's transaction activity — see the Evidence tab below for the full list.
              </p>
            </div>
          )}
        </>
      )}

      {transactionDetail && (
        <div className="inspector-section">
          <h3>Transaction Summary</h3>
          <div className="detail-grid">
            <div>
              <span>Amount</span>
              <strong>{typeof transactionDetail.btc_amount === 'number' ? `${transactionDetail.btc_amount} BTC` : 'Unknown'}</strong>
            </div>
            <div>
              <span>Fee</span>
              <strong>{transactionDetail.fee ?? 'Unknown'}</strong>
            </div>
            <div>
              <span>Script Type</span>
              <strong>{transactionDetail.script_type || 'Unknown'}</strong>
            </div>
            <div>
              <span>Correlation Confidence</span>
              <strong>
                {typeof transactionDetail.confidence === 'number'
                  ? `${Math.round(transactionDetail.confidence * 100)}%`
                  : 'N/A'}
              </strong>
            </div>
          </div>
          <p style={{ marginTop: 4 }}>Full transaction, timeline and evidence detail is in the tabs below.</p>
        </div>
      )}

      {ipDetail && (
        <div className="inspector-section">
          <h3>Network Node Summary</h3>
          <div className="detail-grid">
            <div>
              <span>Classification</span>
              <strong>{ipDetail.classification || 'Unknown'}</strong>
            </div>
            <div>
              <span>Country</span>
              <strong>{ipDetail.country || (ipDetail.geoip_available ? 'Unknown' : 'Unavailable')}</strong>
            </div>
            <div>
              <span>Connected TX</span>
              <strong>{ipDetail.connected_transactions?.length || 0}</strong>
            </div>
            <div>
              <span>Connected Wallets</span>
              <strong>{ipDetail.connected_wallets?.length || 0}</strong>
            </div>
          </div>
          <p style={{ marginTop: 4 }}>Full GeoIP / ASN detail is in the GeoIP tab below.</p>
        </div>
      )}
    </div>
  )
}
