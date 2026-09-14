const API_BASE = 'http://localhost:8000'

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

export function runPipeline() {
  return request('/api/pipeline/run', { method: 'POST' })
}

export async function uploadPipeline(formData) {
  const res = await fetch(`${API_BASE}/api/pipeline/upload`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Upload failed: ${res.status}`)
  }
  return res.json()
}

export async function uploadPipelineDual(networkFile, blockchainFile) {
  const formData = new FormData()
  formData.append('network_file', networkFile)
  formData.append('blockchain_file', blockchainFile)
  const res = await fetch(`${API_BASE}/api/pipeline/upload-dual`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = body.detail
    const err = new Error(
      typeof detail === 'string' ? detail : detail?.message || `Request failed: ${res.status}`
    )
    err.validation = typeof detail === 'object' ? detail : null
    throw err
  }
  return res.json()
}

export async function uploadPipelineMerged(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/api/pipeline/upload-merged`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const detail = body.detail
    const err = new Error(
      typeof detail === 'string' ? detail : detail?.message || `Request failed: ${res.status}`
    )
    err.validation = typeof detail === 'object' ? detail : null
    throw err
  }
  return res.json()
}

export function getLeads() {
  return request('/api/leads')
}

export function getLeadDetail(wallet) {
  return request(`/api/leads/${encodeURIComponent(wallet)}`)
}

export function getClusters() {
  return request('/api/clusters')
}

export function getGraph() {
  return request('/api/graph')
}

export function listTransactions() {
  return request('/api/transactions')
}

export function getTransactionDetail(txid) {
  return request(`/api/transactions/${encodeURIComponent(txid)}`)
}

export function getIpDetail(ip) {
  return request(`/api/ip/${encodeURIComponent(ip)}`)
}