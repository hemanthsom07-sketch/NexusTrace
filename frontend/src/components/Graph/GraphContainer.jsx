import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Crosshair,
  Box,
  Square,
  AlertCircle,
} from 'lucide-react'
import GraphView2D from './GraphView2D'
import GraphView3D from './GraphView3D'
import GraphLegend from './GraphLegend'

export default function GraphContainer({
  graphData,
  selectedEntityId,
  onSelectEntity,
  loading = false,
}) {
  const containerRef = useRef(null)
  const fgRef = useRef(null)
  const [dims, setDims] = useState({ width: 600, height: 500 })
  const [mode, setMode] = useState('2d') // '2d' | '3d'
  const [webglError, setWebglError] = useState(false)

  // Track container size
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) {
        setDims({ width, height })
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Format data for react-force-graph: nodes and links
  const fgData = useMemo(() => {
    if (!graphData || !graphData.nodes) return null
    return {
      nodes: graphData.nodes.map((n) => ({ ...n })),
      links: (graphData.edges || graphData.links || []).map((e) => ({
        ...e,
        source: e.source,
        target: e.target,
      })),
    }
  }, [graphData])

  // Camera control helpers
  const handleZoomIn = useCallback(() => {
    if (!fgRef.current) return
    if (mode === '2d') {
      const currentZoom = fgRef.current.zoom()
      fgRef.current.zoom(currentZoom * 1.3, 300)
    }
  }, [mode])

  const handleZoomOut = useCallback(() => {
    if (!fgRef.current) return
    if (mode === '2d') {
      const currentZoom = fgRef.current.zoom()
      fgRef.current.zoom(currentZoom / 1.3, 300)
    }
  }, [mode])

  const handleFit = useCallback(() => {
    if (!fgRef.current) return
    if (mode === '2d') {
      fgRef.current.zoomToFit(400, 30)
    } else {
      fgRef.current.zoomToFit(800, 30)
    }
  }, [mode])

  const handleReset = useCallback(() => {
    if (!fgRef.current) return
    if (mode === '2d') {
      fgRef.current.centerAt(0, 0, 400)
      fgRef.current.zoom(1, 400)
    } else {
      fgRef.current.cameraPosition({ x: 0, y: 0, z: 220 }, { x: 0, y: 0, z: 0 }, 800)
    }
  }, [mode])

  const handleCenterSelected = useCallback(() => {
    if (!fgRef.current || !selectedEntityId || !fgData?.nodes) return
    const target = fgData.nodes.find((n) => n.id === selectedEntityId)
    if (target && target.x !== undefined) {
      if (mode === '2d') {
        fgRef.current.centerAt(target.x, target.y, 500)
        fgRef.current.zoom(2.2, 500)
      } else {
        fgRef.current.cameraPosition(
          { x: target.x + 40, y: target.y + 40, z: (target.z || 0) + 60 },
          target,
          800
        )
      }
    }
  }, [selectedEntityId, fgData, mode])

  if (loading) {
    return (
      <div className="graph-panel" ref={containerRef}>
        <div className="cyber-empty-state">
          <div className="cyber-spinner" />
          <p>Synthesizing entity topology graph…</p>
        </div>
      </div>
    )
  }

  if (!fgData || fgData.nodes.length === 0) {
    return (
      <div className="graph-panel" ref={containerRef}>
        <div className="cyber-empty-state">
          <AlertCircle size={32} color="#64748B" />
          <p style={{ fontWeight: 600, color: '#94A3B8' }}>No Graph Topology Loaded</p>
          <p style={{ fontSize: 11.5 }}>
            Run the pipeline or upload datasets to generate the cross-layer entity graph.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="graph-panel" ref={containerRef}>
      {/* Floating HUD Top Controls */}
      <div className="graph-hud-top">
        {/* 2D / 3D Switcher */}
        <div className="graph-mode-toggle">
          <button
            className={`mode-btn ${mode === '2d' ? 'active' : ''}`}
            onClick={() => setMode('2d')}
            title="Switch to 2D Canvas View (Fast & Crisp)"
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Square size={12} />
              2D Canvas
            </span>
          </button>
          <button
            className={`mode-btn ${mode === '3d' ? 'active' : ''}`}
            onClick={() => {
              try {
                setMode('3d')
              } catch (e) {
                setWebglError(true)
                setMode('2d')
              }
            }}
            title="Switch to 3D WebGL Spatial Graph"
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Box size={12} />
              3D Spatial
            </span>
          </button>
        </div>

        {/* Toolbar: Zoom, Fit, Reset, Center */}
        <div className="graph-controls-toolbar">
          <button className="ctrl-btn" onClick={handleZoomIn} title="Zoom in">
            <ZoomIn size={14} />
          </button>
          <button className="ctrl-btn" onClick={handleZoomOut} title="Zoom out">
            <ZoomOut size={14} />
          </button>
          <button className="ctrl-btn" onClick={handleFit} title="Fit entire graph">
            <Maximize2 size={13} />
          </button>
          <button className="ctrl-btn" onClick={handleReset} title="Reset camera view">
            <RotateCcw size={13} />
          </button>
          {selectedEntityId && (
            <button
              className="ctrl-btn"
              onClick={handleCenterSelected}
              title="Focus selected entity"
              style={{ color: '#0EA5E9' }}
            >
              <Crosshair size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Graph Viewport */}
      <div className="graph-canvas-container">
        {mode === '2d' ? (
          <GraphView2D
            fgRef={fgRef}
            width={dims.width}
            height={dims.height}
            graphData={fgData}
            selectedEntityId={selectedEntityId}
            onSelectEntity={onSelectEntity}
          />
        ) : (
          <GraphView3D
            fgRef={fgRef}
            width={dims.width}
            height={dims.height}
            graphData={fgData}
            selectedEntityId={selectedEntityId}
            onSelectEntity={onSelectEntity}
          />
        )}
      </div>

      {/* Graph Legend Overlay */}
      <GraphLegend />
    </div>
  )
}
