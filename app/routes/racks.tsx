import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { PageHeader } from "~/components/common/page-header";
import { Button } from "~/components/ui/button";
import { ConfirmButton } from "~/components/common/confirm-button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "~/components/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { WarehousePicker } from "~/components/common/pickers/warehouse-picker";
import { getSession } from "~/lib/auth";
import { tauriInvoke } from "~/lib/tauri";
import { toast } from "sonner";

type RackRow = {
  id: string;
  code: string;
  name: string;
  warehouse_id?: string | null;
  location?: string | null;
  status: string;
  level_count: number;
  slots_per_level: number;
  created_at: number;
};

type RackListResult = {
  items: RackRow[];
  total: number;
};

type SlotRow = {
  id: string;
  rack_id: string;
  level_no: number;
  slot_no: number;
  code: string;
  status: string;
  created_at: number;
};

type SlotListResult = {
  items: SlotRow[];
};

type RackFormValues = {
  warehouseId: string;
  codeSuffix: string;
  name: string;
  location: string;
  levelCount: string;
  slotsPerLevel: string;
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

export default function RacksPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<RackRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editRack, setEditRack] = useState<RackRow | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [slotOpen, setSlotOpen] = useState(false);
  const [slotRows, setSlotRows] = useState<SlotRow[]>([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotLevel, setSlotLevel] = useState("");
  const [activeRack, setActiveRack] = useState<RackRow | null>(null);
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const form = useForm<RackFormValues>({
    defaultValues: {
      warehouseId: "",
      codeSuffix: "",
      name: "",
      location: "",
      levelCount: "",
      slotsPerLevel: "",
    },
  });

  const fetchRacks = async (page = pageIndex, keywordValue = keyword, statusValue = status, warehouseId = warehouseFilter) => {
    setLoading(true);
    try {
      const trimmed = keywordValue?.trim();
      const normalizedStatus = statusValue === "all" ? undefined : statusValue;
      const result = await tauriInvoke<RackListResult>("list_racks", {
        input: { keyword: trimmed || undefined, status: normalizedStatus, warehouse_id: warehouseId || undefined, page_index: page, page_size: pageSize },
      });
      setRows(result.items);
      setTotal(result.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载失败";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const result = await tauriInvoke<WarehouseListResult>("list_warehouses", {
        input: {
          page_index: 1,
          page_size: 200,
        },
      });
      setWarehouses(result.items);
    } catch {
      setWarehouses([]);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchRacks(pageIndex, keyword, status, warehouseFilter);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [pageIndex, keyword, status, warehouseFilter]);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    const warehouseIdParam = searchParams.get("warehouse_id");
    if (warehouseIdParam) {
      setWarehouseFilter(warehouseIdParam);
      // trigger a fetch for that warehouse filter
      void fetchRacks(1, keyword, status, warehouseIdParam);
    }
  }, [searchParams]);

  const resetForm = () => {
    form.reset({
      warehouseId: "",
      codeSuffix: "",
      name: "",
      location: "",
      levelCount: "",
      slotsPerLevel: "",
    });
  };

  const warehouseId = form.watch("warehouseId");
  const codeSuffix = form.watch("codeSuffix");
  const normalizeSuffix = (value: string) => value.trim().replace(/^R+/i, "").replace(/\D/g, "");
  const formatSuffix = (value: string) => {
    const digits = normalizeSuffix(value);
    return digits ? digits.padStart(2, "0") : "";
  };
  const formattedSuffix = formatSuffix(codeSuffix || "");
  const rackCode = formattedSuffix ? `R${formattedSuffix}` : "";
  const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
  const warehouseLabel = (id?: string | null) => {
    if (!id) return "-";
    const warehouse = warehouseMap.get(id);
    if (!warehouse) return "-";
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{warehouse.code}</Badge>
        <span className="truncate">{warehouse.name}</span>
      </div>
    );
  };
  const availableWarehouses = warehouses.filter((warehouse) => warehouse.status === "active" || warehouse.id === warehouseId);

  const handleCreate = async (values: RackFormValues) => {
    const formattedCode = formatSuffix(values.codeSuffix);
    const rackCode = formattedCode ? `R${formattedCode}` : "";
    const normalizedName = values.name.trim() || rackCode;
    try {
      await tauriInvoke("create_rack", {
        input: {
          code: rackCode,
          name: normalizedName,
          warehouse_id: values.warehouseId,
          location: values.location.trim() ? values.location.trim() : null,
          level_count: Number(values.levelCount),
          slots_per_level: Number(values.slotsPerLevel),
        },
      });
      toast.success("货架创建成功");
      setFormOpen(false);
      resetForm();
      await fetchRacks();
    } catch (err) {
      const message = err instanceof Error ? err.message : "创建失败";
      toast.error(message);
    }
  };

  const handleUpdate = async (values: RackFormValues) => {
    if (!editRack) return;

    const normalizedName = values.name.trim() || editRack.code;
    try {
      await tauriInvoke("update_rack", {
        input: {
          id: editRack.id,
          name: normalizedName,
          warehouse_id: values.warehouseId,
          location: values.location.trim() ? values.location.trim() : null,
          level_count: Number(values.levelCount),
          slots_per_level: Number(values.slotsPerLevel),
        },
      });
      toast.success("货架更新成功");
      setFormOpen(false);
      setEditRack(null);
      resetForm();
      await fetchRacks();
    } catch (err) {
      const message = err instanceof Error ? err.message : "更新失败";
      toast.error(message);
    }
  };

  const openCreate = () => {
    setEditRack(null);
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (row: RackRow) => {
    setEditRack(row);
    form.reset({
      codeSuffix: row.code.replace(/^R+/i, ""),
      name: row.name,
      warehouseId: row.warehouse_id || "",
      location: row.location || "",
      levelCount: String(row.level_count),
      slotsPerLevel: String(row.slots_per_level),
    });
    setFormOpen(true);
  };

  const handleToggleStatus = async (row: RackRow) => {
    const nextStatus = row.status === "active" ? "inactive" : "active";
    try {
      await tauriInvoke("set_rack_status", {
        input: {
          id: row.id,
          status: nextStatus,
        },
      });
      toast.success("状态更新成功");
      await fetchRacks();
    } catch (err) {
      const message = err instanceof Error ? err.message : "更新失败";
      toast.error(message);
    }
  };

  const fetchSlots = async (rackId: string, levelNo?: number) => {
    setSlotLoading(true);
    try {
      const result = await tauriInvoke<SlotListResult>("list_slots", {
        query: {
          rack_id: rackId,
          level_no: levelNo,
        },
      });
      setSlotRows(result.items);
    } catch (err) {
      const message = err instanceof Error ? err.message : "加载库位失败";
      toast.error(message);
    } finally {
      setSlotLoading(false);
    }
  };

  const openSlots = async (row: RackRow) => {
    setActiveRack(row);
    setSlotLevel("");
    setSlotOpen(true);
    await fetchSlots(row.id);
  };

  const handleSlotFilter = async () => {
    if (!activeRack) return;
    const levelNo = slotLevel ? Number(slotLevel) : undefined;
    await fetchSlots(activeRack.id, levelNo);
  };

  const handleSlotStatus = async (slot: SlotRow) => {
    const nextStatus = slot.status === "active" ? "inactive" : "active";
    try {
      await tauriInvoke("set_slot_status", {
        input: {
          slot_id: slot.id,
          status: nextStatus,
        },
      });
      toast.success("库位状态更新成功");
      if (activeRack) {
        await fetchSlots(activeRack.id, slotLevel ? Number(slotLevel) : undefined);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "更新库位失败";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="货架结构"
        description="维护货架与层/位配置，支持停用与再生 Slot。"
        actions={
          <Dialog
            open={formOpen}
            onOpenChange={(open) => {
              setFormOpen(open);
              if (!open) {
                setEditRack(null);
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={openCreate}>新增货架</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editRack ? "编辑货架" : "新增货架"}</DialogTitle>
                <DialogDescription>{editRack ? "调整货架层数与格数" : "填写货架基本信息"}</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void form.handleSubmit(editRack ? handleUpdate : handleCreate)();
                  }}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="warehouseId"
                    rules={{
                      validate: (value) => (value ? true : "请选择仓库"),
                    }}
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel>所属仓库</FormLabel>
                        <FormControl>
                          <WarehousePicker value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-2 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="codeSuffix"
                      rules={{
                        validate: (value) => {
                          if (editRack) return true;
                          const trimmed = value.trim().replace(/^R+/i, "");
                          if (!trimmed) return "请输入货架编号";
                          if (!/^\d+$/.test(trimmed)) return "货架编号只能输入数字";
                          if (Number(trimmed) <= 0) return "货架编号必须大于 0";
                          return true;
                        },
                      }}
                      render={({ field }) => (
                        <FormItem className="grid gap-2">
                          <FormLabel htmlFor="rack-code">货架编号</FormLabel>
                          <FormControl>
                            <Input id="rack-code" placeholder="例如 04" disabled={!!editRack} type="number" min={1} inputMode="numeric" pattern="[0-9]*" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="name"
                      rules={{
                        validate: () => true,
                      }}
                      render={({ field }) => (
                        <FormItem className="grid gap-2">
                          <FormLabel htmlFor="rack-name">货架名称</FormLabel>
                          <FormControl>
                            <Input id="rack-name" placeholder="新建货架" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <p className="text-xs text-slate-500">完整编号：{rackCode || "R"}</p>
                  <FormField
                    control={form.control}
                    name="location"
                    rules={{
                      validate: () => true,
                    }}
                    render={({ field }) => (
                      <FormItem className="grid gap-2">
                        <FormLabel htmlFor="rack-location">货架位置</FormLabel>
                        <FormControl>
                          <Input id="rack-location" placeholder="例如 A区-1排" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="levelCount"
                      rules={{
                        validate: (value) => (Number(value) > 0 ? true : "请输入有效层数"),
                      }}
                      render={({ field }) => (
                        <FormItem className="grid gap-2">
                          <FormLabel htmlFor="rack-level">层数</FormLabel>
                          <FormControl>
                            <Input id="rack-level" placeholder="例如 4" type="number" min={1} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="slotsPerLevel"
                      rules={{
                        validate: (value) => (Number(value) > 0 ? true : "请输入有效格数"),
                      }}
                      render={({ field }) => (
                        <FormItem className="grid gap-2">
                          <FormLabel htmlFor="rack-slot">每层格数</FormLabel>
                          <FormControl>
                            <Input id="rack-slot" placeholder="例如 12" type="number" min={1} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <ConfirmButton className="w-full" label="保存" confirmText={editRack ? "确认保存货架变更？" : "确认创建货架？"} onBeforeConfirmOpen={() => form.trigger()} onConfirm={() => form.handleSubmit(editRack ? handleUpdate : handleCreate)()} />
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="space-y-6">
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
          <div className="min-w-[180px] max-w-[180px] flex-1 space-y-2">
            <Label>仓库</Label>
            <WarehousePicker value={warehouseFilter} onChange={(v) => setWarehouseFilter(v)} placeholder="全部" />
          </div>
          <div className="min-w-[140px] w-[140px] max-w-[140px] flex-1 space-y-2">
            <Label>关键词</Label>
            <Input placeholder="搜索货架编号或名称" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
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
          <Button
            variant="outline"
            onClick={() => {
              setPageIndex(1);
              void fetchRacks(1, keyword, status, warehouseFilter);
            }}
          >
            筛选
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setKeyword("");
              setStatus("all");
              setWarehouseFilter("");
              setPageIndex(1);
              void fetchRacks(1, "", "all", "");
            }}
          >
            重置
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>货架编号</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>仓库</TableHead>
              <TableHead>位置</TableHead>
              <TableHead>层数</TableHead>
              <TableHead>每层格数</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead className="text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.code}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{warehouseLabel(row.warehouse_id)}</TableCell>
                <TableCell>{row.location || "-"}</TableCell>
                <TableCell>{row.level_count}</TableCell>
                <TableCell>{row.slots_per_level}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "active" ? "secondary" : "outline"}>{row.status === "active" ? "启用" : "停用"}</Badge>
                </TableCell>
                <TableCell>{new Date(row.created_at * 1000).toLocaleString()}</TableCell>
                <TableCell className="text-center">
                  <Button variant="ghost" size="sm" onClick={() => openSlots(row)}>
                    查看库位
                  </Button>
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
                          navigate(`/stock?tab=slot&rack_id=${encodeURIComponent(row.id)}`);
                        }}
                      >
                        查看库存
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          navigate(`/txns?rack_id=${encodeURIComponent(row.id)}`);
                        }}
                      >
                        查看流水
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleStatus(row)}>{row.status === "active" ? "停用" : "启用"}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {!loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-slate-500">
                  暂无货架数据
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <Dialog open={slotOpen} onOpenChange={setSlotOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>库位详情</DialogTitle>
            <DialogDescription>
              {activeRack ? (
                <span className="inline-flex items-center gap-2">
                  <Badge variant="secondary">{activeRack.code}</Badge>
                  <span className="truncate">{activeRack.name}</span>
                </span>
              ) : (
                "库位列表"
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
            <div className="min-w-[140px] space-y-2">
              <Label>层号</Label>
              <Input placeholder="例如 1" value={slotLevel} onChange={(event) => setSlotLevel(event.target.value)} />
            </div>
            <Button variant="outline" onClick={handleSlotFilter}>
              筛选
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSlotLevel("");
                if (activeRack) {
                  fetchSlots(activeRack.id);
                }
              }}
            >
              重置
            </Button>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>库位编号</TableHead>
                  <TableHead>层号</TableHead>
                  <TableHead>格号</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-center">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slotRows.map((slot) => (
                  <TableRow key={slot.id}>
                    <TableCell className="font-medium">{slot.code}</TableCell>
                    <TableCell>{slot.level_no}</TableCell>
                    <TableCell>{slot.slot_no}</TableCell>
                    <TableCell>
                      <Badge variant={slot.status === "active" ? "secondary" : "outline"}>{slot.status === "active" ? "启用" : "停用"}</Badge>
                    </TableCell>
                    <TableCell>{new Date(slot.created_at * 1000).toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            更多
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              navigate(`/stock?tab=slot&slot_id=${encodeURIComponent(slot.id)}`);
                            }}
                          >
                            查看库存
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              navigate(`/txns?slot_id=${encodeURIComponent(slot.id)}`);
                            }}
                          >
                            查看流水
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleSlotStatus(slot)}>{slot.status === "active" ? "停用" : "启用"}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {!slotLoading && slotRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-500">
                      暂无库位数据
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

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
                  event.preventDefault();
                  setPageIndex((prev) => Math.max(1, prev - 1));
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  const totalPages = Math.max(1, Math.ceil(total / pageSize));
                  setPageIndex((prev) => Math.min(totalPages, prev + 1));
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  );
}
