import * as React from "react"

import { cn, copyToClipboard } from "~/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip"
import { toast } from "sonner"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({
  className,
  children,
  ...props
}: React.ComponentProps<"td">) {
  const isPlainText =
    typeof children === "string" || typeof children === "number"
  const textValue = isPlainText ? String(children) : ""
  const isCentered = typeof className === "string" && className.includes("text-center")
  const copyText = async (value: string) => {
    if (!value) return
    const ok = await copyToClipboard(value)
    if (ok) {
      toast.success("已复制")
    } else {
      toast.error("复制失败")
    }
  }

  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    >
      {isPlainText ? (
        textValue ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "block max-w-[220px] truncate",
                  isCentered && "mx-auto text-center"
                )}
              >
                {textValue}
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="cursor-pointer"
              onClick={() => void copyText(textValue)}
            >
              {textValue}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span
            className={cn(
              "block max-w-[220px] truncate",
              isCentered && "mx-auto text-center"
            )}
          >
            {textValue}
          </span>
        )
      ) : (
        children
      )}
    </td>
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
