import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { useSearchParams } from "react-router"
import { PageHeader } from "~/components/common/page-header"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { DatePicker } from "~/components/ui/date"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Combobox } from "~/components/common/combobox"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "~/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { getSession } from "~/lib/auth"
import { tauriInvoke } from "~/lib/tauri"
import { toast } from "sonner"
import { open } from "@tauri-apps/plugin-dialog"
import {
  ReversalDialog,
  type ReversalFormValues,
} from "~/components/stock/stock-action-dialogs"

type TxnRow = {
  id: string
  txn_no: string
  txn_type: string
  occurred_at: number
  created_at: number
  operator_name: string
  item_code: string
  item_name: string
  from_slot_code?: string | null
  to_slot_code?: string | null
  qty: number
  actual_qty?: number | null
  ref_txn_id?: string | null
  has_reversal?: boolean
  ref_txn_no?: string | null
  ref_txn_type?: string | null
  ref_item_name?: string | null
  ref_operator_name?: string | null
  ref_from_slot_code?: string | null
  ref_to_slot_code?: string | null
  ref_qty?: number | null
  ref_actual_qty?: number | null
  ref_occurred_at?: number | null
  ref_note?: string | null
  note?: string | null
}

type TxnPhotoRow = {
  id: string
  data_id: string
  photo_type: string
  file_path: string
  created_at: number
}

type TxnPhotoListResult = {
  items: TxnPhotoRow[]
}

type SettingsDto = {
  storage_root: string
}

type OperatorRow = {
  id: string
  username: string
  display_name: string
  status: string
  role: string
  created_at: number
}

type OperatorListResult = {
  items: OperatorRow[]
  total: number
}

type TxnListResult = {
  items: TxnRow[]
  total: number
}

