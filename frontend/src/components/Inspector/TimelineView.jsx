import React from 'react'
import { Clock3, Radio, Layers, ShieldCheck, ArrowDown } from 'lucide-react'

function formatTime(ts) {
  if (ts === null || ts === undefined || ts === '') return 'Timestamp unavailable'

  const date = new Date(typeof ts === 'number' ? ts * 1000 : ts)
  if (Number.isNaN(date.getTime())) return 'Timestamp unavailable'

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

function EventRow({ event, index }) {
  const isNetwork = event.type === 'NETWORK'
  const amount =
    event.type === 'TRANSACTION'
      ? event.description?.split(' · ')[1] || null
      : null

  return (
    <div className="nt2-event">
      <div className="nt2-time">
        <span>{formatTime(event.timestamp ?? event.ts)}</span>
      </div>

      <div className={`nt2-marker ${isNetwork ? 'network' : 'transaction'}`}>
        {isNetwork ? <Radio size={13} /> : <Layers size={13} />}
      </div>

      <div className={`nt2-card ${isNetwork ? 'network' : 'transaction'}`}>
        <div className="nt2-card-head">
          <div className="nt2-kind">
            {isNetwork ? 'NETWORK OBSERVATION' : 'BLOCKCHAIN TRANSACTION'}
          </div>
          <span className="nt2-sequence">#{String(index + 1).padStart(2, '0')}</span>
        </div>

        {isNetwork ? (
          <>
            <div className="nt2-title">
              Observation from <code>{event.ip || 'Unknown IP'}</code>
            </div>

            <div className="nt2-facts">
              <span>
                <small>PORT</small>
                <b>{event.port ?? '—'}</b>
              </span>
              <span>
                <small>TIME DELTA</small>
                <b>{event.time_delta_seconds ?? '—'}s</b>
              </span>
              <span>
                <small>CONFIDENCE</small>
                <b>{event.confidence != null ? `${Math.round(event.confidence * 100)}%` : '—'}</b>
              </span>
            </div>

            <div className="nt2-evidence-note">
              <ShieldCheck size={12} />
              <span>
                Network-layer evidence correlated with the nearby blockchain transaction.
                This supports the link; it does not establish IP ownership.
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="nt2-title">
              <code>{event.description?.split(' · ')[0] || 'Transaction'}</code>
              {amount && <strong>{amount}</strong>}
            </div>

            <div className="nt2-transaction-note">
              Blockchain-layer transaction recorded in the analyzed dataset.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function TimelineView({ evidence = [] }) {
  const events = Array.isArray(evidence) ? evidence : []

  if (events.length === 0) {
    return (
      <div className="nt2-empty">
        <Clock3 size={18} />
        <strong>No timestamped events available</strong>
        <span>The selected entity has no usable transaction or network timestamps.</span>
      </div>
    )
  }

  return (
    <section className="nt2-timeline">
      <div className="nt2-header">
        <div>
          <div className="nt2-eyebrow">
            <Clock3 size={13} />
            EVIDENCE TIMELINE
          </div>
          <h3>Cross-layer activity sequence</h3>
          <p>
            Blockchain transactions and network observations are shown in their actual
            recorded order. Network observations are supporting correlation evidence,
            not separate on-chain events.
          </p>
        </div>

        <div className="nt2-count">
          <strong>{events.length}</strong>
          <span>EVENTS</span>
        </div>
      </div>

      <div className="nt2-legend">
        <span><i className="tx-dot" /> Blockchain transaction</span>
        <span><i className="net-dot" /> Network observation</span>
        <span className="legend-note">Closer Δt → stronger correlation confidence</span>
      </div>

      <div className="nt2-list">
        {events.map((event, index) => (
          <React.Fragment key={`${event.type}-${event.timestamp ?? event.ts ?? 'unknown'}-${index}`}>
            <EventRow event={event} index={index} />
            {index < events.length - 1 && (
              <div className="nt2-connector">
                <ArrowDown size={11} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="nt2-footer">
        <ShieldCheck size={13} />
        <span>
          Correlation confidence is a rule-based evidence score derived from temporal
          proximity and network-port context. It is not a probability of malicious activity.
        </span>
      </div>
    </section>
  )
}
