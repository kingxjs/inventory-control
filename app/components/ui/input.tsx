import * as React from "react"
import { X } from "lucide-react"

import { cn } from "~/lib/utils"

function Input({ className, type, value, onChange, disabled, readOnly, ...props }: React.ComponentProps<"input">) {
  const hasValue = value !== undefined && value !== null && String(value) !== ""
  const showClear = hasValue && !disabled && !readOnly

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault()
    // 尝试以事件目标结构调用 onChange，兼容 react-hook-form 的 field.onChange
    if (typeof onChange === "function") {
      // @ts-expect-error: 构造一个简单的合成事件对象以触发 onChange
      onChange({ target: { value: "" } })
    }
  }

  // 从 props 中提取 onInput 和 inputMode，避免传递到 restProps
  const { onInput: userOnInput, inputMode: userInputMode, ...restProps } = props

  // 将 type="number" 转换为 type="text" + inputMode="numeric"
  // 这样可以保留无效输入的内容，让表单校验正确工作
  // 同时在移动端显示数字键盘
  const actualType = type === "number" ? "text" : type
  const actualInputMode = type === "number" ? (userInputMode || "numeric") : userInputMode

  return (
    <div className="relative inline-block w-full group">
      <input
        type={actualType}
        inputMode={actualInputMode}
        data-slot="input"
        value={value}
        onChange={onChange}
        onInput={userOnInput}
        disabled={disabled}
        readOnly={readOnly}
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input dark:border-input/15 h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          showClear ,
          className
        )}
        {...restProps}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="清除输入"
        onClick={handleClear}
        className={cn(
          "absolute right-2 inset-y-0 flex items-center justify-center rounded-full p-1 text-muted-foreground hover:text-foreground focus:outline-none transition-opacity duration-150",
          // 仅当有值且可用时允许显示，并在悬浮或聚焦时可见
          showClear
            ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto"
            : "hidden"
        )}
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

export { Input }