export default function TxnsPage() {
  const [rows, setRows] = useState<TxnRow[]>([])
  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [warehouseFilter, setWarehouseFilter] = useState("all")
  const [rackFilter, setRackFilter] = useState("all")
  const [slotFilter, setSlotFilter] = useState("all")
  const [itemFilter, setItemFilter] = useState("all")
  const [operatorFilter, setOperatorFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [detailOpen, setDetailOpen] = useState(false)
  const [activeRow, setActiveRow] = useState<TxnRow | null>(null)
  const [selectedTxnId, setSelectedTxnId] = useState("")
  const [reversalOpen, setReversalOpen] = useState(false)
  const [txnPhotoRows, setTxnPhotoRows] = useState<TxnPhotoRow[]>([])
  const [txnPhotoLoading, setTxnPhotoLoading] = useState(false)
  const [txnPhotoUrls, setTxnPhotoUrls] = useState<Record<string, string>>({})
  const [storageRoot, setStorageRoot] = useState("")
  const [operators, setOperators] = useState<OperatorRow[]>([])
  const [searchParams] = useSearchParams()
  const actorOperatorId = (getSession() as any)?.actor_operator_id || ""
  const reversalForm = useForm<ReversalFormValues>({
    defaultValues: {
      txn_no: "",
      occurred_at: "",
      operator_id: actorOperatorId,
      note: "",
    },
  })

  const fetchTxns = async (
    page = pageIndex,
    overrides?: {
      keyword?: string
      typeFilter?: string
      itemFilter?: string
      slotFilter?: string
      warehouseFilter?: string
      rackFilter?: string
      operatorFilter?: string
      startDate?: string
      endDate?: string
    }
  ) => {
    const nextKeyword = (overrides?.keyword ?? keyword).trim()
    const nextType = overrides?.typeFilter ?? typeFilter
    const nextItem = overrides?.itemFilter ?? itemFilter
    const nextSlot = overrides?.slotFilter ?? slotFilter
    const nextWarehouse = overrides?.warehouseFilter ?? warehouseFilter
    const nextRack = overrides?.rackFilter ?? rackFilter
    const nextOperator = overrides?.operatorFilter ?? operatorFilter
    const nextStartDate = overrides?.startDate ?? startDate
    const nextEndDate = overrides?.endDate ?? endDate
    const startAt = nextStartDate
      ? Math.floor(new Date(`${nextStartDate}T00:00:00`).getTime() / 1000)
      : undefined
    const endAt = nextEndDate
      ? Math.floor(new Date(`${nextEndDate}T23:59:59`).getTime() / 1000)
      : undefined
    setLoading(true)
    try {
      const result = await tauriInvoke<TxnListResult>("list_txns", {
        input: {
          actor_operator_id: actorOperatorId,
          txn_type: nextType === "all" ? undefined : nextType,
          keyword: nextKeyword || undefined,
          item_code: nextItem === "all" ? undefined : nextItem,
          slot_code: nextSlot === "all" ? undefined : nextSlot,
          warehouse_code: nextWarehouse === "all" ? undefined : nextWarehouse,
          rack_code: nextRack === "all" ? undefined : nextRack,
          operator_name: nextOperator === "all" ? undefined : nextOperator,
          start_at: startAt,
          end_at: endAt,
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
    fetchTxns(pageIndex)
  }, [pageIndex])

  useEffect(() => {
    const itemParam = searchParams.get("item_code")
    const slotParam = searchParams.get("slot_code")
    const warehouseParam = searchParams.get("warehouse_code")
    const rackParam = searchParams.get("rack_code")
    const operatorParam = searchParams.get("operator_name")
    if (itemParam) {
      setItemFilter(itemParam)
    }
    if (warehouseParam) {
      setWarehouseFilter(warehouseParam)
    }
    if (rackParam) {
      setRackFilter(rackParam)
    }
    if (slotParam) {
      setSlotFilter(slotParam)
    }
    if (operatorParam) {
      setOperatorFilter(operatorParam)
    }
    if (itemParam || warehouseParam || rackParam || slotParam || operatorParam) {
      setPageIndex(1)
      void fetchTxns(1, {
        itemFilter: itemParam ?? itemFilter,
        slotFilter: slotParam ?? slotFilter,
        warehouseFilter: warehouseParam ?? warehouseFilter,
        rackFilter: rackParam ?? rackFilter,
        operatorFilter: operatorParam ?? operatorFilter,
      })
    }
  }, [searchParams])

  useEffect(() => {
    tauriInvoke<OperatorListResult>("list_operators", {
      query: {
        actor_operator_id: actorOperatorId,
        page_index: 1,
        page_size: 2000,
      },
    })
      .then((result) => {
        setOperators(result.items)
      })
      .catch(() => {
        setOperators([])
      })
  }, [actorOperatorId])

  const openDetail = (row: TxnRow) => {
    setActiveRow(row)
    setDetailOpen(true)
  }

  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedTxnId) || null,
    [rows, selectedTxnId]
  )

  const getSlotCodes = (row: TxnRow) =>
    [row.from_slot_code, row.to_slot_code].filter(Boolean) as string[]
  const extractWarehouseCode = (slotCode: string) => {
    const parts = slotCode.split("-")
    return parts.find((part) => part.startsWith("W")) || ""
  }
  const extractRackCode = (slotCode: string) => {
    const parts = slotCode.split("-")
    return parts.find((part) => part.startsWith("R")) || ""
  }

  const warehouseOptions = Array.from(
    new Set(
      rows
        .flatMap((row) => getSlotCodes(row).map(extractWarehouseCode))
        .filter(Boolean)
    )
  )
  const rackOptions = Array.from(
    new Set(
      rows
        .flatMap((row) => getSlotCodes(row).map(extractRackCode))
        .filter(Boolean)
    )
  )
  const slotOptions = Array.from(
    new Set(rows.flatMap((row) => getSlotCodes(row)))
  )
  const itemOptions = Array.from(
    new Map(rows.map((row) => [row.item_code, row.item_name])).entries()
  )
  const operatorOptions = Array.from(
    new Set(rows.map((row) => row.operator_name).filter(Boolean))
  )

  const filteredRackOptions =
    warehouseFilter === "all"
      ? rackOptions
      : rackOptions.filter((code) => code.startsWith(`R`))

  const filteredSlotOptions =
    warehouseFilter === "all" && rackFilter === "all"
      ? slotOptions
      : slotOptions.filter((slotCode) => {
          if (warehouseFilter !== "all" && !slotCode.includes(warehouseFilter)) {
            return false
          }
          if (rackFilter !== "all" && !slotCode.includes(`-${rackFilter}-`)) {
            return false
          }
          return true
        })
  const slotOptionsForSelect =
    slotFilter !== "all" && !filteredSlotOptions.includes(slotFilter)
      ? [slotFilter, ...filteredSlotOptions]
      : filteredSlotOptions

  useEffect(() => {
    if (warehouseFilter !== "all") {
      const hasRack = rackOptions.includes(rackFilter)
      if (!hasRack) {
        setRackFilter("all")
      }
    }
    setSlotFilter("all")
  }, [warehouseFilter])

  useEffect(() => {
    if (rackFilter !== "all") {
      const hasSlot = filteredSlotOptions.includes(slotFilter)
      if (!hasSlot) {
        setSlotFilter("all")
      }
    }
  }, [rackFilter, filteredSlotOptions, slotFilter])

  const filteredRows = rows.filter((row) => {
    const slots = getSlotCodes(row)
    const warehouseCodes = slots.map(extractWarehouseCode).filter(Boolean)
    const rackCodes = slots.map(extractRackCode).filter(Boolean)
    const matchesWarehouse =
      warehouseFilter === "all" || warehouseCodes.includes(warehouseFilter)
    const matchesRack =
      rackFilter === "all" || rackCodes.includes(rackFilter)
    const matchesSlot = slotFilter === "all" || slots.includes(slotFilter)
    const matchesItem = itemFilter === "all" || row.item_code === itemFilter
    const matchesOperator =
      operatorFilter === "all" || row.operator_name === operatorFilter
    return (
      matchesWarehouse &&
      matchesRack &&
      matchesSlot &&
      matchesItem &&
      matchesOperator
    )
  })

  const parseTime = (value: string) => {
    if (!value) return Math.floor(Date.now() / 1000)
    return Math.floor(new Date(value).getTime() / 1000)
  }

  const buildPhotoPath = (filePath: string) => {
    if (!storageRoot) return ""
    const root = storageRoot.replace(/\\+/g, "/")
    return `${root}/${filePath}`.replace(/\/{2,}/g, "/")
  }

  const fetchPhotoUrl = async (path: string) => {
    const bytes = await tauriInvoke<number[]>("read_photo_bytes", {
      input: { path, actor_operator_id: actorOperatorId },
    })
    const blob = new Blob([new Uint8Array(bytes)])
    return URL.createObjectURL(blob)
  }

  const usePhotoPicker = () => {
    const [selectedPaths, setSelectedPaths] = useState<string[]>([])
    const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})

    const reset = () => {
      setSelectedPaths([])
      setPreviewUrls((prev) => {
        Object.values(prev).forEach((url) => URL.revokeObjectURL(url))
        return {}
      })
    }

    const handlePick = async () => {
      const selected = await open({
        multiple: true,
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "bmp"] }],
      })
      if (!selected) return
      const filePaths = Array.isArray(selected) ? selected : [selected]
      setSelectedPaths((prev) => {
        const merged = new Set([...prev, ...filePaths])
        return Array.from(merged)
      })
    }

    const handleRemove = (path: string) => {
      setSelectedPaths((prev) => prev.filter((item) => item !== path))
    }

    useEffect(() => {
      let active = true
      const load = async () => {
        if (selectedPaths.length === 0) {
          setPreviewUrls((prev) => {
            Object.values(prev).forEach((url) => URL.revokeObjectURL(url))
            return {}
          })
          return
        }
        try {
          const entries = await Promise.all(
            selectedPaths.map(async (path) => {
              const url = await fetchPhotoUrl(path)
              return [path, url] as const
            }),
          )
          if (!active) {
            entries.forEach(([, url]) => URL.revokeObjectURL(url))
            return
          }
          setPreviewUrls((prev) => {
            Object.entries(prev).forEach(([path, url]) => {
              if (!selectedPaths.includes(path)) {
                URL.revokeObjectURL(url)
              }
            })
            return Object.fromEntries(entries)
          })
        } catch {
          toast.error("图片预览失败")
        }
      }
      load()
      return () => {
        active = false
      }
    }, [selectedPaths])

    return { selectedPaths, previewUrls, handlePick, handleRemove, reset }
  }

  const reversalPhotos = usePhotoPicker()

  const submitReversal = async (values: ReversalFormValues) => {
    try {
      const txnNo = await tauriInvoke<string>("reverse_txn", {
        input: {
          txn_no: values.txn_no,
          occurred_at: parseTime(values.occurred_at),
          operator_id: (values as any).operator_id || undefined,
          note: values.note || null,
        },
      })
        if (reversalPhotos.selectedPaths.length > 0) {
        await tauriInvoke("add_photos", {
          input: {
            photo_type: "txn",
            data_id: txnNo,
            src_paths: reversalPhotos.selectedPaths,
            actor_operator_id: actorOperatorId,
          },
        })
        toast.success("图片上传成功")
        reversalPhotos.reset()
      }
      toast.success("冲正成功")
      setReversalOpen(false)
      setSelectedTxnId("")
      reversalForm.reset({
        txn_no: "",
        occurred_at: "",
        operator_id: actorOperatorId,
        note: "",
      })
      await fetchTxns(1)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "冲正失败"
      toast.error(message)
      return false
    }
  }

  const submitReversalFromForm = async () => {
    let ok = false
    await reversalForm.handleSubmit(async (values) => {
      ok = await submitReversal(values)
    })()
    return ok
  }

  const beforeReversalSubmit = () => reversalForm.trigger()

  useEffect(() => {
    tauriInvoke<SettingsDto>("get_settings")
      .then((settings) => {
        setStorageRoot(settings.storage_root || "")
      })
      .catch(() => {
        setStorageRoot("")
      })
  }, [])

  useEffect(() => {
    let active = true
    if (!detailOpen || !activeRow?.txn_no) {
      setTxnPhotoRows([])
      return
    }
    setTxnPhotoLoading(true)
    tauriInvoke<TxnPhotoListResult>("list_photos", {
      query: {
        photo_type: "txn",
        data_id: activeRow.txn_no,
      },
    })
      .then((result) => {
        if (active) {
          setTxnPhotoRows(result.items)
        }
      })
      .catch(() => {
        if (active) {
          setTxnPhotoRows([])
        }
      })
      .finally(() => {
        if (active) {
          setTxnPhotoLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [detailOpen, activeRow?.txn_no])

  useEffect(() => {
    let active = true
    const paths = txnPhotoRows
      .map((photo) => buildPhotoPath(photo.file_path))
      .filter(Boolean)
    const load = async () => {
      if (paths.length === 0) {
        setTxnPhotoUrls((prev) => {
          Object.values(prev).forEach((url) => URL.revokeObjectURL(url))
          return {}
        })
        return
      }
      try {
        const entries = await Promise.all(
          paths.map(async (path) => {
            const url = await fetchPhotoUrl(path)
            return [path, url] as const
          }),
        )
        if (!active) {
          entries.forEach(([, url]) => URL.revokeObjectURL(url))
          return
        }
        setTxnPhotoUrls((prev) => {
          Object.entries(prev).forEach(([path, url]) => {
            if (!paths.includes(path)) {
              URL.revokeObjectURL(url)
            }
          })
          return Object.fromEntries(entries)
        })
      } catch {
        toast.error("流水图片加载失败")
      }
    }
    load()
    return () => {
      active = false
    }
  }, [txnPhotoRows, storageRoot])

  const txnTypeLabel = (txnType: string) => {
    switch (txnType) {
      case "IN":
        return "入库"
      case "OUT":
        return "出库"
      case "MOVE":
        return "移库"
      case "COUNT":
        return "盘点"
      case "REVERSAL":
        return "冲正"
      default:
        return txnType
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="流水查询"
        description="支持按条件筛选流水，查看详情与冲正链路。"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={
                !selectedRow || selectedRow.txn_type === "REVERSAL" || !!selectedRow.ref_txn_id || !!selectedRow.has_reversal
              }
              onClick={() => {
                if (!selectedRow) {
                  toast.error("请选择流水记录")
                  return
                }
                if (selectedRow.txn_type === "REVERSAL" || selectedRow.ref_txn_id || selectedRow.has_reversal) {
                  toast.error("该流水不可冲正")
                  return
                }
                reversalForm.setValue("txn_no", selectedRow.txn_no)
                if (!reversalForm.getValues("operator_id")) {
                  reversalForm.setValue("operator_id", actorOperatorId)
                }
                setReversalOpen(true)
              }}
            >
              冲正
            </Button>
            <Button variant="outline">导出流水</Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
        <div className="min-w-[180px] flex-1 space-y-2">
          <Label>搜索</Label>
          <Input
            placeholder="流水号/物品/记录人"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <div className="min-w-[70px] space-y-2">
          <Label>类型</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="请选择" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="IN">入库</SelectItem>
              <SelectItem value="OUT">出库</SelectItem>
              <SelectItem value="MOVE">移库</SelectItem>
              <SelectItem value="COUNT">盘点</SelectItem>
              <SelectItem value="REVERSAL">冲正</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[140px] space-y-2">
          <Label>开始时间</Label>
          <DatePicker value={startDate} onChange={setStartDate} />
        </div>
        <div className="min-w-[140px] space-y-2">
          <Label>结束时间</Label>
          <DatePicker value={endDate} onChange={setEndDate} />
        </div>
        <div className="min-w-[180px] space-y-2">
          <Label>仓库</Label>
          <Combobox
            value={warehouseFilter}
            onChange={setWarehouseFilter}
            placeholder="全部"
            options={[
              { value: "all", label: "全部" },
              ...warehouseOptions.map((code) => ({
                value: code,
                label: code,
              })),
            ]}
          />
        </div>
        <div className="min-w-[180px] space-y-2">
          <Label>货架</Label>
          <Combobox
            value={rackFilter}
            onChange={setRackFilter}
            placeholder="全部"
            options={[
              { value: "all", label: "全部" },
              ...filteredRackOptions.map((code) => ({
                value: code,
                label: code,
              })),
            ]}
          />
        </div>
        <div className="min-w-[180px] space-y-2">
          <Label>库位</Label>
          <Combobox
            value={slotFilter}
            onChange={setSlotFilter}
            placeholder="全部"
            options={[
              { value: "all", label: "全部" },
              ...slotOptionsForSelect.map((code) => ({
                value: code,
                label: code,
              })),
            ]}
          />
        </div>
        <div className="min-w-[180px] space-y-2">
          <Label>物品</Label>
          <Combobox
            value={itemFilter}
            onChange={setItemFilter}
            placeholder="全部"
            options={[
              { value: "all", label: "全部" },
              ...itemOptions.map(([code, name]) => ({
                value: code,
                label: `${code}·${name}`,
                searchLabel: `${code} ${name}`,
              })),
            ]}
          />
        </div>
        <div className="min-w-[120px] space-y-2">
          <Label>记录人</Label>
          <Combobox
            value={operatorFilter}
            onChange={setOperatorFilter}
            placeholder="全部"
            options={[
              { value: "all", label: "全部" },
              ...operatorOptions.map((name) => ({
                value: name,
                label: name,
              })),
            ]}
          />
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setPageIndex(1)
            fetchTxns(1)
          }}
        >
          筛选
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setKeyword("")
            setTypeFilter("all")
            setStartDate("")
            setEndDate("")
            setWarehouseFilter("all")
            setRackFilter("all")
            setSlotFilter("all")
            setItemFilter("all")
            setOperatorFilter("all")
            setPageIndex(1)
            fetchTxns(1)
          }}
        >
          重置
        </Button>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center">选择</TableHead>
              <TableHead>流水号</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>物品</TableHead>
              <TableHead>库位</TableHead>
              <TableHead>数量</TableHead>
              <TableHead>记录人</TableHead>
              <TableHead>发生时间</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.id}>
                <TableCell className="text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-slate-900"
                    checked={selectedTxnId === row.id}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedTxnId(row.id)
                        reversalForm.setValue("txn_no", row.txn_no)
                      } else if (selectedTxnId === row.id) {
                        setSelectedTxnId("")
                        reversalForm.setValue("txn_no", "")
                      }
                    }}
                  />
                </TableCell>
                <TableCell className="max-w-[140px] truncate font-medium">{row.txn_no}</TableCell>
                <TableCell>{txnTypeLabel(row.txn_type)}</TableCell>
                <TableCell>{row.item_name}</TableCell>
                <TableCell>{row.from_slot_code || row.to_slot_code || "-"}</TableCell>
                <TableCell>{row.qty}</TableCell>
                <TableCell>{row.operator_name}</TableCell>
                <TableCell>{new Date(row.occurred_at * 1000).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {row.has_reversal
                      ? "已冲正"
                      : "成功"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Button variant="ghost" size="sm" onClick={() => openDetail(row)}>
                    详情
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={row.txn_type === "REVERSAL" || !!row.ref_txn_id || !!row.has_reversal}
                    onClick={() => {
                      if (row.txn_type === "REVERSAL" || row.ref_txn_id || row.has_reversal) {
                        toast.error("该流水不可冲正")
                        return
                      }
                      setSelectedTxnId(row.id)
                      reversalForm.setValue("txn_no", row.txn_no)
                      if (!reversalForm.getValues("operator_id")) {
                        reversalForm.setValue("operator_id", actorOperatorId)
                      }
                      setReversalOpen(true)
                    }}
                  >
                    冲正
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-slate-500">
                  暂无流水数据
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

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>流水详情</DialogTitle>
            <DialogDescription>{activeRow?.txn_no || "-"}</DialogDescription>
          </DialogHeader>
          {activeRow ? (
            <div className="grid gap-3 text-sm text-slate-600">
              <div className="flex flex-wrap gap-6">
                <span>类型：{txnTypeLabel(activeRow.txn_type)}</span>
                <span>数量：{activeRow.qty}</span>
                <span>
                  时间：{new Date(activeRow.occurred_at * 1000).toLocaleString()}
                </span>
              </div>
              <div className="flex flex-wrap gap-6">
                <span>物品：{activeRow.item_name}</span>
                <span>记录人：{activeRow.operator_name}</span>
              </div>
              <div className="flex flex-wrap gap-6">
                <span>来源库位：{activeRow.from_slot_code || "-"}</span>
                <span>目标库位：{activeRow.to_slot_code || "-"}</span>
              </div>
              <div className="flex flex-wrap gap-6">
                <span>冲正关联：{activeRow.ref_txn_id || "-"}</span>
                <span>实盘数量：{activeRow.actual_qty ?? "-"}</span>
              </div>
              {activeRow.txn_type === "REVERSAL" ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                  <div className="mb-2 text-sm font-medium text-slate-600">关联流水详情</div>
                  <div className="grid gap-2">
                    <div className="flex flex-wrap gap-6">
                      <span>流水号：{activeRow.ref_txn_no || "-"}</span>
                      <span>类型：{activeRow.ref_txn_type ? txnTypeLabel(activeRow.ref_txn_type) : "-"}</span>
                    </div>
                    <div className="flex flex-wrap gap-6">
                      <span>物品：{activeRow.ref_item_name || "-"}</span>
                      <span>记录人：{activeRow.ref_operator_name || "-"}</span>
                    </div>
                    <div className="flex flex-wrap gap-6">
                      <span>来源库位：{activeRow.ref_from_slot_code || "-"}</span>
                      <span>目标库位：{activeRow.ref_to_slot_code || "-"}</span>
                    </div>
                    <div className="flex flex-wrap gap-6">
                      <span>数量：{activeRow.ref_qty ?? "-"}</span>
                      <span>实盘数量：{activeRow.ref_actual_qty ?? "-"}</span>
                    </div>
                    <div className="flex flex-wrap gap-6">
                      <span>
                        时间：
                        {activeRow.ref_occurred_at
                          ? new Date(activeRow.ref_occurred_at * 1000).toLocaleString()
                          : "-"}
                      </span>
                    </div>
                    <div>备注：{activeRow.ref_note || "-"}</div>
                  </div>
                </div>
              ) : null}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                备注：{activeRow.note || "-"}
              </div>
              <div className="grid gap-2">
                <span className="text-sm font-medium text-slate-600">流水图片</span>
                {txnPhotoLoading ? (
                  <div className="text-xs text-slate-500">加载中...</div>
                ) : txnPhotoRows.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    {txnPhotoRows.map((photo) => {
                      const path = buildPhotoPath(photo.file_path)
                      return (
                        <div
                          key={photo.id}
                          className="aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-white"
                        >
                          <img
                            src={path ? txnPhotoUrls[path] || "" : ""}
                            alt={photo.file_path}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">暂无图片</div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ReversalDialog
        open={reversalOpen}
        onOpenChange={(open) => {
          setReversalOpen(open)
          if (!open) {
            reversalPhotos.reset()
          }
        }}
        reversalForm={reversalForm}
        operators={operators}
        photoPaths={reversalPhotos.selectedPaths}
        photoPreviewUrls={reversalPhotos.previewUrls}
        onPickPhotos={reversalPhotos.handlePick}
        onRemovePhoto={reversalPhotos.handleRemove}
        onSubmit={submitReversalFromForm}
        onBeforeSubmit={beforeReversalSubmit}
      />
    </div>
  )
}
