import { useSyncExternalStore } from "react"

export type Session = {
  actor_operator_id: string
  must_change_pwd: boolean
  username?: string
}

const SESSION_KEY = "inventory.session"
const SESSION_EVENT = "inventory:session"
let lastRawSession: string | null = null
let lastParsedSession: Session | null = null

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window
}

function emitSessionChange() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(SESSION_EVENT))
}

export function getSession(): Session | null {
  if (!canUseStorage()) return null
  const raw = window.localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  if (raw === lastRawSession) {
    return lastParsedSession
  }
  try {
    const parsed = JSON.parse(raw) as Session
    lastRawSession = raw
    lastParsedSession = parsed
    return parsed
  } catch {
    return null
  }
}

export function setSession(session: Session) {
  if (!canUseStorage()) return
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  emitSessionChange()
}

export function updateSession(patch: Partial<Session>) {
  const current = getSession()
  if (!current) return
  setSession({ ...current, ...patch })
}

export function clearSession() {
  if (!canUseStorage()) return
  window.localStorage.removeItem(SESSION_KEY)
  lastRawSession = null
  lastParsedSession = null
  emitSessionChange()
}

function subscribeSession(listener: () => void) {
  if (typeof window === "undefined") return () => {}
  const handleStorage = (event: StorageEvent) => {
    if (event.key === SESSION_KEY) {
      listener()
    }
  }
  const handleSessionEvent = () => listener()
  window.addEventListener("storage", handleStorage)
  window.addEventListener(SESSION_EVENT, handleSessionEvent)
  return () => {
    window.removeEventListener("storage", handleStorage)
    window.removeEventListener(SESSION_EVENT, handleSessionEvent)
  }
}

export function useSession() {
  // 通过外部 store 订阅 session 变化，避免在各处手动 getSession。
  return useSyncExternalStore(subscribeSession, getSession, () => null)
}
