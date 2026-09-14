import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, X, AlertCircle, Crosshair } from 'lucide-react'
import GraphView2D from './GraphView2D'
import GraphLegend from './GraphLegend'
import { connectedNetwork } from '../../lib/graphNetwork'
import { layoutNetwork } from '../../lib/graphLayout'
import { edgeExplanation } from '../../lib/entityMeta'
import { formatPercent } from '../../lib/format'

function findEvidenceForBroadcastEdge(link, transactions) {
  // Confidence already lives on the edge itself (see graph/builder.py),
  // but delta-t/port only exist on each transaction's own correlation_evidence
  // list -- look that up rather than inventing it.
  if (link.edge_type !== 'broadcast') return null

  const ip =
    link.source?.label ||
    link.source?.id?.replace(/^ip:/, '')

  const txid =
    link.target?.label ||
    link.target?.id?.replace(/^tx:/, '')

  const tx = transactions.find((t) => t.txid === txid)

  if (!tx) return null

  return (
    tx.correlation_evidence || []
  ).find((ev) => ev.ip === ip) || null
}

function OverflowNotice({ overflow }) {
  if (!overflow?.total) return null

  const parts = []

  if (overflow.transactions > 0) {
    parts.push(
      `${overflow.transactions} additional transaction${overflow.transactions === 1 ? '' : 's'}`
    )
  }

  if (overflow.outputWallets > 0) {
    parts.push(
      `${overflow.outputWallets} additional wallet${overflow.outputWallets === 1 ? '' : 's'}`
    )
  }

  if (overflow.ips > 0) {
    parts.push(
      `${overflow.ips} additional IP${overflow.ips === 1 ? '' : 's'}`
    )
  }

  return (
    <div className="graph-overflow-notice">
      <AlertCircle size={15} />

      <div>
        <strong>Investigation view limited</strong>

        <span>
          {parts.join(' · ')}
        </span>

        <small>
          The graph is intentionally focused for readability. Use the
          Transactions and Evidence tabs to inspect the complete dataset.
        </small>
      </div>
    </div>
  )
}

