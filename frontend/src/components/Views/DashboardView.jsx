import React, { useMemo } from 'react'
import {
  Database,
  Activity,
  ShieldAlert,
  Network,
  FileSearch,
  UploadCloud,
} from 'lucide-react'
import KpiBar from '../KpiBar'
import { summarizeAnalysis } from '../../lib/explainability'
import { formatPercent } from '../../lib/format'

export default function DashboardView({
  stats,
  leads = [],
  transactions = [],
  hasAnalyzed = false,
  analysisSource,
  onInvestigateWallet,
  onNavigateTab,
  onGoToPipeline,
  clusters = [],
}) {
  const topLead = leads[0]

  const distinctIps = useMemo(() => {
    const set = new Set()
    leads.forEach((l) => (l.related_ips || []).forEach((ip) => set.add(ip)))
    return set.size
  }, [leads])

  const clusterWalletCount = useMemo(
    () => new Set(clusters.flatMap((cluster) => cluster.wallets || [])).size,
    [clusters]
  )

  const severityCounts = useMemo(() => {
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 }

    leads.forEach((l) => {
      if (counts[l.severity] !== undefined) {
        counts[l.severity] += 1
      }
    })

    return counts
  }, [leads])

  const recentLeads = useMemo(
    () =>
      leads
        .slice()
        .sort((a, b) => (b.anomaly_score || 0) - (a.anomaly_score || 0))
        .slice(0, 6),
    [leads]
  )

  const analysisSummary = useMemo(
    () => (hasAnalyzed ? summarizeAnalysis(leads) : null),
    [hasAnalyzed, leads]
  )

  if (!hasAnalyzed) {
    return (
      <div className="dashboard-view">
        <div className="gated-view" style={{ height: '70vh' }}>
          <div className="gated-card">
            <div className="gated-card-icon">
              <UploadCloud size={22} />
            </div>

            <h3>No Analysis Yet</h3>

            <p>
              Overview will populate with real dataset statistics and an
              evidence-based analysis summary once you upload a dataset and
              run analysis.
            </p>

            <button
              className="btn btn-primary"
              onClick={onGoToPipeline}
            >
              Go to Dataset Input
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-view">
      <div className="dashboard-hero">
        <div className="hero-content">
          <h1>Nothing on-chain stays hidden.</h1>

          <p>
            NexusTrace fuses P2P network-layer broadcast telemetry with Bitcoin
            blockchain transactions to surface cross-layer correlations,
            anomalous wallets and evidence-backed investigation leads —
            fully offline.
          </p>

          <button
            className="investigate-button"
            onClick={() => onNavigateTab('investigate')}
          >
            Open Investigation Workspace →
          </button>
        </div>
      </div>

      {analysisSummary && (
        <div className="ai-summary-card">
          <div className="ai-summary-header">
            <FileSearch size={13} />
            Investigation Summary
          </div>

          <p className="ai-summary-text">
            {analysisSummary}
          </p>
        </div>
      )}

      <div className="command-grid">
        <div className="command-card">
          <div className="command-card-title">
            <Database size={13} />
            Dataset Status
          </div>

          <div className="command-status-row">
            <span className="status-dot" />
            Dataset loaded
          </div>

          <div className="command-card-sub">
            {stats?.transactions_ingested != null
              ? `${stats.transactions_ingested} transactions · ${
                  stats.events_ingested || 0
                } network events ingested`
              : `${transactions.length} transactions analyzed`}

            {analysisSource && (
              <>
                {' · '}
                {analysisSource.type === 'sample'
                  ? 'Built-in Sample Dataset'
                  : analysisSource.type === 'restored'
                    ? 'Current Backend Analysis'
                    : 'Uploaded Dataset'}
              </>
            )}
          </div>
        </div>

        <div className="command-card">
          <div className="command-card-title">
            <Activity size={13} />
            Analysis Status
          </div>

          <div className="command-status-row">
            <span className="status-dot" />
            ANALYSIS COMPLETE
          </div>

          <div className="command-card-sub">
            {stats?.links_found != null
              ? `${stats.links_found} cross-layer correlations found`
              : 'Results loaded from current session'}
          </div>
        </div>

        <div className="command-card">
          <div className="command-card-title">
            <Network size={13} />
            Network Intelligence
          </div>

          <div className="command-card-value">
            {distinctIps}
          </div>

          <div className="command-card-sub">
            Distinct correlated IP addresses
          </div>
        </div>
      </div>

      <div className="command-grid">
        <div className="command-card">
          <div className="command-card-title">
            <ShieldAlert size={13} />
            High Severity
          </div>

          <div
            className="command-card-value"
            style={{ color: 'var(--sev-high)' }}
          >
            {severityCounts.HIGH}
          </div>

          <div className="command-card-sub">
            of {leads.length} scored wallets
          </div>
        </div>

        <div className="command-card">
          <div className="command-card-title">
            <ShieldAlert size={13} />
            Medium Severity
          </div>

          <div
            className="command-card-value"
            style={{ color: 'var(--sev-medium)' }}
          >
            {severityCounts.MEDIUM}
          </div>

          <div className="command-card-sub">
            of {leads.length} scored wallets
          </div>
        </div>

        <div className="command-card">
          <div className="command-card-title">
            <ShieldAlert size={13} />
            Low Severity
          </div>

          <div
            className="command-card-value"
            style={{ color: 'var(--sev-low)' }}
          >
            {severityCounts.LOW}
          </div>

          <div className="command-card-sub">
            of {leads.length} scored wallets
          </div>
        </div>
      </div>

      {stats && (
        <div style={{ marginBottom: 20 }}>
          <KpiBar stats={stats} />
        </div>
      )}

      <div className="command-grid">
        <div className="command-card">
          <div className="command-card-title">
            <Activity size={13} />
            Detection Method
          </div>

          <div
            className="command-card-value"
            style={{ fontSize: 18 }}
          >
            Isolation Forest
          </div>

          <div className="command-card-sub">
            Unsupervised anomaly detection · 6 behavioral features · offline
          </div>
        </div>

        <div className="command-card">
          <div className="command-card-title">
            <Network size={13} />
            Entity Clustering
          </div>

          <div className="command-card-value">
            {clusters.length}
          </div>

          <div className="command-card-sub">
            Common-input ownership clusters · {clusterWalletCount} wallets
            grouped
          </div>
        </div>

        <div className="command-card">
          <div className="command-card-title">
            <FileSearch size={13} />
            Evidence Coverage
          </div>

          <div className="command-card-value">
            {stats?.links_found ?? 0}
          </div>

          <div className="command-card-sub">
            Network observations correlated to blockchain activity
          </div>
        </div>
      </div>

      {topLead && (
        <div className="priority-card">
          <div className="priority-content">
            <span className="priority-label">
              Highest Priority Target Flagged
            </span>

            <h2>{topLead.wallet}</h2>

            <p>
              {topLead.reasons?.[0] || 'Suspicious activity detected.'}
            </p>
          </div>

          <button
            className="triage-button"
            onClick={() => onInvestigateWallet(topLead.wallet)}
          >
            Investigate Entity →
          </button>
        </div>
      )}

      <div className="overview-columns">
        <div className="overview-panel">
          <div className="overview-panel-header">
            Recent Leads
          </div>

          {recentLeads.length === 0 ? (
            <div className="ai-insight-row">
              No wallets were flagged in this dataset.
            </div>
          ) : (
            recentLeads.map((lead) => (
              <div
                className="recent-lead-row"
                key={lead.wallet}
                onClick={() => onInvestigateWallet(lead.wallet)}
                style={{ cursor: 'pointer' }}
              >
                <span className="recent-lead-wallet">
                  {lead.wallet}
                </span>

                <span
                  className={`severity severity-${(
                    lead.severity || 'low'
                  ).toLowerCase()}`}
                >
                  {lead.severity}
                </span>

                <span className="recent-lead-score">
                  {formatPercent(lead.anomaly_score)}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="overview-panel">
          <div className="overview-panel-header">
            <FileSearch size={12} style={{ marginRight: 6 }} />
            Correlation Snapshot
          </div>

          <div className="ai-insight-row">
            <span>
              {stats?.links_found ?? '—'} cross-layer correlations linked
              network telemetry to blockchain transactions in this dataset.
            </span>
          </div>

          <div className="ai-insight-row">
            <span>
              {distinctIps} distinct IP address
              {distinctIps === 1 ? '' : 'es'} were associated with flagged
              wallets.
            </span>
          </div>

          <div className="ai-insight-row">
            <span>
              {severityCounts.HIGH + severityCounts.MEDIUM} of{' '}
              {leads.length} wallets exceeded the medium-or-higher severity
              threshold.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}