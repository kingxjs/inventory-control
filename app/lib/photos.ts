import { open as tauriOpen } from "@tauri-apps/plugin-dialog"
import { tauriInvoke } from "~/lib/tauri"

export type PhotoType = "item" | "txn"

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "bmp"]

function isAndroidWebView() {
  if (typeof navigator === "undefined") return false
  return /android/i.test(navigator.userAgent || "")
}

function inferExtension(file: File) {
  const nameExt = file.name.split(".").pop()?.toLowerCase().trim()
  if (nameExt && nameExt.length <= 12) {
    return nameExt
  }
  const mime = (file.type || "").toLowerCase()
  if (mime.includes("jpeg")) return "jpg"
  if (mime.includes("png")) return "png"
  if (mime.includes("webp")) return "webp"
  if (mime.includes("bmp")) return "bmp"
  return "bin"
}

async function pickViaDialog() {
  const selected = await tauriOpen({
    multiple: true,
    filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
  })
  if (!selected) return []
  return Array.isArray(selected) ? selected : [selected]
}

async function stageFiles(photoType: PhotoType, files: File[]) {
  const stagedPaths: string[] = []
  for (const file of files) {
    const extension = inferExtension(file)
    const buffer = await file.arrayBuffer()
    const bytes = Array.from(new Uint8Array(buffer))
    const stagedPath = await tauriInvoke<string>("stage_photo_bytes", {
      input: {
        photo_type: photoType,
        extension,
        bytes,
      },
    })
    stagedPaths.push(stagedPath)
  }
  return stagedPaths
}

function pickViaFileInput(photoType: PhotoType) {
  return new Promise<string[]>((resolve, reject) => {
    if (typeof document === "undefined") {
      resolve([])
      return
    }
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.multiple = true
    // 在 Android WebView 中提示直接打开相机（后置摄像头优先）。
    input.setAttribute("capture", "environment")
    input.style.position = "fixed"
    input.style.left = "-9999px"

    const cleanup = () => {
      input.onchange = null
      if (input.parentNode) {
        input.parentNode.removeChild(input)
      }
    }

    input.onchange = async () => {
      try {
        const files = Array.from(input.files || [])
        if (files.length === 0) {
          cleanup()
          resolve([])
          return
        }
        const staged = await stageFiles(photoType, files)
        cleanup()
        resolve(staged)
      } catch (err) {
        cleanup()
        reject(err)
      }
    }

    document.body.appendChild(input)
    input.click()
  })
}

export async function pickImagePaths(photoType: PhotoType) {
  // Android WebView 中 dialog 插件可能无法返回可访问的文件路径，
  // 这里改为 file input + 后端 staging，最终仍返回路径以复用既有链路。
  if (isAndroidWebView()) {
    return pickViaFileInput(photoType)
  }
  return pickViaDialog()
}
