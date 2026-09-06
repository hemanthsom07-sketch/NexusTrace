import React, { useState, useMemo } from 'react'
import { Search, Layers, ArrowRight, Crosshair, Globe, Wallet } from 'lucide-react'

export default function TransactionsView({
  transactions = [],
  onSelectTx,
  onFocusInGraph,
  onInvestigateWallet,
}) {
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return transactions
    const q = searchTerm.trim().toLowerCase()
    return transactions.filter((tx) => {
      if (tx.txid.toLowerCase().includes(q)) return true
      if (tx.input_addresses?.some((a) => a.toLowerCase().includes(q))) return true
      if (tx.output_addresses?.some((a) => a.toLowerCase().includes(q))) return true
      if (tx.correlated_ips?.some((ip) => ip.toLowerCase().includes(q))) return true
      return false
    })
  }, [transactions, searchTerm])

  return (
    <div className="full-view-container">
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9', marginBottom: 2 }}>
            On-Chain Blockchain Transactions
          </h2>
          <p style={{ fontSize: 12, color: '#94A3B8' }}>
            Ingested Bitcoin blockchain ledger records with cross-layer network correlations.
          </p>
        </div>

        <div className="search-input-wrapper" style={{ width: 280 }}>
          <Search size={14} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search TXID, address, or IP…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Transactions Ledger Table */}
      <div className="data-table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>TXID</th>
              <th>Timestamp</th>
              <th>Input Wallets (Sources)</th>
              <th>Output Wallets (Dests)</th>
              <th>Total BTC</th>
              <th>Correlated P2P IP</th>
              <th>Confidence</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#64748B' }}>
                  No transactions match the search filter.
                </td>
              </tr>
            ) : (
              filtered.map((tx) => {
                const inSum = (tx.input_amounts || []).reduce((a, b) => a + b, 0)
                const outSum = (tx.output_amounts || []).reduce((a, b) => a + b, 0)
                const confPct = ((tx.confidence_max ?? 0) * 100).toFixed(0)

                return (
                  <tr key={tx.txid}>
                    <td>
                      <span
                        style={{
                          fontFamily: 'ui-monospace',
                          fontWeight: 700,
                          color: '#06B6D4',
                          cursor: 'pointer',
                        }}
                        onClick={() => onSelectTx(tx.txid)}
                        title="Click to inspect this transaction"
                      >
                        {tx.txid}
                      </span>
                    </td>
                    <td style={{ fontSize: 11.5, color: '#94A3B8', fontFamily: 'ui-monospace' }}>
                      {tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleTimeString() : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(tx.input_addresses || []).map((addr) => (
                          <button
                            key={addr}
                            className="evidence-chip"
                            style={{ padding: '1px 5px', fontSize: 10.5 }}
                            onClick={() => onInvestigateWallet(addr)}
                            title={`Investigate wallet ${addr}`}
                          >
                            <Wallet size={9} />
                            <span>{addr}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(tx.output_addresses || []).map((addr) => (
                          <button
                            key={addr}
                            className="evidence-chip"
                            style={{ padding: '1px 5px', fontSize: 10.5 }}
                            onClick={() => onInvestigateWallet(addr)}
                            title={`Investigate wallet ${addr}`}
                          >
                            <Wallet size={9} />
                            <span>{addr}</span>
                          </button>
                        ))}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'ui-monospace', fontWeight: 600 }}>
                      {outSum.toFixed(2)} BTC
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(tx.correlated_ips || []).map((ip) => (
                          <span
                            key={ip}
                            className="evidence-chip ip"
                            style={{ padding: '1px 5px', fontSize: 10.5 }}
                          >
                            <Globe size={9} />
                            <span>{ip}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'ui-monospace',
                          fontWeight: 600,
                          color: tx.confidence_max >= 0.9 ? '#10B981' : '#F59E0B',
                        }}
                      >
                        {confPct}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn-secondary"
                        style={{ fontSize: 11, padding: '3px 8px' }}
                        onClick={() => {
                          onSelectTx(tx.txid)
                          if (onFocusInGraph) onFocusInGraph(`tx:${tx.txid}`)
                        }}
                        title="Focus in 2D/3D Network Graph"
                      >
                        <Crosshair size={11} />
                        <span>Graph</span>
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
