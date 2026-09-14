import React, { useMemo } from 'react'
import LeadList from '../LeadList'
import GraphContainer from '../Graph/GraphContainer'
import EntityInspector from '../Inspector/EntityInspector'
import InvestigationTabs from '../Investigation/InvestigationTabs'
import AnalysisSourceBadge from '../AnalysisSourceBadge'

function buildEntityId(entity, selectedWallet) {
  if (entity?.fullId) return entity.fullId

  if (entity?.type && entity?.id) {
    const prefix =
      entity.type === 'transaction'
        ? 'tx'
        : entity.type === 'ip'
          ? 'ip'
          : 'wallet'

    return `${prefix}:${entity.id}`
  }

  if (selectedWallet) {
    return `wallet:${selectedWallet}`
  }

  return null
}

export default function InvestigateView({
  leads,
  graphData,
  transactions,
  clusters,
  analysisSource,
  runStats,
  analyzedAt,
  selectedEntity,
  selectedWallet,
  leadDetail,
  transactionDetail,
  ipDetail,
  onSelectWallet,
  onSelectEntity,
  loadingGraph,
  onGenerateReport,
  reportLoading,
}) {
  const activeEntityId = useMemo(
    () => buildEntityId(selectedEntity, selectedWallet),
    [selectedEntity, selectedWallet]
  )

  const activeWallet =
    selectedEntity?.type === 'wallet'
      ? selectedEntity.id
      : selectedWallet || null

  return (
    <div className="investigate-view">
      <div className="investigation-header-stack">
        <AnalysisSourceBadge
          analysisSource={analysisSource}
          runStats={runStats}
          leads={leads}
          selectedEntity={selectedEntity}
          selectedWallet={selectedWallet}
          transactions={transactions}
          analyzedAt={analyzedAt}
          onGenerateReport={onGenerateReport}
          reportLoading={reportLoading}
        />
      </div>

      <section className="investigation-primary-workspace">
        <div className="investigation-primary-grid">
          <div className="investigation-queue-panel">
            <LeadList
              leads={leads}
              selectedWallet={activeWallet}
              onSelectWallet={onSelectWallet}
            />
          </div>

          <div className="investigation-graph-panel">
            <GraphContainer
              graphData={graphData}
              selectedEntityId={activeEntityId}
              onSelectEntity={onSelectEntity}
              transactions={transactions}
              loading={loadingGraph}
            />
          </div>

          <div className="investigation-inspector-panel">
            <EntityInspector
              selectedEntity={selectedEntity}
              selectedWallet={activeWallet}
              leadDetail={leadDetail}
              transactionDetail={transactionDetail}
              ipDetail={ipDetail}
              clusters={clusters}
              transactions={transactions}
              onSelectEntity={onSelectEntity}
            />
          </div>
        </div>
      </section>

      <section className="investigation-lower-workspace">
        <InvestigationTabs
          wallet={activeWallet}
          selectedEntity={selectedEntity}
          leadDetail={leadDetail}
          transactionDetail={transactionDetail}
          ipDetail={ipDetail}
          transactions={transactions}
          clusters={clusters}
          onSelectTx={(txid) =>
            onSelectEntity({
              type: 'transaction',
              id: txid,
              fullId: `tx:${txid}`,
            })
          }
          onSelectEntity={onSelectEntity}
          onSelectWallet={onSelectWallet}
        />
      </section>
    </div>
  )
}
