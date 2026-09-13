import React from 'react'
import { formatPercent } from '../../lib/format'

export default function AlertsView({
  leads = [],
  onInvestigateWallet,
  hasAnalyzed = true,
  onGoToPipeline,
}) {
  return (
    <div className="alerts-view">
      <div className="alerts-header">
        <div>
          <h2>Security Alerts</h2>
          <p>High-priority wallets requiring investigation.</p>
        </div>

        <span className="alerts-count">{leads.length} alerts</span>
      </div>

      {leads.length === 0 ? (
        <div className="empty-state">
          {hasAnalyzed ? (
            <p>No wallets were flagged in the analyzed dataset.</p>
          ) : (
            <>
              <p>No analysis has been run yet — alerts will populate once a dataset is analyzed.</p>
              {onGoToPipeline && (
                <button className="btn btn-primary" onClick={onGoToPipeline}>
                  Go to Dataset Input
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="alerts-table-wrapper">
          <table className="alerts-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Wallet Address</th>
                <th>Anomaly Score</th>
                <th>Top Flagged Reason</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {leads.map((lead) => (
                <tr key={lead.wallet}>
                  <td>
                    <span className={`severity-badge severity-${(lead.severity || 'LOW').toLowerCase()}`}>
                      {lead.severity || 'LOW'}
                    </span>
                  </td>
                  <td className="wallet-address">{lead.wallet}</td>
                  <td>{formatPercent(lead.anomaly_score)}</td>
                  <td>{lead.reasons?.[0] || 'No reason provided'}</td>
                  <td>
                    <button className="investigate-button" onClick={() => onInvestigateWallet(lead.wallet)}>
                      Investigate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
