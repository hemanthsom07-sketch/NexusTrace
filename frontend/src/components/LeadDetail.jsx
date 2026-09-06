import React, { useEffect, useState } from 'react'
import { getLeadDetail } from '../api/client'

export default function LeadDetail({ wallet }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!wallet) {
      setDetail(null)
      return
    }
    setLoading(true)
    setError(null)
    getLeadDetail(wallet)
      .then(setDetail)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [wallet])

  if (!wallet) {
    return <div className="empty-state">Select a wallet from the list to see its evidence.</div>
  }
  if (loading) return <div className="empty-state">Loading…</div>
  if (error) return <div className="empty-state error">Error: {error}</div>
  if (!detail) return null

  return (
    <div className="lead-detail-card">
      <div className="lead-detail-header">
        <div>
          <div className="lead-detail-label">INVESTIGATION ALERT</div>
          <div className="lead-detail-wallet">Wallet: {detail.wallet}</div>
        </div>
        <div className="lead-detail-score">
          <span className={`severity-badge severity-${detail.severity.toLowerCase()}`}>
            {detail.severity}
          </span>
          <div className="score-value">{detail.anomaly_score.toFixed(3)}</div>
          <div className="score-caption">anomaly score</div>
        </div>
      </div>

      <div className="lead-detail-section">
        <h4>Flagged because:</h4>
        <ul>
          {detail.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </div>

      <div className="lead-detail-section">
        <h4>Related evidence:</h4>
        <p><strong>TXIDs:</strong> {detail.related_txids.join(', ') || '—'}</p>
        <p><strong>Connected IPs:</strong> {detail.related_ips.join(', ') || '—'}</p>
      </div>

      {detail.feature_snapshot && (
        <div className="lead-detail-section">
          <h4>Feature snapshot:</h4>
          <table className="feature-table">
            <tbody>
              {Object.entries(detail.feature_snapshot).map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{typeof v === 'number' ? v.toFixed(3) : v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="disclaimer">
        Anomaly score reflects statistical rarity in this dataset only — it is not a
        determination of criminal activity. Investigator judgment required.
      </p>
    </div>
  )
}
