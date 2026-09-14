import React, { useMemo } from 'react'
import { Database, FileDown, Loader2, ShieldAlert } from 'lucide-react'
import { formatPercent } from '../lib/format'

export default function AnalysisSourceBadge({
  analysisSource,
  runStats,
  leads = [],
  selectedEntity,
  selectedWallet,
  transactions = [],
  analyzedAt,
  onGenerateReport,
  reportLoading,
}) {
  if (!analysisSource) return null

  const isSample = analysisSource.type === 'sample'
  const isRestored = analysisSource.type === 'restored'
  const validation = analysisSource.validation

  const networkCount =
    validation?.network_records ??
    runStats?.events_ingested ??
    null

  const blockchainCount =
    validation?.blockchain_records ??
    runStats?.transactions_ingested ??
    null

  const matchingTxids = validation?.matching_txids ?? null

  const analyzedLabel = analyzedAt
    ? new Date(analyzedAt * 1000).toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : null

  const subjectId =
    selectedEntity?.id ||
    selectedWallet ||
    leads?.[0]?.wallet ||
    'Awaiting subject selection'

  const subjectLead = useMemo(() => {
    if (!subjectId) return null

    return (
      leads.find((lead) => lead.wallet === subjectId) ||
      leads.find((lead) => lead.entity_id === subjectId) ||
      null
    )
  }, [leads, subjectId])

  const severity = subjectLead?.severity || 'LOW'

  const riskScore =
    typeof subjectLead?.anomaly_score === 'number'
      ? subjectLead.anomaly_score
      : null

  const relatedTransactions =
    subjectLead?.related_txids?.length ||
    transactions.filter((tx) => {
      if (!subjectId) return false

      return (
        tx.input_addresses?.includes?.(subjectId) ||
        tx.output_addresses?.includes?.(subjectId)
      )
    }).length ||
    0

  const evidenceCount = transactions.reduce((count, tx) => {
    const evidence = Array.isArray(tx.correlation_evidence)
      ? tx.correlation_evidence.length
      : 0

    return count + evidence
  }, 0)

  const networkObservations = transactions.reduce((count, tx) => {
    const evidence = Array.isArray(tx.correlation_evidence)
      ? tx.correlation_evidence
      : []

    const uniqueIps = new Set(
      evidence
        .map((item) => item?.ip)
        .filter(Boolean)
    )

    return count + uniqueIps.size
  }, 0)

  return (
    <>
      <div className="case-workspace-header">
        <div className="case-workspace-title">
          <div className="case-workspace-kicker">
            <ShieldAlert size={13} />
            <span>CASE WORKSPACE</span>
            <span className="case-status">OPEN</span>
          </div>

          <div className="case-workspace-case-id">
            <strong>
              CASE-NT-{String(
                Math.max(1, leads.length)
              ).padStart(3, '0')}
            </strong>
            <span>Current Analysis</span>
          </div>
        </div>

        <div className="case-workspace-subject">
          <span className="case-label">SUBJECT</span>
          <strong title={subjectId}>{subjectId}</strong>
        </div>

        <div className="case-workspace-risk">
          <span className="case-label">RISK</span>
          <div>
            <strong className={`severity-${severity.toLowerCase()}`}>
              {severity}
            </strong>
            {riskScore !== null && (
              <span>{formatPercent(riskScore)}</span>
            )}
          </div>
        </div>

        <div className="case-workspace-stats">
          <div>
            <strong>{relatedTransactions}</strong>
            <span>Transactions</span>
          </div>

          <div>
            <strong>{networkObservations}</strong>
            <span>Network Obs.</span>
          </div>

          <div>
            <strong>{evidenceCount}</strong>
            <span>Evidence</span>
          </div>
        </div>
      </div>

      <div className="analysis-source-badge">
        <div className="analysis-source-main">
          <Database size={14} className="badge-icon" />

          <div>
            <div className="analysis-source-label">
              Current Analysis
            </div>

            <div className="analysis-source-value">
              {isSample
                ? 'Built-in Sample Dataset'
                : isRestored
                  ? 'Current Backend Analysis'
                  : 'Uploaded Dataset'}
            </div>

            {analyzedLabel && (
              <div className="analysis-source-time">
                Analyzed on {analyzedLabel}
              </div>
            )}
          </div>
        </div>

        <div className="analysis-source-metrics">
          <div className="analysis-metric">
            <span className="analysis-metric-value">
              {networkCount ?? '—'}
            </span>
            <span className="analysis-metric-label">
              Network Events
            </span>
          </div>

          <div className="analysis-metric">
            <span className="analysis-metric-value">
              {blockchainCount ?? '—'}
            </span>
            <span className="analysis-metric-label">
              Blockchain Transactions
            </span>
          </div>

          <div className="analysis-metric">
            <span className="analysis-metric-value">
              {matchingTxids ?? '—'}
            </span>
            <span className="analysis-metric-label">
              Matching TXIDs
            </span>
          </div>

          <div className="analysis-metric">
            <span className="analysis-metric-value">
              {leads.length}
            </span>
            <span className="analysis-metric-label">
              Investigation Leads
            </span>
          </div>
        </div>

        {onGenerateReport && (
          <button
            className="btn btn-primary report-button"
            onClick={onGenerateReport}
            disabled={reportLoading}
          >
            {reportLoading ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <FileDown size={15} />
            )}

            {reportLoading
              ? 'Preparing…'
              : 'Generate Final Report'}
          </button>
        )}
      </div>
    </>
  )
}