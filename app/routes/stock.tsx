import { useEffect, useRef, useState } from "react";
import { set, useForm, useWatch } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";
import { PageHeader } from "~/components/common/page-header";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "~/components/ui/alert-dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "~/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Combobox } from "~/components/common/combobox";
import { SlotPicker } from "~/components/common/pickers/slot-picker";
import { WarehousePicker } from "~/components/common/pickers/warehouse-picker";
import { RackPicker } from "~/components/common/pickers/rack-picker";
import { ItemPicker } from "~/components/common/pickers/item-picker";
/* SlotPicker replaced by SlotCascaderPicker inside dialogs; no direct import needed here */
import { OperatorPicker } from "~/components/common/pickers/operator-picker";
import { getSession } from "~/lib/auth";
import { tauriInvoke } from "~/lib/tauri";
import { toast } from "sonner";
import { CommonDialog } from "~/components/common/common-dialogs";
import InboundForm from "~/components/stock/forms/inbound-form";
import OutboundForm from "~/components/stock/forms/outbound-form";
import MoveForm from "~/components/stock/forms/move-form";
import CountForm from "~/components/stock/forms/count-form";

import { type OutboundFormValues, type InboundFormValues, type MoveFormValues, type CountFormValues } from "~/components/stock/types";
type StockBySlotRow = {
  warehouse_id?: string | null;
  warehouse_code?: string | null;
  warehouse_name?: string | null;
  rack_id?: string | null;
  rack_name: string;
  rack_code: string;
  slot_id?: string | null;
  slot_code: string;
  item_id: string;
  item_code: string;
  item_name: string;
  operator_name?: string | null;
  qty: number;
};

type StockByItemRow = {
  warehouse_id?: string | null;
  warehouse_code?: string | null;
  warehouse_name?: string | null;
  rack_id?: string | null;
  rack_name: string;
  rack_code: string;
  slot_id?: string | null;
  slot_code: string;
  item_id: string;
  item_code: string;
  item_name: string;
  operator_name?: string | null;
  qty: number;
};

type StockBySlotResult = {
  items: StockBySlotRow[];
  total: number;
};

type StockByItemResult = {
  items: StockByItemRow[];
  total: number;
};

type ItemRow = {
  id: string;
  item_code: string;
  name: string;
  status: string;
};

type ItemListResult = {
  items: ItemRow[];
  total: number;
};

type OperatorRow = {
  id: string;
  username: string;
  display_name: string;
  status: string;
  role: string;
  created_at: number;
};

type OperatorListResult = {
  items: OperatorRow[];
  total: number;
};

type RackRow = {
  id: string;
  code: string;
  name: string;
  warehouse_id?: string | null;
  status: string;
  level_count: number;
};

type RackListResult = {
  items: RackRow[];
  total: number;
};

type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  created_at: number;
};

type WarehouseListResult = {
  items: WarehouseRow[];
  total: number;
};

type StockExportResult = {
  file_path: string;
};

