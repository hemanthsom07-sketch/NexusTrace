// Real, deterministic explainability computed entirely from data the
// backend already returns (every lead's feature_snapshot). This is NOT a
// substitute for a true SHAP/feature-contribution value from the Isolation
// Forest model -- it's an evidence-based percentile-deviation ranking,
// and is always labeled as such in the UI. Nothing here is invented: every
// number is derived from the actual analyzed dataset's own distribution.

export const FEATURE_META = {
  transaction_velocity: {
    label: 'Transaction Velocity',
    unit: '',
    meaning: "The wallet's transaction frequency during the observed period.",
  },
  fan_out_count: {
    label: 'Fan-out',
    unit: '',
    meaning: 'Number of distinct outputs associated with funds sent by this wallet.',
  },
  fan_in_count: {
    label: 'Fan-in',
    unit: '',
    meaning: 'Number of distinct inputs associated with funds received by this wallet.',
  },
  distinct_ip_count: {
    label: 'Network Association',
    unit: ' IP',
    meaning: 'How many distinct network endpoints telemetry associated with this wallet.',
  },
  total_out_amount: {
    label: 'Outgoing Amount',
    unit: ' BTC',
    meaning: 'Total BTC sent by this wallet in the analyzed period.',
  },
  total_in_amount: {
    label: 'Incoming Amount',
    unit: ' BTC',
    meaning: 'Total BTC received by this wallet in the analyzed period.',
  },
}

const FEATURE_ORDER = Object.keys(FEATURE_META)

function percentileRank(values, target) {
  if (!values.length) return 50
  const below = values.filter((v) => v < target).length
  const equal = values.filter((v) => v === target).length
  // Midpoint rank -- standard percentile-of-value definition.
  return Math.round(((below + 0.5 * equal) / values.length) * 100)
}

/**
 * Builds a structured, per-feature explanation for one wallet relative to
 * every other wallet in the current analysis (the same population the
 * Isolation Forest itself was fit on).
 */
export function explainWallet(leads, wallet) {
  const lead = leads.find((l) => l.wallet === wallet)
  if (!lead || !lead.feature_snapshot) return null

  const columns = {}
  FEATURE_ORDER.forEach((key) => {
    columns[key] = leads
      .map((l) => l.feature_snapshot?.[key])
      .filter((v) => typeof v === 'number')
  })

  const signals = FEATURE_ORDER
    .filter((key) => typeof lead.feature_snapshot[key] === 'number')
    .map((key) => {
      const value = lead.feature_snapshot[key]
      const values = columns[key]
      const percentile = percentileRank(values, value)
      const direction = percentile >= 60 ? 'high' : percentile <= 40 ? 'low' : 'typical'
      // Evidence-based contribution weight -- distance of this wallet's
      // percentile from the dataset median, normalized to 0-1. This is an
      // explanatory signal, not a model-derived feature-importance value.
      const importance = Math.round((Math.abs(percentile - 50) / 50) * 100) / 100
      return {
        feature: key,
        label: FEATURE_META[key].label,
        meaning: FEATURE_META[key].meaning,
        value: Math.round(value * 10000) / 10000,
        unit: FEATURE_META[key].unit,
        percentile,
        direction,
        importance,
      }
    })
    .sort((a, b) => b.importance - a.importance)

  const top = signals.slice(0, 2).filter((s) => s.direction !== 'typical')

  let summary
  const severityLabel = (lead.severity || 'LOW')
  if (top.length === 0) {
    summary = `${wallet} is ranked ${severityLabel} based on its overall multi-feature anomaly profile rather than any single dominant signal -- no individual feature stands out sharply from the rest of this dataset, but the combination across all features is unusual. This makes it a high-priority investigation lead, not a confirmed determination of wrongdoing.`
  } else {
    const parts = top.map((s) => {
      const qualifier = s.direction === 'high' ? 'above' : 'below'
      return `its ${s.label.toLowerCase()} (${s.value}${s.unit}), which sits ${qualifier} the ${s.percentile}th percentile for this dataset`
    })
    summary = `${wallet} is ranked ${severityLabel} because its observed behavior is unusually anomalous compared with the rest of the analyzed dataset -- primarily ${parts.join(' and ')}. This combination of signals makes it a high-priority investigation lead with correlated evidence worth reviewing, but the anomaly score alone does not establish malicious activity.`
  }

  return { wallet, signals, summary, severity: lead.severity, score: lead.anomaly_score }
}

/**
 * Dataset-level narrative for the Overview page's "Investigation Summary" --
 * built the same way, purely from the leads array already returned by the
 * backend for the current analysis session.
 */
export function summarizeAnalysis(leads) {
  if (!leads || leads.length === 0) return null

  const high = leads.filter((l) => l.severity === 'HIGH').length
  const medium = leads.filter((l) => l.severity === 'MEDIUM').length
  const top = leads.slice().sort((a, b) => (b.anomaly_score || 0) - (a.anomaly_score || 0))[0]
  const topExplanation = top ? explainWallet(leads, top.wallet) : null

  const sentences = []
  sentences.push(
    high > 0
      ? `Analysis identified ${high} wallet${high === 1 ? '' : 's'} whose behavioral profile differs significantly from the normal activity observed in this dataset${medium ? `, along with ${medium} medium-severity wallet${medium === 1 ? '' : 's'} worth reviewing` : ''}.`
      : medium > 0
        ? `Analysis flagged ${medium} wallet${medium === 1 ? '' : 's'} at medium severity -- no wallet crossed the high-severity threshold in this dataset.`
        : `Analysis completed across ${leads.length} wallet${leads.length === 1 ? '' : 's'} with no wallets crossing the anomaly thresholds for this dataset.`
  )

  if (top && topExplanation) {
    const dominant = topExplanation.signals.filter((s) => s.direction !== 'typical').slice(0, 2)
    if (dominant.length) {
      sentences.push(
        `The highest-risk entity, ${top.wallet}, shows ${dominant.map((s) => s.label.toLowerCase()).join(' and ')} well outside the typical range for this dataset${top.related_ips?.length ? `, with activity associated with ${top.related_ips.length} network endpoint${top.related_ips.length === 1 ? '' : 's'}` : ''}.`
      )
    }
    sentences.push('These signals warrant further investigation, but the anomaly score alone does not establish malicious activity.')
  }

  return sentences.join(' ')
}
