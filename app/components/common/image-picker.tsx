import { XIcon } from "lucide-react"
import { Button } from "~/components/ui/button"

type ImagePickerProps = {
  label?: string
  selectedPaths: string[]
  previewUrls: Record<string, string>
  onPick: () => void
  onRemove: (path: string) => void
}

export function ImagePicker({
  label = "图片上传",
  selectedPaths,
  previewUrls,
  onPick,
  onRemove,
}: ImagePickerProps) {
  return (
    <div className="grid gap-2 md:col-span-2">
      <span className="text-sm font-medium text-slate-900">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={onPick}>
          选择图片
        </Button>
        <span className="text-xs text-slate-500">已选择 {selectedPaths.length} 张</span>
      </div>
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
          <div className="grid gap-2 sm:grid-cols-3">
            {selectedPaths.map((path) => (
              <div
                key={path}
                className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-white"
              >
                {previewUrls[path] ? (
                  <img
                    src={previewUrls[path]}
                    alt={path}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">
                    预览加载中
                  </div>
                )}
                <button
                  type="button"
                  className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                  onClick={() => onRemove(path)}
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
