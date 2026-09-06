import React, { useRef, useEffect, useMemo } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

const COLOR_MAP = {
  HIGH: '#EF4444',
  MEDIUM: '#F59E0B',
  LOW: '#64748B',
  tx: '#06B6D4',
  ip: '#10B981',
}

export default function GraphView2D({
  graphData,
  selectedEntityId,
  onSelectEntity,
  width,
  height,
  fgRef,
}) {
  // Compute neighbors and links connected to selectedEntityId
  const { neighborNodes, neighborLinks } = useMemo(() => {
    const nodes = new Set()
    const links = new Set()
    if (!selectedEntityId || !graphData?.links) {
      return { neighborNodes: nodes, neighborLinks: links }
    }

    nodes.add(selectedEntityId)

    graphData.links.forEach((link) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source
      const targetId = typeof link.target === 'object' ? link.target.id : link.target

      if (sourceId === selectedEntityId || targetId === selectedEntityId) {
        nodes.add(sourceId)
        nodes.add(targetId)
        links.add(link)
      }
    })

    return { neighborNodes: nodes, neighborLinks: links }
  }, [graphData, selectedEntityId])

  // Center camera on selected node when selection changes
  useEffect(() => {
    if (!selectedEntityId || !fgRef?.current || !graphData?.nodes) return
    const targetNode = graphData.nodes.find((n) => n.id === selectedEntityId)
    if (targetNode && targetNode.x !== undefined && targetNode.y !== undefined) {
      fgRef.current.centerAt(targetNode.x, targetNode.y, 600)
      fgRef.current.zoom(2.2, 600)
    }
  }, [selectedEntityId, graphData, fgRef])

  const handleNodeClick = (node) => {
    if (!node) return
    let rawId = node.id
    if (node.node_type === 'wallet') rawId = rawId.replace(/^wallet:/, '')
    if (node.node_type === 'transaction') rawId = rawId.replace(/^tx:/, '')
    if (node.node_type === 'ip') rawId = rawId.replace(/^ip:/, '')

    onSelectEntity({
      type: node.node_type,
      id: rawId,
      fullId: node.id,
      node,
    })
  }

  const paintNode = (node, ctx, globalScale) => {
    const isSelected = node.id === selectedEntityId
    const isNeighbor = neighborNodes.has(node.id)
    const isDimmed = selectedEntityId && !isSelected && !isNeighbor

    ctx.save()
    ctx.globalAlpha = isDimmed ? 0.2 : 1.0

    let baseColor = COLOR_MAP.LOW
    let radius = 5

    if (node.node_type === 'wallet') {
      baseColor = COLOR_MAP[node.severity] || (node.anomaly_score >= 0.7 ? '#EF4444' : '#64748B')
      radius = isSelected ? 8 : 6.5
    } else if (node.node_type === 'transaction') {
      baseColor = COLOR_MAP.tx
      radius = isSelected ? 6.5 : 5
    } else if (node.node_type === 'ip') {
      baseColor = COLOR_MAP.ip
      radius = isSelected ? 7 : 5.5
    }

    // Glowing halo for selected node
    if (isSelected) {
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius + 5, 0, 2 * Math.PI, false)
      ctx.fillStyle = node.node_type === 'wallet' && node.severity === 'HIGH' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(14, 165, 233, 0.35)'
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = '#38BDF8'
      ctx.stroke()
    } else if (isNeighbor) {
      ctx.beginPath()
      ctx.arc(node.x, node.y, radius + 2.5, 0, 2 * Math.PI, false)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Node Body
    ctx.beginPath()
    if (node.node_type === 'transaction') {
      // Diamond for transactions
      ctx.moveTo(node.x, node.y - radius)
      ctx.lineTo(node.x + radius, node.y)
      ctx.lineTo(node.x, node.y + radius)
      ctx.lineTo(node.x - radius, node.y)
      ctx.closePath()
    } else {
      // Circle for wallets and IPs
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false)
    }

    ctx.fillStyle = baseColor
    ctx.fill()
    ctx.lineWidth = 1.2
    ctx.strokeStyle = '#0B1019'
    ctx.stroke()

    // Node label (only show when zoomed in or if selected/neighbor)
    const label = node.label || node.id
    if (globalScale >= 1.2 || isSelected || isNeighbor) {
      ctx.font = `${isSelected ? 'bold ' : ''}${Math.max(3, 9 / globalScale)}px ui-monospace, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = isSelected ? '#FFFFFF' : isNeighbor ? '#E2E8F0' : '#94A3B8'
      ctx.fillText(label, node.x, node.y + radius + 2)
    }

    ctx.restore()
  }

  const getLinkColor = (link) => {
    const isNeighborLink = neighborLinks.has(link)
    if (selectedEntityId && !isNeighborLink) {
      return 'rgba(30, 45, 71, 0.2)'
    }

    if (link.edge_type === 'broadcast') {
      return isNeighborLink ? '#E8542C' : 'rgba(232, 84, 44, 0.6)'
    }
    if (link.edge_type === 'input') {
      return isNeighborLink ? '#38BDF8' : 'rgba(56, 189, 248, 0.4)'
    }
    return isNeighborLink ? '#F59E0B' : 'rgba(245, 158, 11, 0.4)'
  }

  const getLinkWidth = (link) => {
    if (neighborLinks.has(link)) return 2.5
    return link.edge_type === 'broadcast' ? 1.5 : 1.0
  }

  return (
    <ForceGraph2D
      ref={fgRef}
      width={width}
      height={height}
      graphData={graphData}
      nodeId="id"
      nodeCanvasObject={paintNode}
      nodePointerAreaPaint={(node, color, ctx) => {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(node.x, node.y, 10, 0, 2 * Math.PI, false)
        ctx.fill()
      }}
      linkColor={getLinkColor}
      linkWidth={getLinkWidth}
      linkDirectionalArrowLength={3.5}
      linkDirectionalArrowRelPos={0.95}
      linkDirectionalParticles={(link) => (neighborLinks.has(link) ? 3 : 0)}
      linkDirectionalParticleSpeed={0.008}
      linkDirectionalParticleWidth={2}
      onNodeClick={handleNodeClick}
      backgroundColor="#05080E"
      d3AlphaDecay={0.02}
      d3VelocityDecay={0.3}
    />
  )
}
