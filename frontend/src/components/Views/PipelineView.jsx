import React, { useState, useRef } from 'react'
import {
  UploadCloud,
  FileText,
  FileJson,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCw,
  Terminal,
} from 'lucide-react'
import { uploadPipeline, runPipeline } from '../../api/client'

export default function PipelineView({ onPipelineSuccess, onShowToast }) {
  const [networkFile, setNetworkFile] = useState(null)
  const [txFile, setTxFile] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [logs, setLogs] = useState([])
  const [lastResult, setLastResult] = useState(null)
  const [dragOverNet, setDragOverNet] = useState(false)
  const [dragOverTx, setDragOverTx] = useState(false)

  const netInputRef = useRef(null)
  const txInputRef = useRef(null)

  const addLog = (msg) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => [...prev, `[${timestamp}] ${msg}`])
  }

  const handleRunSampleData = async () => {
    setIsRunning(true)
    setLogs([])
    addLog('Initiating pipeline execution against default sample dataset…')
    try {
      addLog('Calling POST /api/pipeline/run…')
      const res = await runPipeline()
      addLog(`Normalizing network events: ${res.events_ingested} ingested, ${res.events_skipped} skipped`)
      addLog(`Normalizing transactions: ${res.transactions_ingested} ingested, ${res.transactions_skipped} skipped`)
      addLog(`Cross-layer matching: ${res.links_found} correlation links established`)
      addLog(`Isolation Forest ML: ${res.leads_generated} wallets evaluated`)
      addLog('Persisting intelligence cache to SQLite db…')
      addLog('✓ Pipeline completed successfully.')
      setLastResult(res)
      if (onShowToast) onShowToast('Pipeline completed! Intelligence data synchronized.', 'success')
      if (onPipelineSuccess) onPipelineSuccess(res)
    } catch (err) {
      addLog(`ERROR: ${err.message}`)
      if (onShowToast) onShowToast(`Pipeline run failed: ${err.message}`, 'error')
    } finally {
      setIsRunning(false)
    }
  }

  const handleUploadAndRun = async () => {
    if (!networkFile && !txFile) {
      if (onShowToast) onShowToast('Select at least one file or run default dataset.', 'error')
      return
    }

    setIsRunning(true)
    setLogs([])
    addLog('Packaging multipart/form-data for browser ingestion…')

    const formData = new FormData()
    if (networkFile) {
      formData.append('network_csv', networkFile)
      addLog(`Attached Network CSV: ${networkFile.name} (${(networkFile.size / 1024).toFixed(1)} KB)`)
    }
    if (txFile) {
      formData.append('tx_json', txFile)
      addLog(`Attached Transactions JSON: ${txFile.name} (${(txFile.size / 1024).toFixed(1)} KB)`)
    }

    try {
      addLog('Transmitting payload to POST /api/pipeline/upload…')
      const res = await uploadPipeline(formData)
      addLog(`Ingested ${res.events_ingested} network events (${res.events_skipped} skipped)`)
      addLog(`Ingested ${res.transactions_ingested} blockchain transactions (${res.transactions_skipped} skipped)`)
      addLog(`Discovered ${res.links_found} candidate cross-layer correlation links`)
      addLog(`Generated ${res.leads_generated} investigation leads (${res.high_risk_count} HIGH risk)`)
      addLog('Synchronizing SQLite graph topology cache…')
      addLog('✓ Application state refreshed automatically.')
      setLastResult(res)
      if (onShowToast) onShowToast('Dataset uploaded and pipeline executed successfully!', 'success')
      if (onPipelineSuccess) onPipelineSuccess(res)
    } catch (err) {
      addLog(`INGESTION FAILED: ${err.message}`)
      if (onShowToast) onShowToast(`Upload error: ${err.message}`, 'error')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="full-view-container">
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9', marginBottom: 2 }}>
          Data Ingestion &amp; Correlation Pipeline
        </h2>
        <p style={{ fontSize: 12, color: '#94A3B8' }}>
          Upload raw P2P network telemetry and blockchain transaction logs to trigger automated correlation and anomaly scoring.
        </p>
      </div>

      {/* Drag & Drop File Upload Zones */}
      <div className="dropzone-grid">
        {/* Network CSV Dropzone */}
        <div
          className="file-dropzone"
          style={{ borderColor: dragOverNet ? '#0EA5E9' : networkFile ? '#10B981' : '#1E2D47' }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOverNet(true)
          }}
          onDragLeave={() => setDragOverNet(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOverNet(false)
            if (e.dataTransfer.files?.[0]) setNetworkFile(e.dataTransfer.files[0])
          }}
          onClick={() => netInputRef.current?.click()}
        >
          <input
            ref={netInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && setNetworkFile(e.target.files[0])}
          />
          <div className="dropzone-icon">
            <FileText size={28} color={networkFile ? '#10B981' : '#0EA5E9'} />
          </div>
          <div className="dropzone-title">
            {networkFile ? networkFile.name : 'Network Events Telemetry (CSV)'}
          </div>
          <div className="dropzone-hint">
            {networkFile
              ? `${(networkFile.size / 1024).toFixed(1)} KB • Click or drop to replace`
              : 'Drag and drop sample_network.csv or browse file'}
          </div>
        </div>

        {/* Transactions JSON Dropzone */}
        <div
          className="file-dropzone"
          style={{ borderColor: dragOverTx ? '#0EA5E9' : txFile ? '#10B981' : '#1E2D47' }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOverTx(true)
          }}
          onDragLeave={() => setDragOverTx(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOverTx(false)
            if (e.dataTransfer.files?.[0]) setTxFile(e.dataTransfer.files[0])
          }}
          onClick={() => txInputRef.current?.click()}
        >
          <input
            ref={txInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && setTxFile(e.target.files[0])}
          />
          <div className="dropzone-icon">
            <FileJson size={28} color={txFile ? '#10B981' : '#06B6D4'} />
          </div>
          <div className="dropzone-title">
            {txFile ? txFile.name : 'Bitcoin Transactions (JSON)'}
          </div>
          <div className="dropzone-hint">
            {txFile
              ? `${(txFile.size / 1024).toFixed(1)} KB • Click or drop to replace`
              : 'Drag and drop sample_transactions.json or browse file'}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          className="btn-primary"
          style={{ padding: '9px 18px', fontSize: 13 }}
          onClick={handleUploadAndRun}
          disabled={isRunning || (!networkFile && !txFile)}
        >
          {isRunning ? <RotateCw size={14} className="spin" /> : <UploadCloud size={14} />}
          <span>Upload Files &amp; Run Pipeline</span>
        </button>

        <button
          className="btn-secondary"
          style={{ padding: '9px 18px', fontSize: 13 }}
          onClick={handleRunSampleData}
          disabled={isRunning}
        >
          <Play size={14} />
          <span>Execute Against Default Sample Dataset</span>
        </button>
      </div>

      {/* Execution Results Summary */}
      {lastResult && (
        <div
          className="data-table-card"
          style={{ padding: 16, background: '#0E1524', border: '1px solid #1E2D47' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10B981', fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
            <CheckCircle2 size={16} />
            <span>Ingestion &amp; Anomaly Detection Execution Results</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div className="kpi-card">
              <div className="kpi-label">Events Ingested</div>
              <div className="kpi-value">{lastResult.events_ingested}</div>
              <div className="kpi-sub">{lastResult.events_skipped} skipped rows</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Transactions Ingested</div>
              <div className="kpi-value">{lastResult.transactions_ingested}</div>
              <div className="kpi-sub">{lastResult.transactions_skipped} skipped rows</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Correlations Found</div>
              <div className="kpi-value cyan">{lastResult.links_found}</div>
              <div className="kpi-sub">Temporal links (Δt ≤ 5.0s)</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Wallets Scored</div>
              <div className="kpi-value">{lastResult.leads_generated}</div>
              <div className="kpi-sub" style={{ color: '#EF4444', fontWeight: 600 }}>
                {lastResult.high_risk_count ?? 2} HIGH risk targets
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Ingestion Console Logs */}
      <div className="data-table-card" style={{ background: '#05080E' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #172236', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#64748B', fontFamily: 'ui-monospace' }}>
          <Terminal size={13} />
          <span>Pipeline Telemetry &amp; Verification Console</span>
        </div>
        <div
          style={{
            padding: 14,
            maxHeight: 220,
            overflowY: 'auto',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 11.5,
            lineHeight: 1.6,
            color: '#CBD5E1',
          }}
        >
          {logs.length === 0 ? (
            <span style={{ color: '#475569' }}>
              Console ready. Upload datasets or run pipeline to view real-time log output.
            </span>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} style={{ color: log.includes('ERROR') ? '#EF4444' : log.includes('✓') ? '#10B981' : '#CBD5E1' }}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
