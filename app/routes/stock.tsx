import { useEffect, useRef, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useNavigate, useSearchParams } from "react-router"
import { PageHeader } from "~/components/common/page-header"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "~/components/ui/pagination"
import { Textarea } from "~/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { Combobox } from "~/components/common/combobox"
import { getSession } from "~/lib/auth"
import { tauriInvoke } from "~/lib/tauri"
import { toast } from "sonner"
import { open } from "@tauri-apps/plugin-dialog"
import {
  CountDialog,
  InboundDialog,
  MoveDialog,
  OutboundDialog,
  ReversalDialog,
  type CountFormValues,
  type InboundFormValues,
  type MoveFormValues,
  type OutboundFormValues,
  type ReversalFormValues,
  type SlotPickerValue,
} from "~/components/stock/stock-action-dialogs"

type StockBySlotRow = {
  warehouse_code?: string | null
  warehouse_name?: string | null
  rack_name: string
  rack_code: string
  slot_code: string
  item_code: string
  item_name: string
  operator_name?: string | null
  qty: number
}

type StockByItemRow = {
  warehouse_code?: string | null
  warehouse_name?: string | null
  rack_code: string
  rack_name: string
  item_code: string
  item_name: string
  slot_code: string
  operator_name?: string | null
  qty: number
}

type StockBySlotResult = {
  items: StockBySlotRow[]
  total: number
}

type StockByItemResult = {
  items: StockByItemRow[]
  total: number
}

type ItemRow = {
  id: string
  item_code: string
  name: string
  status: string
}

