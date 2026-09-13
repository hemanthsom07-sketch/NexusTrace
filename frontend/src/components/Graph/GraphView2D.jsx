import React, { useMemo, useCallback, useState } from 'react'
import { NODE_TYPE_META, nodeColorFor, edgeColorFor, edgeLabelFor } from '../../lib/entityMeta'

const PADDING_X = 95
const PADDING_Y = 75

export default function GraphView2D({
  nodes,
  links,
  bounds,
  selectedEntityId,
  onSelectEntity,
  onLinkClick,
  zoomLevel = 1,
  width,
  height,
}) {
  const [hoveredEdge, setHoveredEdge] = useState(null)

  const viewBox = useMemo(() => {
    const w = Math.max(bounds.maxX - bounds.minX, 500) + PADDING_X * 2
    const h = Math.max(bounds.maxY - bounds.minY, 520) + PADDING_Y * 2
    const cx = (bounds.minX + bounds.maxX) / 2
    const cy = (bounds.minY + bounds.maxY) / 2
    const scaledW = w / zoomLevel
    const scaledH = h / zoomLevel
    return `${cx - scaledW / 2} ${cy - scaledH / 2} ${scaledW} ${scaledH}`
  }, [bounds, zoomLevel])

  const handleNodeClick = useCallback((node) => {
    let rawId = node.id
    if (node.node_type === 'wallet') rawId = rawId.replace(/^wallet:/, '')
    if (node.node_type === 'transaction') rawId = rawId.replace(/^tx:/, '')
    if (node.node_type === 'ip') rawId = rawId.replace(/^ip:/, '')
    onSelectEntity({ type: node.node_type, id: rawId, fullId: node.id, node })
  }, [onSelectEntity])

  const curvePath = (link) => {
    // Broadcast is an evidence relationship, so render it visually from the
    // transaction lane toward the IP lane even though the backend stores the
    // edge as IP -> transaction. This avoids implying fund flow through an IP.
    const isBroadcast = link.edge_type === 'broadcast'
    const source = isBroadcast ? link.target : link.source
    const target = isBroadcast ? link.source : link.target
    const dx = target.x - source.x
    const dy = target.y - source.y
    const bend = Math.min(70, Math.abs(dx) * 0.16)
    const sign = dy >= 0 ? 1 : -1
    const cx = source.x + dx / 2
    const cy = source.y + dy / 2 + sign * bend
    return `M ${source.x} ${source.y} Q ${cx} ${cy} ${target.x} ${target.y}`
  }

  const displayPoints = (link) => {
    const isBroadcast = link.edge_type === 'broadcast'
    return isBroadcast ? { source: link.target, target: link.source } : { source: link.source, target: link.target }
  }

  return (
    <svg
      className="investigation-graph-svg"
      width={width}
      height={height}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      onMouseLeave={() => setHoveredEdge(null)}
    >
      <defs>
        <filter id="graphSelectedGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <text x={bounds.minX} y={bounds.minY - 32} className="graph-lane-title">FUND FLOW</text>
      {nodes.some((n) => n.node_type === 'ip') && (
        <text x={bounds.maxX - 150} y={Math.max(...nodes.map((n) => n.y)) + 54} className="graph-lane-title">NETWORK EVIDENCE</text>
      )}

      {links.map((link, i) => {
        const color = edgeColorFor(link.edge_type)
        const hovered = hoveredEdge === i
        const label = edgeLabelFor(link.edge_type)
        const { source, target } = displayPoints(link)
        const dx = target.x - source.x
        const dy = target.y - source.y
        const dist = Math.hypot(dx, dy) || 1
        const ux = dx / dist
        const uy = dy / dist
        const targetRadius = target.id === selectedEntityId ? 20 : 14
        const tipX = target.x - ux * (targetRadius + 2)
        const tipY = target.y - uy * (targetRadius + 2)
        const backX = tipX - ux * 9
        const backY = tipY - uy * 9
        const perpX = -uy * 3.5
        const perpY = ux * 3.5
        const midX = (source.x + target.x) / 2
        const midY = (source.y + target.y) / 2
        const labelWidth = label.length * 6.1 + 18

        return (
          <g
            key={i}
            className="graph-edge"
            onClick={(e) => { e.stopPropagation(); onLinkClick(link) }}
            onMouseEnter={() => setHoveredEdge(i)}
          >
            <path d={curvePath(link)} fill="none" stroke={color} strokeWidth={hovered ? 2.8 : 1.8} opacity={hovered ? 1 : 0.72} />
            <polygon
              points={`${tipX},${tipY} ${backX + perpX},${backY + perpY} ${backX - perpX},${backY - perpY}`}
              fill={color}
              opacity={hovered ? 1 : 0.8}
            />
            <path d={curvePath(link)} fill="none" stroke="transparent" strokeWidth="20" />
            <g pointerEvents="none">
              <rect x={midX - labelWidth / 2} y={midY - 10} width={labelWidth} height={20} rx={5} className={`graph-edge-label-bg ${hovered ? 'hovered' : ''}`} stroke={color} />
              <text className="graph-edge-label-text" x={midX} y={midY + 1} textAnchor="middle" dominantBaseline="middle" fill={color}>{label}</text>
            </g>
          </g>
        )
      })}

      {nodes.map((node) => {
        const isSelected = node.id === selectedEntityId
        const color = nodeColorFor(node)
        const radius = isSelected ? 20 : 14
        const glyph = (NODE_TYPE_META[node.node_type] || {}).glyph || '?'
        const label = node.label || node.id
        const shortLabel = label.length > 20 ? `${label.slice(0, 10)}…${label.slice(-7)}` : label

        return (
          <g key={node.id} className="graph-node" transform={`translate(${node.x}, ${node.y})`} onClick={(e) => { e.stopPropagation(); handleNodeClick(node) }}>
            <title>{`[${(node.node_type || '').toUpperCase()}] ${label}`}</title>
            {isSelected && <circle r={radius + 9} fill={color} opacity={0.18} filter="url(#graphSelectedGlow)" />}
            <circle r={radius} fill={color} stroke={isSelected ? '#ffffff' : 'rgba(5,8,14,0.75)'} strokeWidth={isSelected ? 2.8 : 1.4} />
            <text className="graph-node-glyph" textAnchor="middle" dominantBaseline="middle">{glyph}</text>
            <text className={`graph-node-label ${isSelected ? 'selected' : ''}`} y={radius + 18} textAnchor="middle">{shortLabel}</text>
          </g>
        )
      })}
    </svg>
  )
}
