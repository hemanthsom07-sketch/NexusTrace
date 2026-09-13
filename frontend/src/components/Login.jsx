import React, { useState } from 'react'
import { Lock, User, AlertCircle, Eye, EyeOff, ShieldCheck, GitBranch, Radar } from 'lucide-react'
import { checkCredentials, setAuthenticated } from '../lib/auth'

// Folded-ribbon "N" brand mark -- a static, deterministic SVG (no external
// image asset) built from a handful of polygons so it reads as a distinct
// logotype rather than a generic icon-in-a-box.
function BrandMark({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="brandMarkGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="55%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <polygon points="6,14 20,6 20,20 6,28" fill="url(#brandMarkGrad)" opacity="0.95" />
      <polygon points="20,6 42,18 28,26 20,20" fill="#818cf8" opacity="0.85" />
      <polygon points="6,28 20,20 20,34 6,42" fill="#4338ca" opacity="0.9" />
      <polygon points="20,20 28,26 42,18 42,32 28,40 20,34" fill="url(#brandMarkGrad)" />
    </svg>
  )
}

// Deterministic "network intelligence" globe -- pure SVG, no external image
// asset. Node positions/arcs/leader-lines are fixed values (not randomized
// per render), so the visual is stable across reloads.
function IntelGlobe() {
  const coins = [
    [175, 205], [355, 270], [440, 155], [235, 355],
  ]
  const dots = [
    [265, 120], [520, 235], [230, 290], [310, 330], [470, 270], [200, 150], [470, 340],
  ]
  return (
    <svg viewBox="0 0 700 420" className="login-globe-svg" aria-hidden="true">
      <defs>
        <radialGradient id="globeGlow" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="rgba(56,189,248,0.20)" />
          <stop offset="100%" stopColor="rgba(56,189,248,0)" />
        </radialGradient>
        <linearGradient id="globeStroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <circle cx="350" cy="210" r="230" fill="url(#globeGlow)" />
      <circle cx="350" cy="210" r="160" fill="none" stroke="url(#globeStroke)" strokeWidth="1.2" opacity="0.55" />
      {[70, 105, 135].map((ry, i) => (
        <ellipse key={i} cx="350" cy="210" rx="160" ry={ry} fill="none" stroke="#38bdf8" strokeWidth="0.8" opacity="0.32" />
      ))}
      {[40, 80, 120].map((rx, i) => (
        <ellipse key={i} cx="350" cy="210" rx={rx} ry="160" fill="none" stroke="#8b5cf6" strokeWidth="0.8" opacity="0.28" />
      ))}

      {/* connecting arcs between evidence points, purely decorative */}
      {[[175, 205, 440, 155], [355, 270, 470, 270], [235, 355, 175, 205], [440, 155, 470, 340]].map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6366f1" strokeWidth="0.8" opacity="0.35" />
      ))}

      {dots.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="2.6" fill="#38bdf8" />
          <circle cx={x} cy={y} r="6" fill="none" stroke="#38bdf8" strokeWidth="0.7" opacity="0.5" />
        </g>
      ))}

      {coins.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="13" fill="#0e1626" stroke="#38bdf8" strokeWidth="1.4" />
          <text x={x} y={y + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#38bdf8">&#8383;</text>
        </g>
      ))}

      {/* leader lines from the four corner annotations to the globe */}
      <line x1="70" y1="55" x2="182" y2="185" stroke="#475569" strokeWidth="1" opacity="0.6" />
      <line x1="630" y1="55" x2="518" y2="185" stroke="#475569" strokeWidth="1" opacity="0.6" />
      <line x1="70" y1="365" x2="205" y2="290" stroke="#475569" strokeWidth="1" opacity="0.6" />
      <line x1="630" y1="365" x2="495" y2="290" stroke="#475569" strokeWidth="1" opacity="0.6" />
    </svg>
  )
}

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      setError('Enter both a username and password.')
      return
    }
    if (!checkCredentials(username, password)) {
      setError('Invalid credentials. Access denied.')
      return
    }
    setAuthenticated(true)
    setError('')
    onLogin()
  }

  return (
    <div className="login-screen">
      <div className="login-split">
        <div className="login-left">
          <div className="login-brand">
            <BrandMark />
            <div>
              <h1>
                Nexus<span className="brand-accent">Trace</span>
              </h1>
              <div className="brand-subtitle">TRACE &bull; ANALYZE &bull; INVESTIGATE</div>
            </div>
          </div>

          <h2 className="login-headline">
            Uncover Illicit Flows<br />
            <span className="login-headline-accent">Secure a Safer Tomorrow</span>
          </h2>
          <p className="login-subline">Bitcoin Transaction Intelligence &bull; Network Analysis &bull; Real Impact</p>

          <div className="login-card">
            <h3>Investigator Login</h3>
            <p className="login-card-sub">Access the NexusTrace Investigation Platform</p>

            <form onSubmit={handleSubmit} className="login-form">
              <label className="login-label">Username</label>
              <div className="login-field">
                <User size={15} />
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                />
              </div>

              <label className="login-label">Password</label>
              <div className="login-field">
                <Lock size={15} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {error && (
                <div className="login-error">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" className="btn btn-primary login-submit">
                Sign In &rarr;
              </button>
            </form>
          </div>

          <div className="login-capabilities">
            <div className="login-capability">
              <ShieldCheck size={18} />
              <span>Detect<br />Anomalies</span>
            </div>
            <div className="login-capability">
              <GitBranch size={18} />
              <span>Correlate<br />Evidence</span>
            </div>
            <div className="login-capability">
              <Radar size={18} />
              <span>Enable<br />Investigations</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

