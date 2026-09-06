// api/client.js -- Cyber Intelligence API Client
// Uses VITE_API_BASE if provided, otherwise falls back to relative path (Vite proxy / production reverse proxy)

const API_BASE = import.meta.env.VITE_API_BASE || ''

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData
  const headers = isFormData
    ? { ...(options.headers || {}) }
    : { 'Content-Type': 'application/json', ...(options.headers || {}) }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

export function runPipeline(networkCsv = null, txJson = null) {
  const params = new URLSearchParams()
  if (networkCsv) params.append('network_csv', networkCsv)
  if (txJson) params.append('tx_json', txJson)
  const qs = params.toString() ? `?${params.toString()}` : ''
  return request(`/api/pipeline/run${qs}`, { method: 'POST' })
}

export function uploadPipeline(formData) {
  return request('/api/pipeline/upload', {
    method: 'POST',
    body: formData,
  })
}

export function getStats() {
  return request('/api/stats')
}

export function getLeads() {
  return request('/api/leads')
}

export function getLeadDetail(wallet) {
  return request(`/api/leads/${encodeURIComponent(wallet)}`)
}

export function getGraph() {
  return request('/api/graph')
}

export function getSubgraph(entityId, hops = 1) {
  return request(`/api/graph/subgraph/${encodeURIComponent(entityId)}?hops=${hops}`)
}

export function getTransactions() {
  return request('/api/transactions')
}

export function getTransactionDetail(txid) {
  return request(`/api/transactions/${encodeURIComponent(txid)}`)
}

