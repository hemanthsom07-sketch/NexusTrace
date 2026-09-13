import React from 'react'
import { AlertTriangle } from 'lucide-react'

export default function WhyFlaggedCard({ reasons = [] }) {
  if (!reasons.length) return null

  return (
    <div className="why-flagged-card">
      <div className="why-flagged-header">
        <AlertTriangle size={20} />
        <h3>Explainable AI Risk Factors</h3>
      </div>

      <div className="risk-factors">
        {reasons.map((reason, idx) => (
          <div
            key={idx}
            className="risk-factor"
          >
            <span className="risk-factor-number">
              #{idx + 1}
            </span>

            <span className="risk-factor-text">
              {reason}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}