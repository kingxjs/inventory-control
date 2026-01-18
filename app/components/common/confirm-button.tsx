import { useState } from "react"

import { Button, buttonVariants } from "~/components/ui/button"
import { Popover, PopoverAnchor, PopoverContent } from "~/components/ui/popover"
import type { VariantProps } from "class-variance-authority"

type ConfirmButtonProps = {
  label: string
  onConfirm: () => void | Promise<void>
  onBeforeConfirmOpen?: () => boolean | Promise<boolean>
  confirmText?: string
  disabled?: boolean
  className?: string
  contentClassName?: string
} & VariantProps<typeof buttonVariants>

export function ConfirmButton({
  label,
  onConfirm,
  confirmText = "确认提交？",
  onBeforeConfirmOpen,
  disabled,
  className,
  contentClassName,
  variant = "default",
  size = "default",
}: ConfirmButtonProps) {
  const [open, setOpen] = useState(false)
  const handleOpen = async () => {
    if (disabled) return
    if (onBeforeConfirmOpen) {
      const allowed = await onBeforeConfirmOpen()
      if (!allowed) return
    }
    setOpen(true)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Button
          className={className}
          variant={variant}
          size={size}
          disabled={disabled}
          onClick={handleOpen}
          type="button"
        >
          {label}
        </Button>
      </PopoverAnchor>
      <PopoverContent
        align="center"
        side="top"
        className={contentClassName || "w-64"}
      >
        <div className="grid gap-3 text-sm text-slate-600">
          <p className="font-medium text-slate-900">{confirmText}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              onClick={async () => {
                setOpen(false)
                await onConfirm()
              }}
              type="button"
            >
              确认
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
