import React from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

export default function Toast({ toasts, onClose }) {
  if (!toasts || toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type || 'info'}`}>
          {t.type === 'success' && <CheckCircle2 size={16} color="#10B981" />}
          {t.type === 'error' && <AlertTriangle size={16} color="#EF4444" />}
          {(!t.type || t.type === 'info') && <Info size={16} color="#0EA5E9" />}
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            onClick={() => onClose(t.id)}
            style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex' }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
