import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react"
import { Button } from "~/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "~/components/ui/dialog"
import { pickImagePaths } from "~/lib/photos"
import { tauriInvoke } from "~/lib/tauri"
import { toast } from "sonner"

type ImagePickerProps = {
  label?: string
  photoType: "item" | "txn"
  value?: string[]
  onChange?: (paths: string[]) => void
  mode?: "edit" | "preview"
  onRemove?: (path: string) => void
}

export function ImagePicker({
  label = "图片上传",
  photoType,
  value,
  onChange,
  mode = "edit",
  onRemove,
}: ImagePickerProps) {
  const isPreviewMode = mode === "preview"
  const [selectedPaths, setSelectedPaths] = useState<string[]>(value ?? [])
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const previewSrc = previewPath ? previewUrls[previewPath] : ""
  const previewIndex = useMemo(
    () => (previewPath ? selectedPaths.indexOf(previewPath) : -1),
    [previewPath, selectedPaths],
  )
  const previewCount = selectedPaths.length
  const valueKey = useMemo(() => (value ?? []).join("|"), [value])
  const prevPathsRef = useRef<string[]>(selectedPaths)
  const previewUrlsRef = useRef<Record<string, string>>({})
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const touchLastRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (previewPath && !selectedPaths.includes(previewPath)) {
      setPreviewPath(null)
    }
  }, [previewPath, selectedPaths])

  useEffect(() => {
    // 允许父组件以受控方式覆盖当前列表。
    setSelectedPaths(value ?? [])
  }, [valueKey])

  useEffect(() => {
    // 清理已移除项对应的 object URL，避免内存泄漏。
    const prevPaths = prevPathsRef.current
    const removedPaths = prevPaths.filter((path) => !selectedPaths.includes(path))
    if (removedPaths.length > 0) {
      setPreviewUrls((prev) => {
        const next = { ...prev }
        for (const path of removedPaths) {
          const url = next[path]
          if (url) {
            URL.revokeObjectURL(url)
            delete next[path]
          }
        }
        previewUrlsRef.current = next
        return next
      })
    }
    prevPathsRef.current = selectedPaths
  }, [selectedPaths])

  useEffect(() => {
    let active = true
    const loadPreviews = async () => {
      for (const path of selectedPaths) {
        if (previewUrlsRef.current[path]) continue
        try {
          const bytes = await tauriInvoke<number[]>("read_photo_bytes", { input: { path } })
          const blob = new Blob([new Uint8Array(bytes)])
          const url = URL.createObjectURL(blob)
          if (!active) {
            URL.revokeObjectURL(url)
            return
          }
          setPreviewUrls((prev) => {
            if (prev[path]) {
              URL.revokeObjectURL(url)
              return prev
            }
            const next = { ...prev, [path]: url }
            previewUrlsRef.current = next
            return next
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : "图片预览失败"
          toast.error(message)
        }
      }
    }
    loadPreviews()
    return () => {
      active = false
    }
  }, [selectedPaths])

  useEffect(() => {
    previewUrlsRef.current = previewUrls
  }, [previewUrls])

  useEffect(() => {
    return () => {
      for (const url of Object.values(previewUrlsRef.current)) {
        URL.revokeObjectURL(url)
      }
    }
  }, [])

  const emitChange = (paths: string[]) => {
    setSelectedPaths(paths)
    onChange?.(paths)
  }

  const handlePick = async () => {
    if (isPreviewMode) return
    try {
      const filePaths = await pickImagePaths(photoType)
      if (filePaths.length === 0) return
      // 统一去重，避免重复选择导致列表膨胀。
      const nextPaths = Array.from(new Set([...selectedPaths, ...filePaths]))
      emitChange(nextPaths)
    } catch (err) {
      const message = err instanceof Error ? err.message : "图片选择失败"
      toast.error(message)
    }
  }

  const handleRemove = (path: string) => {
    if (isPreviewMode) {
      onRemove?.(path)
      return
    }
    emitChange(selectedPaths.filter((item) => item !== path))
  }

  const openPreview = (path: string) => {
    setPreviewPath(path)
  }

  const goToIndex = (nextIndex: number) => {
    if (previewCount === 0) return
    const normalized = ((nextIndex % previewCount) + previewCount) % previewCount
    const nextPath = selectedPaths[normalized]
    if (nextPath) {
      setPreviewPath(nextPath)
    }
  }

  const handlePrev = () => {
    if (previewIndex < 0) return
    goToIndex(previewIndex - 1)
  }

  const handleNext = () => {
    if (previewIndex < 0) return
    goToIndex(previewIndex + 1)
  }

  const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const touch = event.touches[0]
    if (!touch) return
    const point = { x: touch.clientX, y: touch.clientY }
    touchStartRef.current = point
    touchLastRef.current = point
  }

  const handleTouchMove: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const touch = event.touches[0]
    if (!touch) return
    touchLastRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchEnd: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const start = touchStartRef.current
    touchStartRef.current = null
    const last = touchLastRef.current
    touchLastRef.current = null
    if (!start || !last) return
    const dx = last.x - start.x
    const dy = last.y - start.y
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)
    // 仅在水平滑动明显时触发切换，避免误触。
    if (absDx < 40 || absDx < absDy) return
    if (dx < 0) {
      handleNext()
    } else {
      handlePrev()
    }
  }

  return (
    <div className="grid gap-2 md:col-span-2">
      <span className="text-sm font-medium text-slate-900">{label}</span>
      {isPreviewMode ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">共 {selectedPaths.length} 张</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={handlePick}>
            选择图片
          </Button>
          <span className="text-xs text-slate-500">已选择 {selectedPaths.length} 张</span>
        </div>
      )}
      {selectedPaths.length > 0 ? (
        <div className="grid gap-2">
          {/* <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            {selectedPaths.map((path) => (
              <div key={path} className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate">{path}</span>
                <span className="text-slate-400">已选</span>
              </div>
            ))}
          </div> */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {selectedPaths.map((path) => (
              <div
                key={path}
                className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-white"
              >
                {previewUrls[path] ? (
                  <button
                    type="button"
                    className="block h-full w-full"
                    onClick={() => openPreview(path)}
                  >
                    <img
                      src={previewUrls[path]}
                      alt={path}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">
                    预览加载中
                  </div>
                )}
                <button
                  type="button"
                  className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white opacity-100 transition md:h-6 md:w-6 lg:opacity-0 lg:group-hover:opacity-100"
                  onClick={() => handleRemove(path)}
                  hidden={isPreviewMode && !onRemove}
                  aria-label="删除图片"
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <Dialog
        open={Boolean(previewPath)}
        onOpenChange={(open) => {
          if (!open) setPreviewPath(null)
        }}
      >
        <DialogContent className="max-w-[min(96vw,72rem)] border-slate-800 bg-black/90 p-2 sm:p-4" showCloseButton>
          <DialogTitle className="sr-only">图片预览</DialogTitle>
          <DialogDescription className="sr-only">查看所选图片的大图预览</DialogDescription>
          {previewSrc ? (
            <div
              className="relative flex max-h-[80vh] items-center justify-center"
              style={{ touchAction: "pan-y" }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={previewSrc}
                alt={previewPath || "预览"}
                className="max-h-[78vh] w-auto max-w-full rounded-md object-contain"
              />
              {previewCount > 1 ? (
                <>
                  <button
                    type="button"
                    className="absolute left-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white"
                    onClick={handlePrev}
                    aria-label="上一张"
                  >
                    <ChevronLeftIcon className="size-5" />
                  </button>
                  <button
                    type="button"
                    className="absolute right-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white"
                    onClick={handleNext}
                    aria-label="下一张"
                  >
                    <ChevronRightIcon className="size-5" />
                  </button>
                  <div className="absolute bottom-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                    {previewIndex + 1} / {previewCount}
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-slate-300">预览加载中</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
