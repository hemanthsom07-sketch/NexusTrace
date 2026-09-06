import React from 'react'
import { Layers, Globe, ArrowRight } from 'lucide-react'

export default function RelatedChips({
  relatedTxids = [],
  relatedIps = [],
  onSelectTx,
  onSelectIp,
}) {
  return (
    <div className="inspector-card">
      <div className="section-title">
        <Layers size={13} />
        <span>Correlated Entities &amp; Evidence</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6, fontWeight: 600 }}>
            Related Transactions ({relatedTxids.length}):
          </div>
          {relatedTxids.length === 0 ? (
            <span style={{ fontSize: 11.5, color: '#64748B' }}>None recorded</span>
          ) : (
            <div className="chips-container">
              {relatedTxids.map((txid) => (
                <button
                  key={txid}
                  className="evidence-chip"
                  onClick={() => onSelectTx && onSelectTx(txid)}
                  title={`Inspect transaction ${txid} in graph`}
                >
                  <Layers size={11} />
                  <span>{txid}</span>
                  <ArrowRight size={10} style={{ opacity: 0.6 }} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6, fontWeight: 600 }}>
            Correlated IP Nodes ({relatedIps.length}):
          </div>
          {relatedIps.length === 0 ? (
            <span style={{ fontSize: 11.5, color: '#64748B' }}>None recorded</span>
          ) : (
            <div className="chips-container">
              {relatedIps.map((ip) => (
                <button
                  key={ip}
                  className="evidence-chip ip"
                  onClick={() => onSelectIp && onSelectIp(ip)}
                  title={`Inspect IP ${ip} in graph & GeoIP`}
                >
                  <Globe size={11} />
                  <span>{ip}</span>
                  <ArrowRight size={10} style={{ opacity: 0.6 }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
