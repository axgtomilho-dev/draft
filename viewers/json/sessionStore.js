const STORAGE_KEY = 'jsonview-sessions'
const INDEX_KEY = 'jsonview-session-index'

function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

function readIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY)) || []
  } catch {
    return []
  }
}

function writeIndex(index) {
  try { localStorage.setItem(INDEX_KEY, JSON.stringify(index)) } catch {}
}

function sessionKey(id) {
  return `${STORAGE_KEY}:${id}`
}

export function getSessionFromHash() {
  const hash = window.location.hash.replace('#', '')
  return hash || null
}

export function setHashInUrl(sessionId) {
  const url = new URL(window.location)
  url.hash = sessionId
  window.history.replaceState(null, '', url)
}

export function createSession() {
  const id = generateId()
  const session = {
    id,
    json: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  try { localStorage.setItem(sessionKey(id), JSON.stringify(session)) } catch {}

  const index = readIndex()
  index.unshift({ id, createdAt: session.createdAt, updatedAt: session.updatedAt })
  writeIndex(index)

  return session
}

export function loadSession(id) {
  try {
    const raw = localStorage.getItem(sessionKey(id))
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveSession(session) {
  const updated = { ...session, updatedAt: Date.now() }
  try { localStorage.setItem(sessionKey(session.id), JSON.stringify(updated)) } catch {}

  const index = readIndex()
  const existing = index.findIndex(s => s.id === session.id)
  if (existing >= 0) {
    index[existing].updatedAt = updated.updatedAt
  } else {
    index.unshift({ id: session.id, createdAt: updated.createdAt, updatedAt: updated.updatedAt })
  }
  writeIndex(index)
}

export function initSession() {
  const hashId = getSessionFromHash()

  if (hashId) {
    const session = loadSession(hashId)
    if (session) return session
  }

  const session = createSession()
  setHashInUrl(session.id)
  return session
}
