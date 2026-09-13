// Simple local/demo authentication, as explicitly scoped for this prototype:
// no backend auth infrastructure, but it does actually gate access to the
// application (App.jsx renders <Login/> instead of the app until this
// passes). Credentials are demo-only and are intentionally not displayed
// anywhere in the UI.

const DEMO_USERNAME = 'investigator'
const DEMO_PASSWORD = 'nexustrace-sih26146'
const SESSION_KEY = 'nexustrace_authenticated'

export function checkCredentials(username, password) {
  return username.trim().toLowerCase() === DEMO_USERNAME && password === DEMO_PASSWORD
}

export function isAuthenticated() {
  return sessionStorage.getItem(SESSION_KEY) === 'true'
}

export function setAuthenticated(value) {
  if (value) {
    sessionStorage.setItem(SESSION_KEY, 'true')
  } else {
    sessionStorage.removeItem(SESSION_KEY)
  }
}
