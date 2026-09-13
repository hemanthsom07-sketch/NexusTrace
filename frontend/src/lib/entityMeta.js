// Shared visual + semantic mapping for graph node/edge types.
// Centralised so the graph, legend, investigation queue and risk inspector
// all agree on the same colors and relationship names.

export const SEVERITY_COLOR = {
  HIGH: '#f2495c',
  MEDIUM: '#f5a524',
  LOW: '#38bdf8',
}

export const NODE_TYPE_META = {
  wallet: { label: 'Wallet', glyph: 'W', color: '#38bdf8' },
  transaction: { label: 'Transaction', glyph: 'TX', color: '#22d3ee' },
  ip: { label: 'IP', glyph: 'IP', color: '#a78bfa' },
}

// Edge_type values are exactly what the backend graph builder emits
// (input / output / broadcast) -- these are display labels only, not
// invented relationships.
//   wallet --input--> tx     =>  wallet SENT_TO the transaction (it's an input)
//   tx --output--> wallet    =>  transaction sent an OUTPUT_TO the wallet
//   ip --broadcast--> tx     =>  ip CORRELATED_WITH the transaction (network evidence)
// input/output are kept distinct (rather than both "SENT_TO") so the
// direction of fund flow through a transaction is unambiguous in the UI.
export const EDGE_TYPE_META = {
  input: { label: 'SENT_TO', color: '#38bdf8' },
  output: { label: 'OUTPUT_TO', color: '#f5a524' },
  broadcast: { label: 'CORRELATED_WITH', color: '#e8542c' },
}

export function nodeColorFor(node) {
  if (node.node_type === 'wallet') {
    return SEVERITY_COLOR[node.severity] || NODE_TYPE_META.wallet.color
  }
  return (NODE_TYPE_META[node.node_type] || {}).color || '#94a3b8'
}

export function edgeLabelFor(edgeType) {
  return (EDGE_TYPE_META[edgeType] || {}).label || edgeType || 'RELATED_TO'
}

export function edgeColorFor(edgeType) {
  return (EDGE_TYPE_META[edgeType] || {}).color || '#475569'
}

export function stripPrefix(fullId, type) {
  if (!fullId) return fullId
  const prefix = type === 'transaction' ? 'tx:' : `${type}:`
  return fullId.startsWith(prefix) ? fullId.slice(prefix.length) : fullId
}

export function fullIdFor(type, id) {
  return `${type === 'transaction' ? 'tx' : type}:${id}`
}

// Builds the small contextual explanation shown when an investigator
// clicks a relationship/edge in the graph (spec: "clicking an edge/
// relationship should show a small contextual explanation"). Only fields
// that actually exist on the edge/backend data are included -- confidence
// and correlation timing live only on broadcast (IP-correlation) edges,
// never fabricated for input/output edges.
export function edgeExplanation(link) {
  const sourceLabel = link.source?.label || link.source?.id || 'entity'
  const targetLabel = link.target?.label || link.target?.id || 'entity'
  const relationship = edgeLabelFor(link.edge_type)

  if (link.edge_type === 'input') {
    return {
      relationship,
      text: `Wallet ${sourceLabel} is an input to transaction ${targetLabel}.`,
    }
  }
  if (link.edge_type === 'output') {
    return {
      relationship,
      text: `Transaction ${sourceLabel} sends an output to wallet ${targetLabel}.`,
    }
  }
  if (link.edge_type === 'broadcast') {
    return {
      relationship,
      text: `Network telemetry for ${sourceLabel} was correlated with blockchain transaction ${targetLabel}.`,
      confidence: typeof link.confidence === 'number' ? link.confidence : null,
    }
  }
  return { relationship, text: `${sourceLabel} is related to ${targetLabel}.` }
}
