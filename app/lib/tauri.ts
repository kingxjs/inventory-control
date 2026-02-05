import { invoke } from "@tauri-apps/api/core";
import { getSession } from "./auth";

// 平台检测
export const isMobile = () => {
  if (typeof window === "undefined") return false;
  const userAgent = navigator.userAgent.toLowerCase();
  // 支持 Android、iOS、鸿蒙（HarmonyOS）平板
  return /android|iphone|ipad|ipod|harmonyos/.test(userAgent);
};

// 触发系统分享功能（移动端）
export async function shareFile(filePath: string) {
  if (!isMobile()) {
    throw new Error("分享功能仅在移动端可用");
  }
  
  try {
    // 使用 tauri-plugin-share 提供的官方 API
    // 自动检测文件类型并触发系统分享对话框
    await invoke("plugin:share|share_file", { 
      path: filePath,
      mime: "*/*" // 自动检测 MIME 类型
    });
  } catch (err) {
    throw normalizeTauriError(err);
  }
}

function normalizeTauriError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : err && typeof err === "object" && "message" in err ? String((err as { message?: unknown }).message) : "";
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { message?: unknown };
      if (parsed?.message) {
        return new Error(String(parsed.message));
      }
    } catch {
      // ignore json parse errors
    }
    return new Error(raw);
  }
  return new Error("操作失败");
}

export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>) {
  if (typeof window === "undefined") {
    throw new Error("仅客户端可调用 tauri invoke");
  }
  // 自动注入顶层 actor operator id（若 frontend 没传的话）
  try {
    const session = getSession();
    if (session) {
      const operatorId = (session as any).actor_operator_id as string | undefined;
      if (args && operatorId) {
        // shallow clone and inject only top-level actor identifiers
        const cloned = { ...(args as Record<string, unknown>) };
        // inject both snake_case and camelCase variants to be compatible with backend naming
        // if (!Object.prototype.hasOwnProperty.call(cloned, "actor_operator_id")) {
        //   ;(cloned as any).actor_operator_id = operatorId
        // }
        // actorOperatorId 对应后端 actor_operator_id 的 camelCase 变体
        if (!Object.prototype.hasOwnProperty.call(cloned, "actorOperatorId")) {
          (cloned as any).actorOperatorId = operatorId;
        }
        args = cloned;
      }
    }
    return await invoke<T>(cmd, args);
  } catch (err) {
    throw normalizeTauriError(err);
  }
}

export async function revealInFolder(path: string) {
  if (typeof window === "undefined") {
    throw new Error("仅客户端可调用 reveal_in_folder");
  }
  try {
    await invoke("reveal_in_folder", { filePath: path });
  } catch (err) {
    throw normalizeTauriError(err);
  }
}

export async function openFolder(path: string) {
  if (typeof window === "undefined") {
    throw new Error("仅客户端可调用 open_folder");
  }
  try {
    await invoke("open_folder", { path });
  } catch (err) {
    throw normalizeTauriError(err);
  }
}
