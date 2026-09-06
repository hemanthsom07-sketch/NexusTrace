import React, { useEffect, useMemo } from 'react'
import ForceGraph3D from 'react-force-graph-3d'

const COLOR_MAP = {
  HIGH: '#EF4444',
  MEDIUM: '#F59E0B',
  LOW: '#64748B',
  tx: '#06B6D4',
  ip: '#10B981',
}

export default function GraphView3D({
  graphData,
  selectedEntityId,
  onSelectEntity,
  width,
  height,
  fgRef,
}) {
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

  // Center camera in 3D when selected node changes
  useEffect(() => {
    if (!selectedEntityId || !fgRef?.current || !graphData?.nodes) return
    const targetNode = graphData.nodes.find((n) => n.id === selectedEntityId)
    if (targetNode && targetNode.x !== undefined) {
      const distance = 80
      const distRatio = 1 + distance / Math.hypot(targetNode.x, targetNode.y, targetNode.z || 1)
      fgRef.current.cameraPosition(
        {
          x: targetNode.x * distRatio,
          y: targetNode.y * distRatio,
          z: (targetNode.z || 0) * distRatio,
        },
        targetNode,
        1000
      )
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

  const getNodeColor = (node) => {
    const isSelected = node.id === selectedEntityId
    const isNeighbor = neighborNodes.has(node.id)

    if (selectedEntityId && !isSelected && !isNeighbor) {
      return 'rgba(60, 75, 100, 0.25)'
    }

    if (node.node_type === 'wallet') {
      return COLOR_MAP[node.severity] || (node.anomaly_score >= 0.7 ? '#EF4444' : '#64748B')
    }
    if (node.node_type === 'transaction') return COLOR_MAP.tx
    if (node.node_type === 'ip') return COLOR_MAP.ip
    return '#94A3B8'
  }

  const getNodeVal = (node) => {
    if (node.id === selectedEntityId) return 12
    if (neighborNodes.has(node.id)) return 8
    if (node.node_type === 'wallet') return 6
    return 4
  }

  const getLinkColor = (link) => {
    const isNeighborLink = neighborLinks.has(link)
    if (selectedEntityId && !isNeighborLink) {
      return 'rgba(25, 35, 55, 0.15)'
    }
    if (link.edge_type === 'broadcast') return '#E8542C'
    if (link.edge_type === 'input') return '#38BDF8'
    return '#F59E0B'
  }

  return (
    <ForceGraph3D
      ref={fgRef}
      width={width}
      height={height}
      graphData={graphData}
      nodeId="id"
      nodeLabel={(node) => `[${(node.node_type || '').toUpperCase()}] ${node.label || node.id}`}
      nodeColor={getNodeColor}
      nodeVal={getNodeVal}
      nodeResolution={16}
      linkColor={getLinkColor}
      linkWidth={(link) => (neighborLinks.has(link) ? 2.5 : 0.8)}
      linkDirectionalArrowLength={3.5}
      linkDirectionalArrowRelPos={1}
      linkDirectionalParticles={(link) => (neighborLinks.has(link) ? 4 : 0)}
      linkDirectionalParticleSpeed={0.008}
      linkDirectionalParticleWidth={2}
      onNodeClick={handleNodeClick}
      backgroundColor="#05080E"
    />
  )
}
