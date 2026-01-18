import { invoke } from "@tauri-apps/api/core"
import { getSession } from "./auth"

function normalizeTauriError(err: unknown): Error {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message)
          : ""
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { message?: unknown }
      if (parsed?.message) {
        return new Error(String(parsed.message))
      }
    } catch {
      // ignore json parse errors
    }
    return new Error(raw)
  }
  return new Error("操作失败")
}

export async function tauriInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>
) {
  if (typeof window === "undefined") {
    throw new Error("仅客户端可调用 tauri invoke")
  }
  // 自动注入顶层 actor operator id（若 frontend 没传的话）
  try {
    const session = getSession()
    if (session) {
      const operatorId = (session as any).actor_operator_id as string | undefined
      if (args && operatorId) {
        // shallow clone and inject only top-level actor identifiers
        const cloned = { ...(args as Record<string, unknown>) }
        // inject both snake_case and camelCase variants to be compatible with backend naming
        if (!Object.prototype.hasOwnProperty.call(cloned, "actor_operator_id")) {
          ;(cloned as any).actor_operator_id = operatorId
        }
        // actorOperatorId 对应后端 actor_operator_id 的 camelCase 变体
        if (!Object.prototype.hasOwnProperty.call(cloned, "actorOperatorId")) {
          ;(cloned as any).actorOperatorId = operatorId
        }
        args = cloned
      }
    }
    return await invoke<T>(cmd, args)
  } catch (err) {
    throw normalizeTauriError(err)
  }
}
