import React from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

export default function Toast({ toasts = [], onClose }) {
  if (!toasts.length) return null

  return (
    <div
      className="toast-container"
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {toasts.map((toast) => {
        const isError = toast.type === 'error'
        const isSuccess = toast.type === 'success'

        return (
          <div
            key={toast.id}
            className={`toast ${
              isError
                ? 'toast-error'
                : isSuccess
                  ? 'toast-success'
                  : 'toast-info'
            }`}
          >
            <div className="toast-icon">
              {isError ? (
                <AlertCircle size={20} />
              ) : isSuccess ? (
                <CheckCircle2 size={20} />
              ) : (
                <Info size={20} />
              )}
            </div>

            <div className="toast-message">
              {toast.message}
            </div>

            <button
              onClick={() => onClose(toast.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Close notification"
            >
              <X size={18} />
            </button>
          </div>
        )
      })}
    </div>
  )
}