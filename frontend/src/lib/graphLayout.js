// Deterministic left-to-right investigation map.
// The selected wallet is the case anchor; transactions form the middle lane;
// output wallets and network evidence sit on the right. This is deliberately
// a case-flow diagram, not a generic force-directed network.

const X = { root: 0, transaction: 330, output: 700, ip: 700 }
const TX_GAP = 66
const OUTPUT_GAP = 72
const IP_GAP = 70

function idOf(value) {
  return typeof value === 'object' ? value?.id : value
}

export function layoutNetwork(nodes, links) {
  if (!nodes?.length) return { nodes: [], links: [], bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } }

  const root = nodes.find((n) => n.hop === 0) || nodes.find((n) => n.node_type === 'wallet') || nodes[0]
  const txs = nodes.filter((n) => n.node_type === 'transaction').slice(0, 8)
  const outputs = nodes.filter((n) => n.node_type === 'wallet' && n.id !== root.id).slice(0, 10)
  const ips = nodes.filter((n) => n.node_type === 'ip').slice(0, 6)

  const positioned = []
  const txStart = -((txs.length - 1) * TX_GAP) / 2
  positioned.push({ ...root, x: X.root, y: 0 })
  txs.forEach((node, i) => positioned.push({ ...node, x: X.transaction, y: txStart + i * TX_GAP }))

  // Put output wallets in the upper/right fund-flow lane.
  const outputStart = -((outputs.length - 1) * OUTPUT_GAP) / 2 - 15
  outputs.forEach((node, i) => positioned.push({ ...node, x: X.output, y: outputStart + i * OUTPUT_GAP }))

  // Keep network evidence in a clearly separated lower lane.
  const ipStart = Math.max(170, -((ips.length - 1) * IP_GAP) / 2 + 250)
  ips.forEach((node, i) => positioned.push({ ...node, x: X.ip, y: ipStart + i * IP_GAP }))

  const byId = new Map(positioned.map((n) => [n.id, n]))
  const resolvedLinks = links
    .map((link) => ({ ...link, source: byId.get(idOf(link.source)), target: byId.get(idOf(link.target)) }))
    .filter((link) => link.source && link.target)

  const xs = positioned.map((n) => n.x)
  const ys = positioned.map((n) => n.y)
  return {
    nodes: positioned,
    links: resolvedLinks,
    bounds: {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    },
  }
}
