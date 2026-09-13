import React, { useEffect, useMemo, useCallback } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import * as THREE from 'three'

const COLOR_MAP = {
  HIGH: '#EF4444',
  MEDIUM: '#F59E0B',
  LOW: '#38BDF8',
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
      return {
        neighborNodes: nodes,
        neighborLinks: links,
      }
    }

    nodes.add(selectedEntityId)

    graphData.links.forEach((link) => {
      const sourceId =
        typeof link.source === 'object'
          ? link.source.id
          : link.source

      const targetId =
        typeof link.target === 'object'
          ? link.target.id
          : link.target

      if (
        sourceId === selectedEntityId ||
        targetId === selectedEntityId
      ) {
        nodes.add(sourceId)
        nodes.add(targetId)
        links.add(link)
      }
    })

    return {
      neighborNodes: nodes,
      neighborLinks: links,
    }
  }, [graphData, selectedEntityId])

  // react-force-graph-3d only calls nodeThreeObject/linkColor for nodes/
  // links as they enter the simulation -- it does NOT automatically
  // re-invoke them for already-rendered nodes just because a prop these
  // accessors close over (selectedEntityId, neighborNodes) changed. That's
  // the actual cause of "switching to 2D and back fixes it" -- switching
  // modes remounts this component, so every node gets freshly constructed
  // with the current selection. Calling .refresh() here does the same
  // thing without a remount, so selection updates immediately.
  useEffect(() => {
    fgRef?.current?.refresh?.()
  }, [selectedEntityId, neighborNodes, neighborLinks, fgRef])

  useEffect(() => {
    if (
      !selectedEntityId ||
      !fgRef?.current ||
      !graphData?.nodes
    ) {
      return
    }

    const targetNode = graphData.nodes.find(
      (n) => n.id === selectedEntityId
    )

    if (
      targetNode &&
      targetNode.x !== undefined
    ) {
      const distance = 90

      const distRatio =
        1 +
        distance /
          Math.hypot(
            targetNode.x,
            targetNode.y,
            targetNode.z || 1
          )

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

  const handleNodeClick = useCallback(
    (node) => {
      if (!node) return

      let rawId = node.id

      if (node.node_type === 'wallet') {
        rawId = rawId.replace(/^wallet:/, '')
      }

      if (node.node_type === 'transaction') {
        rawId = rawId.replace(/^tx:/, '')
      }

      if (node.node_type === 'ip') {
        rawId = rawId.replace(/^ip:/, '')
      }

      onSelectEntity({
        type: node.node_type,
        id: rawId,
        fullId: node.id,
        node,
      })
    },
    [onSelectEntity]
  )

  const createNodeObject = useCallback(
    (node) => {
      const isSelected =
        node.id === selectedEntityId

      const isNeighbor =
        neighborNodes.has(node.id)

      const isDimmed =
        selectedEntityId &&
        !isSelected &&
        !isNeighbor

      let colorHex = COLOR_MAP.LOW
      let radius = 4

      if (node.node_type === 'wallet') {
        colorHex =
          COLOR_MAP[node.severity] ||
          (node.anomaly_score >= 0.7
            ? '#EF4444'
            : '#38BDF8')

        radius = isSelected ? 8 : 6
      } else if (node.node_type === 'transaction') {
        colorHex = COLOR_MAP.tx
        radius = isSelected ? 7 : 5
      } else if (node.node_type === 'ip') {
        colorHex = COLOR_MAP.ip
        radius = isSelected ? 7.5 : 5.5
      }

      const group = new THREE.Group()

      const geometry =
        node.node_type === 'transaction'
          ? new THREE.OctahedronGeometry(radius)
          : new THREE.SphereGeometry(
              radius,
              16,
              16
            )

      const material =
        new THREE.MeshPhongMaterial({
          color: colorHex,
          emissive: colorHex,
          emissiveIntensity: isSelected
            ? 0.6
            : isNeighbor
              ? 0.3
              : 0.15,
          transparent: true,
          opacity: isDimmed ? 0.25 : 0.95,
          shininess: 80,
        })

      const mesh = new THREE.Mesh(
        geometry,
        material
      )

      group.add(mesh)

      if (isSelected) {
        const ringGeo =
          new THREE.RingGeometry(
            radius + 2,
            radius + 4,
            32
          )

        const ringMat =
          new THREE.MeshBasicMaterial({
            color: 0x38bdf8,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8,
          })

        const ringMesh = new THREE.Mesh(
          ringGeo,
          ringMat
        )

        group.add(ringMesh)
      }

      return group
    },
    [selectedEntityId, neighborNodes]
  )

  const getLinkColor = useCallback(
    (link) => {
      const isNeighborLink =
        neighborLinks.has(link)

      if (
        selectedEntityId &&
        !isNeighborLink
      ) {
        return 'rgba(30, 45, 71, 0.15)'
      }

      if (link.edge_type === 'broadcast') {
        return '#E8542C'
      }

      if (link.edge_type === 'input') {
        return '#38BDF8'
      }

      return '#F59E0B'
    },
    [selectedEntityId, neighborLinks]
  )

  return (
    <ForceGraph3D
      ref={fgRef}
      graphData={graphData || { nodes: [], links: [] }}
      width={width}
      height={height}
      nodeThreeObject={createNodeObject}
      nodeLabel={(node) =>
        `[${(node.node_type || '').toUpperCase()}] ${
          node.label || node.id
        }`
      }
      linkColor={getLinkColor}
      linkWidth={(link) =>
        neighborLinks.has(link) ? 2.5 : 1.0
      }
      linkDirectionalArrowLength={4}
      linkDirectionalArrowRelPos={1}
      linkDirectionalParticles={(link) =>
        neighborLinks.has(link) ? 4 : 2
      }
      linkDirectionalParticleSpeed={0.008}
      linkDirectionalParticleWidth={2}
      onNodeClick={handleNodeClick}
      backgroundColor="#05080E"
    />
  )
}