import React, { useEffect, useRef, useState, useCallback } from 'react'
import ForceGraph3D from 'react-force-graph-3d'

// Color by node type -- matches the navy/blue palette used across the
// project's PPT and diagrams, for visual consistency.
const NODE_COLORS = {
  ip: '#1B5FAE',
  wallet: '#0A1628',
  transaction: '#1E93A0',
}
const FLAGGED_COLOR = '#E8542C'

export default function GraphView({ graphData, selectedWallet, onSelectWallet }) {
  const containerRef = useRef(null)
  const fgRef = useRef(null)
  const [dims, setDims] = useState({ width: 600, height: 500 })

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDims({ width, height })
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const handleNodeClick = useCallback(
    (node) => {
      if (node.node_type === 'wallet') {
        // strip the "wallet:" prefix the backend uses to namespace node ids
        onSelectWallet(node.id.replace(/^wallet:/, ''))
      }
    },
    [onSelectWallet]
  )

  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return (
      <div className="empty-state" ref={containerRef}>
        No graph data yet — click "Run Pipeline" to load data.
      </div>
    )
  }

  // react-force-graph expects {nodes, links} -- our backend calls the
  // second one "edges", so map it here rather than renaming on the backend.
  const fgData = {
    nodes: graphData.nodes,
    links: graphData.edges.map((e) => ({ ...e, source: e.source, target: e.target })),
  }

  const selectedNodeId = selectedWallet ? `wallet:${selectedWallet}` : null

  return (
    <div className="graph-view" ref={containerRef}>
      <ForceGraph3D
        ref={fgRef}
        width={dims.width}
        height={dims.height}
        graphData={fgData}
        nodeId="id"
        nodeLabel={(node) => `${node.node_type}: ${node.label}`}
        nodeColor={(node) =>
          node.id === selectedNodeId ? FLAGGED_COLOR : NODE_COLORS[node.node_type] || '#93A3B0'
        }
        nodeRelSize={5}
        linkColor={() => 'rgba(120,140,160,0.5)'}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        onNodeClick={handleNodeClick}
        backgroundColor="#ffffff"
      />
    </div>
  )
}
