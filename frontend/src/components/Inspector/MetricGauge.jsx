import React from 'react'

export default function MetricGauge({
  label,
  value,
  max = 10,
  isHighRisk = false,
}) {
  const pct = Math.min(
    100,
    Math.max(0, (value / max) * 100)
  )

  return (
    <div className="metric-gauge">
      <div className="metric-gauge-header">
        <span className="metric-gauge-label">
          {label}
        </span>

        <span
          className={`metric-gauge-value ${
            isHighRisk ? 'high-risk' : ''
          }`}
        >
          {value}
        </span>
      </div>

      <div className="metric-gauge-track">
        <div
          className={`metric-gauge-fill ${
            isHighRisk ? 'high-risk' : ''
          }`}
          style={{
            width: `${pct}%`,
          }}
        />
      </div>

      <div className="metric-gauge-scale">
        <span>0</span>
        <span>{max}</span>
      </div>
    </div>
  )
}