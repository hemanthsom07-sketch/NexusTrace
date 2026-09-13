import React, { useState, useCallback, useMemo, useEffect } from 'react'
import Login from './components/Login'
import Navigation from './components/Navigation'
import Toast from './components/Toast'
import DashboardView from './components/Views/DashboardView'
import InvestigateView from './components/Views/InvestigateView'
import TransactionsView from './components/Views/TransactionsView'
import AlertsView from './components/Views/AlertsView'
import PipelineView from './components/Views/PipelineView'
import { isAuthenticated, setAuthenticated } from './lib/auth'

import {
  getLeadDetail,
  getGraph,
  listTransactions,
  getTransactionDetail,
  getIpDetail,
  getLeads,
} from './api/client'
import { buildReportHtml } from './lib/report'

// Explicit analysis-session state machine (spec section 16). The frontend
// never silently shows investigation data the user hasn't actually
// produced in this session -- every downstream page keys off this instead
// of just checking whether arrays happen to be non-empty.
const ANALYSIS_STATE = {
  NO_DATA: 'NO_DATA',
  ANALYZING: 'ANALYZING',
  ANALYSIS_COMPLETE: 'ANALYSIS_COMPLETE',
  ERROR: 'ERROR',
}

export default function App() {
  const [authed, setAuthed] = useState(() => isAuthenticated())

  const [activeTab, setActiveTab] = useState('pipeline')
  const [analysisState, setAnalysisState] = useState(ANALYSIS_STATE.NO_DATA)
  const [analysisSource, setAnalysisSource] = useState(null)
  const [runStats, setRunStats] = useState(null)
  const [leads, setLeads] = useState([])
  const [transactions, setTransactions] = useState([])
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })

  const [selectedWallet, setSelectedWallet] = useState(null)
  const [selectedEntity, setSelectedEntity] = useState(null)

  const [leadDetail, setLeadDetail] = useState(null)
  const [transactionDetail, setTransactionDetail] = useState(null)
  const [ipDetail, setIpDetail] = useState(null)

  const [loadingGraph, setLoadingGraph] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [toasts, setToasts] = useState([])
  const [reportLoading, setReportLoading] = useState(false)

  const hasAnalyzed = analysisState === ANALYSIS_STATE.ANALYSIS_COMPLETE

  const stats = useMemo(() => {
    if (!runStats && leads.length === 0) return null
    const highRiskCount = leads.filter((l) => l.severity === 'HIGH').length
    const totalOutAmount = transactions.reduce((sum, tx) => sum + (tx.btc_amount || 0), 0)
    return {
      ...(runStats || {}),
      wallets_count: leads.length,
      high_risk_count: highRiskCount,
      total_out_amount: totalOutAmount,
    }
  }, [runStats, leads, transactions])

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  const closeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  // Wipes every downstream investigation artifact. Called right before a
  // new analysis starts, so a slow request never leaves a stale previous
  // investigation visible underneath a loading indicator, and used again
  // on logout.
  const resetInvestigation = useCallback(() => {
    setLeads([])
    setTransactions([])
    setGraphData({ nodes: [], links: [] })
    setSelectedWallet(null)
    setSelectedEntity(null)
    setLeadDetail(null)
    setTransactionDetail(null)
    setIpDetail(null)
    setRunStats(null)
    setAnalysisSource(null)
  }, [])

  const fetchAllData = useCallback(async () => {
    setLoadingGraph(true)
    try {
      // Promise.allSettled (not .all) is deliberate: /api/leads and
      // /api/graph legitimately 404 ("run pipeline first") when the
      // analysis genuinely produced zero leads or zero correlations for
      // this dataset -- that is a valid empty result, not a failed
      // request, and must never be treated the same as the analysis
      // itself failing. /api/transactions never 404s (always returns a
      // list, possibly empty).
      const [leadsRes, graphRes, txsRes] = await Promise.allSettled([
        getLeads(),
        getGraph(),
        listTransactions(),
      ])

      const loadedLeads = leadsRes.status === 'fulfilled' && Array.isArray(leadsRes.value) ? leadsRes.value : []
      const loadedGraph = graphRes.status === 'fulfilled' && graphRes.value ? graphRes.value : { nodes: [], links: [] }
      const loadedTxs = txsRes.status === 'fulfilled' && Array.isArray(txsRes.value) ? txsRes.value : []

      setLeads(loadedLeads)
      setGraphData(loadedGraph)
      setTransactions(loadedTxs)

      if (loadedLeads.length > 0) {
        const firstWallet = loadedLeads[0].wallet
        setSelectedWallet(firstWallet)
        setSelectedEntity({ type: 'wallet', id: firstWallet, fullId: `wallet:${firstWallet}` })
      }

      // Only warn about a fetch that failed for a real reason (backend
      // down, network error, etc) -- not the expected "run pipeline
      // first" 404 for a dataset with no leads/correlations.
      const unexpectedFailure = [leadsRes, graphRes, txsRes].find(
        (r) => r.status === 'rejected' && !/run pipeline first/i.test(r.reason?.message || '')
      )
      if (unexpectedFailure) {
        showToast(`Some analysis results failed to load: ${unexpectedFailure.reason.message}`, 'error')
      }
    } finally {
      setLoadingGraph(false)
    }
  }, [showToast])

  // Every entry point into a fresh analysis (upload-dual, upload-merged, or
  // the explicit sample run) funnels through this single handler so the
  // NO_DATA -> ANALYZING -> ANALYSIS_COMPLETE state machine is enforced in
  // exactly one place. This is only ever called by PipelineView after a
  // real, successful upload-dual/upload-merged/run response (see the
  // try/catch there) -- so ANALYSIS_COMPLETE always reflects an actual
  // backend result, never a hardcoded value.
  const handleAnalysisStart = useCallback(() => {
    setAnalysisState(ANALYSIS_STATE.ANALYZING)
  }, [])

  const handleAnalysisSuccess = useCallback(
    async (result, sourceMeta) => {
      resetInvestigation()
      setRunStats(result || null)
      setAnalysisSource(sourceMeta || null)
      setLastUpdated(Math.floor(Date.now() / 1000))
      // The analysis itself has already succeeded by the time this runs
      // (the caller only invokes this after a 200 response from
      // upload-dual/upload-merged/run) -- unlock Overview/Investigate/
      // Transactions/Alerts from that real response now, rather than
      // gating the unlock on the follow-up detail fetches below. Those
      // fetches populate the actual leads/graph/transactions data, but
      // whether they find something to show is a separate question from
      // whether the analysis succeeded.
      setAnalysisState(ANALYSIS_STATE.ANALYSIS_COMPLETE)
      showToast('Dataset analyzed successfully.', 'success')
      await fetchAllData()
    },
    [fetchAllData, resetInvestigation, showToast]
  )

  const handleAnalysisError = useCallback(
    (message) => {
      // Keep whatever the previous analysisState was (NO_DATA or
      // ANALYSIS_COMPLETE from an earlier successful run) -- only surface
      // the error, don't force the app into a broken/empty state.
      showToast(message || 'Analysis failed.', 'error')
    },
    [showToast]
  )

  // Builds the final investigation report from the entity currently selected
  // in the investigation workspace. If nothing is selected, fall back to the
  // highest-risk lead so the button remains useful from Overview.
  // plus the detail for each of its related transactions/IPs so the
  // report has real correlation, timeline and GeoIP data rather than
  // whatever partial slice happens to already be in memory.
  const handleGenerateReport = useCallback(async () => {
    const selectedWalletId = selectedEntity?.type === 'wallet' ? selectedEntity.id : null
    const primary = (selectedWalletId && leads.find((lead) => lead.wallet === selectedWalletId)) || leads[0]
    if (!primary) {
      showToast('No investigation leads available to report on.', 'error')
      return
    }
    setReportLoading(true)
    try {
      const primaryLeadDetail = await getLeadDetail(primary.wallet).catch(() => primary)
      const txids = (primaryLeadDetail.related_txids || []).slice(0, 25)
      const ips = (primaryLeadDetail.related_ips || []).slice(0, 10)

      const transactionDetails = (
        await Promise.allSettled(txids.map((txid) => getTransactionDetail(txid)))
      ).filter((r) => r.status === 'fulfilled').map((r) => r.value)

      const ipDetails = (
        await Promise.allSettled(ips.map((ip) => getIpDetail(ip)))
      ).filter((r) => r.status === 'fulfilled').map((r) => r.value)

      const html = buildReportHtml({
        analysisSource,
        runStats,
        leads,
        primaryLeadDetail,
        transactionDetails,
        ipDetails,
        analyzedAt: lastUpdated,
      })

      const reportWindow = window.open('', '_blank')
      if (!reportWindow) {
        showToast('Allow pop-ups to view the generated report.', 'error')
        return
      }
      reportWindow.document.open()
      reportWindow.document.write(html)
      reportWindow.document.close()
    } catch (err) {
      showToast(err.message || 'Failed to generate report.', 'error')
    } finally {
      setReportLoading(false)
    }
  }, [leads, selectedEntity, analysisSource, runStats, lastUpdated, showToast])

  useEffect(() => {
    if (!selectedEntity) {
      setLeadDetail(null)
      setTransactionDetail(null)
      setIpDetail(null)
      return
    }
    const { type, id } = selectedEntity

    if (type === 'wallet') {
      setTransactionDetail(null)
      setIpDetail(null)
      getLeadDetail(id).then(setLeadDetail).catch(() => setLeadDetail(null))
    } else if (type === 'transaction') {
      setLeadDetail(null)
      setIpDetail(null)
      getTransactionDetail(id).then(setTransactionDetail).catch(() => setTransactionDetail(null))
    } else if (type === 'ip') {
      setLeadDetail(null)
      setTransactionDetail(null)
      getIpDetail(id).then(setIpDetail).catch(() => setIpDetail(null))
    }
  }, [selectedEntity])

  const handleSelectWallet = (wallet) => {
    setSelectedWallet(wallet)
    setSelectedEntity({ type: 'wallet', id: wallet, fullId: `wallet:${wallet}` })
  }

  const handleInvestigateWallet = (wallet) => {
    handleSelectWallet(wallet)
    setActiveTab('investigate')
  }

  const handleSelectTx = (txid) => {
    setSelectedEntity({ type: 'transaction', id: txid, fullId: `tx:${txid}` })
    setActiveTab('investigate')
  }

  const handleSelectEntity = (entity) => {
    if (!entity) return
    setSelectedEntity({
      type: entity.type,
      id: entity.id,
      fullId: entity.fullId || `${entity.type === 'transaction' ? 'tx' : entity.type}:${entity.id}`,
    })
    if (entity.type === 'wallet') setSelectedWallet(entity.id)
  }

  const handleGoToPipeline = () => setActiveTab('pipeline')

  const handleLogin = () => setAuthed(true)

  const handleLogout = () => {
    setAuthenticated(false)
    setAuthed(false)
    setActiveTab('pipeline')
    setAnalysisState(ANALYSIS_STATE.NO_DATA)
    resetInvestigation()
  }

  if (!authed) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="app">
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        lastUpdated={lastUpdated}
        hasAnalyzed={hasAnalyzed}
        onLogout={handleLogout}
      />

      <main className="app-content">
        {activeTab === 'dashboard' && (
          <DashboardView
            stats={stats}
            leads={leads}
            transactions={transactions}
            hasAnalyzed={hasAnalyzed}
            analysisSource={analysisSource}
            onInvestigateWallet={handleInvestigateWallet}
            onNavigateTab={setActiveTab}
            onGoToPipeline={handleGoToPipeline}
          />
        )}

        {activeTab === 'investigate' && (
          hasAnalyzed ? (
            <InvestigateView
              leads={leads}
              graphData={graphData}
              transactions={transactions}
              analysisSource={analysisSource}
              runStats={runStats}
              analyzedAt={lastUpdated}
              selectedEntity={selectedEntity}
              selectedWallet={selectedWallet}
              leadDetail={leadDetail}
              transactionDetail={transactionDetail}
              ipDetail={ipDetail}
              onSelectWallet={handleSelectWallet}
              onSelectEntity={handleSelectEntity}
              loadingGraph={loadingGraph}
              onGenerateReport={handleGenerateReport}
              reportLoading={reportLoading}
            />
          ) : (
            <GatedView onGoToPipeline={handleGoToPipeline} />
          )
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            transactions={transactions}
            onSelectTx={handleSelectTx}
            hasAnalyzed={hasAnalyzed}
            onGoToPipeline={handleGoToPipeline}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertsView
            leads={leads}
            onInvestigateWallet={handleInvestigateWallet}
            hasAnalyzed={hasAnalyzed}
            onGoToPipeline={handleGoToPipeline}
          />
        )}

        {activeTab === 'pipeline' && (
          <PipelineView
            onAnalysisStart={handleAnalysisStart}
            onAnalysisSuccess={handleAnalysisSuccess}
            onAnalysisError={handleAnalysisError}
            onShowToast={showToast}
          />
        )}
      </main>

      <Toast toasts={toasts} onClose={closeToast} />
    </div>
  )
}

function GatedView({ onGoToPipeline }) {
  return (
    <div className="gated-view">
      <div className="gated-card">
        <h3>No Active Investigation</h3>
        <p>Analyze a dataset from Dataset Input before opening the investigation workspace.</p>
        <button className="btn btn-primary" onClick={onGoToPipeline}>Go to Dataset Input</button>
      </div>
    </div>
  )
}
