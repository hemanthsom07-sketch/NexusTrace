import React from 'react'
import { Database, FileDown, Loader2 } from 'lucide-react'

// Compact "current analysis" header bar. Every value here comes straight
// from the actual analysis response for this session (validation record
// counts for an upload, or nothing but the source label for the sample
// pipeline, plus the live leads count and the timestamp of the last
// successful analysis) -- nothing is guessed or hardcoded.
export default function AnalysisSourceBadge({
  analysisSource,
  runStats,
  leadsCount,
  analyzedAt,
  onGenerateReport,
  reportLoading,
}) {
  if (!analysisSource) return null

  const isSample = analysisSource.type === 'sample'
  const isRestored = analysisSource.type === 'restored'
  const validation = analysisSource.validation

  const networkCount = validation?.network_records ?? runStats?.events_ingested ?? null
  const blockchainCount = validation?.blockchain_records ?? runStats?.transactions_ingested ?? null
  const matchingTxids = validation?.matching_txids ?? null

  const analyzedLabel = analyzedAt
    ? new Date(analyzedAt * 1000).toLocaleString(undefined, {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : null

  return (
    <div className="analysis-source-badge">
      <div className="analysis-source-main">
        <Database size={14} className="badge-icon" />
        <div>
          <div className="analysis-source-label">Current Analysis</div>
          <div className="analysis-source-value">{isSample ? 'Built-in Sample Dataset' : isRestored ? 'Current Backend Analysis' : 'Uploaded Dataset'}</div>
          {analyzedLabel && <div className="analysis-source-time">Analyzed on {analyzedLabel}</div>}
        </div>
      </div>

      <div className="analysis-source-metrics">
        <div className="analysis-metric">
          <span className="analysis-metric-value">{networkCount ?? '—'}</span>
          <span className="analysis-metric-label">Network Events</span>
        </div>
        <div className="analysis-metric">
          <span className="analysis-metric-value">{blockchainCount ?? '—'}</span>
          <span className="analysis-metric-label">Blockchain Transactions</span>
        </div>
        <div className="analysis-metric">
          <span className="analysis-metric-value">{matchingTxids ?? '—'}</span>
          <span className="analysis-metric-label">Matching TXIDs</span>
        </div>
        <div className="analysis-metric">
          <span className="analysis-metric-value">{leadsCount ?? 0}</span>
          <span className="analysis-metric-label">Investigation Leads</span>
        </div>
      </div>

      {onGenerateReport && (
        <button className="btn btn-primary report-button" onClick={onGenerateReport} disabled={reportLoading}>
          {reportLoading ? <Loader2 size={15} className="spin" /> : <FileDown size={15} />}
          {reportLoading ? 'Preparing…' : 'Generate Final Report'}
        </button>
      )}
    </div>
  )
}
