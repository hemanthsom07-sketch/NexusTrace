import { formatPercent, formatTime } from './format'
import { explainWallet } from './explainability'

// Builds the "GENERATE FINAL REPORT" document (spec section 26). Every
// value placed in the report is read from data the app already fetched
// from the real backend for the current analysis session (leads,
// lead-detail, transaction-detail, ip-detail) -- nothing here is invented,
// no percentage or confidence value is fabricated, and fields the backend
// did not return are shown as "Unavailable" rather than a made-up number.

function escapeHtml(value) {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function section(title, bodyHtml) {
  return `
    <section class="rpt-section">
      <h2>${escapeHtml(title)}</h2>
      ${bodyHtml}
    </section>`
}

function kv(label, value) {
  return `<div class="rpt-kv"><span>${escapeHtml(label)}</span><b>${escapeHtml(value ?? 'Unavailable')}</b></div>`
}

/**
 * @param {object} params
 * @param {object} params.analysisSource - { type: 'uploaded'|'sample', validation }
 * @param {object} params.runStats - raw pipeline response (events_ingested, transactions_ingested, leads_generated, ...)
 * @param {array}  params.leads - current leads array (already backend-scored)
 * @param {object} params.primaryLeadDetail - result of GET /api/leads/{wallet} for the top lead
 * @param {array}  params.transactionDetails - array of GET /api/transactions/{txid} results for the primary lead's related txids
 * @param {array}  params.ipDetails - array of GET /api/ip/{ip} results for the primary lead's related ips
 * @param {number} params.analyzedAt - unix seconds
 */
export function buildReportHtml({
  analysisSource,
  runStats,
  leads = [],
  primaryLeadDetail,
  transactionDetails = [],
  ipDetails = [],
  clusters = [],
  analyzedAt,
}) {
  const isSample = analysisSource?.type === 'sample'
  const validation = analysisSource?.validation
  const networkCount = validation?.network_records ?? runStats?.events_ingested ?? null
  const blockchainCount = validation?.blockchain_records ?? runStats?.transactions_ingested ?? null
  const matchingTxids = validation?.matching_txids ?? null
  const highRiskCount = leads.filter((l) => l.severity === 'HIGH').length

  const primary = primaryLeadDetail
  const explanation = primary ? explainWallet(leads, primary.wallet) : null

  // Chronological timeline built only from real timestamps already present
  // on the fetched transaction records and their correlation evidence.
  const timelineEvents = []
  transactionDetails.forEach((tx) => {
    if (!tx) return
    if (tx.timestamp) {
      timelineEvents.push({ ts: tx.timestamp, text: `Blockchain transaction recorded &mdash; ${escapeHtml(tx.txid)}` })
    }
    ;(tx.correlation_evidence || []).forEach((ev) => {
      if (tx.timestamp) {
        timelineEvents.push({
          ts: ev.network_timestamp ?? null,
          text: `Network observation ${escapeHtml(ev.ip)} correlated with ${escapeHtml(tx.txid)} (confidence ${formatPercent(ev.confidence)}, Δt ${escapeHtml(ev.time_delta_seconds)}s)`,
        })
      }
    })
  })
  timelineEvents.sort((a, b) => {
    const ta = typeof a.ts === 'number' ? a.ts : Date.parse(a.ts) || 0
    const tb = typeof b.ts === 'number' ? b.ts : Date.parse(b.ts) || 0
    return ta - tb
  })

  const behavioralRows = (explanation?.signals || [])
    .map((s) => `<tr><td>${escapeHtml(s.label)}</td><td class="rpt-mono">${escapeHtml(s.value)}${escapeHtml(s.unit)}</td><td>${s.percentile}th percentile</td></tr>`)
    .join('')

  const txRows = transactionDetails
    .filter(Boolean)
    .map((tx) => `<tr><td class="rpt-mono">${escapeHtml(tx.txid)}</td><td>${escapeHtml(formatTime(tx.timestamp))}</td><td class="rpt-mono">${escapeHtml(tx.btc_amount)} BTC</td><td class="rpt-mono">${escapeHtml(tx.correlated_ip) || 'Unavailable'}</td><td>${tx.confidence != null ? formatPercent(tx.confidence) : 'Unavailable'}</td></tr>`)
    .join('')

  const correlationRows = transactionDetails
    .filter((tx) => tx && (tx.correlation_evidence || []).length > 0)
    .flatMap((tx) => (tx.correlation_evidence || []).map((ev) => `
      <tr>
        <td class="rpt-mono">${escapeHtml(ev.ip)}</td>
        <td class="rpt-mono">${escapeHtml(tx.txid)}</td>
        <td>${formatPercent(ev.confidence)}</td>
        <td>${ev.time_delta_seconds != null ? `${escapeHtml(ev.time_delta_seconds)}s` : 'Unavailable'}</td>
        <td>${ev.port != null ? escapeHtml(ev.port) : 'Unavailable'}</td>
      </tr>`))
    .join('')

  const geoRows = ipDetails
    .filter(Boolean)
    .map((geo) => {
      const networkType = String(geo.network_type || geo.classification || '').toLowerCase()
      const isPrivate = geo.is_private || networkType.includes('private') || networkType.includes('internal')
      const isDocumentation = networkType.includes('documentation') || networkType.includes('reserved')
      const classification = isPrivate ? 'PRIVATE / INTERNAL' : isDocumentation ? 'DOCUMENTATION / RESERVED' : 'PUBLIC ROUTABLE'
      const location = isPrivate || isDocumentation
        ? 'No public geolocation'
        : (geo.geoip_available ? [geo.city, geo.region, geo.country].filter(Boolean).join(', ') || 'Unavailable' : 'Unavailable')
      const source = geo.geoip_source || geo.source || 'Unavailable'
      return `<tr><td class="rpt-mono">${escapeHtml(geo.ip)}</td><td>${classification}</td><td>${escapeHtml(location)}</td><td class="rpt-mono">${escapeHtml(geo.asn) || 'Unavailable'}</td><td>${escapeHtml(geo.org) || 'Unavailable'}<br/><span style="font-size:9px;color:#64748b">${escapeHtml(source)}</span></td></tr>`
    })
    .join('')

  const generatedAt = new Date().toLocaleString()

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>NexusTrace Final Investigation Report</title>
<style>
  @page { margin: 24mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px 40px; background: #fff; }
  .rpt-header { border-bottom: 3px solid #4338ca; padding-bottom: 14px; margin-bottom: 20px; }
  .rpt-brand { font-size: 22px; font-weight: 800; color: #312e81; letter-spacing: 0.02em; }
  .rpt-brand span { color: #0891b2; }
  .rpt-sub { font-size: 12px; color: #475569; margin-top: 2px; }
  .rpt-title { font-size: 16px; font-weight: 700; margin-top: 14px; letter-spacing: 0.06em; text-transform: uppercase; }
  .rpt-meta { font-size: 11px; color: #64748b; margin-top: 4px; }
  .rpt-section { margin: 20px 0; page-break-inside: avoid; }
  .rpt-section h2 { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #4338ca; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; }
  .rpt-kv-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 24px; }
  .rpt-kv { display: flex; justify-content: space-between; font-size: 12.5px; border-bottom: 1px dotted #e2e8f0; padding: 3px 0; }
  .rpt-kv span { color: #64748b; }
  .rpt-kv b { color: #0f172a; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  th { text-align: left; background: #f1f5f9; padding: 6px 8px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.03em; color: #475569; }
  td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
  .rpt-mono { font-family: 'Consolas', 'Courier New', monospace; }
  .rpt-badge { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; }
  .rpt-badge-high { background: #fee2e2; color: #b91c1c; }
  .rpt-badge-medium { background: #fef3c7; color: #b45309; }
  .rpt-badge-low { background: #dbeafe; color: #1d4ed8; }
  .rpt-text { font-size: 12.5px; line-height: 1.6; color: #1e293b; }
  .rpt-disclaimer { margin-top: 28px; padding: 12px 14px; background: #f8fafc; border-left: 3px solid #4338ca; font-size: 11px; color: #475569; }
  .rpt-footer { margin-top: 24px; font-size: 10px; color: #94a3b8; text-align: center; }
  .rpt-print-bar { position: sticky; top: 0; background: #0f172a; color: #fff; padding: 10px 16px; display: flex; justify-content: flex-end; gap: 10px; }
  .rpt-print-bar button { background: #4338ca; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 12.5px; cursor: pointer; }
  @media print { .rpt-print-bar { display: none; } }
</style>
</head>
<body>
  <div class="rpt-print-bar"><button onclick="window.print()">Print / Save as PDF</button></div>

  <div class="rpt-header">
    <div class="rpt-brand">Nexus<span>Trace</span></div>
    <div class="rpt-sub">Bitcoin Transaction Intelligence</div>
    <div class="rpt-title">Final Investigation Report</div>
    <div class="rpt-meta">Generated ${escapeHtml(generatedAt)}</div>
  </div>

  ${section('Case Summary', `
    <div class="rpt-kv-grid">
      ${kv('Analysis Source', isSample ? 'Built-in Sample Dataset' : 'Uploaded Dataset')}
      ${kv('Network Events', networkCount)}
      ${kv('Blockchain Transactions', blockchainCount)}
      ${kv('Matching TXIDs', matchingTxids)}
      ${kv('Investigation Leads', leads.length)}
      ${kv('High Risk Leads', highRiskCount)}
    </div>
  `)}

  ${primary ? section('Primary Investigation Lead', `
    <div class="rpt-kv-grid">
      ${kv('Entity', primary.wallet)}
      ${kv('Type', 'Wallet')}
      <div class="rpt-kv"><span>Risk</span><b><span class="rpt-badge rpt-badge-${(primary.severity || 'low').toLowerCase()}">${escapeHtml(primary.severity)}</span></b></div>
      ${kv('Risk Score', formatPercent(primary.anomaly_score))}
      <p class="rpt-text">Risk score is a dataset-relative anomaly ranking, not a probability of illicit activity.</p>
    </div>
  `) : ''}

  ${primary && clusters.find((cluster) => cluster.wallets?.includes(primary.wallet)) ? (() => {
    const cluster = clusters.find((item) => item.wallets?.includes(primary.wallet))
    return section('Entity Cluster', `
      <p class="rpt-text"><b>${escapeHtml(cluster.cluster_id)}</b> — Common Input Ownership heuristic grouped ${cluster.wallets.length} wallets as a candidate entity.</p>
      <p class="rpt-text">Members: ${cluster.wallets.map(escapeHtml).join(', ')}</p>
      <p class="rpt-text">This is an investigative heuristic, not proof of common control.</p>
    `)
  })() : ''}

  ${primary ? section('Why This Entity Was Flagged', `
    <p class="rpt-text">${escapeHtml(explanation?.summary || 'No deterministic explanation available for this entity.')}</p>
  `) : ''}

  ${behavioralRows ? section('Key Behavioral Signals', `
    <table><thead><tr><th>Signal</th><th>Observed</th><th>Dataset Context</th></tr></thead>
    <tbody>${behavioralRows}</tbody></table>
  `) : ''}

  ${txRows ? section('Related Transactions', `
    <table><thead><tr><th>TXID</th><th>Time</th><th>BTC</th><th>Correlated IP</th><th>Correlation Confidence</th></tr></thead>
    <tbody>${txRows}</tbody></table>
  `) : ''}

  ${correlationRows ? section('Network Correlation', `
    <table><thead><tr><th>IP</th><th>Transaction</th><th>Correlation Confidence</th><th>Time Difference</th><th>Port</th></tr></thead>
    <tbody>${correlationRows}</tbody></table>
  `) : ''}

  ${timelineEvents.length ? section('Investigation Timeline', `
    <table><thead><tr><th>Time</th><th>Event</th></tr></thead>
    <tbody>${timelineEvents.map((e) => `<tr><td class="rpt-mono">${escapeHtml(formatTime(e.ts))}</td><td>${e.text}</td></tr>`).join('')}</tbody></table>
  `) : section('Investigation Timeline', '<p class="rpt-text">No chronological evidence available for this entity.</p>')}

  ${geoRows ? section('Network / GeoIP Information', `
    <table><thead><tr><th>IP</th><th>Classification</th><th>Location</th><th>ASN</th><th>Organization</th></tr></thead>
    <tbody>${geoRows}</tbody></table>
  `) : section('Network / GeoIP Information', '<p class="rpt-text">No GeoIP-eligible public IP addresses were associated with this entity.</p>')}

  ${primary ? section('Investigator Assessment', `
    <p class="rpt-text">${escapeHtml(explanation?.summary || '')}</p>
  `) : ''}

  <div class="rpt-disclaimer">
    Anomaly scores, behavioral signals and cross-dataset correlations indicate investigation priorities.
    They do not independently establish malicious activity.
  </div>

  <div class="rpt-footer">NexusTrace &middot; Offline Bitcoin Transaction Intelligence &middot; SIH26146</div>
</body>
</html>`
}
