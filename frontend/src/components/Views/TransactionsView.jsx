import React from 'react'
import { formatTime, formatPercent } from '../../lib/format'

export default function TransactionsView({
  transactions = [],
  onSelectTx,
  hasAnalyzed = true,
  onGoToPipeline,
}) {
  return (
    <div className="transactions-view">
      <div className="transactions-header">
        <h2>Transactions</h2>
        <span>{transactions.length} transactions</span>
      </div>

      {transactions.length === 0 ? (
        <div className="empty-state">
          {hasAnalyzed ? (
            <p>No transactions in the analyzed dataset.</p>
          ) : (
            <>
              <p>No dataset has been analyzed yet.</p>
              {onGoToPipeline && (
                <button className="btn btn-primary" onClick={onGoToPipeline}>
                  Go to Dataset Input
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="transactions-table-wrapper">
          <table className="transactions-table">
            <thead>
              <tr>
                <th>TXID</th>
                <th>Time</th>
                <th>Inputs</th>
                <th>Outputs</th>
                <th>BTC Amount</th>
                <th>Fee</th>
                <th>Correlated IP</th>
                <th>Confidence</th>
              </tr>
            </thead>

            <tbody>
              {transactions.map((tx) => (
                <tr
                  key={tx.txid}
                  onClick={() => onSelectTx(tx.txid)}
                  className="transaction-row"
                >
                  <td className="txid">{tx.txid}</td>
                  <td>{formatTime(tx.timestamp)}</td>
                  <td>{tx.input_addresses?.join(', ') || 'None'}</td>
                  <td>{tx.output_addresses?.join(', ') || 'None'}</td>
                  <td>{typeof tx.btc_amount === 'number' ? tx.btc_amount : 0} BTC</td>
                  <td>{tx.fee ?? '—'}</td>
                  <td className="txid">{tx.correlated_ip || 'None'}</td>
                  <td>{formatPercent(tx.confidence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
