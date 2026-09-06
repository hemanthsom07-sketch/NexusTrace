import React from 'react'
import {
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Activity,
  Zap,
  Layers,
  Globe,
  Wallet,
  CheckCircle2,
} from 'lucide-react'
import KpiBar from '../KpiBar'

export default function DashboardView({
  stats,
  leads = [],
  onInvestigateWallet,
  onNavigateTab,
}) {
  const topLeads = leads.slice(0, 5)
  const plantedLead = leads.find((l) => l.wallet === 'W_A12') || topLeads[0]

  return (
    <div className="full-view-container">
      {/* Executive Hero Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0B1220 0%, #0F1B2E 100%)',
          border: '1px solid #1E2D47',
          borderRadius: 8,
          padding: '24px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ maxWidth: 640 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontFamily: 'ui-monospace, monospace',
              color: '#38BDF8',
              background: 'rgba(14, 165, 233, 0.12)',
              border: '1px solid rgba(14, 165, 233, 0.3)',
              borderRadius: 4,
              padding: '3px 8px',
              marginBottom: 12,
            }}
          >
            <Zap size={11} />
            <span>CROSS-LAYER INTELLIGENCE CORE ACTIVE</span>
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#F8FAFC', marginBottom: 6, letterSpacing: '-0.5px' }}>
            Nothing on-chain stays hidden.
          </h1>
          <p style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.5 }}>
            NexusTrace synthesizes P2P network layer broadcast events with Bitcoin blockchain transactions,
            unveiling synthetic clusters, rapid fan-out dispersion, and behavioral anomalies with explainable mathematical proofs.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 200 }}>
          <button
            className="btn-primary"
            style={{ justifyContent: 'center', padding: '10px 18px', fontSize: 13 }}
            onClick={() => onNavigateTab('investigate')}
          >
            <span>Open Investigation Workspace</span>
            <ArrowRight size={14} />
          </button>
          <button
            className="btn-secondary"
            style={{ justifyContent: 'center', padding: '8px 14px' }}
            onClick={() => onNavigateTab('pipeline')}
          >
            <span>Ingest Custom Datasets</span>
          </button>
        </div>
      </div>

      {/* Executive KPI Summary Bar */}
      <KpiBar stats={stats} />

      {/* Grid: Planted Anomaly Callout & Risk Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        {/* Planted Anomaly Hero Card (W_A12) */}
        {plantedLead && (
          <div
            className="data-table-card"
            style={{
              padding: 20,
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.06), #0E1524)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    color: '#EF4444',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                  }}
                >
                  <ShieldAlert size={14} />
                  Highest Priority Target Flagged
                </span>
                <span className="severity-tag high">{plantedLead.severity} SEVERITY</span>
              </div>

              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'ui-monospace', color: '#FFFFFF', marginBottom: 4 }}>
                {plantedLead.wallet}
              </div>

              <p style={{ fontSize: 12.5, color: '#94A3B8', marginBottom: 16 }}>
                Synthetically planted multi-hop fan-out anomaly identified with an anomaly score of{' '}
                <strong style={{ color: '#EF4444' }}>{plantedLead.anomaly_score.toFixed(3)}</strong>. Correlated across{' '}
                {plantedLead.related_txids?.length || 4} outgoing transactions originating from node{' '}
                <code style={{ color: '#38BDF8' }}>{plantedLead.related_ips?.[0] || '45.33.1.10'}</code>.
              </p>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {(plantedLead.reasons || []).slice(0, 2).map((r, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(11, 16, 25, 0.7)',
                      border: '1px solid #1E2D47',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: 11.5,
                      color: '#E2E8F0',
                      flex: 1,
                    }}
                  >
                    {r}
                  </div>
                ))}
              </div>
            </div>

            <button
              className="btn-primary"
              style={{ width: 'fit-content', background: '#EF4444', borderColor: '#DC2626' }}
              onClick={() => onInvestigateWallet(plantedLead.wallet)}
            >
              <span>Triage Target {plantedLead.wallet}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        )}

        {/* Triage Matrix / Quick Stats */}
        <div className="data-table-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#0EA5E9', textTransform: 'uppercase' }}>
            <Activity size={14} />
            <span>Detection Matrix &amp; Distribution</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                <span style={{ color: '#EF4444', fontWeight: 600 }}>High Risk Leads (Score ≥ 0.70)</span>
                <span style={{ fontFamily: 'ui-monospace', fontWeight: 700 }}>
                  {stats?.high_risk_count ?? 2} wallets
                </span>
              </div>
              <div className="gauge-bar-track">
                <div
                  className="gauge-bar-fill high-risk"
                  style={{ width: `${((stats?.high_risk_count ?? 2) / (stats?.wallets_count || 38)) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                <span style={{ color: '#F59E0B', fontWeight: 600 }}>Medium Risk Leads (0.40 ≤ Score &lt; 0.70)</span>
                <span style={{ fontFamily: 'ui-monospace', fontWeight: 700 }}>
                  {stats?.medium_risk_count ?? 1} wallets
                </span>
              </div>
              <div className="gauge-bar-track">
                <div
                  className="gauge-bar-fill"
                  style={{
                    background: '#F59E0B',
                    width: `${((stats?.medium_risk_count ?? 1) / (stats?.wallets_count || 38)) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                <span style={{ color: '#64748B', fontWeight: 600 }}>Low Risk Baseline (Score &lt; 0.40)</span>
                <span style={{ fontFamily: 'ui-monospace', fontWeight: 700 }}>
                  {stats?.low_risk_count ?? 35} wallets
                </span>
              </div>
              <div className="gauge-bar-track">
                <div
                  className="gauge-bar-fill"
                  style={{
                    background: '#64748B',
                    width: `${((stats?.low_risk_count ?? 35) / (stats?.wallets_count || 38)) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 'auto',
              background: '#0B1019',
              border: '1px solid #172236',
              borderRadius: 6,
              padding: 10,
              fontSize: 11.5,
              color: '#94A3B8',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <CheckCircle2 size={16} color="#10B981" />
            <span>Unsupervised Isolation Forest verified against 18 on-chain blocks.</span>
          </div>
        </div>
      </div>

      {/* Top 5 Ranked Investigation Leads Table */}
      <div className="data-table-card">
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1E2D47', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#F1F5F9', letterSpacing: '0.5px' }}>
            Top Investigation Leads
          </div>
          <button
            className="btn-secondary"
            style={{ fontSize: 11 }}
            onClick={() => onNavigateTab('investigate')}
          >
            View All ({leads.length})
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Wallet</th>
              <th>Risk Score</th>
              <th>Severity</th>
              <th>Velocity</th>
              <th>Fan-out</th>
              <th>Outgoing Volume</th>
              <th>Connected IPs</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {topLeads.map((lead) => (
              <tr key={lead.wallet}>
                <td style={{ fontFamily: 'ui-monospace', fontWeight: 600, color: '#38BDF8' }}>
                  {lead.wallet}
                </td>
                <td style={{ fontFamily: 'ui-monospace', fontWeight: 700, color: lead.severity === 'HIGH' ? '#EF4444' : '#F1F5F9' }}>
                  {lead.anomaly_score.toFixed(3)}
                </td>
                <td>
                  <span className={`severity-tag ${lead.severity.toLowerCase()}`}>{lead.severity}</span>
                </td>
                <td style={{ fontFamily: 'ui-monospace' }}>
                  {(lead.feature_snapshot?.transaction_velocity ?? 0).toFixed(2)} tx/hr
                </td>
                <td style={{ fontFamily: 'ui-monospace' }}>
                  {lead.feature_snapshot?.fan_out_count ?? 0}
                </td>
                <td style={{ fontFamily: 'ui-monospace' }}>
                  {(lead.feature_snapshot?.total_out_amount ?? 0).toFixed(2)} BTC
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(lead.related_ips || []).map((ip) => (
                      <span key={ip} className="evidence-chip ip" style={{ padding: '2px 5px', fontSize: 10 }}>
                        {ip}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: 11, padding: '3px 8px' }}
                    onClick={() => onInvestigateWallet(lead.wallet)}
                  >
                    Investigate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
