import React, { useEffect, useMemo, useState } from 'react'
import {
  Search,
  ArrowUpRight,
  ShieldAlert,
  Activity,
  Radio,
  Database,
} from 'lucide-react'
import { formatTime, formatPercent } from '../../lib/format'
import { getLeads } from '../../api/client'

/*
 * Transaction risk is derived from the behavioral risk of the wallets
 * involved in the transaction.
 *
 * Correlation confidence remains a separate field:
 *   - RISK       = how anomalous the related wallet behavior is
 *   - CORRELATION = how confidently network telemetry matches the transaction
 *
 * This keeps the Transactions page consistent with the Investigation Queue
 * instead of incorrectly using correlation confidence as transaction risk.
 */

const RISK_ORDER = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
}

function severityFromScore(score) {
  const value = typeof score === 'number' ? score : Number(score)

  if (!Number.isFinite(value)) return 'LOW'
  if (value >= 0.66) return 'HIGH'
  if (value >= 0.33) return 'MEDIUM'
  return 'LOW'
}

function getRisk(tx, leadByWallet) {
  /*
   * A transaction's primary risk is the behavioral risk of its SENDER.
   * For Bitcoin transaction records, input_addresses are the sender-side
   * entities. We intentionally do not promote a transaction to HIGH merely
   * because one of its output wallets is high-risk.
   *
   * This makes the transaction filter consistent with the investigation
   * story: "Which sender behavior produced this transaction?"
   */
  const inputWallets = Array.isArray(tx.input_addresses)
    ? tx.input_addresses
    : []

  let bestLead = null
  let bestScore = -1

  for (const wallet of inputWallets) {
    const lead = leadByWallet.get(wallet)
    if (!lead) continue

    const score =
      typeof lead.anomaly_score === 'number'
        ? lead.anomaly_score
        : Number(lead.anomaly_score)

    if (Number.isFinite(score) && score > bestScore) {
      bestLead = lead
      bestScore = score
    } else if (!bestLead) {
      bestLead = lead
    }
  }

  /*
   * If the sender is not scored, fall back to any scored output wallet.
   * This keeps the UI useful for incomplete datasets without changing the
   * primary sender-risk semantics.
   */
  if (!bestLead) {
    const outputWallets = Array.isArray(tx.output_addresses)
      ? tx.output_addresses
      : []

    for (const wallet of outputWallets) {
      const lead = leadByWallet.get(wallet)
      if (!lead) continue

      const score =
        typeof lead.anomaly_score === 'number'
          ? lead.anomaly_score
          : Number(lead.anomaly_score)

      if (Number.isFinite(score) && score > bestScore) {
        bestLead = lead
        bestScore = score
      }
    }
  }

  if (!bestLead) {
    const confidence =
      typeof tx.confidence === 'number' ? tx.confidence : Number(tx.confidence)

    if (!Number.isFinite(confidence) || confidence <= 0) {
      return { label: 'UNLINKED', className: 'unlinked', score: null }
    }

    return { label: 'LOW', className: 'low', score: 0 }
  }

  const score =
    typeof bestLead.anomaly_score === 'number'
      ? bestLead.anomaly_score
      : Number(bestLead.anomaly_score)

  const label =
    bestLead.severity || severityFromScore(Number.isFinite(score) ? score : 0)

  return {
    label,
    className: label.toLowerCase(),
    score: Number.isFinite(score) ? score : 0,
  }
}

function getInputCount(tx) {
  return Array.isArray(tx.input_addresses)
    ? tx.input_addresses.length
    : 0
}

function getOutputCount(tx) {
  return Array.isArray(tx.output_addresses)
    ? tx.output_addresses.length
    : 0
}