function GraphCanvas({
  fgData,
  selectedEntityId,
  onSelectEntity,
  transactions,
  isFullscreen,
  onToggleFullscreen,
  onClose,
}) {
  const containerRef = useRef(null)
  const [dims, setDims] = useState({ width: 600, height: 500 })
  const [zoomLevel, setZoomLevel] = useState(1)
  const [linkInfo, setLinkInfo] = useState(null)

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

  // Reset zoom and any open link detail whenever the focused network
  // changes, so the default view is always the readable, fitted view.
  useEffect(() => {
    setZoomLevel(1)
    setLinkInfo(null)
  }, [selectedEntityId])

  const layout = useMemo(
    () => layoutNetwork(fgData.nodes, fgData.links),
    [fgData]
  )

  const handleLinkClick = useCallback(
    (link) => {
      const explanation = edgeExplanation(link)
      const evidence = findEvidenceForBroadcastEdge(
        link,
        transactions
      )

      setLinkInfo({
        ...explanation,
        evidence,
      })
    },
    [transactions]
  )

  const handleZoomIn = () =>
    setZoomLevel((z) => Math.min(z * 1.3, 6))

  const handleZoomOut = () =>
    setZoomLevel((z) => Math.max(z / 1.3, 0.4))

  const handleReset = () => setZoomLevel(1)

  if (!selectedEntityId) {
    return (
      <div ref={containerRef} className="graph-container empty">
        <div className="graph-empty">
          <Crosshair size={28} />

          <h3>Select an investigation lead</h3>

          <p>
            The graph intentionally stays focused on one case.
            Choose a wallet from the Investigation Queue to reveal
            its transactions, output wallets and network evidence.
          </p>
        </div>
      </div>
    )
  }

  if (!layout.nodes.length) {
    return (
      <div ref={containerRef} className="graph-container empty">
        <div className="graph-empty">
          <AlertCircle size={28} />

          <h3>No Graph Data</h3>

          <p>
            Analysis completed but produced no graph relationships
            for this dataset -- this is a valid result when no
            wallets or correlations were found.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="graph-container">
      <div className="graph-header">
        <div className="graph-title">
          <h2>Investigation Graph</h2>

          <span>
            {layout.nodes.length} entities · {layout.links.length} relationships
          </span>
        </div>

        {selectedEntityId && (
          <div className="graph-focus-chip">
            <Crosshair size={12} />
            Focused network
          </div>
        )}
      </div>

      <OverflowNotice overflow={fgData.overflow} />

      <div className="graph-canvas">
        <GraphView2D
          nodes={layout.nodes}
          links={layout.links}
          bounds={layout.bounds}
          selectedEntityId={selectedEntityId}
          onSelectEntity={onSelectEntity}
          onLinkClick={handleLinkClick}
          zoomLevel={zoomLevel}
          width={dims.width}
          height={dims.height}
        />

        {linkInfo && (
          <div className="graph-link-detail">
            <div className="graph-link-detail-header">
              <span className="graph-link-detail-title">
                {linkInfo.relationship}
              </span>

              <button
                className="graph-link-detail-close"
                onClick={() => setLinkInfo(null)}
              >
                <X size={13} />
              </button>
            </div>

            <div className="graph-link-detail-text">
              {linkInfo.text}
            </div>

            {(typeof linkInfo.confidence === 'number' ||
              linkInfo.evidence) && (
              <div className="graph-link-detail-facts">
                {typeof linkInfo.confidence === 'number' && (
                  <div className="graph-link-detail-fact">
                    <span>Correlation Confidence</span>
                    <b>
                      {formatPercent(linkInfo.confidence)}
                    </b>
                  </div>
                )}

                {linkInfo.evidence?.port !== undefined && (
                  <div className="graph-link-detail-fact">
                    <span>Port</span>
                    <b>{linkInfo.evidence.port}</b>
                  </div>
                )}

                {typeof linkInfo.evidence?.time_delta_seconds ===
                  'number' && (
                  <div className="graph-link-detail-fact">
                    <span>Δt</span>
                    <b>
                      {linkInfo.evidence.time_delta_seconds}s
                    </b>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="graph-controls">
        <button
          onClick={handleZoomIn}
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>

        <button
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>

        <button
          onClick={handleReset}
          title="Reset Zoom"
        >
          <RotateCcw size={16} />
        </button>

        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            title={
              isFullscreen
                ? 'Exit Fullscreen'
                : 'View Fullscreen'
            }
          >
            <Maximize2 size={16} />
          </button>
        )}

        {onClose && (
          <button
            onClick={onClose}
            title="Close Fullscreen"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <GraphLegend />
    </div>
  )
}

export default function GraphContainer({
  graphData,
  selectedEntityId,
  onSelectEntity,
  transactions = [],
  loading = false,
}) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  const fullGraph = useMemo(() => {
    if (!graphData || !graphData.nodes) return null

    return {
      nodes: graphData.nodes.map((n) => ({ ...n })),
      links: (
        graphData.edges ||
        graphData.links ||
        []
      ).map((e) => ({ ...e })),
    }
  }, [graphData])

  // Selecting an entity narrows the view to a small, readable case map.
  // The full dataset remains available in the investigation tabs.
  const fgData = useMemo(() => {
    if (!fullGraph) return null

    if (!selectedEntityId) {
      return {
        nodes: [],
        links: [],
        overflow: {
          transactions: 0,
          outputWallets: 0,
          ips: 0,
          total: 0,
        },
      }
    }

    return connectedNetwork(
      fullGraph.nodes,
      fullGraph.links,
      selectedEntityId
    )
  }, [fullGraph, selectedEntityId])

  useEffect(() => {
    if (!isFullscreen) return

    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false)
      }
    }

    window.addEventListener('keydown', handleKey)

    return () =>
      window.removeEventListener('keydown', handleKey)
  }, [isFullscreen])

  if (loading) {
    return (
      <div className="graph-container loading">
        <div className="graph-loading">
          <AlertCircle size={24} />
          <span>Loading investigation graph…</span>
        </div>
      </div>
    )
  }

  if (!fgData) {
    return (
      <div className="graph-container empty">
        <div className="graph-empty">
          <AlertCircle size={28} />

          <h3>No Graph Data</h3>

          <p>
            Analysis completed but produced no graph relationships
            for this dataset -- this is a valid result when no
            wallets or correlations were found.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <GraphCanvas
        fgData={fgData}
        selectedEntityId={selectedEntityId}
        onSelectEntity={onSelectEntity}
        transactions={transactions}
        isFullscreen={false}
        onToggleFullscreen={() => setIsFullscreen(true)}
      />

      {isFullscreen && (
        <div
          className="graph-fullscreen-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsFullscreen(false)
            }
          }}
        >
          <div className="graph-fullscreen-panel">
            <GraphCanvas
              fgData={fgData}
              selectedEntityId={selectedEntityId}
              onSelectEntity={onSelectEntity}
              transactions={transactions}
              isFullscreen
              onClose={() => setIsFullscreen(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}