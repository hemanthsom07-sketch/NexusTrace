import React from 'react'
import { Clock } from 'lucide-react'

export default function TimelineView({ evidence = [] }) {
  if (!evidence.length) return null

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown time'

    const date = new Date(
      typeof timestamp === 'number'
        ? timestamp * 1000
        : timestamp
    )

    if (Number.isNaN(date.getTime())) {
      return 'Unknown time'
    }

    return date.toLocaleString()
  }

  return (
    <div className="timeline-view">
      <div className="timeline-header">
        <Clock size={20} />
        <h3>Evidence Timeline</h3>
      </div>

      <div className="timeline">
        {evidence.map((item, idx) => (
          <div
            key={item.id || idx}
            className="timeline-item"
          >
            <div className="timeline-marker">
              <span />
            </div>

            <div className="timeline-content">
              <div className="timeline-time">
                {formatTime(
                  item.timestamp ||
                    item.time ||
                    item.created_at
                )}
              </div>

              <div className="timeline-event">
                {item.description ||
                  item.event ||
                  item.message ||
                  item.label ||
                  'Evidence event'}
              </div>

              {item.type && (
                <div className="timeline-type">
                  {item.type}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}