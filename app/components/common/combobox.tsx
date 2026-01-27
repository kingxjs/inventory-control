import type { ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { CheckIcon, ChevronDownIcon, X } from "lucide-react"

import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"

type ComboboxOption = {
  node?: any
  value: string
  label: ReactNode
  searchLabel?: string
}

type ComboboxProps = {
  options: ComboboxOption[]
  value: string
  onChange: (value: string,node?: any) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  onSearch?: (query: string) => Promise<ComboboxOption[]>
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "请选择",
  searchPlaceholder = "搜索...",
  emptyText = "未找到匹配项",
  disabled,
  onSearch,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [displayOptions, setDisplayOptions] = useState<ComboboxOption[]>(options)
  const requestIdRef = useRef(0)
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value]
  )
  const selectedLabel = selectedOption?.label

  useEffect(() => {
    if (!onSearch) {
      setDisplayOptions(options)
    }
  }, [options, onSearch])

  useEffect(() => {
    if (!onSearch || !open) {
      return
    }
    const timer = window.setTimeout(async () => {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      setLoading(true)
      try {
        const nextOptions = await onSearch(search.trim())
        if (requestIdRef.current === requestId) {
          setDisplayOptions(nextOptions)
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false)
        }
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search, onSearch, open])

  const listOptions = onSearch ? displayOptions : options

  return (
    <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
        <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between group"
        >
          <span className={cn("truncate", !selectedOption && "text-slate-400")}>
            {selectedOption ? selectedLabel : placeholder}
          </span>
          <div className="ml-2 flex items-center gap-2">
            {value !== "" && value !== "all" && !disabled ? (
              <span
                role="button"
                tabIndex={-1}
                aria-label="清除选择"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full p-1 text-slate-500 hover:text-slate-700 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange("")
                  setOpen(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    e.stopPropagation()
                    onChange("")
                    setOpen(false)
                  }
                }}
              >
                <X className="size-4" />
              </span>
            ) : null}
            <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading ? (
              <div className="px-2 py-3 text-center text-xs text-slate-500">
                加载中...
              </div>
            ) : (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            <CommandGroup>
              {listOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={
                    option.searchLabel ||
                    (typeof option.label === "string" ? option.label : option.value)
                  }
                  onSelect={() => {
                    onChange(option.value,option.node)
                    setOpen(false)
                  }}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 size-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
