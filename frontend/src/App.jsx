import React, { useState, useEffect, useCallback } from 'react'
import Navigation from './components/Navigation'
import Toast from './components/Toast'
import InvestigateView from './components/Views/InvestigateView'
import DashboardView from './components/Views/DashboardView'
import TransactionsView from './components/Views/TransactionsView'
import AlertsView from './components/Views/AlertsView'
import PipelineView from './components/Views/PipelineView'
import GraphContainer from './components/Graph/GraphContainer'
import {
  getLeads,
  getGraph,
  getStats,
  getTransactions,
  getLeadDetail,
  getTransactionDetail,
  runPipeline,
} from './api/client'

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard') // dashboard | investigate | transactions | graph | alerts | pipeline
  const [leads, setLeads] = useState([])
  const [graphData, setGraphData] = useState(null)
  const [stats, setStats] = useState(null)
  const [transactions, setTransactions] = useState([])

  // Global entity selection
  const [selectedEntity, setSelectedEntity] = useState(null) // { type: 'wallet'|'transaction'|'ip', id, fullId }
  const [leadDetail, setLeadDetail] = useState(null)
  const [txDetail, setTxDetail] = useState(null)
  const [ipDetail, setIpDetail] = useState(null)

  const [pipelineStatus, setPipelineStatus] = useState('ready')
  const [isRunning, setIsRunning] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [toasts, setToasts] = useState([])
  const [loadingInitial, setLoadingInitial] = useState(true)

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const closeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Synchronize entire intelligence dataset
  const refreshData = useCallback(async (selectTopWallet = false) => {
    try {
      const [leadsRes, graphRes, statsRes, txRes] = await Promise.all([
        getLeads().catch(() => []),
        getGraph().catch(() => null),
        getStats().catch(() => null),
        getTransactions().catch(() => []),
      ])

      setLeads(leadsRes)
      setGraphData(graphRes)
      setStats(statsRes)
      setTransactions(txRes)
      setLastUpdated(statsRes?.last_updated || Date.now() / 1000)
      setPipelineStatus('ready')

      // Auto-select planted anomaly W_A12 or top lead
      if (selectTopWallet || !selectedEntity) {
        const targetWallet = leadsRes.find((l) => l.wallet === 'W_A12') || leadsRes[0]
        if (targetWallet) {
          setSelectedEntity({
            type: 'wallet',
            id: targetWallet.wallet,
            fullId: `wallet:${targetWallet.wallet}`,
          })
          setLeadDetail(targetWallet)
        }
      }
    } catch (err) {
      console.warn('Initial data synchronization check:', err.message)
    } finally {
      setLoadingInitial(false)
    }
  }, [selectedEntity])

  // FIX #14: Initial load on application mount
  useEffect(() => {
    refreshData(true)
  }, [])

  // Handle entity selection (Wallet)
  const handleSelectWallet = useCallback(
    (wallet) => {
      const local = leads.find((l) => l.wallet === wallet)
      setSelectedEntity({
        type: 'wallet',
        id: wallet,
        fullId: `wallet:${wallet}`,
      })
      if (local) {
        setLeadDetail(local)
      }
      // Background fetch for extra GeoIP enrichment details if not in memory
      getLeadDetail(wallet)
        .then((full) => setLeadDetail(full))
        .catch(() => {})
    },
    [leads]
  )

  // Handle entity selection (Transaction)
  const handleSelectTx = useCallback(
    (txid) => {
      const local = transactions.find((t) => t.txid === txid)
      setSelectedEntity({
        type: 'transaction',
        id: txid,
        fullId: `tx:${txid}`,
      })
      if (local) {
        setTxDetail(local)
      }
      getTransactionDetail(txid)
        .then((full) => setTxDetail(full))
        .catch(() => {})
    },
    [transactions]
  )

  // Handle entity selection (IP)
  const handleSelectIp = useCallback(
    (ip) => {
      setSelectedEntity({
        type: 'ip',
        id: ip,
        fullId: `ip:${ip}`,
      })
      // Find any lead with this IP to grab GeoIP details
      const parentLead = leads.find((l) => l.related_ips?.includes(ip))
      const geo = parentLead?.related_ips_details?.find((g) => g.ip === ip)
      setIpDetail(geo || { ip })
    },
    [leads]
  )

  // Handle clicking on any node directly in 2D/3D graph
  const handleSelectGraphEntity = useCallback(
    ({ type, id, fullId, node }) => {
      if (type === 'wallet') {
        handleSelectWallet(id)
      } else if (type === 'transaction') {
        handleSelectTx(id)
      } else if (type === 'ip') {
        handleSelectIp(id)
      }
    },
    [handleSelectWallet, handleSelectTx, handleSelectIp]
  )

  // Navigate directly to triage workspace with chosen target
  const handleInvestigateWallet = useCallback(
    (wallet) => {
      handleSelectWallet(wallet)
      setActiveTab('investigate')
    },
    [handleSelectWallet]
  )

  // Quick Run Pipeline trigger from navigation
  const handleQuickRun = async () => {
    setIsRunning(true)
    setPipelineStatus('running')
    showToast('Executing cross-layer correlation pipeline…', 'info')
    try {
      const res = await runPipeline()
      showToast(
        `Pipeline complete: ${res.events_ingested} events, ${res.transactions_ingested} txs, ${res.leads_generated} leads.`,
        'success'
      )
      await refreshData(false)
    } catch (err) {
      setPipelineStatus('error')
      showToast(`Pipeline execution failed: ${err.message}`, 'error')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="app-shell">
      {/* Top Application Header */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pipelineStatus={pipelineStatus}
        lastUpdated={lastUpdated}
        onRunPipeline={handleQuickRun}
        isRunning={isRunning}
      />

      {/* Main Workspace Area */}
      <main className="app-content">
        {activeTab === 'dashboard' && (
          <DashboardView
            stats={stats}
            leads={leads}
            onInvestigateWallet={handleInvestigateWallet}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'investigate' && (
          <InvestigateView
            leads={leads}
            graphData={graphData}
            selectedEntity={selectedEntity}
            selectedWallet={selectedEntity?.type === 'wallet' ? selectedEntity.id : null}
            leadDetail={leadDetail}
            transactionDetail={txDetail}
            ipDetail={ipDetail}
            onSelectWallet={handleSelectWallet}
            onSelectEntity={handleSelectGraphEntity}
            onSelectTx={(txid) => {
              handleSelectTx(txid)
            }}
            onSelectIp={(ip) => {
              handleSelectIp(ip)
            }}
            onFocusInGraph={(entityFullId) => {
              setSelectedEntity((prev) => ({ ...(prev || {}), fullId: entityFullId }))
            }}
            onShowToast={showToast}
            loadingGraph={loadingInitial}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            transactions={transactions}
            onSelectTx={(txid) => {
              handleSelectTx(txid)
              setActiveTab('investigate')
            }}
            onFocusInGraph={(txNodeId) => {
              const txid = txNodeId.replace(/^tx:/, '')
              handleSelectTx(txid)
              setActiveTab('investigate')
            }}
            onInvestigateWallet={handleInvestigateWallet}
          />
        )}

        {activeTab === 'graph' && (
          <div style={{ height: '100%', width: '100%', position: 'relative' }}>
            <GraphContainer
              graphData={graphData}
              selectedEntityId={selectedEntity?.fullId}
              onSelectEntity={handleSelectGraphEntity}
              loading={loadingInitial}
            />
          </div>
        )}

        {activeTab === 'alerts' && (
          <AlertsView
            leads={leads}
            onInvestigateWallet={handleInvestigateWallet}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'pipeline' && (
          <PipelineView
            onPipelineSuccess={async () => {
              await refreshData(true)
              setActiveTab('investigate')
            }}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Floating Toast Notification Stack */}
      <Toast toasts={toasts} onClose={closeToast} />
    </div>
  )
}
