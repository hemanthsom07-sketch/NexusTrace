export function formatTime(ts) {
  if (ts === null || ts === undefined || ts === '') return 'Unknown'
  const date = new Date(typeof ts === 'number' ? ts * 1000 : ts)
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString()
}

export function formatBtc(value) {
  if (typeof value !== 'number') return '0 BTC'
  return `${value} BTC`
}

export function formatPercent(value) {
  if (typeof value !== 'number') return 'N/A'
  return `${Math.round(value * 100)}%`
}