export default function TransactionsView({
  transactions = [],
  onSelectTx,
  hasAnalyzed = true,
  onGoToPipeline,
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [leads, setLeads] = useState([])

  /*
   * Fetch the same wallet-risk dataset used by Investigation Queue.
   * This keeps TransactionsView self-contained and avoids requiring an App.jsx
   * prop change just to synchronize the severity model.
   */
  useEffect(() => {
    let cancelled = false

    if (!hasAnalyzed) {
      setLeads([])
      return undefined
    }

    getLeads()
      .then((result) => {
        if (!cancelled) {
          setLeads(Array.isArray(result) ? result : [])
        }
      })
      .catch(() => {
        if (!cancelled) setLeads([])
      })

    return () => {
      cancelled = true
    }
  }, [hasAnalyzed, transactions.length])

  const leadByWallet = useMemo(
    () => new Map(leads.map((lead) => [lead.wallet, lead])),
    [leads],
  )

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase()

    return transactions.filter((tx) => {
      const risk = getRisk(tx, leadByWallet)

      const matchesFilter =
        filter === 'ALL' ||
        (filter === 'CORRELATED' && tx.correlated_ip) ||
        (filter === 'UNLINKED' && !tx.correlated_ip) ||
        risk.label === filter

      if (!matchesFilter) return false

      if (!query) return true

      const searchable = [
        tx.txid,
        tx.correlated_ip,
        ...(tx.input_addresses || []),
        ...(tx.output_addresses || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchable.includes(query)
    })
  }, [transactions, search, filter, leadByWallet])

  const stats = useMemo(() => {
    const correlated = transactions.filter((tx) => tx.correlated_ip).length

    const high = transactions.filter(
      (tx) => getRisk(tx, leadByWallet).label === 'HIGH',
    ).length

    const totalBtc = transactions.reduce(
      (sum, tx) =>
        sum + (typeof tx.btc_amount === 'number' ? tx.btc_amount : 0),
      0,
    )

    return {
      total: transactions.length,
      correlated,
      high,
      totalBtc,
    }
  }, [transactions, leadByWallet])

  if (transactions.length === 0) {
    return (
      <div className="transactions-view">
        <div className="transactions-header">
          <div>
            <div className="section-eyebrow">BLOCKCHAIN ACTIVITY</div>
            <h2>Transactions</h2>
          </div>
          <span>0 transactions</span>
        </div>

        <div className="empty-state">
          {hasAnalyzed ? (
            <p>No transactions in the analyzed dataset.</p>
          ) : (
            <>
              <p>No dataset has been analyzed yet.</p>
              {onGoToPipeline && (
                <button
                  className="btn btn-primary"
                  onClick={onGoToPipeline}
                >
                  Go to Dataset Input
                </button>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="transactions-view">
      <div className="transactions-header">
        <div>
          <div className="section-eyebrow">BLOCKCHAIN ACTIVITY</div>
          <h2>Transaction Intelligence</h2>
          <p>
            Inspect blockchain transactions and their cross-layer network
            correlations.
          </p>
        </div>

        <div className="transactions-header-count">
          {filteredTransactions.length} / {transactions.length}
        </div>
      </div>

      <div className="transaction-summary-strip">
        <div className="transaction-summary-item">
          <Database size={16} />
          <div>
            <span>Total Transactions</span>
            <strong>{stats.total}</strong>
          </div>
        </div>

        <div className="transaction-summary-item">
          <Radio size={16} />
          <div>
            <span>Network Correlated</span>
            <strong>{stats.correlated}</strong>
          </div>
        </div>

        <div className="transaction-summary-item">
          <ShieldAlert size={16} />
          <div>
            <span>High Risk</span>
            <strong>{stats.high}</strong>
          </div>
        </div>

        <div className="transaction-summary-item">
          <Activity size={16} />
          <div>
            <span>Observed Output</span>
            <strong>{stats.totalBtc.toFixed(4)} BTC</strong>
          </div>
        </div>
      </div>

      <div className="transactions-toolbar">
        <div className="transaction-search">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search TXID, wallet address or IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="transaction-filters">
          {['ALL', 'HIGH', 'MEDIUM', 'LOW', 'CORRELATED', 'UNLINKED'].map(
            (item) => (
              <button
                key={item}
                type="button"
                className={`transaction-filter ${
                  filter === item ? 'active' : ''
                }`}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="transactions-table-wrapper">
        {filteredTransactions.length === 0 ? (
          <div className="empty-state compact">
            <p>No transactions match the current filters.</p>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSearch('')
                setFilter('ALL')
              }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <table className="transactions-table">
            <thead>
              <tr>
                <th>RISK</th>
                <th>TXID</th>
                <th>TIME</th>
                <th>FLOW</th>
                <th>OUTPUT</th>
                <th>FEE</th>
                <th>NETWORK OBSERVATION</th>
                <th>CORRELATION</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {filteredTransactions.map((tx) => {
                const risk = getRisk(tx, leadByWallet)
                const inputCount = getInputCount(tx)
                const outputCount = getOutputCount(tx)

                return (
                  <tr
                    key={tx.txid}
                    onClick={() => onSelectTx(tx.txid)}
                    className="transaction-row"
                  >
                    <td>
                      <span
                        className={`transaction-risk-badge ${risk.className}`}
                      >
                        {risk.label}
                      </span>
                    </td>

                    <td className="txid">
                      <div className="transaction-id-cell">
                        <strong>{tx.txid}</strong>
                        <span>Open investigation</span>
                      </div>
                    </td>

                    <td>
                      <span className="transaction-time">
                        {formatTime(tx.timestamp)}
                      </span>
                    </td>

                    <td>
                      <div className="transaction-flow">
                        <span>{inputCount} in</span>
                        <ArrowUpRight size={13} />
                        <span>{outputCount} out</span>
                      </div>
                    </td>

                    <td>
                      <strong className="transaction-btc">
                        {typeof tx.btc_amount === 'number'
                          ? tx.btc_amount
                          : 0}{' '}
                        BTC
                      </strong>
                    </td>

                    <td>
                      {typeof tx.fee === 'number' ? `${tx.fee} BTC` : '—'}
                    </td>

                    <td>
                      {tx.correlated_ip ? (
                        <div className="transaction-network-cell">
                          <span className="network-status-dot" />
                          <span className="txid">{tx.correlated_ip}</span>
                        </div>
                      ) : (
                        <span className="transaction-unlinked">
                          No network match
                        </span>
                      )}
                    </td>

                    <td>
                      {typeof tx.confidence === 'number' ? (
                        <div className="transaction-confidence">
                          <span>{formatPercent(tx.confidence)}</span>
                          <div className="transaction-confidence-bar">
                            <div
                              style={{
                                width: `${Math.max(
                                  0,
                                  Math.min(100, tx.confidence * 100),
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="transaction-unlinked">—</span>
                      )}
                    </td>

                    <td>
                      <ArrowUpRight
                        size={15}
                        className="transaction-open-icon"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="transactions-footer-note">
        <span>
          Risk reflects the behavioral anomaly severity of the primary
          sender wallet. Correlation separately shows network-to-blockchain
          match confidence.
        </span>
      </div>
    </div>
  )
}
