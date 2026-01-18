import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "~/lib/utils"
import { Button } from "./button"
import { Calendar } from "./calendar"
import { Input } from "./input"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

type DateTimePickerProps = {
  value?: string
  onChange?: (value: string) => void
  datePlaceholder?: string
  timePlaceholder?: string
  defaultNow?: boolean
  disabled?: boolean
  className?: string
  id?: string
  timeStep?: number
}

const parseDate = (value?: string) => {
  if (!value) return undefined
  const [datePart] = value.split("T")
  const [year, month, day] = datePart.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

const formatDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const parseTime = (value?: string) => {
  if (!value) return ""
  const parts = value.split("T")
  return parts[1] ?? ""
}

export function DateTimePicker({
  value,
  onChange,
  datePlaceholder = "选择日期",
  timePlaceholder = "选择时间",
  defaultNow = true,
  disabled,
  className,
  id,
  timeStep = 60,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [timeValue, setTimeValue] = React.useState(() => parseTime(value))
  const selectedDate = parseDate(value)
  const didInitRef = React.useRef(false)

  React.useEffect(() => {
    setTimeValue(parseTime(value))
  }, [value])

  React.useEffect(() => {
    if (didInitRef.current) return
    if (value || !defaultNow) return
    const now = new Date()
    const dateValue = formatDate(now)
    const timeValue = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`
    didInitRef.current = true
    onChange?.(`${dateValue}T${timeValue}`)
  }, [defaultNow, onChange, value])

  const emitChange = (nextDate?: Date, nextTime?: string) => {
    const dateValue = nextDate ? formatDate(nextDate) : ""
    const time = nextTime ?? timeValue
    if (!dateValue) return
    const normalizedTime = time || "00:00"
    onChange?.(`${dateValue}T${normalizedTime}`)
  }

  return (
    <div className={cn("flex flex-1 items-center gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id={id}
            disabled={disabled}
            className="min-w-[160px] flex-1 justify-between font-normal"
          >
            {selectedDate ? formatDate(selectedDate) : datePlaceholder}
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
              emitChange(date, timeValue)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
      <Input
        type="time"
        step={timeStep}
        value={timeValue}
        onChange={(event) => {
          const nextTime = event.target.value
          setTimeValue(nextTime)
          emitChange(selectedDate, nextTime)
        }}
        placeholder={timePlaceholder}
        disabled={disabled}
        className="min-w-[120px] flex-1 bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
      />
    </div>
  )
}