type ItemListResult = {
  items: ItemRow[]
  total: number
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

type RackRow = {
  id: string
  code: string
  name: string
  warehouse_id?: string | null
  status: string
  level_count: number
}

type RackListResult = {
  items: RackRow[]
  total: number
}

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

type StockExportResult = {
  file_path: string
}

export default function StockPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const actorOperatorId = (getSession() as any)?.actor_operator_id || ""
  const [slotRows, setSlotRows] = useState<StockBySlotRow[]>([])
  const [itemRows, setItemRows] = useState<StockByItemRow[]>([])
  const [items, setItems] = useState<ItemRow[]>([])
  const [operators, setOperators] = useState<OperatorRow[]>([])
  const [racks, setRacks] = useState<RackRow[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([])
  const [resourceLoading, setResourceLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("slot")
  const [keyword, setKeyword] = useState("")
  const [warehouseFilter, setWarehouseFilter] = useState("all")
  const [rackFilter, setRackFilter] = useState("all")
  const [slotFilter, setSlotFilter] = useState("all")
  const [itemFilter, setItemFilter] = useState("all")
  const [operatorFilter, setOperatorFilter] = useState("all")
  const [status, setStatus] = useState("all")
  const [inboundTarget, setInboundTarget] = useState<SlotPickerValue>({
    warehouseId: "",
    rackId: "",
    levelNo: "",
    slotCode: "",
  })
  const [selectedStockKey, setSelectedStockKey] = useState("")
  const [outboundSource, setOutboundSource] = useState<SlotPickerValue>({
    warehouseId: "",
    rackId: "",
    levelNo: "",
    slotCode: "",
  })
  const [moveSource, setMoveSource] = useState<SlotPickerValue>({
    warehouseId: "",
    rackId: "",
    levelNo: "",
    slotCode: "",
  })
  const [moveTarget, setMoveTarget] = useState<SlotPickerValue>({
    warehouseId: "",
    rackId: "",
    levelNo: "",
    slotCode: "",
  })
  const [countTarget, setCountTarget] = useState<SlotPickerValue>({
    warehouseId: "",
    rackId: "",
    levelNo: "",
    slotCode: "",
  })
  const inboundForm = useForm<InboundFormValues>({
    defaultValues: {
      item_code: "",
      to_slot_code: "",
      qty: "",
      occurred_at: "",
      operator_id: actorOperatorId,
      note: "",
    },
  })
  const outboundForm = useForm<OutboundFormValues>({
    defaultValues: {
      item_code: "",
      from_slot_code: "",
      qty: "",
      occurred_at: "",
      operator_id: actorOperatorId,
      note: "",
    },
  })
  const moveForm = useForm<MoveFormValues>({
    defaultValues: {
      item_code: "",
      from_slot_code: "",
      to_slot_code: "",
      qty: "",
      occurred_at: "",
      operator_id: actorOperatorId,
      note: "",
    },
  })
  const countForm = useForm<CountFormValues>({
    defaultValues: {
      item_code: "",
      slot_code: "",
      actual_qty: "",
      occurred_at: "",
      operator_id: actorOperatorId,
      note: "",
    },
  })
  const reversalForm = useForm<ReversalFormValues>({
    defaultValues: {
      txn_no: "",
      occurred_at: "",
      operator_id: actorOperatorId,
      note: "",
    },
  })
  const inbound = useWatch({ control: inboundForm.control }) || inboundForm.getValues()
  const outbound = useWatch({ control: outboundForm.control }) || outboundForm.getValues()
  const move = useWatch({ control: moveForm.control }) || moveForm.getValues()
  const count = useWatch({ control: countForm.control }) || countForm.getValues()
  const reversal =
    useWatch({ control: reversalForm.control }) || reversalForm.getValues()
  const [pageIndexSlot, setPageIndexSlot] = useState(1)
  const [pageIndexItem, setPageIndexItem] = useState(1)
  const [pageSize] = useState(20)
  const [totalSlot, setTotalSlot] = useState(0)
  const [totalItem, setTotalItem] = useState(0)
  const [inboundOpen, setInboundOpen] = useState(false)
  const [outboundOpen, setOutboundOpen] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [countOpen, setCountOpen] = useState(false)
  const [reversalOpen, setReversalOpen] = useState(false)
  const handledOpenRef = useRef<string | null>(null)
  const [inboundConfirmOpen, setInboundConfirmOpen] = useState(false)
  const [inboundConfirmDetail, setInboundConfirmDetail] = useState("")
  const inboundConfirmResolverRef = useRef<((value: boolean) => void) | null>(null)

  const buildPhotoPreviewUrl = async (path: string) => {
    const bytes = await tauriInvoke<number[]>("read_photo_bytes", {
      input: { path },
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
              const url = await buildPhotoPreviewUrl(path)
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

  const inboundPhotos = usePhotoPicker()
  const outboundPhotos = usePhotoPicker()
  const movePhotos = usePhotoPicker()
  const countPhotos = usePhotoPicker()
  const reversalPhotos = usePhotoPicker()

  const inboundSlotItems = slotRows.filter(
    (row) => row.slot_code === inbound.to_slot_code && row.qty > 0,
  )
  const moveSourceItems = slotRows.filter(
    (row) => row.slot_code === move.from_slot_code && row.qty > 0,
  )
  const moveTargetItems = slotRows.filter(
    (row) => row.slot_code === move.to_slot_code && row.qty > 0,
  )

  const searchItemOptions = async (keyword: string) => {
    const result = await tauriInvoke<ItemListResult>("list_items", {
      query: {
        keyword: keyword || undefined,
        page_index: 1,
        page_size: 50,
      },
    })
    return result.items
      .filter((item) => item.status === "active")
      .map((item) => ({
        value: item.item_code,
        label: (
          <span className="flex items-center gap-2">
            <Badge variant="secondary" className="shrink-0">
              {item.item_code}
            </Badge>
            <span className="truncate">{item.name}</span>
          </span>
        ),
        searchLabel: `${item.item_code} ${item.name}`,
      }))
  }

  useEffect(() => {
    setResourceLoading(true)
    Promise.all([
      tauriInvoke<ItemListResult>("list_items", {
        query: {
          keyword: undefined,
          page_index: 1,
          page_size: 5000,
        },
      }),
      tauriInvoke<RackListResult>("list_racks", {
        input: { page_index: 1, page_size: 2000 },
      }),
      tauriInvoke<WarehouseListResult>("list_warehouses", {
        input: {
          page_index: 1,
          page_size: 2000,
        },
      }),
      tauriInvoke<OperatorListResult>("list_operators", {
        query: {
          page_index: 1,
          page_size: 2000,
        },
      }),
    ])
      .then(([itemResult, rackResult, warehouseResult, operatorResult]) => {
        setItems(itemResult.items.filter((item) => item.status === "active"))
        setRacks(rackResult.items.filter((rack) => rack.status === "active"))
        setWarehouses(warehouseResult.items.filter((warehouse) => warehouse.status === "active"))
        setOperators(operatorResult.items)
      })
      .catch(() => {
        setItems([])
        setRacks([])
        setWarehouses([])
        setOperators([])
      })
      .finally(() => {
        setResourceLoading(false)
      })
  }, [actorOperatorId])

  useEffect(() => {
    if (!inboundForm.getValues("operator_id")) {
      inboundForm.setValue("operator_id", actorOperatorId)
    }
    if (!outboundForm.getValues("operator_id")) {
      outboundForm.setValue("operator_id", actorOperatorId)
    }
    if (!moveForm.getValues("operator_id")) {
      moveForm.setValue("operator_id", actorOperatorId)
    }
    if (!countForm.getValues("operator_id")) {
      countForm.setValue("operator_id", actorOperatorId)
    }
    if (!reversalForm.getValues("operator_id")) {
      reversalForm.setValue("operator_id", actorOperatorId)
    }
  }, [actorOperatorId])

  const fetchStock = async (
    slotPage = pageIndexSlot,
    itemPage = pageIndexItem
  ) => {
    setLoading(true)
    try {
      const [bySlot, byItem] = await Promise.all([
        tauriInvoke<StockBySlotResult>("list_stock_by_slot", {
          input: {
            page_index: slotPage,
            page_size: pageSize,
          },
        }),
        tauriInvoke<StockByItemResult>("list_stock_by_item", {
          input: {
            page_index: itemPage,
            page_size: pageSize,
          },
        }),
      ])
      setSlotRows(bySlot.items)
      setTotalSlot(bySlot.total)
      setItemRows(byItem.items)
      setTotalItem(byItem.total)
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载库存失败"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStock(pageIndexSlot, pageIndexItem)
  }, [pageIndexSlot, pageIndexItem])

  useEffect(() => {
    const openTarget = searchParams.get("open")
    if (!openTarget) return
    if (handledOpenRef.current === openTarget) {
      return
    }
    handledOpenRef.current = openTarget
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete("open")
    const closeParam = () => setSearchParams(nextParams, { replace: true })

    if (openTarget === "inbound") {
      setInboundOpen(true)
      closeParam()
      return
    }

    if (!selectedStockKey) {
      toast.error("请选择库存信息")
      closeParam()
      return
    }

    if (openTarget === "outbound") {
      applySelectedStock("outbound")
      setOutboundOpen(true)
    } else if (openTarget === "move") {
      applySelectedStock("move")
      setMoveOpen(true)
    } else if (openTarget === "count") {
      applySelectedStock("count")
      setCountOpen(true)
    }
    closeParam()
  }, [searchParams, setSearchParams, selectedStockKey])

  useEffect(() => {
    const tabParam = searchParams.get("tab")
    if (tabParam === "slot" || tabParam === "item") {
      setActiveTab(tabParam)
    }
    const warehouseParam = searchParams.get("warehouse_code")
    if (warehouseParam) {
      setWarehouseFilter(warehouseParam)
      setActiveTab("slot")
    }
    const rackParam = searchParams.get("rack_code")
    if (rackParam) {
      setRackFilter(rackParam)
      setActiveTab("slot")
    }
    const slotParam = searchParams.get("slot_code")
    if (slotParam) {
      setSlotFilter(slotParam)
      setActiveTab("slot")
    }
    const itemParam = searchParams.get("item_code")
    if (itemParam) {
      setItemFilter(itemParam)
      setActiveTab("item")
    }
  }, [searchParams])

  const handleExport = async () => {
    try {
      const result = await tauriInvoke<StockExportResult>("export_stock", {
        // pass empty args to trigger wrapper actor id injection
        
      })
      toast.success(`导出成功：${result.file_path}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "导出失败"
      toast.error(message)
    }
  }

  const parseTime = (value: string) => {
    if (!value) return Math.floor(Date.now() / 1000)
    return Math.floor(new Date(value).getTime() / 1000)
  }

  const requestInboundConfirm = (detail: string) =>
    new Promise<boolean>((resolve) => {
      inboundConfirmResolverRef.current = resolve
      setInboundConfirmDetail(detail)
      setInboundConfirmOpen(true)
    })

  const uploadTxnPhotos = async (
    txnNo: string,
    photoPaths: string[],
    resetPhotos: () => void,
  ) => {
    if (photoPaths.length === 0) return
    try {
      await tauriInvoke("add_photos", {
        input: {
          photo_type: "txn",
          data_id: txnNo,
          src_paths: photoPaths,
        },
      })
      toast.success("图片上传成功")
      resetPhotos()
    } catch (err) {
      const message = err instanceof Error ? err.message : "图片上传失败"
      toast.error(message)
    }
  }

  const submitInbound = async (values: InboundFormValues) => {
    const hasSameItem = inboundSlotItems.some(
      (row) => row.item_code === values.item_code && row.qty > 0,
    )
    if (inboundSlotItems.length > 0 && !hasSameItem) {
      const itemNames = inboundSlotItems
        .map((row) => `${row.item_code} ${row.item_name} × ${row.qty}`)
        .join("\n")
      const confirmed = await requestInboundConfirm(
        `该库位已有物品存放，仍要继续入库吗？\n\n${itemNames}`,
      )
      if (!confirmed) {
        return false
      }
    }
    try {
      const txnNo = await tauriInvoke<string>("create_inbound", {
        input: {
          item_code: values.item_code,
          to_slot_code: values.to_slot_code,
          qty: Number(values.qty),
          occurred_at: parseTime(values.occurred_at),
          operator_id: values.operator_id || undefined,
          note: values.note || null,
        },
      })
      await uploadTxnPhotos(txnNo, inboundPhotos.selectedPaths, inboundPhotos.reset)
      toast.success("入库成功")
      setInboundTarget({ warehouseId: "", rackId: "", levelNo: "", slotCode: "" })
      inboundForm.reset({
        item_code: "",
        to_slot_code: "",
        qty: "",
        occurred_at: "",
        operator_id: actorOperatorId,
        note: "",
      })
      await fetchStock()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "入库失败"
      toast.error(message)
      return false
    }
  }

  const submitOutbound = async (values: OutboundFormValues) => {
    try {
      const txnNo = await tauriInvoke<string>("create_outbound", {
        input: {
          item_code: values.item_code,
          from_slot_code: values.from_slot_code,
          qty: Number(values.qty),
          occurred_at: parseTime(values.occurred_at),
          operator_id: values.operator_id || undefined,
          note: values.note || null,
        },
      })
      await uploadTxnPhotos(txnNo, outboundPhotos.selectedPaths, outboundPhotos.reset)
      toast.success("出库成功")
      await fetchStock()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "出库失败"
      toast.error(message)
      return false
    }
  }

  const submitMove = async (values: MoveFormValues) => {
    try {
      const txnNo = await tauriInvoke<string>("create_move", {
        input: {
          item_code: values.item_code,
          from_slot_code: values.from_slot_code,
          to_slot_code: values.to_slot_code,
          qty: Number(values.qty),
          occurred_at: parseTime(values.occurred_at),
          operator_id: values.operator_id || undefined,
          note: values.note || null,
        },
      })
      await uploadTxnPhotos(txnNo, movePhotos.selectedPaths, movePhotos.reset)
      toast.success("移库成功")
      await fetchStock()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "移库失败"
      toast.error(message)
      return false
    }
  }

  const submitCount = async (values: CountFormValues) => {
    try {
      const txnNo = await tauriInvoke<string>("create_count", {
        input: {
          item_code: values.item_code,
          slot_code: values.slot_code,
          actual_qty: Number(values.actual_qty),
          occurred_at: parseTime(values.occurred_at),
          operator_id: values.operator_id || undefined,
          note: values.note || null,
        },
      })
      await uploadTxnPhotos(txnNo, countPhotos.selectedPaths, countPhotos.reset)
      toast.success("盘点成功")
      await fetchStock()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "盘点失败"
      toast.error(message)
      return false
    }
  }

  const submitReversal = async (values: ReversalFormValues) => {
    try {
      const txnNo = await tauriInvoke<string>("reverse_txn", {
        input: {
          txn_no: values.txn_no,
          occurred_at: parseTime(values.occurred_at),
          operator_id: values.operator_id || undefined,
          // operator_username is UI-only; rely on wrapper-injected actor_operator_id
          note: values.note || null,
        },
      })
      await uploadTxnPhotos(txnNo, reversalPhotos.selectedPaths, reversalPhotos.reset)
      toast.success("冲正成功")
      await fetchStock()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "冲正失败"
      toast.error(message)
      return false
    }
  }

  const submitInboundFromForm = async () => {
    let ok = false
    await inboundForm.handleSubmit(async (values) => {
      ok = await submitInbound(values)
    })()
    return ok
  }

  const submitOutboundFromForm = async () => {
    let ok = false
    await outboundForm.handleSubmit(async (values) => {
      ok = await submitOutbound(values)
    })()
    return ok
  }

  const submitMoveFromForm = async () => {
    let ok = false
    await moveForm.handleSubmit(async (values) => {
      ok = await submitMove(values)
    })()
    return ok
  }

  const submitCountFromForm = async () => {
    let ok = false
    await countForm.handleSubmit(async (values) => {
      ok = await submitCount(values)
    })()
    return ok
  }

  const submitReversalFromForm = async () => {
    let ok = false
    await reversalForm.handleSubmit(async (values) => {
      ok = await submitReversal(values)
    })()
    return ok
  }

  const beforeInboundSubmit = async () => {
    // if (!inboundTarget.warehouseId) {
    //   toast.error("请选择仓库")
    //   return false
    // }
    return inboundForm.trigger()
  }

  const beforeOutboundSubmit = async () => {
    // if (!selectedStockKey) {
    //   toast.error("请选择库存信息")
    //   return false
    // }
    return outboundForm.trigger()
  }

  const beforeMoveSubmit = async () => {
    // if (!selectedStockKey) {
    //   toast.error("请选择库存信息")
    //   return false
    // }
    return moveForm.trigger()
  }

  const beforeCountSubmit = async () => {
    // if (!selectedStockKey) {
    //   toast.error("请选择库存信息")
    //   return false
    // }
    return countForm.trigger()
  }

  const beforeReversalSubmit = () => reversalForm.trigger()

  const formatSlotCode = (slotCode: string) => slotCode

  const allRows = [...slotRows, ...itemRows]
  const warehouseOptions = Array.from(
    new Map(
      allRows
        .filter((row) => row.warehouse_code && row.warehouse_name)
        .map((row) => [
          row.warehouse_code as string,
          { code: row.warehouse_code as string, name: row.warehouse_name as string },
        ])
    ).values()
  )
  const rackOptions = Array.from(
    new Map(
      allRows
        .filter((row) =>
          warehouseFilter === "all" ? true : row.warehouse_code === warehouseFilter
        )
        .map((row) => [row.rack_code, { code: row.rack_code, name: row.rack_name }])
    ).values()
  )
  const slotOptions = Array.from(
    new Set(
      allRows
        .filter((row) =>
          warehouseFilter === "all" ? true : row.warehouse_code === warehouseFilter
        )
        .filter((row) => (rackFilter === "all" ? true : row.rack_code === rackFilter))
        .map((row) => row.slot_code)
    )
  )
  const itemOptions = Array.from(
    new Map(
      allRows.map((row) => [row.item_code, { code: row.item_code, name: row.item_name }])
    ).values()
  )
  const operatorOptions = Array.from(
    new Set(
      allRows
        .map((row) => row.operator_name)
        .filter((name): name is string => Boolean(name))
    )
  )

  useEffect(() => {
    if (warehouseFilter !== "all") {
      const hasRack = rackOptions.some((rack) => rack.code === rackFilter)
      if (!hasRack) {
        setRackFilter("all")
      }
    }
    setSlotFilter("all")
  }, [warehouseFilter])

  useEffect(() => {
    if (rackFilter !== "all") {
      const hasSlot = slotOptions.includes(slotFilter)
      if (!hasSlot) {
        setSlotFilter("all")
      }
    }
  }, [rackFilter, slotOptions])

  const filteredSlotRows = slotRows.filter((row) => {
    const matchesKeyword =
      !keyword ||
      (row.warehouse_name || "").includes(keyword) ||
      row.rack_name.includes(keyword) ||
      row.item_code.includes(keyword) ||
      row.item_name.includes(keyword) ||
      row.slot_code.includes(keyword) ||
      row.rack_code.includes(keyword)
    const matchesStatus =
      status === "all" ||
      (status === "empty" && row.qty === 0) ||
      (status === "low" && row.qty > 0 && row.qty < 5) ||
      (status === "normal" && row.qty >= 5)
    const matchesWarehouse =
      warehouseFilter === "all" || row.warehouse_code === warehouseFilter
    const matchesRack = rackFilter === "all" || row.rack_code === rackFilter
    const matchesSlot = slotFilter === "all" || row.slot_code === slotFilter
    const matchesItem = itemFilter === "all" || row.item_code === itemFilter
    const matchesOperator =
      operatorFilter === "all" || row.operator_name === operatorFilter
    return (
      matchesKeyword &&
      matchesStatus &&
      matchesWarehouse &&
      matchesRack &&
      matchesSlot &&
      matchesItem &&
      matchesOperator
    )
  })

  const filteredItemRows = itemRows.filter((row) => {
    const matchesKeyword =
      !keyword ||
      (row.warehouse_name || "").includes(keyword) ||
      row.rack_name.includes(keyword) ||
      row.item_code.includes(keyword) ||
      row.item_name.includes(keyword) ||
      row.slot_code.includes(keyword)
    const matchesWarehouse =
      warehouseFilter === "all" || row.warehouse_code === warehouseFilter
    const matchesRack = rackFilter === "all" || row.rack_code === rackFilter
    const matchesSlot = slotFilter === "all" || row.slot_code === slotFilter
    const matchesItem = itemFilter === "all" || row.item_code === itemFilter
    const matchesOperator =
      operatorFilter === "all" || row.operator_name === operatorFilter
    return (
      matchesKeyword &&
      matchesWarehouse &&
      matchesRack &&
      matchesSlot &&
      matchesItem &&
      matchesOperator
    )
  })
  const selectedStockRow =
    slotRows.find((row) => `${row.item_code}|${row.slot_code}` === selectedStockKey) ||
    null
  const applyStockRow = (
    row: StockBySlotRow | StockByItemRow,
    mode: "outbound" | "move" | "count"
  ) => {
    const rack = racks.find((item) => item.code === row.rack_code)
    const levelMatch = row.slot_code.match(/-L(\d+)-S/)
    const levelNo = levelMatch ? levelMatch[1] : ""
    if (mode === "outbound") {
      outboundForm.setValue("item_code", row.item_code)
      outboundForm.setValue("from_slot_code", row.slot_code)
      setOutboundSource({
        warehouseId: rack?.warehouse_id || "",
        rackId: rack?.id || "",
        levelNo,
        slotCode: row.slot_code,
      })
    }
    if (mode === "move") {
      moveForm.setValue("item_code", row.item_code)
      moveForm.setValue("from_slot_code", row.slot_code)
      setMoveSource({
        warehouseId: rack?.warehouse_id || "",
        rackId: rack?.id || "",
        levelNo,
        slotCode: row.slot_code,
      })
    }
    if (mode === "count") {
      countForm.setValue("item_code", row.item_code)
      countForm.setValue("slot_code", row.slot_code)
      setCountTarget({
        warehouseId: rack?.warehouse_id || "",
        rackId: rack?.id || "",
        levelNo,
        slotCode: row.slot_code,
      })
    }
  }

  const applySelectedStock = (mode: "outbound" | "move" | "count") => {
    if (!selectedStockRow) return
    applyStockRow(selectedStockRow, mode)
  }

  return (
    <div className="space-y-6">
      <AlertDialog
        open={inboundConfirmOpen}
        onOpenChange={(next) => {
          setInboundConfirmOpen(next)
          if (!next) {
            inboundConfirmResolverRef.current?.(false)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认继续入库</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {inboundConfirmDetail}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => inboundConfirmResolverRef.current?.(false)}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => inboundConfirmResolverRef.current?.(true)}
            >
              确认继续
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PageHeader
        title="库存管理"
        description="当前库存与库存作业集中处理。"
        actions={
          <div className="flex flex-wrap gap-2">
            <InboundDialog
              open={inboundOpen}
              onOpenChange={(open) => {
                setInboundOpen(open)
                if (!open) {
                  inboundPhotos.reset()
                }
              }}
              trigger={<Button>入库</Button>}
              items={items}
              operators={operators}
              warehouses={warehouses}
              racks={racks}
              actorOperatorId={actorOperatorId}
              resourceLoading={resourceLoading}
              inboundForm={inboundForm}
              inboundTarget={inboundTarget}
              setInboundTarget={setInboundTarget}
              inboundSlotItems={inboundSlotItems}
              searchItemOptions={searchItemOptions}
              photoPaths={inboundPhotos.selectedPaths}
              photoPreviewUrls={inboundPhotos.previewUrls}
              onPickPhotos={inboundPhotos.handlePick}
              onRemovePhoto={inboundPhotos.handleRemove}
              onSubmit={submitInboundFromForm}
              onBeforeSubmit={beforeInboundSubmit}
            />
            <OutboundDialog
              open={outboundOpen}
              onOpenChange={(open) => {
                setOutboundOpen(open)
                if (!open) {
                  outboundPhotos.reset()
                }
              }}
              trigger={
                <Button
                  variant="outline"
                  onClick={(event) => {
                    if (!selectedStockKey) {
                      event.preventDefault()
                      event.stopPropagation()
                      toast.error("请选择库存信息")
                      return
                    }
                    applySelectedStock("outbound")
                  }}
                >
                  出库
                </Button>
              }
              items={items}
              operators={operators}
              warehouses={warehouses}
              racks={racks}
              actorOperatorId={actorOperatorId}
              outboundForm={outboundForm}
              outboundSource={outboundSource}
              setOutboundSource={setOutboundSource}
              photoPaths={outboundPhotos.selectedPaths}
              photoPreviewUrls={outboundPhotos.previewUrls}
              onPickPhotos={outboundPhotos.handlePick}
              onRemovePhoto={outboundPhotos.handleRemove}
              onSubmit={submitOutboundFromForm}
              onBeforeSubmit={beforeOutboundSubmit}
            />
            <MoveDialog
              open={moveOpen}
              onOpenChange={(open) => {
                setMoveOpen(open)
                if (!open) {
                  movePhotos.reset()
                }
              }}
              trigger={
                <Button
                  variant="outline"
                  onClick={(event) => {
                    if (!selectedStockKey) {
                      event.preventDefault()
                      event.stopPropagation()
                      toast.error("请选择库存信息")
                      return
                    }
                    applySelectedStock("move")
                  }}
                >
                  移库
                </Button>
              }
              items={items}
              operators={operators}
              warehouses={warehouses}
              racks={racks}
              actorOperatorId={actorOperatorId}
              moveForm={moveForm}
              moveSource={moveSource}
              setMoveSource={setMoveSource}
              moveTarget={moveTarget}
              setMoveTarget={setMoveTarget}
              moveTargetItems={moveTargetItems}
              photoPaths={movePhotos.selectedPaths}
              photoPreviewUrls={movePhotos.previewUrls}
              onPickPhotos={movePhotos.handlePick}
              onRemovePhoto={movePhotos.handleRemove}
              onSubmit={submitMoveFromForm}
              onBeforeSubmit={beforeMoveSubmit}
            />
            <CountDialog
              open={countOpen}
              onOpenChange={(open) => {
                setCountOpen(open)
                if (!open) {
                  countPhotos.reset()
                }
              }}
              trigger={
                <Button
                  variant="outline"
                  onClick={(event) => {
                    if (!selectedStockKey) {
                      event.preventDefault()
                      event.stopPropagation()
                      toast.error("请选择库存信息")
                      return
                    }
                    applySelectedStock("count")
                  }}
                >
                  盘点
                </Button>
              }
              items={items}
              operators={operators}
              warehouses={warehouses}
              racks={racks}
              actorOperatorId={actorOperatorId}
              countForm={countForm}
              countTarget={countTarget}
              setCountTarget={setCountTarget}
              photoPaths={countPhotos.selectedPaths}
              photoPreviewUrls={countPhotos.previewUrls}
              onPickPhotos={countPhotos.handlePick}
              onRemovePhoto={countPhotos.handleRemove}
              onSubmit={submitCountFromForm}
              onBeforeSubmit={beforeCountSubmit}
            />
            <ReversalDialog
              reversalForm={reversalForm}
              operators={operators}
              open={reversalOpen}
              onOpenChange={(open) => {
                setReversalOpen(open)
                if (!open) {
                  reversalPhotos.reset()
                }
              }}
              photoPaths={reversalPhotos.selectedPaths}
              photoPreviewUrls={reversalPhotos.previewUrls}
              onPickPhotos={reversalPhotos.handlePick}
              onRemovePhoto={reversalPhotos.handleRemove}
              trigger={<Button variant="outline">冲正</Button>}
              onSubmit={submitReversalFromForm}
              onBeforeSubmit={beforeReversalSubmit}
            />
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
        <div className="min-w-[180px] flex-1 space-y-2">
          <Label>搜索</Label>
          <Input
            placeholder="物品/货架/位置"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>状态</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="请选择" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="normal">正常</SelectItem>
              <SelectItem value="low">低库存</SelectItem>
              <SelectItem value="empty">缺货</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px] space-y-2">
          <Label>仓库</Label>
          <Combobox
            value={warehouseFilter}
            onChange={setWarehouseFilter}
            placeholder="全部"
            options={[
              { value: "all", label: "全部" },
              ...warehouseOptions.map((warehouse) => ({
                value: warehouse.code,
                label: (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{warehouse.code}</Badge>
                    <span className="truncate">{warehouse.name}</span>
                  </div>
                ),
                searchLabel: `${warehouse.code} ${warehouse.name}`,
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
              ...rackOptions.map((rack) => ({
                value: rack.code,
                label: (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{rack.code}</Badge>
                    <span className="truncate">{rack.name}</span>
                  </div>
                ),
                searchLabel: `${rack.code} ${rack.name}`,
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
              ...slotOptions.map((slotCode) => ({
                value: slotCode,
                label: slotCode,
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
              ...itemOptions.map((item) => ({
                value: item.code,
                label: (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{item.code}</Badge>
                    <span className="truncate">{item.name}</span>
                  </div>
                ),
                searchLabel: `${item.code} ${item.name}`,
              })),
            ]}
          />
        </div>
        <div className="min-w-[160px] space-y-2">
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
            setKeyword("")
            setStatus("all")
            setWarehouseFilter("all")
            setRackFilter("all")
            setSlotFilter("all")
            setItemFilter("all")
            setOperatorFilter("all")
          }}
        >
          重置
        </Button>
        <Button variant="outline" onClick={handleExport}>
          导出
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="slot">按库位</TabsTrigger>
          <TabsTrigger value="item">按物品</TabsTrigger>
        </TabsList>
      <TabsContent value="slot" className="mt-4">
        <div className="rounded-2xl border border-slate-200/70 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">选择</TableHead>
                <TableHead>仓库</TableHead>
                <TableHead>货架</TableHead>
                <TableHead>位置</TableHead>
                <TableHead>物品编号</TableHead>
                <TableHead>物品名称</TableHead>
                <TableHead>数量</TableHead>
                <TableHead>记录人</TableHead>
                <TableHead className="text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {filteredSlotRows.map((row) => (
                  <TableRow key={`${row.slot_code}-${row.item_code}`}>
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-slate-900"
                        checked={selectedStockKey === `${row.item_code}|${row.slot_code}`}
                        disabled={row.qty <= 0}
                        onChange={(event) => {
                          const key = `${row.item_code}|${row.slot_code}`
                          if (event.target.checked) {
                            setSelectedStockKey(key)
                          } else if (selectedStockKey === key) {
                            setSelectedStockKey("")
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.warehouse_code && row.warehouse_name ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{row.warehouse_code}</Badge>
                          <span className="truncate">{row.warehouse_name}</span>
                        </div>
                      ) : (
                        row.warehouse_name || "-"
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{row.rack_code}</Badge>
                        <span className="truncate">{row.rack_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatSlotCode(row.slot_code)}</TableCell>
                    <TableCell>{row.item_code}</TableCell>
                    <TableCell>{row.item_name}</TableCell>
                    <TableCell>{row.qty}</TableCell>
                    <TableCell>{row.operator_name || "-"}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={row.qty <= 0}
                          onClick={() => {
                            const key = `${row.item_code}|${row.slot_code}`
                            setSelectedStockKey(key)
                            applyStockRow(row, "outbound")
                            setOutboundOpen(true)
                          }}
                        >
                          出库
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
                                const key = `${row.item_code}|${row.slot_code}`
                                setSelectedStockKey(key)
                                applyStockRow(row, "move")
                                setMoveOpen(true)
                              }}
                            >
                              移库
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                const key = `${row.item_code}|${row.slot_code}`
                                setSelectedStockKey(key)
                                applyStockRow(row, "count")
                                setCountOpen(true)
                              }}
                            >
                              盘点
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                navigate(
                                  `/txns?slot_code=${encodeURIComponent(row.slot_code)}`
                                )
                              }}
                            >
                              查看流水
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filteredSlotRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-slate-500">
                      暂无库存数据
                    </TableCell>
                  </TableRow>
                ) : null}
            </TableBody>
          </Table>
        </div>
          {totalSlot > 0 ? (
            <Pagination className="justify-between pt-3">
              <p className="text-xs text-slate-500">
                共 {totalSlot} 条，当前第 {pageIndexSlot}/
                {Math.max(1, Math.ceil(totalSlot / pageSize))} 页
              </p>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault()
                      setPageIndexSlot((prev) => Math.max(1, prev - 1))
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault()
                      const totalPages = Math.max(
                        1,
                        Math.ceil(totalSlot / pageSize)
                      )
                      setPageIndexSlot((prev) => Math.min(totalPages, prev + 1))
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </TabsContent>
        <TabsContent value="item" className="mt-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">选择</TableHead>
                <TableHead>仓库</TableHead>
                <TableHead>货架</TableHead>
                <TableHead>物品编号</TableHead>
                <TableHead>物品名称</TableHead>
                <TableHead>位置</TableHead>
                  <TableHead>数量</TableHead>
                  <TableHead>记录人</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItemRows.map((row) => (
                  <TableRow key={`${row.item_code}-${row.slot_code}`}>
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-slate-900"
                        checked={selectedStockKey === `${row.item_code}|${row.slot_code}`}
                        disabled={row.qty <= 0}
                        onChange={(event) => {
                          const key = `${row.item_code}|${row.slot_code}`
                          if (event.target.checked) {
                            setSelectedStockKey(key)
                          } else if (selectedStockKey === key) {
                            setSelectedStockKey("")
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.warehouse_code && row.warehouse_name ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{row.warehouse_code}</Badge>
                          <span className="truncate">{row.warehouse_name}</span>
                        </div>
                      ) : (
                        row.warehouse_name || "-"
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{row.rack_code}</Badge>
                        <span className="truncate">{row.rack_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{row.item_code}</TableCell>
                    <TableCell>{row.item_name}</TableCell>
                    <TableCell>{formatSlotCode(row.slot_code)}</TableCell>
                    <TableCell>{row.qty}</TableCell>
                    <TableCell>{row.operator_name || "-"}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={row.qty <= 0}
                          onClick={() => {
                            const key = `${row.item_code}|${row.slot_code}`
                            setSelectedStockKey(key)
                            applyStockRow(row, "outbound")
                            setOutboundOpen(true)
                          }}
                        >
                          出库
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={row.qty <= 0}
                          onClick={() => {
                            const key = `${row.item_code}|${row.slot_code}`
                            setSelectedStockKey(key)
                            applyStockRow(row, "count")
                            setCountOpen(true)
                          }}
                        >
                          盘点
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
                                const key = `${row.item_code}|${row.slot_code}`
                                setSelectedStockKey(key)
                                applyStockRow(row, "move")
                                setMoveOpen(true)
                              }}
                            >
                              移库
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                const key = `${row.item_code}|${row.slot_code}`
                                setSelectedStockKey(key)
                                applyStockRow(row, "count")
                                setCountOpen(true)
                              }}
                            >
                              盘点
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                navigate(
                                  `/txns?slot_code=${encodeURIComponent(row.slot_code)}`
                                )
                              }}
                            >
                              查看流水
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filteredItemRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-slate-500">
                      暂无库存数据
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          {totalItem > 0 ? (
            <Pagination className="justify-between pt-3">
              <p className="text-xs text-slate-500">
                共 {totalItem} 条，当前第 {pageIndexItem}/
                {Math.max(1, Math.ceil(totalItem / pageSize))} 页
              </p>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault()
                      setPageIndexItem((prev) => Math.max(1, prev - 1))
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault()
                      const totalPages = Math.max(
                        1,
                        Math.ceil(totalItem / pageSize)
                      )
                      setPageIndexItem((prev) => Math.min(totalPages, prev + 1))
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </TabsContent>
      </Tabs>

    </div>
  )
}
