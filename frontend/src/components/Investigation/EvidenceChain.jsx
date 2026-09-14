import React from 'react'
import { ArrowDown, Globe, Network, ShieldAlert, WalletCards } from 'lucide-react'
import { formatPercent, formatTime } from '../../lib/format'

function Node({ icon: Icon, eyebrow, title, detail, tone = '' }) {
  return (
    <div className={`evidence-chain-node ${tone}`}>
      <div className="evidence-chain-icon"><Icon size={14} /></div>
      <div className="evidence-chain-copy">
        <div className="evidence-chain-eyebrow">{eyebrow}</div>
        <div className="evidence-chain-title">{title}</div>
        {detail && <div className="evidence-chain-detail">{detail}</div>}
      </div>
    </div>
  )
}

export default function EvidenceChain({ wallet, leadDetail, transactions = [], geoByIp = {} }) {
  if (!wallet || !leadDetail) return <div className="tab-panel-empty">Select a wallet lead to build its evidence chain.</div>

  const related = transactions.filter((tx) => (leadDetail.related_txids || []).includes(tx.txid)).slice(0, 5)
  const evidence = related.flatMap((tx) => (tx.correlation_evidence || []).map((ev) => ({ tx, ev })))
    .sort((a, b) => (b.ev.confidence || 0) - (a.ev.confidence || 0))
    .slice(0, 4)

  return (
    <div className="evidence-chain">
      <div className="evidence-chain-header">
        <div>
          <div className="eyebrow">INVESTIGATIVE EVIDENCE CHAIN</div>
          <h3>{wallet}</h3>
        </div>
        <div className="evidence-chain-summary"><ShieldAlert size={13} /> {leadDetail.severity || 'LOW'} priority</div>
      </div>

      <Node icon={WalletCards} eyebrow="SUSPICIOUS ENTITY" title={wallet} detail={`${(leadDetail.related_txids || []).length} related transactions · ${(leadDetail.related_ips || []).length} correlated IPs`} tone="wallet" />

      {evidence.length === 0 ? (
        <div className="evidence-chain-empty">No network correlation evidence is available for this wallet's current transactions.</div>
      ) : evidence.map(({ tx, ev }, index) => {
        const geo = geoByIp[ev.ip]
        return (
          <React.Fragment key={`${tx.txid}-${ev.ip}-${index}`}>
            <div className="evidence-chain-connector"><ArrowDown size={13} /></div>
            <Node
              icon={Network}
              eyebrow="BLOCKCHAIN TRANSACTION"
              title={tx.txid}
              detail={`${formatTime(tx.timestamp)} · ${tx.btc_amount ?? 0} BTC · ${tx.input_addresses?.length || 0} inputs → ${tx.output_addresses?.length || 0} outputs`}
              tone="transaction"
            />
            <div className="evidence-chain-connector"><ArrowDown size={13} /></div>
            <Node
              icon={Globe}
              eyebrow="NETWORK OBSERVATION"
              title={ev.ip}
              detail={`Δt ${ev.time_delta_seconds ?? '—'}s · port ${ev.port ?? '—'} · ${formatPercent(ev.confidence)} correlation confidence`}
              tone="network"
            />
            {geo && (
              <>
                <div className="evidence-chain-connector"><ArrowDown size={13} /></div>
                <Node
                  icon={Globe}
                  eyebrow="GEOIP / ASN ENRICHMENT"
                  title={[geo.city, geo.region, geo.country].filter(Boolean).join(', ') || geo.classification || 'Unavailable'}
                  detail={`${geo.asn || 'ASN unavailable'} · ${geo.org || 'Organization unavailable'} · ${geo.geoip_source || geo.source || 'offline address classification'}`}
                  tone="geo"
                />
              </>
            )}
            <div className="evidence-chain-why">
              <strong>WHY THIS MATTERS</strong>
              <span>{ev.evidence || `Network telemetry was observed ${ev.time_delta_seconds ?? '—'} seconds from ${tx.txid}; this contributes to the cross-layer correlation.`}</span>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}
