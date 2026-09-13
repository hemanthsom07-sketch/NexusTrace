import React, { useState, useCallback } from 'react'
import { UploadCloud, CheckCircle2, FileText, Play, ScanSearch, Radar } from 'lucide-react'
import { uploadPipelineDual, uploadPipelineMerged, runPipeline } from '../../api/client'

function UploadZone({ label, sublabel, file, onFile, accept = '.csv,.json,.xml' }) {
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragOver(false)
      const dropped = e.dataTransfer.files?.[0]
      if (dropped) onFile(dropped)
    },
    [onFile]
  )

  return (
    <div
      className={`upload-zone ${dragOver ? 'dragover' : ''} ${file ? 'filled' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="upload-zone-icon">
        {file ? <CheckCircle2 size={20} /> : <UploadCloud size={20} />}
      </div>
      <div className="upload-zone-title">{label}</div>
      <div className="upload-zone-sub">{sublabel}</div>

      {file ? (
        <div className="upload-result">
          <div className="upload-result-name"><FileText size={13} /> {file.name}</div>
          <div className="upload-result-meta">
            <span>{(file.size / 1024).toFixed(1)} KB</span>
            <span>Record count &amp; field validation shown after Analyse</span>
          </div>
        </div>
      ) : (
        <>
          <div className="upload-zone-formats">CSV · JSON · XML</div>
          <label className="upload-button">
            Browse
            <input type="file" accept={accept} hidden onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
          </label>
        </>
      )}
    </div>
  )
}

function ValidationSummary({ validation }) {
  if (!validation) return null
  const invalid = validation.valid === false
  return (
    <div className={`validation-summary ${invalid ? 'invalid' : ''}`}>
      <div className="validation-stat">
        <span>Network</span>
        <strong>{validation.network_records ?? 0}</strong>
      </div>
      <div className="validation-stat">
        <span>Blockchain</span>
        <strong>{validation.blockchain_records ?? 0}</strong>
      </div>
      <div className="validation-stat">
        <span>Matching TXIDs</span>
        <strong>{validation.matching_txids ?? '—'}</strong>
      </div>
      <div className={`validation-stat ${!invalid ? 'ready' : ''}`}>
        <span>Status</span>
        <strong>{invalid ? 'FAILED' : 'READY'}</strong>
      </div>
      {invalid && (
        <div className="validation-error-list">
          Missing fields:{' '}
          {[...(validation.missing_network_fields || []), ...(validation.missing_blockchain_fields || [])].join(', ') || 'unknown'}
        </div>
      )}
    </div>
  )
}

export default function PipelineView({ onAnalysisStart, onAnalysisSuccess, onAnalysisError, onShowToast }) {
  const [mode, setMode] = useState('dual')
  const [networkFile, setNetworkFile] = useState(null)
  const [blockchainFile, setBlockchainFile] = useState(null)
  const [mergedFile, setMergedFile] = useState(null)
  const [validation, setValidation] = useState(null)
  const [loading, setLoading] = useState(false)

  const canAnalyse = mode === 'dual' ? !!(networkFile && blockchainFile) : !!mergedFile

  const currentStep = canAnalyse || validation ? (validation && validation.valid !== false ? 3 : 2) : 1

  const handleAnalyse = async () => {
    setLoading(true)
    setValidation(null)
    onAnalysisStart()
    try {
      const res = mode === 'dual'
        ? await uploadPipelineDual(networkFile, blockchainFile)
        : await uploadPipelineMerged(mergedFile)

      setValidation(res.validation || null)
      await onAnalysisSuccess(res, { type: 'uploaded', validation: res.validation || null })
    } catch (err) {
      if (err.validation) setValidation(err.validation)
      onAnalysisError(err.message || 'Dataset validation failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleSampleRun = async () => {
    setLoading(true)
    onAnalysisStart()
    try {
      const res = await runPipeline()
      await onAnalysisSuccess(res, { type: 'sample' })
    } catch (err) {
      onAnalysisError(err.message || 'Pipeline execution failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pipeline-view">
      <div className="pipeline-header">
        <h2>Dataset Input</h2>
        <p>Provide data → Analyze → Investigate results.</p>
      </div>

      <div className="pipeline-steps">
        <div className={`pipeline-step ${currentStep === 1 ? 'active' : currentStep > 1 ? 'done' : ''}`}>
          <span className="pipeline-step-num">1</span>
          <span className="pipeline-step-label">Add Dataset</span>
        </div>
        <div className={`pipeline-step ${currentStep === 2 ? 'active' : currentStep > 2 ? 'done' : ''}`}>
          <span className="pipeline-step-num">2</span>
          <span className="pipeline-step-label">Analyze</span>
        </div>
        <div className={`pipeline-step ${currentStep === 3 ? 'active' : ''}`}>
          <span className="pipeline-step-num">3</span>
          <span className="pipeline-step-label">Investigate Results</span>
        </div>
      </div>

      <div className="mode-toggle">
        <button className={`mode-option ${mode === 'dual' ? 'active' : ''}`} onClick={() => setMode('dual')}>
          <div className="mode-option-title">Two Separate Datasets</div>
          <div className="mode-option-sub">Network telemetry + blockchain transactions as separate files</div>
        </button>
        <button className={`mode-option ${mode === 'merged' ? 'active' : ''}`} onClick={() => setMode('merged')}>
          <div className="mode-option-title">Single Merged Dataset</div>
          <div className="mode-option-sub">One file containing both network and blockchain fields</div>
        </button>
      </div>

      {mode === 'dual' ? (
        <div className="upload-zone-grid">
          <UploadZone
            label="Network Telemetry"
            sublabel="Network-layer observations"
            file={networkFile}
            onFile={setNetworkFile}
          />
          <UploadZone
            label="Blockchain Transactions"
            sublabel="Blockchain-layer transactions"
            file={blockchainFile}
            onFile={setBlockchainFile}
          />
        </div>
      ) : (
        <div className="upload-zone-grid single">
          <UploadZone
            label="Merged Dataset"
            sublabel="Combined network + blockchain data"
            file={mergedFile}
            onFile={setMergedFile}
          />
        </div>
      )}

      <ValidationSummary validation={validation} />

      <div className="analyse-bar">
        <button className="analyse-button" onClick={handleAnalyse} disabled={!canAnalyse || loading}>
          {loading ? 'Analysing…' : (<><ScanSearch size={15} /> Analyse Data</>)}
        </button>
      </div>

      <div className="pipeline-divider">or, for a quick demo only</div>

      <div className="pipeline-card">
        <h3><Radar size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Built-in Sample Dataset</h3>
        <p>
          Explicitly run the bundled sample network + transaction data instead of uploading your own.
          This never runs automatically — nothing is analyzed until you choose one path above.
        </p>
        <button className="btn" onClick={handleSampleRun} disabled={loading}>
          <Play size={13} /> {loading ? 'Processing…' : 'Run Sample Dataset'}
        </button>
      </div>
    </div>
  )
}
