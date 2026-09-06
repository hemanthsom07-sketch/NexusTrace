import React from 'react'
import { Clock } from 'lucide-react'

export default function TimelineView({ wallet, severity, txCount = 0 }) {
  return (
    <div className="inspector-card">
      <div className="section-title">
        <Clock size={13} />
        <span>Cross-Layer Correlation Sequence</span>
      </div>

      <div className="timeline-list">
        <div className="timeline-step">
          <div className="timeline-node" />
          <div className="timeline-title">01 • P2P Network Broadcast</div>
          <div className="timeline-desc">
            Network layer telemetry captured Bitcoin node transaction propagation via port 8333.
          </div>
        </div>

        <div className="timeline-step">
          <div className="timeline-node" />
          <div className="timeline-title">02 • Temporal Window Correlation</div>
          <div className="timeline-desc">
            Spatio-temporal alignment verified ($\Delta t \le 5.0$s) linking network IPs to transaction IDs.
          </div>
        </div>

        <div className="timeline-step">
          <div className="timeline-node" />
          <div className="timeline-title">03 • On-Chain Ledger Ingestion</div>
          <div className="timeline-desc">
            Transaction mined; inputs and outputs resolved to wallet <strong>{wallet}</strong> ({txCount} transactions).
          </div>
        </div>

        <div className="timeline-step">
          <div className={`timeline-node ${severity === 'HIGH' ? 'high' : ''}`} />
          <div className="timeline-title">04 • Isolation Forest Scoring</div>
          <div className="timeline-desc">
            Multivariate feature anomalies detected; flagged as <strong>{severity || 'LOW'}</strong> risk investigation lead.
          </div>
        </div>
      </div>
    </div>
  )
}
