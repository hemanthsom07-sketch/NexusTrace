import React from 'react'

export default function GraphLegend() {
  return (
    <div className="graph-legend-overlay">
      <div className="legend-row">
        <div className="legend-item">
          <span className="legend-dot wallet" />
          <span>Wallet (Risk)</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot tx" />
          <span>Transaction</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot ip" />
          <span>Correlated IP</span>
        </div>
      </div>
      <div className="legend-row">
        <div className="legend-item">
          <span className="legend-line input" />
          <span>Input (Inflow)</span>
        </div>
        <div className="legend-item">
          <span className="legend-line output" />
          <span>Output (Outflow)</span>
        </div>
        <div className="legend-item">
          <span className="legend-line broadcast" />
          <span>P2P Broadcast</span>
        </div>
      </div>
    </div>
  )
}
