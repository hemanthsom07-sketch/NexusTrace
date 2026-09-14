import React from 'react'
import { NODE_TYPE_META, EDGE_TYPE_META } from '../../lib/entityMeta'
import { GLOSSARY } from '../../lib/glossary'

export default function GraphLegend() {
  return (
    <div className="graph-legend">
      <div>
        <div className="legend-section-title">Nodes</div>
        {Object.entries(NODE_TYPE_META).map(([type, meta]) => (
          <div className="legend-item" key={type}>
            <span className="legend-dot" style={{ backgroundColor: meta.color }} />
            <span>{meta.label}</span>
          </div>
        ))}
      </div>

      <div>
        <div className="legend-section-title">Relationships</div>
        <div className="legend-item" title={GLOSSARY.SENT_TO}>
          <span className="legend-line" style={{ backgroundColor: EDGE_TYPE_META.input.color }} />
          <span>SENT_TO</span>
        </div>
        <div className="legend-item" title={GLOSSARY.OUTPUT_TO || 'Transaction output to a wallet.'}>
          <span className="legend-line" style={{ backgroundColor: EDGE_TYPE_META.output.color }} />
          <span>OUTPUT_TO</span>
        </div>
        <div className="legend-item" title={GLOSSARY.CORRELATED_WITH}>
          <span className="legend-line" style={{ backgroundColor: EDGE_TYPE_META.broadcast.color }} />
          <span>CORRELATED_WITH</span>
        </div>
      </div>
    </div>
  )
}
