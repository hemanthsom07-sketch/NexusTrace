// Build a small, readable investigation network around the selected entity.
// The graph is a visual explanation, not a dump of the entire dataset.
// All underlying transactions remain available in the investigation tabs.

const MAX_TRANSACTIONS = 7
const MAX_OUTPUT_WALLETS = 8
const MAX_IPS = 5

function idOf(value) {
  return typeof value === 'object' ? value?.id : value
}

export function connectedNetwork(nodes, links, selectedId) {
  if (!selectedId || !nodes?.length) return { nodes: [], links: [] }

  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const selected = nodeById.get(selectedId)
  if (!selected) return { nodes: [], links: [] }

  const incident = links.filter((link) => {
    const source = idOf(link.source)
    const target = idOf(link.target)
    return source === selectedId || target === selectedId
  })

  let transactionIds = []

  if (selected.node_type === 'wallet') {
    transactionIds = incident
      .map((link) => {
        const source = idOf(link.source)
        const target = idOf(link.target)
        return source === selectedId ? target : source
      })
      .filter((id) => nodeById.get(id)?.node_type === 'transaction')
  } else if (selected.node_type === 'transaction') {
    transactionIds = [selectedId]
  } else if (selected.node_type === 'ip') {
    transactionIds = incident
      .map((link) => {
        const source = idOf(link.source)
        const target = idOf(link.target)
        return source === selectedId ? target : source
      })
      .filter((id) => nodeById.get(id)?.node_type === 'transaction')
  }

  transactionIds = [...new Set(transactionIds)].slice(0, MAX_TRANSACTIONS)
  const keep = new Set([selectedId, ...transactionIds])

  // Keep the output side deliberately bounded. This prevents one high-degree
  // transaction from turning the investigation view into an unreadable hairball.
  const outputWallets = []
  const ips = []

  for (const txId of transactionIds) {
    const txLinks = links.filter((link) => idOf(link.source) === txId || idOf(link.target) === txId)
    for (const link of txLinks) {
      const sourceId = idOf(link.source)
      const targetId = idOf(link.target)
      const otherId = sourceId === txId ? targetId : sourceId
      const other = nodeById.get(otherId)
      if (!other) continue

      if (other.node_type === 'wallet' && otherId !== selectedId && link.edge_type === 'output') {
        if (!outputWallets.includes(otherId)) outputWallets.push(otherId)
      }
      if (other.node_type === 'ip' && link.edge_type === 'broadcast') {
        if (!ips.includes(otherId)) ips.push(otherId)
      }
    }
  }

  outputWallets.slice(0, MAX_OUTPUT_WALLETS).forEach((id) => keep.add(id))
  ips.slice(0, MAX_IPS).forEach((id) => keep.add(id))

  const keptLinks = links.filter((link) => {
    const source = idOf(link.source)
    const target = idOf(link.target)
    return keep.has(source) && keep.has(target)
  })

  return {
    nodes: nodes
      .filter((node) => keep.has(node.id))
      .map((node) => ({
        ...node,
        hop: node.id === selectedId ? 0 : node.node_type === 'transaction' ? 1 : 2,
      })),
    links: keptLinks,
  }
}
