import React from 'react'
import {
  ArrowDown,
  AlertCircle,
  Database,
  Globe,
  Link2,
  MapPin,
  Network,
  Radio,
  Shield,
  WalletCards,
} from 'lucide-react'
import { formatPercent, formatTime } from '../../lib/format'

function EvidenceStep({
  number,
  icon: Icon,
  eyebrow,
  title,
  detail,
  badges = [],
  description,
  tone = '',
}) {
  return (
    <>
      <div className={`evidence-chain-step ${tone}`}>
        <div className="evidence-chain-step-icon">
          <Icon size={22} />
        </div>

        <div className="evidence-chain-step-number">
          {String(number).padStart(2, '0')}
        </div>

        <div className="evidence-chain-step-main">
          <div className="evidence-chain-step-eyebrow">
            {eyebrow}
          </div>

          <div className="evidence-chain-step-title">
            {title}
          </div>

          {detail && (
            <div className="evidence-chain-step-detail">
              {detail}
            </div>
          )}

          {badges.length > 0 && (
            <div className="evidence-chain-badges">
              {badges.map((badge, index) => (
                <span
                  key={`${badge}-${index}`}
                  className="evidence-chain-badge"
                >
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>

        {description && (
          <div className="evidence-chain-step-description">
            {description}
          </div>
        )}
      </div>

      {number < 4 && (
        <div className="evidence-chain-connector">
          <ArrowDown size={16} />
        </div>
      )}
    </>
  )
}

function SideCard({
  icon: Icon,
  title,
  children,
  tone = '',
}) {
  return (
    <div className={`evidence-chain-side-card ${tone}`}>
      <div className="evidence-chain-side-header">
        <div className="evidence-chain-side-icon">
          <Icon size={16} />
        </div>

        <span>{title}</span>
      </div>

      <div className="evidence-chain-side-content">
        {children}
      </div>
    </div>
  )
}

function SideRow({
  label,
  value,
  emphasis = false,
}) {
  return (
    <div className="evidence-chain-side-row">
      <span>{label}</span>

      <strong className={emphasis ? 'emphasis' : ''}>
        {value}
      </strong>
    </div>
  )
}

export default function EvidenceChain({
  wallet,
  leadDetail,
  transactions = [],
  geoByIp = {},
}) {
  if (!wallet || !leadDetail) {
    return (
      <div className="tab-panel-empty">
        Select a wallet lead to build its evidence chain.
      </div>
    )
  }

  const relatedTransactions = transactions.filter((tx) =>
    (leadDetail.related_txids || []).includes(tx.txid)
  )

  const related = relatedTransactions.slice(0, 5)

  const evidence = related
    .flatMap((tx) =>
      (tx.correlation_evidence || []).map((ev) => ({
        tx,
        ev,
      }))
    )
    .sort(
      (a, b) =>
        (b.ev.confidence || 0) -
        (a.ev.confidence || 0)
    )

  const primaryEvidence = evidence[0] || null

  const primaryTx =
    primaryEvidence?.tx ||
    related[0] ||
    null

  const primaryEv =
    primaryEvidence?.ev ||
    primaryTx?.correlation_evidence?.[0] ||
    null

  const ip = primaryEv?.ip || null

  const geo = ip
    ? geoByIp[ip]
    : null

  const severity =
    leadDetail.severity || 'LOW'

  const riskScore =
    typeof leadDetail.risk_score === 'number'
      ? leadDetail.risk_score
      : null

  const confidence =
    primaryEv?.confidence || 0

  const timeDelta =
    primaryEv?.time_delta_seconds ?? null

  const totalRelated =
    leadDetail.related_txids?.length ||
    relatedTransactions.length ||
    0

  const correlatedIps = new Set(
    evidence
      .map(({ ev }) => ev.ip)
      .filter(Boolean)
  )

  const country =
    geo?.country ||
    geo?.country_name ||
    'Unavailable'

  const location =
    geo?.city && geo?.country
      ? `${geo.city}, ${geo.country}`
      : geo?.city ||
        geo?.country ||
        'Location unavailable'

  const asn =
    geo?.asn ||
    geo?.asn_number ||
    'Unavailable'

  const organization =
    geo?.asn_org ||
    geo?.organization ||
    'Network operator unavailable'

  const port =
    primaryEv?.port || null

  const insightList = []

  if (confidence >= 0.85) {
    insightList.push({
      icon: Link2,
      title: `${formatPercent(confidence)} Correlation`,
      detail: 'Strong network-blockchain link',
      tone: 'correlation',
    })
  }

  if (country !== 'Unavailable') {
    insightList.push({
      icon: MapPin,
      title: `${country}-based IP`,
      detail: location,
      tone: 'location',
    })
  }

  if (port) {
    insightList.push({
      icon: Radio,
      title: 'Bitcoin P2P',
      detail: `Observed on port ${port}`,
      tone: 'network',
    })
  }

  if (insightList.length === 0) {
    insightList.push({
      icon: AlertCircle,
      title: `${severity} Priority`,
      detail: 'Review available evidence',
      tone: 'risk',
    })
  }

  return (
    <div className="evidence-chain-workspace">

      <div className="evidence-chain-main-column">

        <div className="evidence-chain-section-heading">

          <div>
            <div className="eyebrow">
              INVESTIGATIVE EVIDENCE CHAIN
            </div>

            <h3>{wallet}</h3>
          </div>

          <div
            className={`evidence-chain-priority ${severity.toLowerCase()}`}
          >
            <Shield size={13} />
            {severity} PRIORITY
          </div>

        </div>

        <div className="evidence-chain-flow">

          <EvidenceStep
            number={1}
            icon={WalletCards}
            eyebrow="SUSPICIOUS ENTITY (WALLET)"
            title={wallet}
            detail={`${totalRelated} related transactions · ${correlatedIps.size} correlated IP${correlatedIps.size === 1 ? '' : 's'}`}
            badges={[
              `${severity} PRIORITY`,
              riskScore !== null
                ? `RISK ${Math.round(riskScore)}`
                : 'INVESTIGATION LEAD',
            ]}
            description="This wallet was flagged as suspicious based on blockchain behavior and network correlation analysis."
            tone="wallet"
          />

          <EvidenceStep
            number={2}
            icon={Database}
            eyebrow="BLOCKCHAIN TRANSACTION"
            title={
              primaryTx?.txid ||
              'No transaction available'
            }
            detail={
              primaryTx
                ? formatTime(primaryTx.timestamp)
                : 'Transaction details unavailable'
            }
            badges={
              primaryTx
                ? [
                    `${Number(
                      primaryTx.total_output ||
                      primaryTx.amount ||
                      0
                    ).toFixed(2)} BTC`,
                    `${primaryTx.input_addresses?.length || 0} inputs → ${primaryTx.output_addresses?.length || 0} outputs`,
                  ]
                : []
            }
            description="This transaction is linked to the suspicious wallet and provides the blockchain-side anchor for the investigation."
            tone="transaction"
          />

          <EvidenceStep
            number={3}
            icon={Radio}
            eyebrow="NETWORK OBSERVATION"
            title={
              ip ||
              'No correlated IP'
            }
            detail={
              timeDelta !== null
                ? `Δt ${timeDelta}s`
                : 'Timing correlation unavailable'
            }
            badges={[
              port
                ? `PORT ${port}`
                : 'PORT UNKNOWN',
              `${formatPercent(confidence)} CONFIDENCE`,
            ]}
            description={
              ip
                ? `Network telemetry from this IP was correlated with the transaction${timeDelta === 0 ? ' at the same time' : ''}, strengthening the cross-layer link.`
                : 'No network observation is available for the selected evidence.'
            }
            tone="network"
          />

          <EvidenceStep
            number={4}
            icon={Globe}
            eyebrow="GEOIP / ASN ENRICHMENT"
            title={location}
            detail={
              geo?.classification === 'documentation'
                ? 'Documentation / Reserved Address'
                : country !== 'Unavailable'
                  ? country
                  : 'Location unavailable'
            }
            badges={[
              asn !== 'Unavailable'
                ? `AS${String(asn).replace(/^AS/i, '')}`
                : 'ASN UNAVAILABLE',

              organization,

              geo?.source
                ? String(geo.source)
                : 'OFFLINE GEOIP',
            ]}
            description={
              geo?.classification === 'documentation'
                ? 'This address is reserved for documentation and should not be interpreted as a real-world location.'
                : geo
                  ? 'Offline GeoIP/ASN enrichment provides additional network context for the observed IP.'
                  : 'No GeoIP enrichment is currently available for this observation.'
            }
            tone="geo"
          />

        </div>

        <div className="evidence-chain-why">

          <div className="evidence-chain-why-icon">
            <AlertCircle size={22} />
          </div>

          <div>
            <div className="evidence-chain-why-title">
              WHY THIS MATTERS
            </div>

            <p>
              {ip && primaryTx
                ? `Network telemetry from ${ip} was observed ${
                    timeDelta === 0
                      ? 'at the same time'
                      : `within ${timeDelta}s of`
                  } transaction ${primaryTx.txid}. ${
                    port
                      ? `The observation used port ${port}, providing an additional network-layer signal. `
                      : ''
                  }This cross-layer correlation connects blockchain activity with network evidence and gives investigators a concrete lead to review.`
                : 'The evidence chain connects the available wallet, blockchain, network, and enrichment evidence into a single investigative lead.'}
            </p>
          </div>

        </div>

      </div>

      <aside className="evidence-chain-sidebar">

        <SideCard
          icon={Shield}
          title="CASE CONTEXT"
          tone="case"
        >
          <SideRow
            label="Wallet"
            value={wallet}
            emphasis
          />

          <SideRow
            label="Risk Level"
            value={severity}
            emphasis
          />

          <SideRow
            label="Related Transactions"
            value={totalRelated}
          />

          <SideRow
            label="Correlated IPs"
            value={correlatedIps.size}
          />

          {primaryTx?.txid && (
            <SideRow
              label="Primary TX"
              value={primaryTx.txid}
            />
          )}
        </SideCard>

        <SideCard
          icon={Network}
          title="KEY INSIGHTS"
          tone="insights"
        >
          {insightList.map(
            (insight, index) => {
              const InsightIcon =
                insight.icon

              return (
                <div
                  className={`evidence-chain-insight ${insight.tone}`}
                  key={`${insight.title}-${index}`}
                >
                  <div className="evidence-chain-insight-icon">
                    <InsightIcon size={16} />
                  </div>

                  <div>
                    <strong>
                      {insight.title}
                    </strong>

                    <span>
                      {insight.detail}
                    </span>
                  </div>
                </div>
              )
            }
          )}
        </SideCard>

        <SideCard
          icon={Link2}
          title="CORRELATION SIGNALS"
          tone="signals"
        >
          <SideRow
            label="Confidence"
            value={formatPercent(confidence)}
            emphasis
          />

          <SideRow
            label="Time Delta"
            value={
              timeDelta !== null
                ? `${timeDelta}s`
                : 'Unavailable'
            }
          />

          <SideRow
            label="Observed Port"
            value={
              port || 'Unavailable'
            }
          />

          <SideRow
            label="GeoIP Source"
            value={
              geo?.source ||
              'Unavailable'
            }
          />
        </SideCard>

        <SideCard
          icon={MapPin}
          title="NEXT STEPS"
          tone="next"
        >
          <div className="evidence-chain-next-step">
            <span>1</span>

            <p>
              Review all {totalRelated} related
              transaction
              {totalRelated === 1
                ? ''
                : 's'}.
            </p>
          </div>

          {ip && (
            <div className="evidence-chain-next-step">
              <span>2</span>

              <p>
                Investigate other activity
                from {ip}.
              </p>
            </div>
          )}

          <div className="evidence-chain-next-step">
            <span>3</span>

            <p>
              Check for additional
              connected wallets.
            </p>
          </div>
        </SideCard>

      </aside>

    </div>
  )
}