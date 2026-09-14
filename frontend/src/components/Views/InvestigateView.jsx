import React from 'react'
import LeadList from '../LeadList'
import GraphContainer from '../Graph/GraphContainer'
import EntityInspector from '../Inspector/EntityInspector'
import InvestigationTabs from '../Investigation/InvestigationTabs'
import AnalysisSourceBadge from '../AnalysisSourceBadge'

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
  return (
    <div className="investigate-view">
      <AnalysisSourceBadge
        analysisSource={analysisSource}
        runStats={runStats}
        leadsCount={leads?.length || 0}
        analyzedAt={analyzedAt}
        onGenerateReport={onGenerateReport}
        reportLoading={reportLoading}
      />

      <div className="investigate-columns">
        <aside className="investigate-leads">
          <LeadList
            leads={leads}
            selectedWallet={selectedWallet}
            onSelectWallet={onSelectWallet}
          />
        </aside>

        <main className="investigate-graph">
          <GraphContainer
            graphData={graphData}
            selectedEntityId={selectedEntity?.fullId}
            onSelectEntity={onSelectEntity}
            transactions={transactions}
            loading={loadingGraph}
          />
        </main>

        <aside className="investigate-inspector">
          <EntityInspector
            selectedEntity={selectedEntity}
            leads={leads}
            transactions={transactions}
            clusters={clusters}
            leadDetail={leadDetail}
            transactionDetail={transactionDetail}
            ipDetail={ipDetail}
            onSelectEntity={onSelectEntity}
          />
        </aside>
      </div>

      <InvestigationTabs
        selectedEntity={selectedEntity}
        leadDetail={leadDetail}
        transactionDetail={transactionDetail}
        ipDetail={ipDetail}
        transactions={transactions}
        onSelectEntity={onSelectEntity}
      />
    </div>
  )
}
