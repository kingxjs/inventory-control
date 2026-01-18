export type Session = {
  actor_operator_id: string
  must_change_pwd: boolean
  username?: string
}

const SESSION_KEY = "inventory.session"

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window
}

export function getSession(): Session | null {
  if (!canUseStorage()) return null
  const raw = window.localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export function setSession(session: Session) {
  if (!canUseStorage()) return
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function updateSession(patch: Partial<Session>) {
  const current = getSession()
  if (!current) return
  setSession({ ...current, ...patch })
}

export function clearSession() {
  if (!canUseStorage()) return
  window.localStorage.removeItem(SESSION_KEY)
}