export default function StockPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const actorOperatorId = (getSession() as any)?.actor_operator_id || "";
  const [slotRows, setSlotRows] = useState<StockBySlotRow[]>([]);
  const [itemRows, setItemRows] = useState<StockByItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "slot");
  const [keyword, setKeyword] = useState("");
  const [rackFilter, setRackFilter] = useState(searchParams.get("rack_id") || "");
  const [warehouseIdFilter, setWarehouseIdFilter] = useState(searchParams.get("warehouse_id") || "");
  const [slotIdFilter, setSlotIdFilter] = useState(searchParams.get("slot_id") || "");
  const [itemFilter, setItemFilter] = useState(searchParams.get("item_id") || "");
  const [operatorFilter, setOperatorFilter] = useState(searchParams.get("operator_id") || "");
  const [status, setStatus] = useState("all");
  const [selectedStockKey, setSelectedStockKey] = useState("");

  const outboundForm = useForm<OutboundFormValues>({
    defaultValues: {
      item_id: "",
      from_slot_id: "",
      qty: "",
      occurred_at: "",
      operator_id: actorOperatorId,
      note: "",
    },
  });
  const moveForm = useForm<MoveFormValues>({
    defaultValues: {
      item_id: "",
      from_slot_id: "",
      to_slot_id: "",
      qty: "",
      occurred_at: "",
      operator_id: actorOperatorId,
      note: "",
    },
  });
  const countForm = useForm<CountFormValues>({
    defaultValues: {
      item_id: "",
      slot_id: "",
      actual_qty: "",
      occurred_at: "",
      operator_id: actorOperatorId,
      note: "",
    },
  });

  const [pageIndexSlot, setPageIndexSlot] = useState(1);
  const [pageIndexItem, setPageIndexItem] = useState(1);
  const [pageSize] = useState(20);
  const [totalSlot, setTotalSlot] = useState(0);
  const [totalItem, setTotalItem] = useState(0);
  const [inboundOpen, setInboundOpen] = useState(false);
  const [outboundOpen, setOutboundOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [countOpen, setCountOpen] = useState(false);
  const [reversalOpen, setReversalOpen] = useState(false);
  const handledOpenRef = useRef<string | null>(null);
  const [inboundConfirmOpen, setInboundConfirmOpen] = useState(false);
  const [inboundConfirmDetail, setInboundConfirmDetail] = useState("");
  const inboundConfirmResolverRef = useRef<((value: boolean) => void) | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFilePath, setExportFilePath] = useState("");

  const fetchStock = async (slotPage = pageIndexSlot, itemPage = pageIndexItem, overrides: Partial<Record<string, any>> = {}) => {
    setLoading(true);
    try {
      // build filter params from current UI state; allow overrides to bypass
      // relying on React state updates when needed (e.g. reading URL params)
      const slotFilters = {
        page_index: slotPage,
        page_size: pageSize,
        keyword: (overrides.keyword ?? keyword) || undefined,
        warehouse_id: (overrides.warehouse_id ?? warehouseIdFilter) || undefined,
        rack_id: (overrides.rack_id ?? rackFilter) || undefined,
        slot_id: (overrides.slot_id ?? slotIdFilter) || undefined,
        item_id: (overrides.item_id ?? itemFilter) || undefined,
        operator_id: (overrides.operator_id ?? operatorFilter) || undefined,
        status: overrides.status ?? (status === "all" ? undefined : status),
      };
      const itemFilters = {
        page_index: itemPage,
        page_size: pageSize,
        keyword: (overrides.keyword ?? keyword) || undefined,
        warehouse_id: (overrides.warehouse_id ?? warehouseIdFilter) || undefined,
        rack_id: (overrides.rack_id ?? rackFilter) || undefined,
        slot_id: (overrides.slot_id ?? slotIdFilter) || undefined,
        item_id: (overrides.item_id ?? itemFilter) || undefined,
        operator_id: (overrides.operator_id ?? operatorFilter) || undefined,
        status: overrides.status ?? (status === "all" ? undefined : status),
      };

      const [bySlot, byItem] = await Promise.all([
        tauriInvoke<StockBySlotResult>("list_stock_by_slot", {
          input: slotFilters,
        }),
        tauriInvoke<StockByItemResult>("list_stock_by_item", {
          input: itemFilters,
        }),
      ]);
      setSlotRows(bySlot.items);
      setTotalSlot(bySlot.total);
      setItemRows(byItem.items);
      setTotalItem(byItem.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载库存失败";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const openTarget = searchParams.get("open");
    if (!openTarget) return;
    if (handledOpenRef.current === openTarget) {
      return;
    }
    handledOpenRef.current = openTarget;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("open");
    const closeParam = () => setSearchParams(nextParams, { replace: true });

    if (openTarget === "inbound") {
      setInboundOpen(true);
      closeParam();
      return;
    }

    if (!selectedStockKey) {
      toast.error("请选择库存信息");
      closeParam();
      return;
    }

    if (openTarget === "outbound") {
      (async () => {
        await applySelectedStock("outbound");
        setOutboundOpen(true);
      })();
    } else if (openTarget === "move") {
      (async () => {
        await applySelectedStock("move");
        setMoveOpen(true);
      })();
    } else if (openTarget === "count") {
      (async () => {
        await applySelectedStock("count");
        setCountOpen(true);
      })();
    }
    closeParam();
  }, [searchParams, setSearchParams, selectedStockKey]);

  const handleExport = async () => {
    try {
      const result = await tauriInvoke<StockExportResult>("export_stock", {
        // pass empty args to trigger wrapper actor id injection
        input: {
          keyword: keyword || undefined,
          warehouse_id: warehouseIdFilter || undefined,
          rack_id: rackFilter || undefined,
          slot_id: slotIdFilter || undefined,
          item_id: itemFilter || undefined,
          operator_id: operatorFilter || undefined
        },
      });
      // 用 AlertDialog 提示导出成功，并提供打开文件夹按钮
      setExportFilePath(result.file_path);
      setExportDialogOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "导出失败";
      toast.error(message);
    }
  };

  const formatSlotCode = (slotCode: string) => slotCode;
  // function useWhyDidYouUpdate(name: string, props: Record<string, any>) {
  //   const previousProps = useRef<Record<string, any>>({});

  //   useEffect(() => {
  //     if (previousProps.current) {
  //       const allKeys = Object.keys({ ...previousProps.current, ...props });
  //       const changedProps: Record<string, { from: any; to: any }> = {};

  //       allKeys.forEach((key) => {
  //         if (previousProps.current![key] !== props[key]) {
  //           changedProps[key] = {
  //             from: previousProps.current![key],
  //             to: props[key],
  //           };
  //         }
  //       });

  //       if (Object.keys(changedProps).length > 0) {
  //         console.log("[why-did-you-update]", name, changedProps);
  //       }
  //     }

  //     previousProps.current = props;
  //   });
  // }
  // useWhyDidYouUpdate("MyComponent", { pageIndexSlot, pageIndexItem, keyword, warehouseIdFilter, rackFilter, slotIdFilter, itemFilter, operatorFilter, status });
  useEffect(() => {
    fetchStock(pageIndexSlot, pageIndexItem);
  }, [pageIndexSlot, pageIndexItem, keyword, warehouseIdFilter, rackFilter, slotIdFilter, itemFilter, operatorFilter, status]);
  // 当筛选条件变化时，重置页码并重新请求库存数据
  useEffect(() => {
    setPageIndexSlot(1);
    setPageIndexItem(1);
  }, [keyword, warehouseIdFilter, rackFilter, slotIdFilter, itemFilter, operatorFilter, status]);

  const selectedStockRow = slotRows.find((row) => `${row.item_code}|${row.slot_code}` === selectedStockKey) || null;
  const applyStockRow = async (row: StockBySlotRow | StockByItemRow, mode: "outbound" | "move" | "count") => {
    const levelMatch = row.slot_code.match(/-L(\d+)-S/);
    const levelNo = levelMatch ? levelMatch[1] : "";
    // 尝试解析 slot id（避免后续重复解析）
    let slotId = row.slot_id || "";

    if (mode === "outbound") {
      outboundForm.setValue("item_id", row.item_id);
      outboundForm.setValue("from_slot_id", slotId);
      setOutboundOpen(true);
    }
    if (mode === "move") {
      moveForm.setValue("item_id", row.item_id);
      moveForm.setValue("from_slot_id", slotId);
      setMoveOpen(true);
    }
    if (mode === "count") {
      countForm.setValue("item_id", row.item_id);
      countForm.setValue("slot_id", slotId);
      setCountOpen(true);
    }
  };

  const applySelectedStock = async (mode: "outbound" | "move" | "count") => {
    if (!selectedStockRow) return;
    await applyStockRow(selectedStockRow, mode);
  };
  const openFolder = async (path: string) => {
    try {
      await tauriInvoke("open_folder", { path });
      console.log("Folder opened:", path);
    } catch (error) {
      console.error("Failed to open folder:", error);
    }
  };
  return (
    <div className="space-y-6">
      <CommonDialog title="入库" description="物品入库" open={inboundOpen} onOpenChange={setInboundOpen} content={<InboundForm onClose={() => setInboundOpen(false)} />} />
      <CommonDialog title="出库" description="物品出库" open={outboundOpen} onOpenChange={setOutboundOpen} content={<OutboundForm form={outboundForm} onClose={() => setOutboundOpen(false)} />} />
      <CommonDialog title="移库" description="物品移库" open={moveOpen} onOpenChange={setMoveOpen} content={<MoveForm form={moveForm} onClose={() => setMoveOpen(false)} />} />
      <CommonDialog title="盘点" description="盘点物品" open={countOpen} onOpenChange={setCountOpen} content={<CountForm form={countForm} onClose={() => setCountOpen(false)} />} />
      <AlertDialog
        open={inboundConfirmOpen}
        onOpenChange={(next) => {
          setInboundConfirmOpen(next);
          if (!next) {
            inboundConfirmResolverRef.current?.(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认继续入库</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">{inboundConfirmDetail}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => inboundConfirmResolverRef.current?.(false)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => inboundConfirmResolverRef.current?.(true)}>确认继续</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={exportDialogOpen}
        onOpenChange={(next) => {
          setExportDialogOpen(next);
          if (!next) {
            // 清理路径
            // 不需要返回值
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>导出完成</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">{exportFilePath}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setExportDialogOpen(false)}>关闭</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  const path = exportFilePath || "";
                  const dir = path.lastIndexOf("/") > -1 ? path.substring(0, path.lastIndexOf("/")) : path;
                  openFolder(dir);
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "打开文件夹失败";
                  toast.error(msg);
                }
              }}
            >
              打开文件夹
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PageHeader
        title="库存管理"
        description="当前库存与库存作业集中处理。"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setInboundOpen(true)}>入库</Button>
            <Button variant="outline" onClick={handleExport}>
              导出
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
        <div className="min-w-[140px] w-[140px] max-w-[140px] flex-1 space-y-2">
          <Label>搜索</Label>
          <Input placeholder="物品/货架/位置" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        </div>
        <div className="min-w-[180px] max-w-[180px] space-y-2">
          <Label>物品</Label>
          <ItemPicker value={itemFilter} onChange={(v) => setItemFilter(v || "")} placeholder="全部" />
        </div>
        {/* <div className="space-y-2">
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
          </div> */}
        <div className="min-w-[180px] max-w-[180px] space-y-2">
          <Label>仓库</Label>
          <WarehousePicker
            value={warehouseIdFilter}
            onChange={(nextId) => {
              setWarehouseIdFilter(nextId);
            }}
            placeholder="全部"
          />
        </div>
        <div className="min-w-[180px] max-w-[180px] space-y-2">
          <Label>货架</Label>
          <RackPicker value={rackFilter} warehouseId={warehouseIdFilter} onChange={setRackFilter} placeholder="全部" />
        </div>
        <div className="min-w-[180px] max-w-[180px] space-y-2">
          <Label>库位</Label>
          <SlotPicker value={slotIdFilter} rackId={rackFilter} warehouseId={warehouseIdFilter} onChange={(v) => setSlotIdFilter(v || "")} placeholder="全部" />
        </div>
        <div className="flex-1 space-y-2">
          <Label>记录人</Label>
          <div className="min-w-[180px] max-w-[180px]">
            <OperatorPicker value={operatorFilter} onChange={(v) => setOperatorFilter(v || "")} placeholder="全部" />
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setPageIndexItem(1);
            setPageIndexSlot(1);
            fetchStock(1, 1);
          }}
        >
          筛选
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setKeyword("");
            setStatus("all");
            setWarehouseIdFilter("");
            setRackFilter("");
            setSlotIdFilter("");
            setItemFilter("");
            setOperatorFilter("");
          }}
        >
          重置
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
                {slotRows.map((row) => (
                  <TableRow key={`${row.slot_code}-${row.item_code}`}>
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-slate-900"
                        checked={selectedStockKey === `${row.item_code}|${row.slot_code}`}
                        disabled={row.qty <= 0}
                        onChange={(event) => {
                          const key = `${row.item_code}|${row.slot_code}`;
                          if (event.target.checked) {
                            setSelectedStockKey(key);
                          } else if (selectedStockKey === key) {
                            setSelectedStockKey("");
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
                            const key = `${row.item_code}|${row.slot_code}`;
                            setSelectedStockKey(key);
                            applyStockRow(row, "outbound");
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
                                const key = `${row.item_code}|${row.slot_code}`;
                                setSelectedStockKey(key);
                                applyStockRow(row, "move");
                              }}
                            >
                              移库
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                const key = `${row.item_code}|${row.slot_code}`;
                                setSelectedStockKey(key);
                                applyStockRow(row, "count");
                              }}
                            >
                              盘点
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                navigate(`/txns?slot_code=${encodeURIComponent(row.slot_code)}`);
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
                {!loading && slotRows.length === 0 ? (
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
                共 {totalSlot} 条，当前第 {pageIndexSlot}/{Math.max(1, Math.ceil(totalSlot / pageSize))} 页
              </p>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setPageIndexSlot((prev) => Math.max(1, prev - 1));
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      const totalPages = Math.max(1, Math.ceil(totalSlot / pageSize));
                      setPageIndexSlot((prev) => Math.min(totalPages, prev + 1));
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
                {slotRows.map((row) => (
                  <TableRow key={`${row.item_code}-${row.slot_code}`}>
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-slate-900"
                        checked={selectedStockKey === `${row.item_code}|${row.slot_code}`}
                        disabled={row.qty <= 0}
                        onChange={(event) => {
                          const key = `${row.item_code}|${row.slot_code}`;
                          if (event.target.checked) {
                            setSelectedStockKey(key);
                          } else if (selectedStockKey === key) {
                            setSelectedStockKey("");
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
                            const key = `${row.item_code}|${row.slot_code}`;
                            setSelectedStockKey(key);
                            applyStockRow(row, "outbound");
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
                                const key = `${row.item_code}|${row.slot_code}`;
                                setSelectedStockKey(key);
                                applyStockRow(row, "move");
                              }}
                            >
                              移库
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                const key = `${row.item_code}|${row.slot_code}`;
                                setSelectedStockKey(key);
                                applyStockRow(row, "count");
                              }}
                            >
                              盘点
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                navigate(`/txns?slot_code=${encodeURIComponent(row.slot_code)}`);
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
                {!loading && itemRows.length === 0 ? (
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
                共 {totalItem} 条，当前第 {pageIndexItem}/{Math.max(1, Math.ceil(totalItem / pageSize))} 页
              </p>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setPageIndexItem((prev) => Math.max(1, prev - 1));
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      const totalPages = Math.max(1, Math.ceil(totalItem / pageSize));
                      setPageIndexItem((prev) => Math.min(totalPages, prev + 1));
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
