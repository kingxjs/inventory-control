import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "~/lib/utils"
import { Button } from "./button"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

type DatePickerProps = {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  defaultNow?: boolean
  disabled?: boolean
  className?: string
  id?: string
}

const parseDate = (value?: string) => {
  if (!value) return undefined
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

const formatDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function DatePicker({
  value,
  onChange,
  placeholder = "选择日期",
  defaultNow = true,
  disabled,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selectedDate = parseDate(value)
  const didInitRef = React.useRef(false)

  React.useEffect(() => {
    if (didInitRef.current) return
    if (value || !defaultNow) return
    const now = new Date()
    didInitRef.current = true
    onChange?.(formatDate(now))
  }, [defaultNow, onChange, value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          id={id}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          {selectedDate ? formatDate(selectedDate) : placeholder}
          <ChevronDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          captionLayout="dropdown"
          onSelect={(date) => {
            if (!date) return
            onChange?.(formatDate(date))
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
