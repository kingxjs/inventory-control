import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { useForm } from "react-hook-form"
import { PageHeader } from "~/components/common/page-header"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { ConfirmButton } from "~/components/common/confirm-button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "~/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { getSession } from "~/lib/auth"
import { tauriInvoke } from "~/lib/tauri"
import { toast } from "sonner"

type WarehouseRow = {
  id: string
  code: string
  name: string
  status: string
  created_at: number
}

type WarehouseListResult = {
  items: WarehouseRow[]
  total: number
}

type WarehouseFormValues = {
  codeSuffix: string
  name: string
}

export default function WarehousesPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<WarehouseRow[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState("")
  const [status, setStatus] = useState("all")
  const [formOpen, setFormOpen] = useState(false)
  const [editRow, setEditRow] = useState<WarehouseRow | null>(null)
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const form = useForm<WarehouseFormValues>({
    defaultValues: {
      codeSuffix: "",
      name: "",
    },
  })

  const fetchWarehouses = async (
    keywordValue = keyword,
    statusValue = status,
    page = pageIndex,
  ) => {
    
    const trimmedKeyword = keywordValue.trim()
    const normalizedStatus = statusValue === "all" ? undefined : statusValue
    setLoading(true)
    try {
      const result = await tauriInvoke<WarehouseListResult>("list_warehouses", {
        input: {
          keyword: trimmedKeyword || undefined,
          status: normalizedStatus,
          page_index: page,
          page_size: pageSize,
        },
      })
      setRows(result.items)
      setTotal(result.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载失败"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchWarehouses(keyword, status, pageIndex)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [pageIndex, keyword, status])

  const resetForm = () => {
    form.reset({
      codeSuffix: "",
      name: "",
    })
  }

  const openCreate = () => {
    setEditRow(null)
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (row: WarehouseRow) => {
    setEditRow(row)
    form.reset({
      codeSuffix: row.code.replace(/^W+/i, ""),
      name: row.name,
    })
    setFormOpen(true)
  }

  const codeSuffix = form.watch("codeSuffix")
  const normalizeSuffix = (value: string) =>
    value.trim().replace(/^W+/i, "").replace(/\D/g, "")
  const formatSuffix = (value: string) => {
    const digits = normalizeSuffix(value)
    return digits ? digits.padStart(2, "0") : ""
  }
  const formattedSuffix = formatSuffix(codeSuffix || "")
  const warehouseCode = formattedSuffix ? `W${formattedSuffix}` : ""

  const handleSubmit = async (values: WarehouseFormValues) => {
    const formattedCode = formatSuffix(values.codeSuffix || "")
    const warehouseCode = formattedCode ? `W${formattedCode}` : ""
    const name = values.name.trim()
    try {
      if (editRow) {
        await tauriInvoke("update_warehouse", {
          input: {
            id: editRow.id,
            name,
          },
        })
        toast.success("仓库更新成功")
      } else {
        await tauriInvoke("create_warehouse", {
          input: {
            code: warehouseCode,
            name,
          },
        })
        toast.success("仓库创建成功")
      }
      setFormOpen(false)
      resetForm()
      await fetchWarehouses(keyword, status)
    } catch (err) {
      const message = err instanceof Error ? err.message : "保存失败"
      toast.error(message)
    }
  }

  const handleToggleStatus = async (row: WarehouseRow) => {
    const nextStatus = row.status === "active" ? "inactive" : "active"
    try {
      await tauriInvoke("set_warehouse_status", {
        input: {
          id: row.id,
          status: nextStatus,
        },
      })
      toast.success("状态更新成功")
      await fetchWarehouses(keyword, status)
    } catch (err) {
      const message = err instanceof Error ? err.message : "更新失败"
      toast.error(message)
    }
  }

  const handleFilter = async () => {
    setPageIndex(1)
    await fetchWarehouses(keyword, status, 1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="仓库管理"
        description="维护仓库档案与状态，供货架绑定。"
        actions={
          <Dialog
            open={formOpen}
            onOpenChange={(open) => {
              setFormOpen(open)
              if (!open) {
                setEditRow(null)
                resetForm()
              }
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={openCreate}>新增仓库</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editRow ? "编辑仓库" : "新增仓库"}</DialogTitle>
                <DialogDescription>
                  {editRow ? "更新仓库名称" : "填写仓库基础信息"}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void form.handleSubmit(handleSubmit)()
                  }}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="codeSuffix"
                    rules={{
                      validate: (value) => {
                        if (editRow) return true
                        const trimmed = value.trim().replace(/^W+/i, "")
                        if (!trimmed) return "请输入仓库编号"
                        if (!/^\d+$/.test(trimmed)) return "仓库编号只能输入数字"
                        if (Number(trimmed) <= 0) return "仓库编号必须大于 0"
                        return true
                      },
                    }}
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel htmlFor="warehouse-code">仓库编号</FormLabel>
                        <FormControl>
                          <Input
                            id="warehouse-code"
                            placeholder="例如 01"
                            disabled={!!editRow}
                            type="number"
                            min={1}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-slate-500">
                          完整编号：{warehouseCode || "W"}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="name"
                    rules={{
                      validate: (value) =>
                        value.trim() ? true : "请输入仓库名称",
                    }}
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel htmlFor="warehouse-name">仓库名称</FormLabel>
                        <FormControl>
                          <Input id="warehouse-name" placeholder="主仓库" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <ConfirmButton
                    className="w-full"
                    label="保存"
                    confirmText={editRow ? "确认保存仓库变更？" : "确认创建仓库？"}
                    onBeforeConfirmOpen={() => form.trigger()}
                    onConfirm={() => form.handleSubmit(handleSubmit)()}
                  />
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
        <div className="min-w-[140px] w-[140px] max-w-[140px] flex-1 space-y-2">
          <Label>关键词</Label>
          <Input
            placeholder="搜索仓库编号或名称"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <div className="flex-1 space-y-2">
          <Label>状态</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="请选择" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="active">启用</SelectItem>
              <SelectItem value="inactive">停用</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={handleFilter}>
          筛选
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setKeyword("")
            setStatus("all")
            setPageIndex(1)
            fetchWarehouses("", "all", 1)
          }}
        >
          重置
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>仓库编号</TableHead>
              <TableHead>仓库名称</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.code}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "active" ? "secondary" : "outline"}>
                    {row.status === "active" ? "启用" : "停用"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(row.created_at * 1000).toLocaleString()}
                </TableCell>
                <TableCell className="text-center">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                    编辑
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        更多
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          navigate(
                            `/stock?tab=slot&warehouse_id=${encodeURIComponent(row.id)}`
                          )
                        }}
                      >
                        查看库存
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          navigate(`/txns?warehouse_id=${encodeURIComponent(row.id)}`)
                        }}
                      >
                        查看流水
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleToggleStatus(row)}
                      >
                        {row.status === "active" ? "停用" : "启用"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {!loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">
                  暂无仓库数据
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {total > 0 ? (
        <Pagination className="justify-between">
          <p className="text-xs text-slate-500">
            共 {total} 条，当前第 {pageIndex}/{Math.max(1, Math.ceil(total / pageSize))} 页
          </p>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(event) => {
                  event.preventDefault()
                  setPageIndex((prev) => Math.max(1, prev - 1))
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault()
                  const totalPages = Math.max(1, Math.ceil(total / pageSize))
                  setPageIndex((prev) => Math.min(totalPages, prev + 1))
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  )
}
