// Short, generic definitions of technical terms/labels used throughout the
// investigation UI. These are factual glossary definitions (what a term
// means), not per-entity claims -- they never vary by dataset and are not
// a substitute for the dynamic, data-driven explanations in explainability.js.

export const GLOSSARY = {
  time_delta: 'Time difference between the network observation and the blockchain transaction.',
  confidence: 'Correlation confidence is a deterministic heuristic based on timing proximity and the observed port signal; it is not a calibrated probability.',
  port_8333: 'Port commonly associated with Bitcoin peer-to-peer network communication.',
  CORRELATED_WITH: 'The system found timing-based evidence linking these two records.',
  SENT_TO: 'The wallet appears as an input to this transaction; this represents a transaction input relationship, not a direct network observation.',
  OUTPUT_TO: 'The transaction contains this wallet as an output address.',
  fan_out: 'Number of distinct outputs associated with funds sent by this wallet.',
  fan_in: 'Number of distinct inputs associated with funds received by this wallet.',
  transaction_velocity: 'How frequently transactions associated with this entity occur during the observed period.',
}

export function portMeaning(port) {
  if (port === 8333 || port === '8333') return GLOSSARY.port_8333
  return 'Network port observed for this connection.'
}
