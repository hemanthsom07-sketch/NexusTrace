import React from 'react'
import { AlertTriangle, CheckCircle } from 'lucide-react'

export default function WhyFlaggedCard({ reasons }) {
  if (!reasons || reasons.length === 0) {
    return (
      <div className="inspector-card">
        <div className="section-title">
          <CheckCircle size={13} />
          <span>Risk Assessment</span>
        </div>
        <p style={{ fontSize: 12, color: '#94A3B8' }}>
          No prominent statistical anomalies identified for this entity.
        </p>
      </div>
    )
  }

  return (
    <div className="inspector-card">
      <div className="section-title">
        <AlertTriangle size={13} color="#EF4444" />
        <span>Why Was This Wallet Flagged?</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {reasons.map((reason, idx) => {
          const num = String(idx + 1).padStart(2, '0')
          return (
            <div key={idx} className="reason-card">
              <span className="reason-num">{num}</span>
              <div className="reason-text">{reason}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
