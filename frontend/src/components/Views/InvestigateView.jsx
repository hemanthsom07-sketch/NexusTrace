import React from 'react'
import LeadList from '../LeadList'
import GraphContainer from '../Graph/GraphContainer'
import EntityInspector from '../Inspector/EntityInspector'

export default function InvestigateView({
  leads,
  graphData,
  selectedEntity,
  selectedWallet,
  leadDetail,
  transactionDetail,
  ipDetail,
  onSelectWallet,
  onSelectEntity,
  onSelectTx,
  onSelectIp,
  onFocusInGraph,
  onShowToast,
  loadingGraph,
}) {
  return (
    <div className="investigate-grid">
      {/* Column 1: Investigation Leads */}
      <section className="workspace-panel">
        <div className="panel-header">
          <div className="panel-title">
            <span>Investigation Leads</span>
            <span className="panel-count-badge">{leads.length}</span>
          </div>
        </div>
        <LeadList
          leads={leads}
          selectedWallet={selectedWallet}
          onSelectWallet={onSelectWallet}
        />
      </section>

      {/* Column 2: Centerpiece Force Graph */}
      <section className="workspace-panel" style={{ background: '#05080E' }}>
        <GraphContainer
          graphData={graphData}
          selectedEntityId={selectedEntity?.fullId}
          onSelectEntity={onSelectEntity}
          loading={loadingGraph}
        />
      </section>

      {/* Column 3: Entity Intelligence Inspector */}
      <section className="workspace-panel">
        <div className="panel-header">
          <div className="panel-title">
            <span>Evidence &amp; Intelligence</span>
          </div>
        </div>
        <EntityInspector
          selectedEntity={selectedEntity}
          leadDetail={leadDetail}
          transactionDetail={transactionDetail}
          ipDetail={ipDetail}
          onSelectWallet={onSelectWallet}
          onSelectTx={onSelectTx}
          onSelectIp={onSelectIp}
          onFocusInGraph={onFocusInGraph}
          onShowToast={onShowToast}
        />
      </section>
    </div>
  )
}
